"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFmt } from "@/client/format";
import { useStore } from "@/client/store";
import type { RunwayStyle, TaskRec } from "@/lib/types";

export const HORIZON_MIN = 48 * 60; // tasks further than 48h wait off-track
export const TICKS: [number, string][] = [[60, "ساعة"], [360, "٦ س"], [1440, "يوم"]];

/** Log scale 0 (now) → 1 (48h): the last hour takes a big share, so near tasks visibly travel. */
export const pos = (min: number) => Math.min(1, Math.log1p(Math.max(0, min) / 12) / Math.log1p(HORIZON_MIN / 12));

export interface RunItem { t: TaskRec; min: number; p: number; color: string }

export const STYLE_INFO: Record<RunwayStyle, { name: string; desc: string }> = {
  lanes: { name: "المسار", desc: "حارات أفقية والمهام بتمشي ناحية «الآن»" },
  radar: { name: "الرادار", desc: "المهام نقط بتقرّب من المركز والشعاع بيلف" },
  road: { name: "الطريق", desc: "عربيات جاية من بعيد بتكبر لحد ما توصلك" },
  metro: { name: "خط المترو", desc: "خط زمني رأسي والمهام محطات" },
  countdown: { name: "العدّاد", desc: "عدّاد تنازلي كبير لأقرب مهمة" },
  orbit: { name: "المدار", desc: "قرص ساعة ١٢ ساعة وأقواس لحد كل مهمة" },
  capsules: { name: "الكبسولات", desc: "كبسولات زجاج بتتملي سائل لحد ما توصل" },
};

/** Stable pseudo-random 0..1 from a string (used for radar angles etc.). */
export function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10007) / 10007;
}

/** Shared clock + classification of timed tasks for every runway style. */
export function useRunway(tasks: TaskRec[]) {
  const cats = useStore((s) => s.categories);
  const [now, setNow] = useState(() => Date.now());
  const [bursts, setBursts] = useState<string[]>([]);
  const prevArrived = useRef<Set<string> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const data = useMemo(() => {
    const color = (t: TaskRec) => (t.categoryId && cats[t.categoryId]?.color) || "var(--accent)";
    const timed = tasks
      .filter((t) => !t.completed && !t.deletedAt && t.dueAt && !t.allDay)
      .map((t) => { const min = (Date.parse(t.dueAt!) - now) / 60000; return { t, min, p: pos(min), color: color(t) }; })
      .sort((a, b) => a.min - b.min);
    const docked = timed.filter((x) => x.min <= 0 && x.min > -12 * 60);
    const riding = timed.filter((x) => x.min > 0 && x.min <= HORIZON_MIN);
    const later = timed.filter((x) => x.min > HORIZON_MIN).length;
    const sod = new Date(now); sod.setHours(0, 0, 0, 0);
    const doneToday = tasks
      .filter((t) => t.completed && !t.deletedAt && t.dueAt && !t.allDay && Date.parse(t.dueAt) >= sod.getTime() && Date.parse(t.dueAt) <= now)
      .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
      .map((t) => ({ t, color: color(t) }));
    return { riding, docked, later, doneToday };
  }, [tasks, now, cats]);

  // Detect arrivals (crossing zero while the screen is open) → burst
  useEffect(() => {
    const ids = new Set(data.docked.map((d) => d.t.id));
    const prev = prevArrived.current;
    if (prev) {
      const fresh = [...ids].filter((id) => !prev.has(id));
      if (fresh.length) {
        setBursts((b) => [...b, ...fresh]);
        if (typeof navigator !== "undefined") navigator.vibrate?.([12, 60, 12]);
        setTimeout(() => setBursts((b) => b.filter((x) => !fresh.includes(x))), 1800);
      }
    }
    prevArrived.current = ids;
  }, [data.docked]);

  return { now, bursts, ...data };
}

/** Human ETA strings shared by all styles. */
export function useEta() {
  const fmt = useFmt();
  const pad = (n: number) => String(n).padStart(2, "0").replace(/\d/g, (d) => fmt.num(+d));
  const eta = (min: number) => {
    if (min < 1) return "دلوقتي";
    if (min < 60) return `بعد ${fmt.num(Math.ceil(min))} د`;
    if (min < 3 * 60) { const tot = Math.round(min), h = Math.floor(tot / 60), m = tot % 60; return m ? `بعد ${fmt.num(h)}:${pad(m)} س` : `بعد ${fmt.num(h)} س`; }
    if (min < 24 * 60) return `بعد ${fmt.num(Math.round(min / 60))} س`;
    return `بعد ${fmt.num(Math.round(min / 1440))} يوم`;
  };
  /** compact: "٥٤ د" / "٤ س" / "٢ يوم" */
  const short = (min: number) => {
    if (min < 1) return "الآن";
    if (min < 60) return `${fmt.num(Math.ceil(min))} د`;
    if (min < 24 * 60) return `${fmt.num(Math.round(min / 60))} س`;
    return `${fmt.num(Math.round(min / 1440))} يوم`;
  };
  /** countdown clock "h:mm:ss" / "mm:ss" */
  const clock = (min: number) => {
    const s = Math.max(0, Math.floor(min * 60));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${fmt.num(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };
  const hhmm = (iso: string) => fmt.time(iso).replace(/\s?[صم]$/, "");
  return { eta, short, clock, hhmm, fmt };
}

export function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => { setR(matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  return r;
}
