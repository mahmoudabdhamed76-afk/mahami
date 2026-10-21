/* مهامي — Service Worker: offline app shell, Web Push, notification actions */
const VERSION = "v1";
const SHELL = `mahami-shell-${VERSION}`;
const STATIC = "mahami-static";
const PRECACHE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/chime.wav"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("mahami-shell-") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("message", (e) => {
  if (e.data?.type === "cache" && Array.isArray(e.data.urls)) {
    e.waitUntil((async () => {
      const shell = await caches.open(SHELL);
      const stat = await caches.open(STATIC);
      await Promise.all(e.data.urls.map(async (u) => {
        try {
          const url = new URL(u);
          if (url.origin !== location.origin) return;
          const target = url.pathname === "/" ? shell : stat;
          if (!(await target.match(url.pathname === "/" ? "/" : u))) {
            const res = await fetch(u, { credentials: "same-origin" });
            if (res.ok) await target.put(url.pathname === "/" ? "/" : u, res);
          }
        } catch { /* ignore */ }
      }));
    })());
  }
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // App shell: network-first, fall back to cached shell when offline
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && url.pathname === "/") (await caches.open(SHELL)).put("/", res.clone());
        return res;
      } catch {
        return (await caches.match("/", { cacheName: SHELL })) || new Response("غير متصل", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // Hashed build assets & fonts: cache-first (immutable)
  if (url.pathname.startsWith("/_next/static/") || /\.(woff2?|png|svg|ico|wav)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) {
        const c = await caches.open(STATIC);
        c.put(req, res.clone()).then(() => trim(STATIC, 400));
      }
      return res;
    })());
    return;
  }

  // Everything else: stale-while-revalidate
  e.respondWith((async () => {
    const c = await caches.open(STATIC);
    const hit = await c.match(req);
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })());
});

// ── Push notifications ────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: "مهامي", body: e.data?.text() }; }
  const actions = data.taskId ? [{ action: "complete", title: "تم ✓" }, { action: "snooze", title: "بعد ١٠ دقائق" }] : [];
  e.waitUntil(self.registration.showNotification(data.title || "مهامي", {
    body: data.body || "",
    tag: data.tag,
    renotify: !!data.tag,
    dir: "rtl",
    lang: "ar",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    data: { url: data.url || "/", taskId: data.taskId },
    actions,
    requireInteraction: !!data.taskId,
  }));
});

self.addEventListener("notificationclick", (e) => {
  const n = e.notification;
  const { url = "/", taskId } = n.data || {};
  n.close();
  if (e.action === "complete" || e.action === "snooze") {
    e.waitUntil(fetch(`/api/tasks/${taskId}/action`, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: e.action, minutes: 10 }),
    }).catch(() => {}));
    return;
  }
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === location.origin) {
        await c.focus();
        c.postMessage({ type: "open-task", taskId });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
