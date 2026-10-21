"use client";
import { ArrowUpDown, CheckCircle2, Eye, EyeOff, Pencil, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { startOfDay } from "@/client/dates";
import { useFmt } from "@/client/format";
import { bucketByDate, matchesSmart, sortTasks, useNow, useSubtasksByTask, useTasks } from "@/client/hooks";
import { useStore } from "@/client/store";
import { useContextDraft, useUI, type Route, type SmartList } from "@/client/ui";
import type { TaskRec } from "@/lib/types";
import { CategoryIcon } from "../ui/icons";
import { Button, cx, EmptyState, IconButton, PRIORITY } from "../ui/primitives";
import { Page } from "../ui/Page";
import { TaskGroup } from "../tasks/TaskRow";
import { SMART } from "./ListsView";

type Sort = "due" | "priority" | "created" | "title";
const SORTS: [Sort, string][] = [["due", "الموعد"], ["priority", "الأولوية"], ["created", "الأحدث"], ["title", "الاسم"]];

export function ListView({ route }: { route: Route }) {
  const now = useNow();
  const fmt = useFmt();
  const tasks = useTasks();
  const subs = useSubtasksByTask();
  const weekStart = useStore((s) => s.settings.weekStart);
  const isCat = route.list.startsWith("cat:");
  const catId = isCat ? route.list.slice(4) : null;
  const cat = useStore((s) => (catId ? s.categories[catId] : undefined));
  const smart = isCat ? null : (route.list as SmartList);
  const editCategory = useUI((s) => s.editCategory);
  const newTask = useUI((s) => s.newTask);
  const [sort, setSort] = useState<Sort>("due");
  const [prio, setPrio] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);

  useContextDraft(
    catId ? { categoryId: catId } : smart === "today" ? { dueAt: startOfDay(now).toISOString(), allDay: true } : smart === "important" ? { priority: 3 } : undefined,
    [catId, smart],
  );

  const { active, done } = useMemo(() => {
    const active: TaskRec[] = [], done: TaskRec[] = [];
    for (const t of tasks) {
      if (prio !== null && t.priority !== prio) continue;
      if (catId) { if (t.categoryId === catId) (t.completed ? done : active).push(t); }
      else if (smart && matchesSmart(smart, t, now)) (t.completed ? done : active).push(t);
    }
    done.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    return { active, done };
  }, [tasks, catId, smart, now, prio]);

  // Completed list: group by completion day
  const doneGroups = useMemo(() => {
    if (smart !== "completed") return [];
    const g = new Map<string, TaskRec[]>();
    for (const t of done) {
      const k = t.completedAt ? fmt.relDay(t.completedAt, now) : "—";
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(t);
    }
    return [...g.entries()];
  }, [done, smart, fmt, now]);

  if (isCat && !cat) {
    return <Page title="القائمة" back="المهام"><EmptyState icon={<Inbox size={32} />} title="القائمة غير موجودة" text="ربما حُذفت من جهاز آخر." /></Page>;
  }

  const title = cat ? cat.name : SMART[smart!].label;
  const total = active.length + done.length;
  const groupedByDate = sort === "due" && (smart === "scheduled" || smart === "all" || smart === "today" || isCat);
  const sections = groupedByDate ? bucketByDate(active, now, weekStart, (d) => fmt.relDay(d)) : [{ key: "all", title: "", tasks: sortTasks(active, sort) }];

  const toolbar = (
    <div className="no-scrollbar -mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4">
      <label className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-fill px-3 t-foot font-semibold">
        <ArrowUpDown size={15} />
        <span>ترتيب: {SORTS.find((s) => s[0] === sort)![1]}</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="ترتيب" className="absolute inset-0 cursor-pointer opacity-0">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {[3, 2, 1].map((p) => (
        <button key={p} type="button" onClick={() => setPrio(prio === p ? null : p)}
          className={cx("inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 t-foot font-semibold transition-colors", prio === p ? "glass-pill text-white" : "bg-fill")}>
          <span style={{ color: prio === p ? undefined : PRIORITY[p].color }}>{PRIORITY[p].short}</span> {PRIORITY[p].label}
        </button>
      ))}
      {smart !== "completed" && (
        <button type="button" onClick={() => setShowDone(!showDone)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-fill px-3 t-foot font-semibold">
          {showDone ? <EyeOff size={15} /> : <Eye size={15} />}{showDone ? "إخفاء المكتملة" : "إظهار المكتملة"}
        </button>
      )}
    </div>
  );

  return (
    <Page
      title={title}
      back="المهام"
      subtitle={`${fmt.num(active.length)} متبقية${done.length ? ` · ${fmt.num(done.length)} مكتملة` : ""}`}
      actions={cat && <IconButton label="تعديل القائمة" onClick={() => editCategory(cat.id)}><Pencil size={19} /></IconButton>}
      headerExtra={
        <>
          {cat && total > 0 && (
            <div className="glass mb-4 flex items-center gap-3 rounded-[20px] p-3.5">
              <CategoryIcon icon={cat.icon} color={cat.color} size={40} />
              <div className="flex-1">
                <div className="mb-1.5 flex justify-between t-foot font-semibold"><span>التقدّم</span><span className="num">{fmt.pct(done.length / total)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-fill"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(done.length / total) * 100}%`, background: cat.color }} /></div>
              </div>
            </div>
          )}
          {toolbar}
        </>
      }
    >
      {smart === "completed" ? (
        doneGroups.length ? doneGroups.map(([k, list]) => <TaskGroup key={k} title={k} tasks={list} subtasks={subs} now={now} />)
          : <EmptyState icon={<CheckCircle2 size={32} />} title="لا مهام مكتملة بعد" text="المهام التي تنجزها ستظهر هنا." />
      ) : active.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={32} />}
          title={total ? "كل شيء مُنجز هنا ✨" : "لا توجد مهام"}
          text={prio !== null ? "لا مهام بهذه الأولوية." : "أضف مهمة جديدة لهذه القائمة."}
          action={<Button variant="tinted" onClick={() => newTask(useUI.getState().ctxDraft)}>مهمة جديدة</Button>}
        />
      ) : (
        sections.map((s) => (
          <TaskGroup key={s.key} title={s.title || undefined} tone={"tone" in s ? s.tone : undefined} tasks={s.tasks} subtasks={subs} now={now} showCategory={!isCat} />
        ))
      )}
      {showDone && smart !== "completed" && done.length > 0 && (
        <TaskGroup title="المكتملة" tasks={done} subtasks={subs} now={now} showCategory={!isCat} collapsible />
      )}
    </Page>
  );
}
