// hooks/usePhotos.ts
// Fuente única de fotos para las pantallas: combina SQLite (repositorio) y archivos (servicio).
import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo, type PhotoChanges } from '@/db/repositories/photos';
import { deleteAllPhotoFiles, deletePhotoFile, persistPhoto } from '@/services/photoFiles';
import { requestSync } from '@/hooks/useSync';
import type { Coords } from '@/types/geo';

export type { Photo, Album } from '@/db/schema';

interface AddPhotoInput {
  uri: string;
  coords: Coords | null;
  source: 'camera' | 'gallery';
}

export function usePhotos() {
  const { data: photos, error } = useLiveQuery(photosRepo.listQuery());
  const { data: photosWithLocation } = useLiveQuery(photosRepo.withLocationQuery());
  const { data: photosWithoutLocation } = useLiveQuery(photosRepo.withoutLocationQuery());

  const addPhoto = useCallback(async ({ uri, coords, source }: AddPhotoInput) => {
    // C5: primero el archivo permanente, luego el registro con la nueva ruta
    const permanentUri = await persistPhoto(uri);
    try {
      await photosRepo.create({
        uri: permanentUri,
        source,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        accuracy: coords?.accuracy ?? null,
      });
    } catch (e) {
      deletePhotoFile(permanentUri); // si falla el INSERT, no dejamos archivos huérfanos
      throw e;
    }
    requestSync(); // Semana 9: la foto nueva queda pendiente y se pide subirla
  }, []);

  const updatePhoto = useCallback(async (id: number, changes: PhotoChanges) => {
    await photosRepo.update(id, changes); // escribe updatedAt: la foto queda pendiente
    requestSync();
  }, []);

  const removePhoto = useCallback(async (id: number) => {
    const photo = await photosRepo.findById(id);
    await photosRepo.remove(id);
    if (photo) deletePhotoFile(photo.uri); // C5: al borrar el registro, se borra el archivo
  }, []);

  const clearAll = useCallback(async () => {
    const uris = await photosRepo.allUris();
    await photosRepo.clearAll();
    uris.forEach(deletePhotoFile);
    deleteAllPhotoFiles();
  }, []);

  return {
    photos,
    photosWithLocation,
    photosWithoutLocation,
    lastPhoto: photos[0] ?? null,
    error,
    addPhoto,
    updatePhoto,
    removePhoto,
    clearAll,
  };
}
