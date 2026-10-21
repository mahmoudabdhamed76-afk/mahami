import { prisma } from "@/server/db";
import { hub } from "@/server/realtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "up", streams: hub.connections, time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
