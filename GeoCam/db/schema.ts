// db/schema.ts
// Semana 7 – Trabajo para la casa + Semana 8 – columnas para la nube + Semana 9 – sync_meta.
// C1: tabla albums + photos.albumId (llave foránea opcional, set null al borrar el álbum).
// C2: columnas note y favorite en photos (segunda migración).
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

  // C1: opcional. Al borrar el álbum, la foto queda sin álbum (no se borra)
  albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }),

  // C2: segunda migración
  note: text('note'),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),

  // Semana 8 (T4): columnas para la nube. Son opcionales porque SQLite no permite
  // agregar una columna obligatoria sin valor constante a una tabla que ya tiene filas.
  // Identidad compartida con la nube: el id autoincremental solo vale en este teléfono
  clientId: text('client_id').unique().$defaultFn(() => randomUUID()),
  // Última modificación hecha por el usuario
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  // Ruta del archivo en el bucket y versión que quedó sincronizada
  remotePath: text('remote_path'),
  syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
  // Semana 9 (C1): Borrado lógico sincronizado
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

// Semana 9 (T3): datos de la sincronización, como el cursor de bajada de cada usuario
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Album = typeof albums.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
