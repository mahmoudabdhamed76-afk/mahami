"use client";
import { AnimatePresence, motion } from "motion/react";
import { BellRing } from "lucide-react";
import { useStore } from "@/client/store";
import { useUI } from "@/client/ui";
import type { RunwayStyle, TaskRec } from "@/lib/types";
import { useEta, useRunway, type RunItem } from "./runway/core";
import { LanesBody } from "./runway/Lanes";
import { RadarBody } from "./runway/Radar";
import { RoadBody } from "./runway/Road";
import { MetroBody } from "./runway/Metro";
import { CountdownBody } from "./runway/Countdown";
import { OrbitBody } from "./runway/Orbit";
import { CapsulesBody } from "./runway/Capsules";

export interface BodyProps {
  riding: RunItem[];
  docked: RunItem[];
  doneToday: { t: TaskRec; color: string }[];
  bursts: string[];
  now: number;
}

const BODIES: Record<RunwayStyle, (p: BodyProps) => React.ReactNode> = {
  lanes: LanesBody, radar: RadarBody, road: RoadBody, metro: MetroBody,
  countdown: CountdownBody, orbit: OrbitBody, capsules: CapsulesBody,
};

/**
 * "مهامي في الطريق" — timed tasks travel toward «الآن». The visual metaphor is
 * the user's choice (Settings → شكل «مهامي في الطريق»); all styles share the
 * same clock, arrival detection and "arrived" list.
 */
export function TaskRunway({ tasks, styleOverride }: { tasks: TaskRec[]; styleOverride?: RunwayStyle }) {
  const pref = useStore((s) => s.settings.runwayStyle);
  const style = styleOverride ?? pref ?? "lanes";
  const openTask = useUI((s) => s.openTask);
  const newTask = useUI((s) => s.newTask);
  const { now, bursts, riding, docked, later, doneToday } = useRunway(tasks);
  const { eta, fmt } = useEta();
  const Body = BODIES[style] ?? LanesBody;
  const next = riding[0];
  const empty = !riding.length && !docked.length;

  return (
    <section className="relative z-10 mt-2" aria-label="مهامي في الطريق" data-runway={style}>
      <div className="mb-2 flex items-end justify-between px-1">
        <div>
          <h2 className="t-headline">مهامي في الطريق</h2>
          <p className="t-cap text-label-2">
            {!empty
              ? next ? <>أقرب مهمة <b className="font-semibold text-label">{eta(next.min)}</b></> : "وصلت مهامك 👇"
              : "مفيش مهام بوقت محدد جاية"}
            {later > 0 && <> · <bdi className="num">{fmt.num(later)}</bdi> بعد يومين</>}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-fill px-2.5 py-1 t-cap font-semibold num">
          <span className="size-1.5 animate-pulse rounded-full bg-ios-green" />{fmt.time(now)}
        </span>
      </div>

      {empty && style !== "lanes" ? (
        <button type="button" onClick={() => newTask(undefined, true)}
          className="runway flex min-h-28 w-full items-center justify-center rounded-[22px] px-6 text-center t-foot text-label-2">
          حدّد وقت لمهامك وهتشوفها جاية في الطريق لحد ما توصل
        </button>
      ) : (
        <Body riding={riding} docked={docked} doneToday={doneToday} bursts={bursts} now={now} />
      )}

      {/* docked: time has come */}
      <AnimatePresence initial={false}>
        {docked.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 space-y-1.5">
            {docked.map(({ t, min }) => (
              <motion.button
                key={t.id} layout type="button" onClick={() => openTask(t.id)}
                initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -30 }}
                className="runway-arrived glass-strong flex w-full items-center gap-3 rounded-2xl px-3 py-2"
              >
                <span className="grid size-8 place-items-center rounded-full bg-[rgb(var(--accent-rgb)/0.16)] text-accent"><BellRing size={16} /></span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block truncate t-sub font-semibold">{t.title}</span>
                  <span className="block t-cap text-label-2">
                    {min > -1 ? "وصلت دلوقتي" : `وصلت من ${fmt.num(Math.round(-min) >= 60 ? Math.round(-min / 60) : Math.round(-min))} ${Math.round(-min) >= 60 ? "س" : "د"}`} · {fmt.time(t.dueAt!)}
                  </span>
                </span>
                <span className="t-cap font-semibold text-accent">افتح</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
