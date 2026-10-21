import { prisma } from "@/server/db";
import { api, HttpError, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { uuid } from "@/lib/schemas";

const MAX = 6 * 1024 * 1024; // ~25 min of opus

/** PUT raw audio bytes for a voice note (idempotent, immutable per id). */
export const PUT = api(async (req, ctx) => {
  const user = await requireUser();
  const id = uuid.parse((await ctx.params).id);
  const mime = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^audio\/[\w.+-]+$/.test(mime)) throw new HttpError(415, "صيغة الصوت غير مدعومة");
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) throw new HttpError(400, "الملف فارغ");
  if (buf.length > MAX) throw new HttpError(413, "التسجيل أطول من المسموح");
  const existing = await prisma.noteAudio.findUnique({ where: { id }, select: { userId: true } });
  if (existing && existing.userId !== user.id) throw new HttpError(404, "غير موجود");
  if (!existing) await prisma.noteAudio.create({ data: { id, userId: user.id, mime, size: buf.length, data: buf } });
  return json({ ok: true, size: buf.length });
});

/** GET the audio (owner only). */
export const GET = api(async (_req, ctx) => {
  const user = await requireUser();
  const id = uuid.parse((await ctx.params).id);
  const a = await prisma.noteAudio.findFirst({ where: { id, userId: user.id } });
  if (!a) throw new HttpError(404, "التسجيل غير متاح بعد");
  return new Response(new Uint8Array(a.data), {
    headers: { "Content-Type": a.mime, "Content-Length": String(a.size), "Cache-Control": "private, max-age=31536000, immutable" },
  });
});
