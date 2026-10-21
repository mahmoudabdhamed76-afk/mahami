"use client";
import { api } from "./api";
import { getState } from "./store";
import type { TaskRec } from "@/lib/types";

export type PushState = "unsupported" | "denied" | "off" | "on";

export async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    // Warm the offline cache with everything this page already loaded (first visit isn't SW-controlled yet)
    const urls = performance.getEntriesByType("resource").map((e) => e.name)
      .filter((u) => u.startsWith(location.origin) && /\/_next\/static\/|\/fonts?\/|\.woff2?$|\/icons\//.test(u));
    const post = () => navigator.serviceWorker.controller?.postMessage({ type: "cache", urls: [...urls, location.origin + "/"] });
    if (navigator.serviceWorker.controller) post();
    else navigator.serviceWorker.addEventListener("controllerchange", post, { once: true });
    navigator.serviceWorker.addEventListener("message", (ev) => {
      if (ev.data?.type === "open-task" && ev.data.taskId) window.dispatchEvent(new CustomEvent("mh:open-task", { detail: ev.data.taskId }));
    });
    return reg;
  } catch (e) {
    console.warn("SW registration failed", e);
    return null;
  }
}

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api<{ publicKey: string }>("/api/push");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  await api("/api/push", { body: sub.toJSON() });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api("/api/push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}

// ── In-app reminders while the app is open ──────────────────────────────────
// Server Web Push covers closed-app delivery; this covers devices without push
// (or offline) and always shows an in-app banner.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const fired = new Set<string>();

export function scheduleLocalReminders(tasks: TaskRec[]) {
  const now = Date.now();
  const horizon = now + 24 * 3600_000;
  const wanted = new Map<string, TaskRec>();
  for (const t of tasks) {
    if (t.completed || !t.remindAt) continue;
    const at = Date.parse(t.remindAt);
    if (at > now - 1000 && at < horizon) wanted.set(`${t.id}@${t.remindAt}`, t);
  }
  for (const [k, h] of timers) if (!wanted.has(k)) { clearTimeout(h); timers.delete(k); }
  for (const [k, t] of wanted) {
    if (timers.has(k) || fired.has(k)) continue;
    timers.set(k, setTimeout(() => { timers.delete(k); fired.add(k); void fire(t); }, Math.max(0, Date.parse(t.remindAt!) - Date.now())));
  }
}

async function fire(t: TaskRec) {
  const st = getState();
  const cur = st.tasks[t.id];
  if (!cur || cur.completed) return;
  st.toast({
    text: `تذكير: ${cur.title}`, icon: "bell",
    action: { label: "عرض", run: () => window.dispatchEvent(new CustomEvent("mh:open-task", { detail: cur.id })) },
  }, 8000);
  try { new Audio("/chime.wav").play().catch(() => {}); } catch { /* ignore */ }
  // System notification only if this device doesn't receive server push (avoid duplicates)
  if ("Notification" in window && Notification.permission === "granted" && (await getPushState()) !== "on") {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts: NotificationOptions = { body: "حان موعد مهمتك", tag: `task-${cur.id}`, dir: "rtl", lang: "ar", icon: "/icons/icon-192.png", data: { url: `/?task=${cur.id}`, taskId: cur.id } };
    if (reg) await reg.showNotification(`⏰ ${cur.title}`, opts);
    else new Notification(`⏰ ${cur.title}`, opts);
  }
}
