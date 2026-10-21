// Zero-install local PostgreSQL for development (Windows / macOS / Linux).
// Usage: npm run db:local   → starts Postgres on port 5433 with data in ./.pgdata
// Then set DATABASE_URL="postgresql://mahami:mahami@localhost:5433/mahami" in .env
let EmbeddedPostgres;
try { ({ default: EmbeddedPostgres } = await import("embedded-postgres")); }
catch { console.error("Run once: npm install --no-save embedded-postgres"); process.exit(1); }
import { existsSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(".pgdata");
const fresh = !existsSync(process.env.PGDATA_DIR ? path.resolve(process.env.PGDATA_DIR) : dir);
const pg = new EmbeddedPostgres({
  databaseDir: process.env.PGDATA_DIR ? path.resolve(process.env.PGDATA_DIR) : dir,
  user: "mahami", password: "mahami", port: Number(process.env.PGPORT_LOCAL ?? 5433), persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("mahami").catch(() => {});
console.log('\n✔ PostgreSQL is running on port 5433');
console.log('  DATABASE_URL="postgresql://mahami:mahami@localhost:5433/mahami"');
console.log('  Press Ctrl+C to stop.\n');

const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
