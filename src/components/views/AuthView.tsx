"use client";
import { motion } from "motion/react";
import { Bell, CalendarDays, CloudOff, Eye, EyeOff, Sparkles } from "lucide-react";
import { useState } from "react";
import { api, ApiError, NetworkError } from "@/client/api";
import { signedIn } from "@/client/sync";
import type { UserDTO } from "@/lib/types";
import { Button, Segmented, Spinner } from "../ui/primitives";

export function AuthView() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const body = mode === "login"
        ? { email, password }
        : { name, email, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      const { user } = await api<{ user: UserDTO }>(`/api/auth/${mode}`, { body });
      await signedIn(user);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof NetworkError ? "لا يوجد اتصال بالإنترنت. سجّل الدخول مرة واحدة أونلاين وبعدها يعمل التطبيق بدون إنترنت." : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  const field = "h-[52px] w-full rounded-2xl bg-fill px-4 t-body outline-none placeholder:text-label-3 focus:ring-2 focus:ring-[rgb(var(--accent-rgb)/0.45)]";

  return (
    <div className="scroll-y relative z-10 flex h-full flex-col items-center justify-center px-5 py-10">
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <motion.img src="/icons/icon-192.png" alt="" className="mb-4 size-[84px] rounded-[22px] shadow-[0_18px_40px_-12px_rgb(var(--accent-rgb)/0.6)]"
            initial={{ rotate: -8, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }} />
          <h1 className="t-large">مهامي</h1>
          <p className="mt-1 t-callout text-label-2">نظّم يومك بهدوء… وأنجز أكثر.</p>
        </div>

        <form onSubmit={submit} className="glass-strong space-y-3 rounded-[30px] p-5">
          <Segmented id="auth" value={mode} onChange={(m) => { setMode(m); setErr(""); }}
            options={[{ value: "login", label: "تسجيل الدخول" }, { value: "register", label: "حساب جديد" }]} />
          {mode === "register" && (
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" autoComplete="name" required minLength={2} aria-label="الاسم" />
          )}
          <input className={field} type="email" dir="ltr" style={{ textAlign: "right" }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" autoComplete="email" required aria-label="البريد الإلكتروني" />
          <div className="relative">
            <input className={field + " pe-12"} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "كلمة المرور (٨ أحرف على الأقل)" : "كلمة المرور"} autoComplete={mode === "login" ? "current-password" : "new-password"}
              required minLength={mode === "register" ? 8 : 1} aria-label="كلمة المرور" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute inset-y-0 end-3 grid place-items-center text-label-2">
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          {err && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-[color-mix(in_srgb,var(--red)_12%,transparent)] px-3 py-2 t-foot text-ios-red" role="alert">{err}</motion.p>}
          <Button type="submit" className="h-[52px] w-full" disabled={busy}>
            {busy ? <Spinner /> : mode === "login" ? "دخول" : "إنشاء الحساب"}
          </Button>
        </form>

        <div className="mt-6 grid grid-cols-2 gap-2.5 text-label-2">
          {[
            [Sparkles, "إضافة ذكية باللغة العربية"],
            [CloudOff, "يعمل بدون إنترنت"],
            [Bell, "تذكيرات وإشعارات"],
            [CalendarDays, "تقويم ومزامنة فورية"],
          ].map(([I, t], i) => {
            const Ic = I as typeof Bell;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
                className="glass flex items-center gap-2 rounded-2xl px-3 py-2.5 t-foot">
                <Ic size={16} className="shrink-0 text-accent" />{t as string}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
