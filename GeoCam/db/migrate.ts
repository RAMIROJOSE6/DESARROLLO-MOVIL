import type { SQLiteDatabase } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "@/drizzle/migrations";
import { photosRepo } from "./repositories/photos";

/** Versioned, local schema migration run by SQLiteProvider before rendering. */
export async function migrateDatabase(database: SQLiteDatabase) {
  await database.execAsync("PRAGMA journal_mode = WAL;");
  await migrate(drizzle(database), migrations);
  await photosRepo.ensureSyncFields();
}
