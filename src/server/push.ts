import webpush from "web-push";
import { prisma, table } from "./db";

let vapid: { publicKey: string; privateKey: string } | null = null;

/** VAPID keys from env, else generated once and stored in the database (shared by all instances). */
export async function getVapid() {
  if (vapid) return vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const gen = webpush.generateVAPIDKeys();
    await prisma.$executeRaw`INSERT INTO ${table("AppSetting")} (key, value) VALUES ('vapid', ${JSON.stringify(gen)}) ON CONFLICT (key) DO NOTHING`;
    const row = await prisma.appSetting.findUnique({ where: { key: "vapid" } });
    vapid = JSON.parse(row!.value);
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", vapid!.publicKey, vapid!.privateKey);
  return vapid!;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  taskId?: string;
}

export async function sendToUser(userId: string, payload: PushPayload) {
  await getVapid();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: "high" },
        );
        sent++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.error("[push] send failed", status, (e as Error).message);
      }
    }),
  );
  return { devices: subs.length, sent };
}
