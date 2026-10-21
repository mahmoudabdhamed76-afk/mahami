"use client";
import { motion } from "motion/react";
import { PartyPopper, Search, Sun } from "lucide-react";
import { useMemo } from "react";
import { endOfDay, startOfDay } from "@/client/dates";
import { plural, useFmt } from "@/client/format";
import { isDueToday, isOverdue, sortTasks, useNow, useSubtasksByTask, useTasks } from "@/client/hooks";
import { useStore } from "@/client/store";
import { useContextDraft, useUI } from "@/client/ui";
import { EmptyState, IconButton, ProgressRing, Button } from "../ui/primitives";
import { Page } from "../ui/Page";
import { TaskGroup } from "../tasks/TaskRow";
import { SyncBadge } from "../SyncBadge";

function greeting(h: number) {
  if (h < 5) return "طابت ليلتك";
  if (h < 12) return "صباح الخير";
  if (h < 17) return "نهارك سعيد";
  return "مساء الخير";
}

export function TodayView() {
  const now = useNow();
  const fmt = useFmt();
  const tasks = useTasks();
  const subs = useSubtasksByTask();
  const user = useStore((s) => s.user);
  const newTask = useUI((s) => s.newTask);
  const todayIso = startOfDay(now).toISOString();
  useContextDraft({ dueAt: todayIso, allDay: true }, [todayIso]);

  const { overdue, today, doneToday } = useMemo(() => {
    const t0 = startOfDay(now).getTime(), t1 = endOfDay(now).getTime();
    const overdue: typeof tasks = [], today: typeof tasks = [], doneToday: typeof tasks = [];
    for (const t of tasks) {
      if (t.completed) {
        const c = t.completedAt ? Date.parse(t.completedAt) : 0;
        if ((c >= t0 && c <= t1) || isDueToday(t, now)) doneToday.push(t);
      } else if (isOverdue(t, now)) overdue.push(t);
      else if (isDueToday(t, now)) today.push(t);
    }
    return {
      overdue: sortTasks(overdue),
      today: sortTasks(today),
      doneToday: doneToday.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    };
  }, [tasks, now]);

  const total = overdue.length + today.length + doneToday.length;
  const ratio = total ? doneToday.length / total : 0;
  const first = user?.name?.split(" ")[0] ?? "";
  const remaining = overdue.length + today.length;

  return (
    <Page
      title="اليوم"
      subtitle={fmt.date(now, { weekday: "long", day: "numeric", month: "long" })}
      actions={<><SyncBadge compact /><IconButton label="بحث" onClick={() => { useUI.getState().setTab("lists"); useUI.getState().setSearch(true); }}><Search size={21} /></IconButton></>}
      headerExtra={
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass mb-6 flex items-center gap-4 rounded-[24px] p-4">
          <ProgressRing value={ratio} size={72} stroke={7}>
            <span className="t-headline num">{fmt.pct(ratio)}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="t-title3">{greeting(new Date(now).getHours())}{first ? `، ${first}` : ""}</p>
            <p className="mt-0.5 t-sub text-label-2">
              {total === 0
                ? "لا توجد مهام لليوم بعد."
                : remaining === 0
                  ? "أنجزت كل مهام اليوم 🎉"
                  : `أنجزت ${fmt.num(doneToday.length)} من ${fmt.num(total)} — باقي ${fmt.num(remaining)} ${plural(remaining, ["مهمة", "مهمتان", "مهام", "مهمة"])}`}
            </p>
            {overdue.length > 0 && <p className="mt-1 t-foot font-medium text-ios-red">{fmt.num(overdue.length)} {plural(overdue.length, ["مهمة متأخرة", "مهمتان متأخرتان", "مهام متأخرة", "مهمة متأخرة"])}</p>}
          </div>
        </motion.div>
      }
    >
      {overdue.length > 0 && <TaskGroup title="متأخرة" tone="danger" tasks={overdue} subtasks={subs} now={now} />}
      {today.length > 0 && <TaskGroup title="مهام اليوم" tasks={today} subtasks={subs} now={now} showDate={false} />}
      {remaining === 0 && (
        <EmptyState
          icon={doneToday.length ? <PartyPopper size={34} /> : <Sun size={34} />}
          title={doneToday.length ? "يوم منجز بالكامل!" : "يومك فاضي"}
          text={doneToday.length ? "استرح قليلًا، أو خطّط لغدٍ أفضل." : "أضف مهمة لليوم وابدأ بخطوة صغيرة."}
          action={<Button onClick={() => newTask({ dueAt: startOfDay(now).toISOString(), allDay: true })}>إضافة مهمة لليوم</Button>}
        />
      )}
      {doneToday.length > 0 && (
        <TaskGroup title="أُنجزت اليوم" tasks={doneToday} subtasks={subs} now={now} showDate={false} collapsible defaultOpen={remaining === 0} />
      )}
    </Page>
  );
}
