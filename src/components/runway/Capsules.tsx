"use client";
import { AnimatePresence, motion } from "motion/react";
import { useUI } from "@/client/ui";
import { cx } from "../ui/primitives";
import type { BodyProps } from "../TaskRunway";
import { hash01, useEta } from "./core";

/** Capsules: liquid-glass vials that fill up in the task's colour as its time approaches. */
export function CapsulesBody({ riding, bursts }: BodyProps) {
  const { eta, short, fmt } = useEta();
  const openTask = useUI((s) => s.openTask);
  const items = riding.slice(0, 12);

  return (
    <div className="runway relative overflow-hidden rounded-[26px]">
      <AnimatePresence>
        {bursts.length > 0 && (
          <motion.div key={bursts.join()} className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_50%,rgb(var(--accent-rgb)/0.35),transparent_60%)]"
            initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.6 }} />
        )}
      </AnimatePresence>
      <div className="scroll-x flex gap-3 overflow-x-auto px-4 pb-3 pt-4 [scrollbar-width:none]">
        <AnimatePresence initial={false}>
          {items.map(({ t, min, p, color }) => {
            const fill = Math.max(0.06, Math.min(0.97, 1 - p));
            const near = min <= 15;
            const seed = hash01(t.id);
            return (
              <motion.button key={t.id} layout type="button" onClick={() => openTask(t.id)} title={`${t.title} — ${eta(min)}`}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6, y: -20 }}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center" style={{ ["--car" as string]: color }}>
                <span className={cx("capsule relative block h-[150px] w-[60px] overflow-hidden rounded-full", near && "capsule-near")}>
                  {/* liquid */}
                  <span className="capsule-liquid absolute inset-x-0 bottom-0" style={{ height: `${fill * 100}%`, background: `linear-gradient(to top, ${color}, color-mix(in srgb, ${color} 60%, white))` }}>
                    <span className="capsule-wave absolute inset-x-0 -top-[9px] h-[10px]" style={{ background: `color-mix(in srgb, ${color} 60%, white)`, animationDuration: `${2.2 + seed * 1.4}s` }} aria-hidden />
                    <span className="absolute inset-0 overflow-hidden" aria-hidden>
                      {[0, 1, 2].map((b) => (
                        <span key={b} className="capsule-bubble absolute bottom-1 rounded-full bg-white/60"
                          style={{ left: `${20 + b * 25 + seed * 10}%`, width: 4 + b, height: 4 + b, animationDuration: `${(near ? 1.2 : 2.8) + b * 0.7}s`, animationDelay: `${b * 0.9 + seed}s` }} />
                      ))}
                    </span>
                  </span>
                  {/* glass highlight + reading */}
                  <span className="pointer-events-none absolute inset-y-3 right-2 w-1.5 rounded-full bg-white/35" />
                  <span className={cx("absolute inset-x-0 top-3 t-cap font-bold num", fill > 0.85 ? "text-white" : near ? "text-ios-orange" : "text-label")}>{short(min)}</span>
                </span>
                <span className="t-cap font-semibold text-label-2 num">{fmt.time(t.dueAt!)}</span>
                <span className="line-clamp-2 w-full t-cap font-semibold leading-tight">{t.title}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
