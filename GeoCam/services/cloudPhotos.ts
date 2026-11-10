// services/cloudPhotos.ts
// Acceso y consulta de fotos en la nube con Supabase.
// C2: Paginación por cursor para TanStack Query (useInfiniteQuery).
import { supabase } from '@/lib/supabase';

export const BUCKET = 'geocam';
export const PAGE_SIZE = 10;

export interface RemotePhotoItem {
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
  server_updated_at?: string;
  created_at: string;
}

export interface CloudPhotosPage {
  items: RemotePhotoItem[];
  nextCursor: string | null;
}

/** URL temporal para ver o descargar un archivo de un bucket privado. */
export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** C2: Servicio paginado con búsqueda por cursor en Supabase. */
export async function listCloudPhotosPage(params: {
  cursor: string | null;
  search: string;
}): Promise<CloudPhotosPage> {
  let query = supabase
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  // Paginación por cursor: registros anteriores al último cargado
  if (params.cursor) {
    query = query.lt('created_at', params.cursor);
  }

  const term = params.search.trim();
  if (term) {
    query = query.ilike('note', `%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const items = (data ?? []) as RemotePhotoItem[];
  return {
    items,
    nextCursor: items.length === PAGE_SIZE ? items[items.length - 1].created_at : null,
  };
}
