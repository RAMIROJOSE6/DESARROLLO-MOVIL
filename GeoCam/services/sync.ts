// services/sync.ts
// Semana 9: sincronización en dos sentidos entre SQLite (fuente de verdad) y Supabase.
// Diseño: 1) bajar lo que cambió en la nube, 2) subir lo pendiente. Conflictos: gana el último cambio.
import { supabase } from '@/lib/supabase';
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import { BUCKET } from '@/services/cloudPhotos';
import { downloadPhotoFile } from '@/services/photoFiles';

interface RemotePhoto {
  client_id: string;
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  taken_at: string;
  updated_at: string; // reloj del teléfono: decide conflictos
  server_updated_at?: string; // reloj del servidor: cursor de bajada
  deleted_at?: string | null; // C1: borrado lógico
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  finishedAt: number;
}

/** Gana el último cambio. Con fechas iguales no gana nadie: ya están sincronizados. */
export function remoteWins(localUpdatedAt: Date | null, remoteUpdatedAt: string): boolean {
  return new Date(remoteUpdatedAt).getTime() > (localUpdatedAt?.getTime() ?? 0);
}

/** Una foto está pendiente si nunca se subió o si se editó después de la última subida. */
export function isPending(photo: { syncedAt: Date | null; updatedAt: Date | null }): boolean {
  if (!photo.syncedAt) return true;
  return (photo.updatedAt?.getTime() ?? 0) > photo.syncedAt.getTime();
}

/** Bajar: solo lo que llegó al servidor después del cursor. */
async function pull(userId: string): Promise<number> {
  const cursorKey = `lastPulledAt:${userId}`;
  const since = (await syncMetaRepo.get(cursorKey)) ?? '1970-01-01T00:00:00Z';

  let { data, error } = await supabase
    .from('photos')
    .select('*')
    .gt('server_updated_at', since)
    .order('server_updated_at', { ascending: true })
    .limit(200);

  // Fallback de resiliencia si server_updated_at aún no se ha creado en Supabase
  if (error && /server_updated_at/i.test(error.message)) {
    console.warn('[pull] server_updated_at no detectado en Supabase, aplicando fallback con updated_at');
    const fallback = await supabase
      .from('photos')
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(200);
    if (!fallback.error) {
      data = fallback.data;
      error = null;
    }
  }

  if (error) throw error;

  let applied = 0;
  for (const remote of data as RemotePhoto[]) {
    const local = await photosRepo.findByClientId(remote.client_id);
    const remoteUpdatedAt = new Date(remote.updated_at);

    // C1: Si la foto fue borrada en otro teléfono
    if (remote.deleted_at) {
      if (local && remoteWins(local.updatedAt, remote.updated_at)) {
        await photosRepo.hardDelete(local.id);
        applied++;
      }
      const cursorTimestamp = remote.server_updated_at || remote.updated_at;
      if (cursorTimestamp) {
        await syncMetaRepo.set(cursorKey, cursorTimestamp);
      }
      continue;
    }

    if (!local) {
      // Foto creada en otro teléfono: se descarga el archivo y se crea la fila local
      const uri = await downloadPhotoFile(remote.storage_path, remote.client_id);
      await photosRepo.insertFromRemote({
        clientId: remote.client_id,
        uri,
        latitude: remote.latitude,
        longitude: remote.longitude,
        note: remote.note,
        favorite: remote.favorite,
        source: remote.source,
        createdAt: new Date(remote.taken_at),
        updatedAt: remoteUpdatedAt,
        remotePath: remote.storage_path,
        syncedAt: remoteUpdatedAt, // nace sincronizada
      });
      applied++;
    } else if (remoteWins(local.updatedAt, remote.updated_at)) {
      // La versión de la nube es más nueva: se aplica en local
      await photosRepo.applyRemote(local.id, {
        note: remote.note,
        favorite: remote.favorite,
        updatedAt: remoteUpdatedAt,
        syncedAt: remoteUpdatedAt,
      });
      applied++;
    }
    // Si la versión local es más nueva no se toca: push la subirá enseguida

    // El cursor avanza fila por fila: si algo falla, el siguiente intento continúa desde aquí
    const cursorTimestamp = remote.server_updated_at || remote.updated_at;
    if (cursorTimestamp) {
      await syncMetaRepo.set(cursorKey, cursorTimestamp);
    }
  }
  return applied;
}

/** Subir: todo lo pendiente, de forma que repetirlo no duplique nada (idempotente). */
async function push(userId: string): Promise<number> {
  const pending = await photosRepo.listPending();
  let pushedCount = 0;

  for (const photo of pending) {
    if (!photo.clientId) continue; // ensureSyncFields() debió rellenarlo
    const path = photo.remotePath ?? `${userId}/${photo.clientId}.jpg`;
    const updatedAt = photo.updatedAt ?? photo.createdAt;

    try {
      // C1: Si la foto fue borrada localmente, sube la marca de borrado y elimina de storage
      if (photo.deletedAt) {
        await supabase.from('photos').upsert(
          {
            client_id: photo.clientId,
            storage_path: path,
            latitude: photo.latitude,
            longitude: photo.longitude,
            note: photo.note,
            favorite: photo.favorite,
            source: photo.source,
            taken_at: photo.createdAt.toISOString(),
            updated_at: updatedAt.toISOString(),
            deleted_at: photo.deletedAt.toISOString(),
          },
          { onConflict: 'client_id' }
        );
        await supabase.storage.from(BUCKET).remove([path]);
        await photosRepo.hardDelete(photo.id);
        pushedCount++;
        continue;
      }

      // 1. El archivo solo se sube la primera vez
      if (!photo.remotePath) {
        const arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
        // "ya existe": un intento anterior subió el archivo pero no alcanzó a guardar la fila
        if (error && !/exists/i.test(error.message)) throw error;
      }

      // 2. upsert por client_id: crea la fila o la actualiza, nunca la duplica
      const { error } = await supabase.from('photos').upsert(
        {
          client_id: photo.clientId,
          storage_path: path,
          latitude: photo.latitude,
          longitude: photo.longitude,
          note: photo.note,
          favorite: photo.favorite,
          source: photo.source,
          taken_at: photo.createdAt.toISOString(),
          updated_at: updatedAt.toISOString(),
        },
        { onConflict: 'client_id' }
      );
      if (error) throw error;

      // 3. syncedAt = la versión que se subió, no "ahora".
      //    Si el usuario editó la foto mientras subía, su updatedAt es posterior y sigue pendiente.
      await photosRepo.markSynced(photo.id, path, updatedAt);
      pushedCount++;
    } catch (photoError) {
      // C5: Si una foto falla al subir, las demás continúan. La fallida queda pendiente para el siguiente ciclo.
      console.warn(`[sync:push] Error al subir foto id ${photo.id} (${photo.clientId}):`, photoError);
    }
  }
  return pushedCount;
}

async function runSync(userId: string): Promise<SyncResult> {
  let pulled = 0;
  let pushed = 0;
  // Si hubo ediciones durante el ciclo, se repite (máximo 3 vueltas) para no dejarlas esperando
  for (let round = 0; round < 3; round++) {
    pulled += await pull(userId); // primero bajar...
    const pushedNow = await push(userId); // ...después subir
    pushed += pushedNow;
    if (pushedNow === 0) break;
    if ((await photosRepo.listPending()).length === 0) break;
  }
  return { pulled, pushed, finishedAt: Date.now() };
}

// Un solo ciclo a la vez: si llega otra petición mientras hay uno en curso, se reutiliza
let running: Promise<SyncResult> | null = null;

/** Un ciclo completo de sincronización. Seguro de llamar varias veces seguidas. */
export function syncAll(userId: string): Promise<SyncResult> {
  if (!running) {
    running = runSync(userId).finally(() => {
      running = null;
    });
  }
  return running;
}
