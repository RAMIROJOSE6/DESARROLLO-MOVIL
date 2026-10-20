import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const generateUUID = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const geoPhotos = sqliteTable("geo_photos", {
  id: text("id").primaryKey().notNull(),
  uri: text("uri").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  accuracy: real("accuracy"),
  coordinateTimestamp: integer("coordinate_timestamp"),
  source: text("source", { enum: ["camera", "gallery"] }).notNull(),
  createdAt: integer("created_at").notNull(),

  // Columnas Tarea C2 Semana 7 (note y favorite)
  note: text("note"),
  favorite: integer("favorite", { mode: "boolean" }).default(false),

  // Columnas T4 Semana 8
  clientId: text("client_id").$defaultFn(generateUUID),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
  remotePath: text("remote_path"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }),

  // Columna C5 Trabajo para la casa (separación por usuario)
  ownerId: text("owner_id"),
});

export const photos = geoPhotos;
export type Photo = typeof geoPhotos.$inferSelect;
export type NewPhoto = typeof geoPhotos.$inferInsert;
export type GeoPhotoRow = Photo;
export type NewGeoPhotoRow = NewPhoto;
