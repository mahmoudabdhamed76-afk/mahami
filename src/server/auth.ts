import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { HttpError } from "./http";
import type { UserDTO, UserSettings } from "@/lib/types";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_COOKIE = "mh_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, N, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const got = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

function isHttps(req: Request) {
  return req.headers.get("x-forwarded-proto")?.split(",")[0] === "https" || new URL(req.url).protocol === "https:";
}

export async function startSession(req: Request, userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await prisma.session.create({
    data: { id: sha256(token), userId, expiresAt, userAgent: req.headers.get("user-agent")?.slice(0, 300) },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: isHttps(req), path: "/", expires: expiresAt,
  });
}

export async function endSession(all = false, userId?: string) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (all && userId) await prisma.session.deleteMany({ where: { userId } });
  else if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // Sliding expiration, refreshed at most once per hour
  if (now - session.lastSeenAt.getTime() > 3600_000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(now + SESSION_DAYS * 864e5) },
    });
  }
  return session.user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "انتهت الجلسة، سجّل الدخول من جديد", "unauthorized");
  return user;
}

export function toUserDTO(u: {
  id: string; email: string; name: string; timezone: string; settings: unknown; calendarToken: string; createdAt: Date;
}): UserDTO {
  return {
    id: u.id, email: u.email, name: u.name, timezone: u.timezone,
    settings: (u.settings ?? {}) as UserSettings, calendarToken: u.calendarToken, createdAt: u.createdAt.toISOString(),
  };
}
