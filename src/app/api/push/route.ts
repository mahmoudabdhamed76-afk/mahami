import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getVapid } from "@/server/push";

export const GET = api(async () => {
  await requireUser();
  return json({ publicKey: (await getVapid()).publicKey });
});

const sub = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export const POST = api(async (req) => {
  const user = await requireUser();
  const s = sub.parse(await body(req));
  await prisma.pushSubscription.upsert({
    where: { endpoint: s.endpoint },
    create: { userId: user.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) },
    update: { userId: user.id, p256dh: s.keys.p256dh, auth: s.keys.auth },
  });
  return json({ ok: true });
});

export const DELETE = api(async (req) => {
  const user = await requireUser();
  const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(await body(req));
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint } });
  return json({ ok: true });
});
