import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { eq, isNull, or, desc } from "drizzle-orm";
import * as Crypto from "expo-crypto";
import { geoPhotos, type Photo } from "@/db/schema";

const sqlite = openDatabaseSync("geocam.db");
export const db = drizzle(sqlite, { schema: { geoPhotos } });

export const photosRepo = {
  /**
   * Rellena clientId y updatedAt para fotos creadas antes de la migración de la Semana 8.
   */
  async ensureSyncFields() {
    try {
      const rows = await db.select().from(geoPhotos).where(isNull(geoPhotos.clientId));
      for (const row of rows) {
        await db
          .update(geoPhotos)
          .set({
            clientId: Crypto.randomUUID(),
            updatedAt: row.updatedAt ?? new Date(row.createdAt),
          })
          .where(eq(geoPhotos.id, row.id));
      }
    } catch (e) {
      console.warn("ensureSyncFields error:", e);
    }
  },

  /**
   * Marca la foto local como sincronizada sin tocar updatedAt (para que no vuelva a quedar pendiente).
   */
  async markSynced(id: string, remotePath: string) {
    await db
      .update(geoPhotos)
      .set({
        remotePath,
        syncedAt: new Date(),
      })
      .where(eq(geoPhotos.id, id));
  },

  async getById(id: string): Promise<Photo | null> {
    const [row] = await db.select().from(geoPhotos).where(eq(geoPhotos.id, id));
    return row ?? null;
  },

  /**
   * C5: Lista fotos locales por el usuario autenticado (incluye fotos previas sin dueño si aplica).
   */
  async listByOwner(ownerId?: string | null): Promise<Photo[]> {
    if (!ownerId) {
      return db.select().from(geoPhotos).orderBy(desc(geoPhotos.createdAt));
    }
    return db
      .select()
      .from(geoPhotos)
      .where(or(eq(geoPhotos.ownerId, ownerId), isNull(geoPhotos.ownerId)))
      .orderBy(desc(geoPhotos.createdAt));
  },

  /**
   * C1: Devuelve fotos locales con syncedAt nulo o anterior a updatedAt.
   */
  async getPendingPhotos(ownerId?: string | null): Promise<Photo[]> {
    const all = await this.listByOwner(ownerId);
    return all.filter((photo) => {
      if (!photo.syncedAt) return true;
      if (photo.updatedAt && photo.syncedAt.getTime() < photo.updatedAt.getTime()) return true;
      return false;
    });
  },

  /**
   * Actualiza metadatos de la foto (nota, favorita) y renueva updatedAt.
   */
  async update(id: string, updates: Partial<{ note: string | null; favorite: boolean; ownerId: string }>) {
    await db
      .update(geoPhotos)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(geoPhotos.id, id));
  },

  async delete(id: string) {
    await db.delete(geoPhotos).where(eq(geoPhotos.id, id));
  },
};
