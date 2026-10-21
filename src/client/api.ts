export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
export class NetworkError extends Error {
  constructor() { super("لا يوجد اتصال بالخادم"); }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new NetworkError();
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; code?: string };
    if (res.status >= 502 && res.status <= 504) throw new NetworkError();
    throw new ApiError(res.status, d.error || "حدث خطأ غير متوقع", d.code);
  }
  return data as T;
}
