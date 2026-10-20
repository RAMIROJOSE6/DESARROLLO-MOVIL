import { supabase } from '@/lib/supabase';
import { photosRepo } from '@/db/repositories/photos';
import type { Photo } from '@/db/schema';

export const BUCKET = 'geocam';

export interface RemotePhoto {
  id: number;
  user_id: string;
  client_id: string;
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  taken_at: string;
  updated_at: string;
  created_at: string;
  signedUrl?: string | null;
}

/**
 * T5 & C2: Sube una foto a Supabase Storage y su fila a PostgreSQL.
 * Previene duplicados con upsert y elimina el archivo del bucket si la inserción en la BD falla.
 */
export async function uploadPhoto(photo: Photo, userId: string): Promise<string> {
  if (!photo.clientId) {
    throw new Error('La foto no tiene clientId: ejecuta ensureSyncFields()');
  }

  // 1. Archivo local -> ArrayBuffer (requerido en React Native para no enviar 0 bytes)
  const arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());

  // 2. Ruta: <id del usuario>/<clientId>.jpg (exigido por las políticas RLS)
  const path = `${userId}/${photo.clientId}.jpg`;

  // Comprobar si ya existe fila remota
  const { data: existingRow } = await supabase
    .from('photos')
    .select('id, storage_path')
    .eq('client_id', photo.clientId)
    .maybeSingle();

  // Subir archivo al bucket geocam
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  // 3. Fila remota con metadatos
  const payload = {
    client_id: photo.clientId,
    storage_path: path,
    latitude: photo.latitude,
    longitude: photo.longitude,
    note: photo.note,
    favorite: Boolean(photo.favorite),
    source: photo.source,
    taken_at: new Date(photo.createdAt).toISOString(),
    updated_at: (photo.updatedAt ?? new Date(photo.createdAt)).toISOString(),
  };

  const { error: dbError } = existingRow
    ? await supabase.from('photos').update(payload).eq('client_id', photo.clientId)
    : await supabase.from('photos').insert(payload);

  if (dbError) {
    // C2: Si el archivo sube pero la fila falla, se borra del bucket antes de reportar el error
    if (!existingRow) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
    }
    throw dbError;
  }

  // 4. Marcar la foto local como sincronizada sin tocar updatedAt
  await photosRepo.markSynced(photo.id, path);

  return path;
}

/**
 * C1: Sube todas las fotos pendientes de sincronizar una por una.
 * Reporta el progreso (current, total) y retorna el total pendientes al final si alguna falla.
 */
export async function syncPendingPhotos(
  userId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ synced: number; failed: number; total: number }> {
  const pending = await photosRepo.getPendingPhotos(userId);
  const total = pending.length;
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const photo = pending[i];
    onProgress?.(i + 1, total);
    try {
      await uploadPhoto(photo, userId);
      synced++;
    } catch (err) {
      console.warn(`Error al subir foto ${photo.id}:`, err);
      failed++;
    }
  }

  return { synced, failed, total };
}

/**
 * C3: Borrado coherente. Al eliminar una foto sincronizada, se borran también su fila remota y su archivo.
 * Si falla la red, arroja excepción para no borrar a medias.
 */
export async function deleteCloudPhoto(photo: Photo): Promise<void> {
  if (!photo.clientId && !photo.remotePath) return;

  // 1. Borrar de la base de datos remota
  const { error: dbError } = await supabase
    .from('photos')
    .delete()
    .eq('client_id', photo.clientId);

  if (dbError) throw dbError;

  // 2. Borrar del bucket privado
  const path = photo.remotePath;
  if (path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([path]);
    if (storageError) {
      console.warn('Advertencia al borrar del storage:', storageError);
    }
  }
}

/**
 * URL temporal firmada para ver un archivo de un bucket privado (1 hora de vigencia).
 */
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * C4: Lista las fotos del usuario actual almacenadas en Supabase con URLs firmadas generadas.
 */
export async function listCloudPhotos(): Promise<RemotePhoto[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .order('taken_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  // Obtener URLs firmadas para cada imagen
  const photosWithUrls = await Promise.all(
    data.map(async (item: RemotePhoto) => {
      try {
        const url = await signedUrl(item.storage_path);
        return { ...item, signedUrl: url };
      } catch {
        return { ...item, signedUrl: null };
      }
    })
  );

  return photosWithUrls;
}
