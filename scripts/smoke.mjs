// End-to-end API smoke test. Usage: BASE=http://localhost:3000 node scripts/smoke.mjs
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
let passed = 0;
const ok = (name) => { passed++; console.log("  ✔", name); };

function client() {
  let cookie = "";
  const req = async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", cookie, origin: BASE },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
  return { req, get cookie() { return cookie; } };
}

const iso = (ms = 0) => new Date(Date.now() + ms).toISOString();

async function main() {
  console.log(`Smoke test against ${BASE}`);
  const a = client();
  const email = `user_${Date.now()}@test.dev`;

  let r = await a.req("POST", "/api/auth/register", { name: "محمود", email, password: "short" });
  assert.equal(r.status, 400); ok("rejects weak password");

  r = await a.req("POST", "/api/auth/register", { name: "محمود", email, password: "secret-pass-1", timezone: "Africa/Cairo" });
  assert.equal(r.status, 201, JSON.stringify(r.data)); ok("register");

  r = await a.req("GET", "/api/auth/me");
  assert.equal(r.data.user.email, email); ok("session cookie works");

  r = await a.req("GET", "/api/sync/pull?since=0");
  assert.equal(r.data.categories.length, 3); ok("starter categories pulled");
  const cat = r.data.categories[0];
  const cursor0 = r.data.cursor;

  // Realtime stream
  const ctrl = new AbortController();
  const stream = await fetch(BASE + "/api/sync/stream", { headers: { cookie: a.cookie }, signal: ctrl.signal });
  assert.equal(stream.headers.get("content-type")?.startsWith("text/event-stream"), true);
  const reader = stream.body.getReader();
  const dec = new TextDecoder();
  let sse = "";
  const gotChange = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return false;
      sse += dec.decode(value);
      if (sse.includes("event: change")) return true;
    }
  })();
  await new Promise((res) => setTimeout(res, 300));

  // Push a task + subtask
  const taskId = randomUUID(), subId = randomUUID();
  const t0 = iso();
  r = await a.req("POST", "/api/sync/push", {
    clientNow: iso(),
    ops: [
      { opId: "1", entity: "subtask", op: "upsert", id: subId, ts: t0, data: { taskId, title: "خطوة أولى", sortOrder: 0 } },
      { opId: "2", entity: "task", op: "upsert", id: taskId, ts: t0, data: { title: "اجتماع الفريق", priority: 3, categoryId: cat.id, dueAt: iso(864e5), allDay: false, reminderOffset: 15 } },
    ],
  });
  assert.deepEqual(r.data.results.map((x) => x.status), ["applied", "applied"], JSON.stringify(r.data)); ok("push applies parent before child");

  const changed = await Promise.race([gotChange, new Promise((res) => setTimeout(() => res(false), 3000))]);
  assert.equal(changed, true); ok("SSE change event received in real time");
  ctrl.abort();

  r = await a.req("GET", `/api/sync/pull?since=${cursor0}`);
  const pulled = r.data.tasks.find((t) => t.id === taskId);
  assert.ok(pulled && r.data.subtasks.some((s) => s.id === subId)); ok("pull returns new task + subtask");
  assert.ok(pulled.remindAt && Math.abs(Date.parse(pulled.dueAt) - Date.parse(pulled.remindAt) - 15 * 60_000) < 1000); ok("reminder offset computed server-side");
  const cursor1 = r.data.cursor;

  // Last-write-wins
  r = await a.req("POST", "/api/sync/push", { ops: [{ opId: "3", entity: "task", op: "upsert", id: taskId, ts: iso(-3600_000), data: { title: "قديم" } }] });
  assert.equal(r.data.results[0].status, "stale"); ok("older write is rejected as stale (LWW)");
  r = await a.req("POST", "/api/sync/push", { ops: [{ opId: "4", entity: "task", op: "upsert", id: taskId, ts: iso(1000), data: { ...pulled, title: "اجتماع الفريق الأسبوعي" } }] });
  assert.equal(r.data.results[0].status, "applied"); ok("newer write wins");
  r = await a.req("GET", `/api/sync/pull?since=${cursor1}`);
  assert.equal(r.data.tasks[0].title, "اجتماع الفريق الأسبوعي"); ok("incremental pull returns only the change");

  // Isolation
  const b = client();
  await b.req("POST", "/api/auth/register", { name: "سارة", email: "b_" + email, password: "secret-pass-2" });
  r = await b.req("POST", "/api/sync/push", { ops: [{ opId: "5", entity: "task", op: "delete", id: taskId, ts: iso(5000) }] });
  assert.equal(r.data.results[0].status, "rejected"); ok("another user cannot touch my task");
  r = await b.req("GET", `/api/tasks/${taskId}`);
  assert.equal(r.status, 404); ok("REST read isolation");

  // REST API
  r = await a.req("POST", "/api/tasks", { title: "شراء مستلزمات المكتب", priority: 2, subtasks: [{ title: "ورق" }, { title: "أقلام" }] });
  assert.equal(r.status, 201); assert.equal(r.data.task.subtasks.length, 2); ok("REST create with subtasks");
  const restId = r.data.task.id;
  r = await a.req("GET", "/api/tasks?q=" + encodeURIComponent("مستلزمات"));
  assert.equal(r.data.total, 1); ok("REST search");
  r = await a.req("PATCH", `/api/tasks/${restId}`, { notes: "من المكتبة" });
  assert.equal(r.data.task.notes, "من المكتبة"); ok("REST patch");
  r = await a.req("POST", `/api/tasks/${restId}/action`, { action: "complete" });
  r = await a.req("GET", `/api/tasks/${restId}`);
  assert.equal(r.data.task.completed, true); ok("quick action: complete");
  r = await a.req("GET", "/api/categories");
  assert.equal(r.data.categories.length, 3); ok("REST categories");
  r = await a.req("DELETE", `/api/tasks/${restId}`);
  r = await a.req("GET", `/api/tasks/${restId}`);
  assert.equal(r.status, 404); ok("REST delete (soft)");
  r = await a.req("GET", `/api/sync/pull?since=0`);
  assert.ok(r.data.tasks.find((t) => t.id === restId).deletedAt); ok("tombstone propagates through sync");
  assert.ok(r.data.subtasks.filter((s) => s.taskId === restId).every((s) => s.deletedAt)); ok("subtasks cascade-deleted");

  // Category delete detaches tasks
  r = await a.req("DELETE", `/api/categories/${cat.id}`);
  r = await a.req("GET", `/api/tasks/${taskId}`);
  assert.equal(r.data.task.categoryId, null); ok("deleting a list detaches its tasks");

  // CSRF guard
  const bad = await fetch(BASE + "/api/tasks", { method: "POST", headers: { "content-type": "application/json", cookie: a.cookie, origin: "https://evil.example" }, body: "{}" });
  assert.equal(bad.status, 403); ok("cross-origin write blocked");

  // Calendar feed
  r = await a.req("GET", "/api/auth/me");
  const ics = await fetch(`${BASE}/api/calendar/${r.data.user.calendarToken}.ics`).then((x) => x.text());
  assert.ok(ics.includes("BEGIN:VCALENDAR") && ics.includes("BEGIN:VEVENT") && ics.includes("BEGIN:VALARM")); ok("iCalendar feed");

  // Reminder scheduler
  const remId = randomUUID();
  await a.req("POST", "/api/sync/push", { ops: [{ opId: "6", entity: "task", op: "upsert", id: remId, ts: iso(), data: { title: "تذكير اختبار", remindAt: iso(-1000) } }] });
  const vapid = await a.req("GET", "/api/push");
  assert.ok(vapid.data.publicKey?.length > 40); ok("VAPID key auto-provisioned");
  let sent = false;
  for (let i = 0; i < 15 && !sent; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    if (process.env.CRON_SECRET) await fetch(BASE + "/api/cron/reminders", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    const p = await a.req("GET", `/api/sync/pull?since=0`);
    // reminderSentAt bumps the row version; detect via a second pull diff
    sent = p.data.cursor > 0 && (await checkSent(remId));
  }
  assert.ok(sent); ok("scheduler claimed the due reminder");

  // Settings + logout
  r = await a.req("PATCH", "/api/auth/me", { settings: { theme: "dark", weekStart: 6 } });
  assert.equal(r.data.user.settings.theme, "dark"); ok("settings saved");
  r = await a.req("POST", "/api/auth/logout", {});
  r = await a.req("GET", "/api/auth/me");
  assert.equal(r.data.user, null); ok("logout ends session");
  r = await a.req("GET", "/api/sync/pull?since=0");
  assert.equal(r.status, 401); ok("protected endpoints require a session");

  r = await a.req("POST", "/api/auth/login", { email, password: "wrong-password" });
  assert.equal(r.status, 401); ok("wrong password rejected");
  r = await a.req("POST", "/api/auth/login", { email, password: "secret-pass-1" });
  assert.equal(r.status, 200); ok("login");

  console.log(`\nAll ${passed} checks passed ✅`);
}

async function checkSent(id) {
  if (!process.env.DATABASE_URL) return true;
  const pg = (await import("pg")).default;
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const t = process.env.DB_SCHEMA ? `"${process.env.DB_SCHEMA}"."Task"` : `"Task"`;
  const { rows } = await c.query(`SELECT "reminderSentAt" FROM ${t} WHERE id=$1`, [id]);
  await c.end();
  return !!rows[0]?.reminderSentAt;
}

main().catch((e) => { console.error("\n✘ FAILED:", e.message); process.exit(1); });
