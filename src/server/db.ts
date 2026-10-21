import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const g = globalThis as unknown as { __prisma?: PrismaClient };

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // DB_SCHEMA lets the app live in its own schema (e.g. on Supabase, away from the public API schema)
  const schema = process.env.DB_SCHEMA || undefined;
  const adapter = new PrismaPg(
    { connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10), idleTimeoutMillis: 10_000 },
    schema ? { schema } : undefined,
  );
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = g.__prisma ?? (g.__prisma = create());

/** Schema-qualified table name for raw SQL (honours DB_SCHEMA). */
export const table = (name: string) => {
  const schema = process.env.DB_SCHEMA;
  return Prisma.raw(schema ? `"${schema.replace(/"/g, "")}"."${name}"` : `"${name}"`);
};
