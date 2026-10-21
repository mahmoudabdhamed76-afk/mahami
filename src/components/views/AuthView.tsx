"use client";
import { motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { Cabinet } from "@lucasmarkes/hairline/react";
import { useEffect, useState } from "react";
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
  const [reduce, setReduce] = useState(false);
  useEffect(() => { setReduce(matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);

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
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="relative -mb-4 -mt-6 h-[300px] w-full max-w-[380px]">
            <div className="auth-halo" aria-hidden />
            <Cabinet className="cab-fig h-full w-full !aspect-auto" play={!reduce} intensity={0.8} label="خزانة مهام بأدراج ملوّنة بتطلع وتدخل" />
          </div>
          <AppName />
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.5 }} className="mt-1 t-callout text-label-2">
            نظّم يومك بهدوء… وأنجز أكثر.
          </motion.p>
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

      </motion.div>
    </div>
  );
}

/** «مهامي» — the word draws itself in (right→left wipe), then a light sweeps through it, and a check underlines it. */
function AppName() {
  return (
    <div className="relative mt-1 inline-flex flex-col items-center">
      <motion.h1
        className="app-name relative text-[3.4rem] font-bold leading-[1.15]"
        initial={{ clipPath: "inset(0 0 0 100%)", filter: "blur(10px)", y: 8 }}
        animate={{ clipPath: "inset(0 0 0 0%)", filter: "blur(0px)", y: 0 }}
        transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1], delay: 0.15 }}
      >
        مهامي
      </motion.h1>
      <svg viewBox="0 0 160 22" className="-mt-1 h-[22px] w-[150px]" aria-hidden>
        <motion.path
          d="M150 12 C 120 18, 70 18, 40 12 L 30 10 L 22 18 L 6 3"
          fill="none" stroke="url(#name-ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeInOut", delay: 1.05 }}
        />
        <defs>
          <linearGradient id="name-ink" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="55%" stopColor="#AF52DE" />
            <stop offset="100%" stopColor="#FF2D55" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
