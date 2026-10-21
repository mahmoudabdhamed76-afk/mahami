import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const json = (data: unknown, init?: ResponseInit) =>
  Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: Request, ctx: Ctx) => Promise<Response>;

/** Same-origin guard for state-changing requests (CSRF defence in depth on top of SameSite cookies). */
function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, server-to-server) don't send Origin
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost = "";
  try { originHost = new URL(origin).host; } catch { /* ignore */ }
  if (!host || originHost !== host) throw new HttpError(403, "طلب غير مسموح من هذا المصدر", "bad_origin");
}

export function api(fn: Handler): Handler {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return json({ error: first?.message || "بيانات غير صالحة", code: "validation", issues: e.issues }, { status: 400 });
      }
      if (e instanceof SyntaxError) return json({ error: "صيغة الطلب غير صحيحة", code: "bad_json" }, { status: 400 });
      console.error("[api]", req.method, new URL(req.url).pathname, e);
      return json({ error: "حدث خطأ غير متوقع في الخادم", code: "server_error" }, { status: 500 });
    }
  };
}

export async function body(req: Request): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 2_000_000) throw new HttpError(413, "حجم الطلب كبير جدًا");
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

// ── Simple fixed-window rate limiter (per process) ──────────────────────────
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return;
  }
  if (++b.count > limit) {
    const mins = Math.ceil((b.reset - now) / 60000);
    throw new HttpError(429, `محاولات كثيرة، حاول مرة أخرى بعد ${mins} دقيقة`, "rate_limited");
  }
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}
