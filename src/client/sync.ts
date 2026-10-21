"use client";
import { api, ApiError, NetworkError } from "./api";
import { clearAll, db, getMeta, loadAll, putRecords, setMeta, type OutboxItem, type StoreName } from "./idb";
import { getState, useStore } from "./store";
import { uid } from "./uid";
import type { CategoryRec, EntityName, PullResponse, PushResult, SubtaskRec, TaskRec, UserDTO } from "@/lib/types";

/**
 * Offline-first sync engine
 * ─────────────────────────
 *  • Every local change is written to IndexedDB + an outbox immediately (UI never waits on the network).
 *  • sync(): push outbox in batches → pull everything with version > cursor → apply.
 *  • Server pushes "change" events over SSE so other devices pull within ~100ms.
 *  • Web Locks keep two tabs from syncing at once; BroadcastChannel keeps tabs' memory in sync.
 */

const STORE: Record<EntityName, StoreName> = { category: "categories", task: "tasks", subtask: "subtasks" };
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("mahami") : null;

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let again = false;
let backoff = 0;
let es: EventSource | null = null;
let started = false;

// ── Local writes ────────────────────────────────────────────────────────────
type AnyRec = CategoryRec | TaskRec | SubtaskRec;

function payload(rec: AnyRec) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, updatedAt, deletedAt, ...data } = rec as AnyRec & Record<string, unknown>;
  return data;
}

export async function commit(entity: EntityName, recs: AnyRec[], deletes: { id: string; ts: string }[] = []) {
  const store = STORE[entity];
  getState().apply(store, recs as never[], deletes.map((d) => d.id));
  const ops: OutboxItem[] = [
    ...recs.map((r) => ({ opId: uid(), entity, op: "upsert" as const, id: r.id, ts: r.updatedAt, data: payload(r) })),
    ...deletes.map((d) => ({ opId: uid(), entity, op: "delete" as const, id: d.id, ts: d.ts })),
  ];
  const d = await db();
  const tx = d.transaction([store, "outbox"], "readwrite");
  const s = tx.objectStore(store) as unknown as { put(v: unknown): Promise<unknown>; delete(k: string): Promise<unknown> };
  await Promise.all([
    ...recs.map((r) => s.put(r)),
    ...deletes.map((x) => s.delete(x.id)),
    ...ops.map((o) => tx.objectStore("outbox").add(o)),
    tx.done,
  ]);
  getState().setSync({ pending: getState().sync.pending + ops.length });
  channel?.postMessage({ type: "reload" });
  schedule(200);
}

// ── Scheduling ──────────────────────────────────────────────────────────────
export function schedule(delay = 250) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void sync(); }, delay);
}

async function withLock(fn: () => Promise<void>) {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (locks?.request) await locks.request("mahami-sync", fn);
  else await fn();
}

export async function sync(): Promise<void> {
  const st = getState();
  if (st.phase !== "app" || !st.user) return;
  if (running) { again = true; return; }
  if (!navigator.onLine) { st.setSync({ state: "offline" }); return; }
  running = true;
  st.setSync({ state: "syncing", error: undefined });
  try {
    await withLock(async () => {
      await pushOutbox();
      await pullAll();
    });
    backoff = 0;
    const pending = await (await db()).count("outbox");
    getState().setSync({ state: "idle", last: Date.now(), pending });
    if (pending) again = true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      getState().setSync({ state: "error", error: e.message });
      getState().setPhase("auth");
      disconnect();
    } else {
      const offline = e instanceof NetworkError;
      getState().setSync({ state: offline ? "offline" : "error", error: (e as Error).message });
      backoff = Math.min(backoff ? backoff * 2 : 4000, 60_000);
      schedule(backoff);
    }
  } finally {
    running = false;
    if (again) { again = false; schedule(300); }
  }
}

async function pushOutbox() {
  const d = await db();
  for (let guard = 0; guard < 50; guard++) {
    const batch = await d.getAll("outbox", null, 200);
    if (!batch.length) return;
    // Collapse multiple edits of the same record into the last one
    const latest = new Map<string, OutboxItem>();
    for (const o of batch) latest.set(`${o.entity}:${o.id}`, o);
    const ops = [...latest.values()].map(({ seq: _s, ...op }) => op); // eslint-disable-line @typescript-eslint/no-unused-vars
    await api<PushResult>("/api/sync/push", { body: { ops, clientNow: new Date().toISOString() } });
    const tx = d.transaction("outbox", "readwrite");
    await Promise.all([...batch.map((o) => tx.store.delete(o.seq!)), tx.done]);
    getState().setSync({ pending: await d.count("outbox") });
  }
}

async function pullAll() {
  let cursor = (await getMeta<number>("cursor")) ?? 0;
  for (let guard = 0; guard < 200; guard++) {
    const r = await api<PullResponse>(`/api/sync/pull?since=${cursor}`);
    await applyRemote(r);
    cursor = r.cursor;
    await setMeta("cursor", cursor);
    if (!r.hasMore) break;
  }
}

async function applyRemote(r: PullResponse) {
  // Local edits not yet pushed win until they are pushed (they'll come back with a newer version)
  const pending = new Set((await (await db()).getAll("outbox")).map((o) => `${o.entity}:${o.id}`));
  const groups: [EntityName, (CategoryRec | TaskRec | SubtaskRec)[]][] = [["category", r.categories], ["task", r.tasks], ["subtask", r.subtasks]];
  let changed = false;
  for (const [entity, list] of groups) {
    const put: AnyRec[] = [];
    const del: string[] = [];
    for (const raw of list) {
      if (pending.has(`${entity}:${raw.id}`)) continue;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { version: _v, ...rec } = raw as AnyRec & { version?: number };
      if (rec.deletedAt) del.push(rec.id);
      else put.push(rec as AnyRec);
    }
    if (put.length || del.length) {
      changed = true;
      getState().apply(STORE[entity], put as never[], del);
      await putRecords(STORE[entity], put, del);
    }
  }
  if (changed) channel?.postMessage({ type: "reload" });
}

// ── Realtime + lifecycle ────────────────────────────────────────────────────
function connect() {
  if (es || typeof EventSource === "undefined") return;
  es = new EventSource("/api/sync/stream");
  es.addEventListener("ready", () => schedule(50));
  es.addEventListener("change", () => schedule(60));
  es.onerror = () => {
    // Browser auto-reconnects; if the session ended, sync() will detect the 401.
    if (es?.readyState === EventSource.CLOSED) { es = null; setTimeout(() => getState().phase === "app" && connect(), 5000); }
  };
}

function disconnect() {
  es?.close();
  es = null;
}

export function startSync() {
  if (started) { connect(); schedule(0); return; }
  started = true;
  connect();
  schedule(0);
  window.addEventListener("online", () => { getState().setOnline(true); connect(); schedule(0); });
  window.addEventListener("offline", () => { getState().setOnline(false); getState().setSync({ state: "offline" }); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { connect(); schedule(0); } });
  setInterval(() => { if (document.visibilityState === "visible") schedule(0); }, 60_000);
  channel?.addEventListener("message", (ev) => { if (ev.data?.type === "reload") void reloadFromDisk(); });
}

let reloadTimer: ReturnType<typeof setTimeout> | null = null;
async function reloadFromDisk() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    const d = await loadAll();
    getState().hydrate(d);
    getState().setSync({ pending: await (await db()).count("outbox") });
  }, 80);
}

// ── Session bootstrap ───────────────────────────────────────────────────────
export async function boot() {
  const local = await loadAll();
  const st = getState();
  if (local.user) {
    st.setUser(local.user);
    st.hydrate(local);
    st.setSync({ pending: await (await db()).count("outbox") });
    st.setPhase("app"); // open instantly from cache, validate session in background
    startSync(); // works offline too: listeners resume syncing when the network returns
  }
  try {
    const { user } = await api<{ user: UserDTO | null }>("/api/auth/me");
    if (!user) throw new ApiError(401, "unauthorized");
    await signedIn(user, local.user);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // Keep unsynced local work: data is only wiped on explicit logout or account switch
      disconnect();
      st.setPhase("auth");
    } else if (!local.user) {
      st.setPhase("auth"); // offline and never logged in on this device
    } else {
      st.setSync({ state: "offline" });
    }
  }
}

export async function signedIn(user: UserDTO, previous?: UserDTO | null) {
  const st = getState();
  const prev = previous ?? (await getMeta<UserDTO>("user"));
  if (prev && prev.id !== user.id) {
    await clearAll();
    st.reset();
  }
  await setMeta("user", user);
  st.setUser(user);
  if (user.settings && Object.keys(user.settings).length) st.setSettings(user.settings);
  st.setPhase("app");
  // Keep the server's timezone in step with the device
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz && tz !== user.timezone) api("/api/auth/me", { method: "PATCH", body: { timezone: tz } }).catch(() => {});
  startSync();
}

export async function updateUserLocal(user: UserDTO) {
  await setMeta("user", user);
  getState().setUser(user);
}

export async function logout(all = false) {
  try { await api("/api/auth/logout", { body: { all } }); } catch { /* offline: still clear locally */ }
  disconnect();
  await clearAll();
  getState().reset();
  getState().setPhase("auth");
}
