"use client";
import { useMemo } from "react";
import { useStore } from "./store";
import { daysBetween } from "./dates";
import type { TaskRec } from "@/lib/types";

export function makeFmt(digits: "arab" | "latn") {
  const loc = digits === "latn" ? "ar-EG-u-nu-latn" : "ar-EG";
  const cache = new Map<string, Intl.DateTimeFormat>();
  const dtf = (o: Intl.DateTimeFormatOptions) => {
    const k = JSON.stringify(o);
    let f = cache.get(k);
    if (!f) cache.set(k, (f = new Intl.DateTimeFormat(loc, o)));
    return f;
  };
  const nf = new Intl.NumberFormat(loc);
  const pf = new Intl.NumberFormat(loc, { style: "percent", maximumFractionDigits: 0 });

  const fmt = {
    locale: loc,
    num: (n: number) => nf.format(n),
    pct: (r: number) => pf.format(r),
    date: (d: Date | string | number, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) => dtf(o).format(new Date(d)),
    time: (d: Date | string | number) => dtf({ hour: "numeric", minute: "2-digit" }).format(new Date(d)),
    weekday: (d: Date | number, style: "long" | "short" | "narrow" = "long") => dtf({ weekday: style }).format(new Date(d)),
    month: (d: Date | number) => dtf({ month: "long", year: "numeric" }).format(new Date(d)),
    /** اليوم / غدًا / أمس / الخميس / ٢٥ أكتوبر */
    relDay: (d: Date | string | number, now = Date.now()) => {
      const n = daysBetween(now, new Date(d));
      if (n === 0) return "اليوم";
      if (n === 1) return "غدًا";
      if (n === -1) return "أمس";
      if (n === 2) return "بعد غد";
      if (n > 2 && n < 7) return fmt.weekday(new Date(d));
      const sameYear = new Date(d).getFullYear() === new Date(now).getFullYear();
      return fmt.date(d, sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "short", year: "numeric" });
    },
    due: (t: Pick<TaskRec, "dueAt" | "allDay">, now = Date.now()) => {
      if (!t.dueAt) return "";
      const day = fmt.relDay(t.dueAt, now);
      return t.allDay ? day : `${day}، ${fmt.time(t.dueAt)}`;
    },
    duration: (minutes: number) => {
      if (minutes < 60) return `${fmt.num(Math.round(minutes))} د`;
      if (minutes < 60 * 24) return `${fmt.num(Math.round(minutes / 60))} س`;
      return `${fmt.num(Math.round(minutes / 1440))} يوم`;
    },
  };
  return fmt;
}

export type Fmt = ReturnType<typeof makeFmt>;

export function useFmt() {
  const digits = useStore((s) => s.settings.digits);
  return useMemo(() => makeFmt(digits), [digits]);
}

/** Arabic plural helper for counts: (n, ["مهمة","مهمتان","مهام","مهمة"]) */
export function plural(n: number, forms: [one: string, two: string, few: string, many: string]) {
  if (n === 1) return forms[0];
  if (n === 2) return forms[1];
  if (n >= 3 && n <= 10) return forms[2];
  return forms[3];
}
