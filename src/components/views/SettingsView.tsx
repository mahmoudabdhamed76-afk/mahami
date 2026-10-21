"use client";
import {
  Bell, BellRing, CalendarRange, ChevronLeft, Clock, Copy, Download, KeyRound, Languages, ListTodo, LogOut, Moon,
  Palette, RefreshCw, Rss, ShieldOff, Trash2, UserRound, Smartphone,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/client/api";
import { useFmt } from "@/client/format";
import { useCategories } from "@/client/hooks";
import { disablePush, enablePush, getPushState, type PushState } from "@/client/notifications";
import { useStore, type Settings } from "@/client/store";
import { logout, sync, updateUserLocal } from "@/client/sync";
import { confirmDialog, useUI } from "@/client/ui";
import type { UserDTO } from "@/lib/types";
import { CategoryIcon } from "../ui/icons";
import { Button, cx, Segmented, Spinner, Switch } from "../ui/primitives";
import { Page } from "../ui/Page";
import { Sheet, SheetHeader } from "../ui/Sheet";
import { SyncBadge } from "../SyncBadge";

const ACCENTS: [string, string][] = [["blue", "#007AFF"], ["indigo", "#5856D6"], ["purple", "#AF52DE"], ["pink", "#FF2D55"], ["orange", "#FF9500"], ["green", "#34C759"], ["teal", "#30B0C7"]];

export function saveSettings(patch: Partial<Settings>) {
  useStore.getState().setSettings(patch);
  api<{ user: UserDTO }>("/api/auth/me", { method: "PATCH", body: { settings: patch } })
    .then(({ user }) => updateUserLocal(user)).catch(() => {});
}

export function SettingsView() {
  const user = useStore((s) => s.user)!;
  const settings = useStore((s) => s.settings);
  const sync$ = useStore((s) => s.sync);
  const toast = useStore((s) => s.toast);
  const cats = useCategories();
  const editCategory = useUI((s) => s.editCategory);
  const fmt = useFmt();
  const [push, setPush] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(user.name);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  useEffect(() => { void getPushState().then(setPush); }, []);

  const feed = typeof location !== "undefined" ? `${location.origin}/api/calendar/${user.calendarToken}.ics` : "";
  const webcal = feed.replace(/^https?:/, "webcal:");

  const togglePush = async (on: boolean) => {
    setBusy(true);
    try {
      const st = on ? await enablePush() : await disablePush();
      setPush(st);
      if (on && st === "denied") toast({ text: "الإشعارات محظورة من إعدادات المتصفح", tone: "error" });
      if (on && st === "on") toast({ text: "تم تفعيل الإشعارات على هذا الجهاز", icon: "bell" });
    } catch (e) {
      toast({ text: (e as Error).message || "تعذّر تفعيل الإشعارات", tone: "error" });
    } finally { setBusy(false); }
  };

  const saveName = async () => {
    const n = name.trim();
    if (n.length < 2 || n === user.name) return setName(user.name);
    try { const r = await api<{ user: UserDTO }>("/api/auth/me", { method: "PATCH", body: { name: n } }); await updateUserLocal(r.user); toast({ text: "تم حفظ الاسم" }); }
    catch { toast({ text: "تعذّر الحفظ — تحقق من الاتصال", tone: "error" }); setName(user.name); }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast({ text: "تم نسخ الرابط", icon: "check" }); }
    catch { prompt("انسخ الرابط:", text); }
  };

  const rotate = async () => {
    if (!(await confirmDialog({ title: "إنشاء رابط تقويم جديد؟", message: "سيتوقف الرابط القديم عن العمل في أي تقويم مشترك.", confirm: "إنشاء رابط جديد", destructive: true }))) return;
    try {
      const r = await api<{ calendarToken: string }>("/api/calendar/token", { body: {} });
      await updateUserLocal({ ...user, calendarToken: r.calendarToken });
      toast({ text: "تم إنشاء رابط جديد" });
    } catch { toast({ text: "يتطلب اتصالًا بالإنترنت", tone: "error" }); }
  };

  const exportData = () => {
    const st = useStore.getState();
    const data = { exportedAt: new Date().toISOString(), user: { name: user.name, email: user.email }, categories: Object.values(st.categories), tasks: Object.values(st.tasks), subtasks: Object.values(st.subtasks) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `mahami-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");

  return (
    <Page title="الإعدادات">
      <div className="glass mb-6 flex items-center gap-4 rounded-[24px] p-4">
        <div className="glass-pill grid size-16 shrink-0 place-items-center rounded-full t-title2 text-white">{initials}</div>
        <div className="min-w-0 flex-1">
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label="الاسم" className="w-full rounded-lg bg-transparent t-title3 outline-none focus:bg-fill focus:px-2" />
          <p className="truncate t-sub text-label-2" dir="ltr" style={{ textAlign: "right" }}>{user.email}</p>
        </div>
      </div>

      <Group title="المظهر">
        <Row icon={<Moon size={17} />} color="#5856D6" label="السمة">
          <Segmented id="theme" className="w-48" value={settings.theme} onChange={(v) => saveSettings({ theme: v })}
            options={[{ value: "system", label: "تلقائي" }, { value: "light", label: "فاتح" }, { value: "dark", label: "داكن" }]} />
        </Row>
        <Row icon={<Palette size={17} />} color="#FF2D55" label="لون التمييز">
          <div className="flex gap-1.5">
            {ACCENTS.map(([k, c]) => (
              <button key={k} type="button" aria-label={k} aria-pressed={settings.accent === k} onClick={() => saveSettings({ accent: k })}
                className={cx("size-7 rounded-full transition-transform", settings.accent === k && "scale-110 ring-2 ring-offset-2 ring-offset-[var(--bg)]")}
                style={{ background: c, ["--tw-ring-color" as string]: c }} />
            ))}
          </div>
        </Row>
        <Row icon={<Languages size={17} />} color="#30B0C7" label="الأرقام">
          <Segmented id="digits" className="w-36" value={settings.digits} onChange={(v) => saveSettings({ digits: v })}
            options={[{ value: "arab", label: "١٢٣" }, { value: "latn", label: "123" }]} />
        </Row>
      </Group>

      <Group title="التقويم">
        <Row icon={<CalendarRange size={17} />} color="#FF3B30" label="بداية الأسبوع">
          <select value={settings.weekStart} onChange={(e) => saveSettings({ weekStart: Number(e.target.value) as 0 | 1 | 6 })} aria-label="بداية الأسبوع"
            className="cursor-pointer rounded-lg bg-transparent t-callout text-label-2 outline-none">
            <option value={6}>السبت</option><option value={0}>الأحد</option><option value={1}>الإثنين</option>
          </select>
        </Row>
        <div className="row-sep px-4 py-3" style={{ ["--sep-inset" as string]: "3.6rem" }}>
          <div className="flex items-center gap-3">
            <Icon color="#34C759"><Rss size={17} /></Icon>
            <div className="flex-1">
              <p className="t-callout">الاشتراك في تقويم المهام</p>
              <p className="t-foot text-label-2">يعمل مع تقويم Google وApple وOutlook ويتحدّث تلقائيًا.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 ps-12">
            <Button variant="tinted" className="h-9 rounded-full px-3 t-foot" onClick={() => copy(feed)}><Copy size={15} /> نسخ الرابط</Button>
            <a href={webcal} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3 t-foot font-semibold"><Smartphone size={15} /> فتح في تقويم الجهاز</a>
            <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3 t-foot font-semibold">Google</a>
            <button type="button" onClick={rotate} className="inline-flex h-9 items-center gap-1.5 rounded-full px-2 t-foot text-label-2"><RefreshCw size={14} /> رابط جديد</button>
          </div>
        </div>
      </Group>

      <Group title="التذكيرات والإشعارات">
        <Row icon={<Bell size={17} />} color="#FF9500" label="إشعارات هذا الجهاز"
          sub={push === "unsupported" ? "غير مدعومة هنا (تحتاج HTTPS، وعلى iPhone أضف التطبيق للشاشة الرئيسية)" : push === "denied" ? "محظورة من إعدادات المتصفح" : "تصلك حتى لو كان التطبيق مغلقًا"}>
          {busy ? <Spinner /> : <Switch checked={push === "on"} onChange={togglePush} label="إشعارات هذا الجهاز" />}
        </Row>
        {push === "on" && (
          <ActionBtn icon={<BellRing size={17} />} color="#FF9500" onClick={() => api<{ sent: number }>("/api/push/test", { body: {} }).then((r) => toast({ text: r.sent ? "أُرسل إشعار تجريبي" : "لم يُرسل — أعد تفعيل الإشعارات", icon: "bell" })).catch((e) => toast({ text: e.message, tone: "error" }))}>
            إرسال إشعار تجريبي
          </ActionBtn>
        )}
        <Row icon={<Clock size={17} />} color="#007AFF" label="تذكير تلقائي" sub="للمهام الجديدة التي لها موعد">
          <Switch checked={settings.autoRemind} onChange={(v) => saveSettings({ autoRemind: v })} label="تذكير تلقائي" />
        </Row>
        <Row icon={<Clock size={17} />} color="#8E8E93" label="وقت تذكير المهام طوال اليوم">
          <input type="time" value={settings.defaultReminderTime} onChange={(e) => e.target.value && saveSettings({ defaultReminderTime: e.target.value })}
            aria-label="وقت التذكير الافتراضي" className="rounded-lg bg-fill px-2 py-1 t-callout outline-none" />
        </Row>
      </Group>

      <Group title="القوائم">
        {cats.map((c) => (
          <button key={c.id} type="button" onClick={() => editCategory(c.id)} className="row-sep flex h-12 w-full items-center gap-3 px-4 active:bg-fill" style={{ ["--sep-inset" as string]: "3.6rem" }}>
            <CategoryIcon icon={c.icon} color={c.color} size={28} />
            <span className="flex-1 truncate text-start t-callout">{c.name}</span>
            <ChevronLeft size={18} className="text-label-3" />
          </button>
        ))}
        <button type="button" onClick={() => editCategory()} className="row-sep flex h-12 w-full items-center gap-3 px-4 t-callout text-accent" style={{ ["--sep-inset" as string]: "3.6rem" }}>
          <Icon color="var(--accent)"><ListTodo size={17} /></Icon> إضافة قائمة جديدة
        </button>
      </Group>

      <Group title="المزامنة والبيانات">
        <Row icon={<RefreshCw size={17} />} color="#34C759" label="الحالة"
          sub={sync$.last ? `آخر مزامنة ${fmt.relDay(sync$.last)} ${fmt.time(sync$.last)}` : "لم تتم مزامنة بعد"}>
          <SyncBadge />
        </Row>
        <button type="button" onClick={() => void sync()} className="row-sep flex h-12 w-full items-center gap-3 px-4 t-callout text-accent" style={{ ["--sep-inset" as string]: "3.6rem" }}>
          <Icon color="var(--accent)"><RefreshCw size={17} /></Icon> مزامنة الآن
        </button>
        <button type="button" onClick={exportData} className="row-sep flex h-12 w-full items-center gap-3 px-4 t-callout text-accent" style={{ ["--sep-inset" as string]: "3.6rem" }}>
          <Icon color="#8E8E93"><Download size={17} /></Icon> تصدير بياناتي (JSON)
        </button>
      </Group>

      <Group title="الحساب">
        <ActionBtn icon={<KeyRound size={17} />} color="#8E8E93" onClick={() => setPwOpen(true)}>تغيير كلمة المرور</ActionBtn>
        <ActionBtn icon={<LogOut size={17} />} color="#FF9500" onClick={async () => {
          if (await confirmDialog({ title: "تسجيل الخروج؟", message: useStore.getState().sync.pending ? "توجد تغييرات لم تُزامن بعد وستُفقد من هذا الجهاز." : undefined, confirm: "تسجيل الخروج", destructive: true })) void logout();
        }}>تسجيل الخروج</ActionBtn>
        <ActionBtn icon={<ShieldOff size={17} />} color="#FF9500" onClick={async () => {
          if (await confirmDialog({ title: "الخروج من كل الأجهزة؟", confirm: "خروج من الكل", destructive: true })) void logout(true);
        }}>تسجيل الخروج من كل الأجهزة</ActionBtn>
        <ActionBtn icon={<Trash2 size={17} />} color="#FF3B30" danger onClick={() => setDelOpen(true)}>حذف الحساب نهائيًا</ActionBtn>
      </Group>

      <p className="pb-4 text-center t-cap text-label-3">مهامي · الإصدار 1.0 · <UserRound size={11} className="inline" /> منذ {fmt.date(user.createdAt, { month: "long", year: "numeric" })}</p>

      <PasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
      <DeleteSheet open={delOpen} onClose={() => setDelOpen(false)} />
    </Page>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const toast = useStore((s) => s.toast);
  const submit = async () => {
    setBusy(true); setErr("");
    try { await api("/api/auth/password", { body: { current: cur, next } }); toast({ text: "تم تغيير كلمة المرور" }); setCur(""); setNext(""); onClose(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "لا يوجد اتصال"); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} label="تغيير كلمة المرور">
      <SheetHeader title="تغيير كلمة المرور" start={<button type="button" onClick={onClose} className="t-body text-accent">إلغاء</button>} />
      <form className="space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <input data-autofocus type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="كلمة المرور الحالية" className="h-12 w-full rounded-xl bg-fill px-4 t-body outline-none" />
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="كلمة المرور الجديدة (٨ أحرف على الأقل)" className="h-12 w-full rounded-xl bg-fill px-4 t-body outline-none" />
        {err && <p className="t-foot text-ios-red">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy || !cur || next.length < 8}>{busy ? <Spinner /> : "حفظ"}</Button>
      </form>
    </Sheet>
  );
}

function DeleteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr("");
    try { await api("/api/auth/me", { method: "DELETE", body: { password: pw } }); onClose(); await logout(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "لا يوجد اتصال"); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} label="حذف الحساب">
      <SheetHeader title="حذف الحساب" start={<button type="button" onClick={onClose} className="t-body text-accent">إلغاء</button>} />
      <form className="space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <p className="t-sub text-label-2">سيتم حذف حسابك وكل مهامك وقوائمك من جميع الأجهزة نهائيًا ولا يمكن التراجع. أدخل كلمة المرور للتأكيد.</p>
        <input data-autofocus type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="كلمة المرور" className="h-12 w-full rounded-xl bg-fill px-4 t-body outline-none" />
        {err && <p className="t-foot text-ios-red">{err}</p>}
        <Button type="submit" variant="danger" className="w-full" disabled={busy || !pw}>{busy ? <Spinner /> : "حذف الحساب نهائيًا"}</Button>
      </form>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="px-4 pb-1.5 t-foot font-semibold text-label-2">{title}</h2>
      <div className="glass overflow-hidden rounded-[20px]">{children}</div>
    </section>
  );
}
function Icon({ color, children }: { color: string; children: ReactNode }) {
  return <span className="grid size-[30px] shrink-0 place-items-center rounded-[8px] text-white" style={{ background: color }}>{children}</span>;
}
function Row({ icon, color, label, sub, children }: { icon: ReactNode; color: string; label: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="row-sep flex min-h-[52px] flex-wrap items-center gap-3 px-4 py-2" style={{ ["--sep-inset" as string]: "3.6rem" }}>
      <Icon color={color}>{icon}</Icon>
      <div className="min-w-0 flex-1"><p className="t-callout">{label}</p>{sub && <p className="t-foot text-label-2">{sub}</p>}</div>
      {children}
    </div>
  );
}
function ActionBtn({ icon, color, children, onClick, danger }: { icon: ReactNode; color: string; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cx("row-sep flex h-12 w-full items-center gap-3 px-4 t-callout active:bg-fill", danger && "text-ios-red")} style={{ ["--sep-inset" as string]: "3.6rem" }}>
      <Icon color={color}>{icon}</Icon>{children}
    </button>
  );
}
