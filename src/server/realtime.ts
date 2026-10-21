import pg from "pg";

/**
 * One LISTEN connection per server process, fanned out to every open SSE
 * stream. Works across multiple instances because NOTIFY goes through Postgres.
 */
type Listener = () => void;

class RealtimeHub {
  private client: pg.Client | null = null;
  private connecting: Promise<void> | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private retry = 1000;

  private async connect() {
    // LISTEN needs a session connection: use the direct/session URL when the main one is a transaction pooler
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
    client.on("notification", (msg) => {
      if (msg.channel !== "sync_changes" || !msg.payload) return;
      this.listeners.get(msg.payload)?.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    });
    client.on("error", (err) => {
      console.error("[realtime] connection error:", err.message);
      this.reset();
    });
    client.on("end", () => this.reset());
    await client.connect();
    await client.query("LISTEN sync_changes");
    this.client = client;
    this.retry = 1000;
  }

  private reset() {
    const old = this.client;
    this.client = null;
    this.connecting = null;
    old?.removeAllListeners();
    old?.end().catch(() => {});
    if (this.listeners.size > 0) {
      const wait = this.retry;
      this.retry = Math.min(this.retry * 2, 30_000);
      setTimeout(() => this.ensure().catch(() => {}), wait);
    }
  }

  ensure(): Promise<void> {
    if (this.client) return Promise.resolve();
    if (!this.connecting) {
      this.connecting = this.connect().catch((e) => {
        this.connecting = null;
        console.error("[realtime] connect failed:", e.message);
        this.reset();
      });
    }
    return this.connecting;
  }

  subscribe(userId: string, fn: Listener) {
    let set = this.listeners.get(userId);
    if (!set) this.listeners.set(userId, (set = new Set()));
    set.add(fn);
    this.ensure().catch(() => {});
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.listeners.delete(userId);
    };
  }

  get connections() {
    let n = 0;
    this.listeners.forEach((s) => (n += s.size));
    return n;
  }
}

const g = globalThis as unknown as { __hub?: RealtimeHub };
export const hub = g.__hub ?? (g.__hub = new RealtimeHub());
