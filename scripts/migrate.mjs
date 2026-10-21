// Applies prisma/migrations/*/migration.sql in order and records them in the
// standard `_prisma_migrations` table — fully compatible with `prisma migrate
// deploy`, but needs no native engine download (works on locked-down hosts).
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import pg from "pg";

const dir = path.resolve("prisma/migrations");
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const schema = process.env.DB_SCHEMA;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (schema) {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema.replace(/"/g, "")}"`).catch(() => {});
    await client.query(`SET search_path TO "${schema.replace(/"/g, "")}"`);
  }
  await client.query("SELECT pg_advisory_lock(72707369)");
  await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
  const { rows } = await client.query(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`);
  const applied = new Set(rows.map((r) => r.migration_name));
  const names = (await readdir(dir, { withFileTypes: true }))
    .filter((d) => d.isDirectory()).map((d) => d.name).sort();
  let count = 0;
  for (const name of names) {
    if (applied.has(name)) continue;
    const sql = await readFile(path.join(dir, name, "migration.sql"), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const id = randomUUID();
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1,$2,$3,now(),1)`,
        [id, checksum, name]);
      await client.query("COMMIT");
      console.log(`✔ applied ${name}`);
      count++;
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${name} failed: ${e.message}`);
    }
  }
  console.log(count ? `Done — ${count} migration(s) applied.` : "Database is up to date.");
} finally {
  await client.end();
}
