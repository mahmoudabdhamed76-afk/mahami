"use client";
import { Search } from "lucide-react";
import { useMemo } from "react";
import { endOfDay, startOfDay } from "@/client/dates";
import { useFmt } from "@/client/format";
import { isDueToday, isOverdue, sortTasks, useNow, useSubtasksByTask, useTasks } from "@/client/hooks";
import { useStore } from "@/client/store";
import { useContextDraft, useUI } from "@/client/ui";
import { IconButton } from "../ui/primitives";
import { Page } from "../ui/Page";
import { TaskGroup } from "../tasks/TaskRow";
import { SyncBadge } from "../SyncBadge";
import { TodayHero } from "../TodayHero";

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
  const first = user?.name?.split(" ")[0] ?? "";
  const remaining = overdue.length + today.length;

  return (
    <Page
      title="اليوم"
      subtitle={fmt.date(now, { weekday: "long", day: "numeric", month: "long" })}
      actions={<><SyncBadge compact /><IconButton label="بحث" onClick={() => { useUI.getState().setTab("lists"); useUI.getState().setSearch(true); }}><Search size={21} /></IconButton></>}
      headerExtra={
        <TodayHero greeting={`${greeting(new Date(now).getHours())}${first ? `، ${first}` : ""}`}
          overdue={overdue} today={today} done={doneToday} allTasks={tasks} now={now} />
      }
    >
      {overdue.length > 0 && <TaskGroup title="متأخرة" tone="danger" tasks={overdue} subtasks={subs} now={now} />}
      {today.length > 0 && <TaskGroup title="مهام اليوم" tasks={today} subtasks={subs} now={now} showDate={false} />}
      {doneToday.length > 0 && (
        <TaskGroup title="أُنجزت اليوم" tasks={doneToday} subtasks={subs} now={now} showDate={false} collapsible defaultOpen={remaining === 0} />
      )}
    </Page>
  );
}
