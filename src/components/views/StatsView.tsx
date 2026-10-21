"use client";
import { motion } from "motion/react";
import { AlarmClock, CheckCircle2, Flame, Timer, TrendingUp, Trophy } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { addDays, dayKey, startOfDay, startOfWeek } from "@/client/dates";
import { useFmt } from "@/client/format";
import { isOverdue, useCategories, useNow, useTasks } from "@/client/hooks";
import { useStore } from "@/client/store";
import { CategoryIcon } from "../ui/icons";
import { cx, PRIORITY, ProgressRing, Segmented } from "../ui/primitives";
import { Page } from "../ui/Page";

export function StatsView() {
  const now = useNow();
  const fmt = useFmt();
  const tasks = useTasks();
  const cats = useCategories();
  const weekStart = useStore((s) => s.settings.weekStart);
  const [range, setRange] = useState<7 | 30>(7);

  const s = useMemo(() => {
    const today = startOfDay(now);
    const perDay = new Map<string, number>();
    let doneTotal = 0, active = 0, overdue = 0;
    const leadTimes: number[] = [];
    const weekday = Array(7).fill(0);
    for (const t of tasks) {
      if (t.completed && t.completedAt) {
        doneTotal++;
        const c = new Date(t.completedAt);
        const k = dayKey(c);
        perDay.set(k, (perDay.get(k) ?? 0) + 1);
        weekday[c.getDay()]++;
        const lead = (c.getTime() - Date.parse(t.createdAt)) / 60000;
        if (lead >= 0) leadTimes.push(lead);
      } else if (!t.completed) {
        active++;
        if (isOverdue(t, now)) overdue++;
      }
    }
    const series = Array.from({ length: range }, (_, i) => {
      const d = addDays(today, i - range + 1);
      return { d, n: perDay.get(dayKey(d)) ?? 0 };
    });
    // Streak: consecutive days with ≥1 completion ending today (or yesterday)
    let streak = 0;
    let cursor = perDay.get(dayKey(today)) ? today : addDays(today, -1);
    while (perDay.get(dayKey(cursor))) { streak++; cursor = addDays(cursor, -1); }
    let best = 0, run = 0;
    for (let i = 365; i >= 0; i--) { if (perDay.get(dayKey(addDays(today, -i)))) best = Math.max(best, ++run); else run = 0; }

    const wkStart = startOfWeek(now, weekStart).getTime();
    const weekTasks = tasks.filter((t) => t.dueAt && Date.parse(t.dueAt) >= wkStart && Date.parse(t.dueAt) < addDays(wkStart, 7).getTime());
    const weekDone = weekTasks.filter((t) => t.completed).length;
    const doneThisWeek = [...perDay.entries()].filter(([k]) => new Date(k + "T12:00").getTime() >= wkStart).reduce((a, [, n]) => a + n, 0);

    const last30 = addDays(today, -29).getTime();
    const created30 = tasks.filter((t) => Date.parse(t.createdAt) >= last30);
    const rate30 = created30.length ? created30.filter((t) => t.completed).length / created30.length : 0;

    leadTimes.sort((a, b) => a - b);
    const median = leadTimes.length ? leadTimes[Math.floor(leadTimes.length / 2)] : null;
    const bestDay = weekday.some(Boolean) ? weekday.indexOf(Math.max(...weekday)) : null;

    const heat = Array.from({ length: 12 * 7 }, (_, i) => {
      const d = addDays(startOfWeek(addDays(today, -7 * 11), weekStart), i);
      return { d, n: perDay.get(dayKey(d)) ?? 0, future: d > today };
    });
    const prio = [3, 2, 1, 0].map((p) => ({ p, n: tasks.filter((t) => !t.completed && t.priority === p).length }));
    return { doneToday: perDay.get(dayKey(today)) ?? 0, doneThisWeek, doneTotal, active, overdue, streak, best, series, weekRatio: weekTasks.length ? weekDone / weekTasks.length : 0, weekTasks: weekTasks.length, weekDone, rate30, median, bestDay, heat, prio };
  }, [tasks, now, range, weekStart]);

  const catStats = useMemo(() => cats.map((c) => {
    const list = tasks.filter((t) => t.categoryId === c.id);
    const done = list.filter((t) => t.completed).length;
    return { c, total: list.length, done };
  }).filter((x) => x.total > 0).sort((a, b) => b.total - a.total), [cats, tasks]);

  const max = Math.max(1, ...s.series.map((x) => x.n));
  const heatMax = Math.max(1, ...s.heat.map((x) => x.n));

  return (
    <Page title="الإحصائيات" subtitle="نظرة على إنتاجيتك">
      {/* Weekly hero */}
      <div className="glass mb-4 flex items-center gap-5 rounded-[26px] p-5">
        <ProgressRing value={s.weekRatio} size={96} stroke={10} color="var(--green)">
          <div className="text-center">
            <p className="t-title3 num">{fmt.pct(s.weekRatio)}</p>
            <p className="t-cap text-label-2">الأسبوع</p>
          </div>
        </ProgressRing>
        <div className="flex-1">
          <p className="t-headline">تقدّم هذا الأسبوع</p>
          <p className="mt-1 t-sub text-label-2">أنجزت {fmt.num(s.weekDone)} من {fmt.num(s.weekTasks)} مهمة مجدولة لهذا الأسبوع.</p>
          {s.streak > 1 && <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--orange)_15%,transparent)] px-2.5 py-1 t-foot font-semibold text-ios-orange"><Flame size={14} /> {fmt.num(s.streak)} أيام متتالية!</p>}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Stat icon={<CheckCircle2 size={18} />} color="var(--green)" value={fmt.num(s.doneToday)} label="أُنجزت اليوم" />
        <Stat icon={<TrendingUp size={18} />} color="var(--accent)" value={fmt.num(s.doneThisWeek)} label="أُنجزت هذا الأسبوع" />
        <Stat icon={<AlarmClock size={18} />} color="var(--red)" value={fmt.num(s.overdue)} label="متأخرة" />
        <Stat icon={<Flame size={18} />} color="var(--orange)" value={fmt.num(s.streak)} label={`سلسلة الأيام · الأفضل ${fmt.num(s.best)}`} />
      </div>

      {/* Bar chart */}
      <Section title="المهام المنجزة" action={<Segmented id="range" className="w-40" value={range} onChange={setRange} options={[{ value: 7, label: "٧ أيام" }, { value: 30, label: "٣٠ يومًا" }]} />}>
        <div className="flex h-44 items-end gap-[3px] pt-4" role="img" aria-label="رسم بياني للمهام المنجزة يوميًا">
          {s.series.map(({ d, n }, i) => (
            <div key={dayKey(d)} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              {range === 7 && <span className="t-cap font-semibold text-label-2 num">{n ? fmt.num(n) : ""}</span>}
              <motion.div
                className={cx("w-full max-w-9 rounded-t-[8px] rounded-b-[3px]", i === s.series.length - 1 ? "glass-pill" : "bg-[rgb(var(--accent-rgb)/0.45)]")}
                initial={{ height: 0 }} animate={{ height: `${Math.max(n ? 6 : 2, (n / max) * 100)}%` }}
                transition={{ type: "spring", stiffness: 160, damping: 20, delay: i * (range === 7 ? 0.04 : 0.01) }}
                title={`${fmt.date(d)}: ${fmt.num(n)}`}
              />
              {range === 7 && <span className="t-cap text-label-2">{fmt.weekday(d, "narrow")}</span>}
            </div>
          ))}
        </div>
        {range === 30 && <div className="mt-2 flex justify-between t-cap text-label-3"><span>{fmt.date(s.series[0].d)}</span><span>اليوم</span></div>}
      </Section>

      {/* Heatmap */}
      <Section title="خريطة النشاط" subtitle="آخر ١٢ أسبوعًا">
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }} dir="ltr">
          {s.heat.map(({ d, n, future }) => (
            <span key={dayKey(d)} title={`${fmt.date(d)}: ${fmt.num(n)}`}
              className="aspect-square rounded-[4px]"
              style={{ background: future ? "transparent" : n ? `rgb(var(--accent-rgb) / ${0.25 + (n / heatMax) * 0.75})` : "var(--fill)" }} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 t-cap text-label-3">أقل
          {[0, 0.3, 0.55, 0.8, 1].map((o) => <span key={o} className="size-3 rounded-[3px]" style={{ background: o ? `rgb(var(--accent-rgb) / ${o})` : "var(--fill)" }} />)} أكثر
        </div>
      </Section>

      {/* Categories */}
      {catStats.length > 0 && (
        <Section title="حسب القائمة">
          <div className="space-y-3.5">
            {catStats.map(({ c, total, done }) => (
              <div key={c.id} className="flex items-center gap-3">
                <CategoryIcon icon={c.icon} color={c.color} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between t-sub"><span className="truncate font-medium">{c.name}</span><span className="text-label-2 num">{fmt.num(done)}/{fmt.num(total)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-fill">
                    <motion.div className="h-full rounded-full" style={{ background: c.color }} initial={{ width: 0 }} animate={{ width: `${(done / total) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Priority */}
      <Section title="المهام الحالية حسب الأولوية">
        <div className="flex h-3 overflow-hidden rounded-full bg-fill">
          {s.prio.filter((x) => x.n).map((x) => (
            <motion.div key={x.p} style={{ background: x.p ? PRIORITY[x.p].color : "var(--label-3)" }} initial={{ width: 0 }} animate={{ width: `${(x.n / Math.max(1, s.active)) * 100}%` }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {s.prio.map((x) => (
            <div key={x.p} className="flex items-center gap-2 t-foot">
              <span className="size-2.5 rounded-full" style={{ background: x.p ? PRIORITY[x.p].color : "var(--label-3)" }} />
              <span className="text-label-2">{x.p ? PRIORITY[x.p].label : "بدون أولوية"}</span>
              <span className="ms-auto font-semibold num">{fmt.num(x.n)}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Insights */}
      <Section title="رؤى">
        <div className="space-y-3">
          <Insight icon={<Trophy size={18} />} color="var(--yellow)">
            {s.bestDay !== null ? <>أكثر أيامك إنتاجية: <b>{fmt.weekday(addDays(startOfWeek(now, 0), s.bestDay))}</b></> : "أنجز بعض المهام لنكتشف أكثر أيامك إنتاجية."}
          </Insight>
          <Insight icon={<Timer size={18} />} color="var(--accent)">
            {s.median !== null ? <>متوسط الوقت من إنشاء المهمة حتى إنجازها: <b>{fmt.duration(s.median)}</b></> : "لا توجد بيانات كافية عن وقت الإنجاز بعد."}
          </Insight>
          <Insight icon={<TrendingUp size={18} />} color="var(--green)">
            نسبة إنجاز المهام التي أنشأتها خلال آخر ٣٠ يومًا: <b>{fmt.pct(s.rate30)}</b> · إجمالي المنجز: <b>{fmt.num(s.doneTotal)}</b>
          </Insight>
        </div>
      </Section>
    </Page>
  );
}

function Stat({ icon, color, value, label }: { icon: ReactNode; color: string; value: string; label: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-[20px] p-4">
      <span className="grid size-8 place-items-center rounded-full" style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>{icon}</span>
      <p className="mt-2 t-title2 num">{value}</p>
      <p className="t-foot text-label-2">{label}</p>
    </motion.div>
  );
}

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="glass mb-4 rounded-[24px] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div><h2 className="t-headline">{title}</h2>{subtitle && <p className="t-foot text-label-2">{subtitle}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Insight({ icon, color, children }: { icon: ReactNode; color: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full" style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}>{icon}</span>
      <p className="t-sub leading-relaxed text-label-2 [&_b]:font-semibold [&_b]:text-label">{children}</p>
    </div>
  );
}
