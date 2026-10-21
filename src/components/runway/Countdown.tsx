"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check, TimerReset } from "lucide-react";
import { toggleTask, updateTask } from "@/client/actions";
import { useStore } from "@/client/store";
import { useUI } from "@/client/ui";
import { cx, Press } from "../ui/primitives";
import type { BodyProps } from "../TaskRunway";
import { useEta } from "./core";

const R = 52, C = 2 * Math.PI * R;

/** Countdown: the next task in a big draining ring with a live h:mm:ss, the rest as small cards. */
export function CountdownBody({ riding, bursts }: BodyProps) {
  const { eta, short, clock, fmt } = useEta();
  const openTask = useUI((s) => s.openTask);
  const toast = useStore((s) => s.toast);
  const cats = useStore((s) => s.categories);
  const next = riding[0];
  const rest = riding.slice(1, 5);

  if (!next) {
    return <div className="runway grid min-h-24 place-items-center rounded-[26px] px-6 text-center t-foot text-label-2">مفيش مهام جاية دلوقتي — شوف اللي وصل تحت 👇</div>;
  }

  const win = next.min <= 60 ? 60 : next.min <= 360 ? 360 : next.min <= 1440 ? 1440 : 2880;
  const frac = Math.max(0.005, Math.min(1, next.min / win));
  const unit = next.min < 60 ? "دقيقة باقية" : next.min < 1440 ? "ساعة باقية" : "يوم باقي";
  const ang = -Math.PI / 2 + frac * 2 * Math.PI;
  const cat = next.t.categoryId ? cats[next.t.categoryId] : null;
  const near = next.min <= 15;

  const snooze = () => {
    updateTask(next.t.id, { dueAt: new Date(Date.parse(next.t.dueAt!) + 10 * 60_000).toISOString() });
    toast({ text: `اتأجلت «${next.t.title}» ١٠ دقايق`, icon: "check" }, 2200);
  };

  return (
    <div>
      <AnimatePresence mode="wait">
        <motion.div key={next.t.id} initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -14, scale: 0.97 }}
          className={cx("runway relative flex items-center gap-4 overflow-hidden rounded-[26px] p-4", near && "countdown-near")} style={{ ["--car" as string]: next.color }}>
          <button type="button" onClick={() => openTask(next.t.id)} className="relative size-[132px] shrink-0" aria-label={`${next.t.title} ${eta(next.min)}`}>
            <svg viewBox="0 0 120 120" className="size-full">
              <defs>
                <linearGradient id="cd-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={next.color} /><stop offset="1" stopColor="#bf5af2" /></linearGradient>
              </defs>
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--fill-2)" strokeWidth="9" />
              <circle cx="60" cy="60" r={R} fill="none" stroke="url(#cd-grad)" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 60 60)" className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
              <circle cx={60 + R * Math.cos(ang)} cy={60 + R * Math.sin(ang)} r="6.5" fill="#fff" className="transition-all duration-1000 ease-linear" />
              <circle cx={60 + R * Math.cos(ang)} cy={60 + R * Math.sin(ang)} r="3" fill={next.color} className="countdown-tick transition-all duration-1000 ease-linear" />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cx("font-bold num tracking-tight", next.min >= 60 ? "text-[1.15rem]" : "text-[1.45rem]", near && "text-ios-orange")}>{clock(next.min)}</span>
              <span className="t-cap text-label-2">{unit}</span>
            </span>
            <AnimatePresence>
              {bursts.map((id) => (
                <motion.span key={id} className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
                  initial={{ scale: 0.8, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }} />
              ))}
            </AnimatePresence>
          </button>
          <div className="min-w-0 flex-1">
            <p className="t-cap font-semibold text-accent">المهمة الجاية</p>
            <button type="button" onClick={() => openTask(next.t.id)} className="block w-full text-start">
              <span className="line-clamp-2 t-title3 leading-snug">{next.t.title}</span>
            </button>
            <p className="mt-0.5 flex items-center gap-1 t-cap text-label-2">
              {fmt.relDay(next.t.dueAt!) !== "اليوم" && <>{fmt.relDay(next.t.dueAt!)} · </>}{fmt.time(next.t.dueAt!)}
              {cat && <> · <span className="size-1.5 rounded-full" style={{ background: cat.color }} />{cat.name}</>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Press onClick={() => toggleTask(next.t.id)} scale={0.92} className="inline-flex h-8 items-center gap-1 rounded-full bg-ios-green px-3.5 t-foot font-bold text-[#04170b]">
                <Check size={15} strokeWidth={3} /> تم
              </Press>
              <Press onClick={snooze} scale={0.92} className="inline-flex h-8 items-center gap-1 rounded-full bg-fill px-3 t-foot font-semibold">
                <TimerReset size={15} /> +١٠ د
              </Press>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {rest.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <AnimatePresence initial={false}>
            {rest.map(({ t, min, p, color }) => (
              <motion.button key={t.id} layout type="button" onClick={() => openTask(t.id)}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="glass-strong rounded-2xl px-3 py-2 text-start">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate t-sub font-semibold">{t.title}</span>
                  <span className="shrink-0 t-cap font-semibold text-label-2 num">{short(min)}</span>
                </span>
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-fill-2">
                  <span className="block h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${Math.max(4, (1 - p) * 100)}%`, background: color }} />
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
