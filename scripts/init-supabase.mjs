import { ensurePostgresSchema, loadDb, saveDb } from "../lib/platform.js";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Use the Supabase transaction pooler connection string.");
  process.exit(1);
}

await ensurePostgresSchema();
const db = await loadDb();
await saveDb(db);

console.log("Supabase app_state table is ready and seeded.");
