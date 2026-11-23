// db/schema.ts
// Semana 7 – Álbumes + Semana 8 – Nube + Semana 9 – Sincronización + Semana 10 – IA Multimodal.
import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

const randomUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uri: text('uri').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracy: real('accuracy'),
  source: text('source', { enum: ['camera', 'gallery'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),

  albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }),

  note: text('note'),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),

  // Semana 8 (T4): columnas para la nube
  clientId: text('client_id').unique().$defaultFn(() => randomUUID()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  remotePath: text('remote_path'),
  syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
  // Semana 9 (C1): Borrado lógico sincronizado
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),

  // Semana 10: IA Generativa Multimodal (T3)
  aiDescription: text('ai_description'),
  aiTags: text('ai_tags'),
});

// Semana 9 (T3): datos de la sincronización
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Semana 10 (C1): Historial persistente de descripciones y consultas de IA
export const aiHistory = sqliteTable('ai_history', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  photoId: integer('photo_id')
    .notNull()
    .references(() => photos.id, { onDelete: 'cascade' }),
  prompt: text('prompt'),
  response: text('response').notNull(),
  tags: text('tags'),
  tone: text('tone').default('natural'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Album = typeof albums.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type AiHistoryItem = typeof aiHistory.$inferSelect;
export type NewAiHistoryItem = typeof aiHistory.$inferInsert;
