"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Cabinet } from "@lucasmarkes/hairline/react";
import { useEffect, useState } from "react";
import { api, ApiError, NetworkError } from "@/client/api";
import { signedIn } from "@/client/sync";
import type { UserDTO } from "@/lib/types";
import { cx, Spinner } from "../ui/primitives";

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

        <form onSubmit={submit} className="space-y-3.5">
          {/* Modern pill switch */}
          <div className="relative mx-auto mb-5 flex w-full max-w-[300px] rounded-full bg-fill p-1" role="tablist">
            {(["login", "register"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErr(""); }}
                className={cx("relative z-10 h-10 flex-1 rounded-full t-sub font-semibold transition-colors", mode === m ? "text-white" : "text-label-2")}>
                {mode === m && <motion.span layoutId="auth-pill" className="auth-pill absolute inset-0 -z-10 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                {m === "login" ? "تسجيل الدخول" : "حساب جديد"}
              </button>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {mode === "register" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Field icon={<UserRound size={19} />} label="الاسم" value={name} onChange={setName} autoComplete="name" required minLength={2} />
              </motion.div>
            )}
          </AnimatePresence>
          <Field icon={<Mail size={19} />} label="البريد الإلكتروني" type="email" ltr value={email} onChange={setEmail} autoComplete="email" required />
          <Field icon={<LockKeyhole size={19} />} label={mode === "register" ? "كلمة المرور (٨ أحرف على الأقل)" : "كلمة المرور"} type={show ? "text" : "password"}
            value={password} onChange={setPassword} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1}
            end={<button type="button" onClick={() => setShow(!show)} aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="grid size-9 place-items-center rounded-full text-label-2 hover:bg-fill">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />

          <AnimatePresence>
            {err && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl bg-[color-mix(in_srgb,var(--red)_12%,transparent)] px-4 py-2.5 t-foot text-ios-red" role="alert">{err}</motion.p>}
          </AnimatePresence>

          <motion.button type="submit" disabled={busy} whileTap={{ scale: 0.97 }}
            className="auth-cta relative !mt-6 flex h-[58px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-[20px] t-body font-bold text-white disabled:opacity-70">
            <span className="auth-cta-shine" aria-hidden />
            {busy ? <Spinner /> : <>{mode === "login" ? "دخول" : "إنشاء الحساب"}<ArrowLeft size={20} strokeWidth={2.6} /></>}
          </motion.button>
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

/** Floating-label field with a leading icon and a glowing focus ring. */
function Field({ icon, label, value, onChange, ltr, end, ...rest }: {
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; ltr?: boolean; end?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [focus, setFocus] = useState(false);
  const up = focus || value.length > 0;
  return (
    <label className={cx("auth-field relative flex h-[62px] items-center gap-3 rounded-[20px] px-4 transition-shadow", focus && "is-focus")}>
      <span className={cx("transition-colors", focus ? "text-accent" : "text-label-3")}>{icon}</span>
      <span className="relative h-full flex-1">
        <span className={cx("pointer-events-none absolute inset-x-0 origin-right truncate transition-all duration-200",
          up ? "top-2 t-cap font-semibold " + (focus ? "text-accent" : "text-label-2") : "top-1/2 -translate-y-1/2 t-callout text-label-3")}>{label}</span>
        <input
          {...rest} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          dir={ltr ? "ltr" : undefined} style={ltr ? { textAlign: "right" } : undefined}
          className="absolute inset-x-0 bottom-2 h-7 w-full bg-transparent t-body outline-none"
        />
      </span>
      {end}
    </label>
  );
}
