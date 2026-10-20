import type { GeoPhoto } from "@/types/geo";
import { createContext, ReactNode, useContext, useState } from "react";

interface GeoPhotosContextType {
  photos: GeoPhoto[];
  addPhoto: (photo: GeoPhoto) => void;
  removePhoto: (id: string) => void;
  clearAll: () => void;
}

const GeoPhotosContext = createContext<GeoPhotosContextType | undefined>(
  undefined,
);

export function GeoPhotosProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<GeoPhoto[]>([]);

  const addPhoto = (photo: GeoPhoto) => {
    setPhotos((prev) => [photo, ...prev]);
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const clearAll = () => {
    setPhotos([]);
  };

  return (
    <GeoPhotosContext.Provider
      value={{ photos, addPhoto, removePhoto, clearAll }}
    >
      {children}
    </GeoPhotosContext.Provider>
  );
}

export function useGeoPhotos(): GeoPhotosContextType {
  const context = useContext(GeoPhotosContext);
  if (!context) {
    throw new Error(
      "useGeoPhotos debe ser utilizado dentro de un GeoPhotosProvider",
    );
  }
  return context;
}
