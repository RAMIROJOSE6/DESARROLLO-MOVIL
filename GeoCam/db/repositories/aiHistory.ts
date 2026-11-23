// db/repositories/aiHistory.ts
// Semana 10 (C1): Repositorio para persistir en SQLite el historial de consultas de IA sobre las fotos.
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { aiHistory, type NewAiHistoryItem } from '@/db/schema';

export const aiHistoryRepo = {
  byPhotoQuery(photoId: number) {
    return db
      .select()
      .from(aiHistory)
      .where(eq(aiHistory.photoId, photoId))
      .orderBy(desc(aiHistory.createdAt));
  },

  async listByPhoto(photoId: number) {
    return await aiHistoryRepo.byPhotoQuery(photoId);
  },

  async save(data: NewAiHistoryItem) {
    await db.insert(aiHistory).values(data);
  },

  async clearByPhoto(photoId: number) {
    await db.delete(aiHistory).where(eq(aiHistory.photoId, photoId));
  },
};
