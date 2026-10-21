"use client";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CalendarDays, CalendarPlus, Check, Clock, Download, Flag, ListChecks, Plus, Tag, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  addSubtask, createTask, defaultReminder, deleteSubtask, deleteTask, restoreTask, toggleTask, updateSubtask, updateTask,
} from "@/client/actions";
import { addDays, combine, dayKey, startOfDay, timeKey } from "@/client/dates";
import { useFmt } from "@/client/format";
import { useCategories, useSubtasksByTask } from "@/client/hooks";
import { downloadIcs, googleCalendarUrl } from "@/client/ics";
import { useStore } from "@/client/store";
import { confirmDialog, useUI } from "@/client/ui";
import type { Priority, TaskRec } from "@/lib/types";
import { CategoryIcon } from "../ui/icons";
import { cx, Press, PRIORITY, Segmented, Switch } from "../ui/primitives";
import { Sheet, SheetHeader } from "../ui/Sheet";
import { Checkbox } from "./TaskRow";

export function TaskEditor() {
  const ed = useUI((s) => s.editor);
  const close = useUI((s) => s.closeEditor);
  const exists = useStore((s) => (ed?.id ? !!s.tasks[ed.id] : true));
  return (
    <Sheet open={!!ed && exists} onClose={close} label="تفاصيل المهمة" height="large">
      {ed && exists && <EditorBody key={ed.id ?? "new"} id={ed.id} draft={ed.draft} />}
    </Sheet>
  );
}

const TIMED_REMINDERS: [number, string][] = [[0, "عند الموعد"], [5, "قبل ٥ دقائق"], [15, "قبل ١٥ دقيقة"], [30, "قبل ٣٠ دقيقة"], [60, "قبل ساعة"], [120, "قبل ساعتين"], [1440, "قبل يوم"]];

// Props (not store reads) so the body can keep rendering during the sheet's exit animation.
function EditorBody({ id, draft }: { id?: string; draft?: Partial<TaskRec> }) {
  const close = useUI((s) => s.closeEditor);
  const live = useStore((s) => (id ? s.tasks[id] : undefined));
  const last = useRef(live);
  if (live) last.current = live;
  const existing = id ? last.current : undefined;
  const settings = useStore((s) => s.settings);
  const toast = useStore((s) => s.toast);
  const cats = useCategories();
  const subsByTask = useSubtasksByTask();
  const fmt = useFmt();
  const base: Partial<TaskRec> = existing ?? draft ?? {};

  const [title, setTitle] = useState(base.title ?? "");
  const [notes, setNotes] = useState(base.notes ?? "");
  const [day, setDay] = useState<string | null>(base.dueAt ? dayKey(new Date(base.dueAt)) : null);
  const [time, setTime] = useState<string | null>(base.dueAt && base.allDay === false ? timeKey(new Date(base.dueAt)) : null);
  const [priority, setPriority] = useState<Priority>((base.priority ?? 0) as Priority);
  const [categoryId, setCategoryId] = useState<string | null>(base.categoryId ?? null);
  const [offset, setOffset] = useState<number | null | undefined>(existing ? existing.reminderOffset : base.reminderOffset);
  const [customRemind, setCustomRemind] = useState<string | null>(
    existing?.remindAt && existing.reminderOffset == null ? toLocalInput(existing.remindAt) : null,
  );
  const [draftSubs, setDraftSubs] = useState<string[]>([]);
  const [newSub, setNewSub] = useState("");

  const subs = existing ? subsByTask[existing.id] ?? [] : [];
  const dueAt = day ? combine(day, time) : null;
  const allDay = !time;
  // New tasks get the default reminder until the user picks one explicitly
  const effOffset = offset === undefined ? defaultReminder(dueAt?.toISOString() ?? null, allDay) : offset;

  const reminderValue = customRemind ? "custom" : effOffset == null || !day ? "none" : String(effOffset);
  const reminderOptions = useMemo(() => {
    const [h, m] = settings.defaultReminderTime.split(":").map(Number);
    const atDefault = -(h * 60 + m);
    const label = fmt.time(new Date(2000, 0, 1, h, m));
    const base: [string, string][] = [["none", "بدون تذكير"]];
    if (day) {
      if (allDay) base.push([String(atDefault), `يوم الموعد ${label}`], [String(1440 + atDefault), `قبلها بيوم ${label}`]);
      else base.push(...TIMED_REMINDERS.map(([v, l]) => [String(v), l] as [string, string]));
    }
    base.push(["custom", "وقت مخصص…"]);
    return base;
  }, [day, allDay, settings.defaultReminderTime, fmt]);

  const canSave = title.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const patch = {
      title: title.trim(),
      notes: notes.trim() || null,
      dueAt: dueAt ? dueAt.toISOString() : null,
      allDay,
      priority,
      categoryId,
      reminderOffset: customRemind ? null : day ? effOffset ?? null : null,
      remindAt: customRemind ? new Date(customRemind).toISOString() : null,
    };
    if (existing) updateTask(existing.id, patch);
    else {
      createTask(patch, draftSubs);
      toast({ text: "أُضيفت المهمة", icon: "check" }, 2200);
    }
    close();
  };

  const remove = async () => {
    if (!existing) return close();
    const ok = await confirmDialog({ title: "حذف هذه المهمة؟", message: "يمكنك التراجع خلال ثوانٍ.", confirm: "حذف المهمة", destructive: true });
    if (!ok) return;
    const snap = deleteTask(existing.id);
    close();
    if (snap) toast({ text: "تم حذف المهمة", icon: "trash", action: { label: "تراجع", run: () => restoreTask(snap) } }, 5000);
  };

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    if (existing) addSubtask(existing.id, t);
    else setDraftSubs([...draftSubs, t]);
    setNewSub("");
  };

  const today = startOfDay(Date.now());
  const preview = existing ? { ...existing, title, notes, dueAt: dueAt?.toISOString() ?? null, allDay, remindAt: customRemind ? new Date(customRemind).toISOString() : existing.remindAt } : null;
  const doneCount = subs.filter((s) => s.done).length;

  return (
    <>
      <SheetHeader
        title={existing ? "تفاصيل المهمة" : "مهمة جديدة"}
        start={<button type="button" onClick={close} className="px-1 t-body text-accent">إلغاء</button>}
        end={<button type="button" onClick={save} disabled={!canSave} className="px-1 t-body font-semibold text-accent disabled:opacity-40">{existing ? "تم" : "إضافة"}</button>}
      />
      <div className="scroll-y flex-1 px-4 pb-[max(env(safe-area-inset-bottom),24px)]">
        {/* Title + notes */}
        <Group>
          <div className="flex items-start gap-3 px-4 py-3">
            {existing && (
              <div className="pt-1.5">
                <Checkbox checked={existing.completed} color={cats.find((c) => c.id === categoryId)?.color ?? "var(--accent)"} onToggle={() => toggleTask(existing.id)} label="إكمال" />
              </div>
            )}
            <textarea
              data-autofocus={!existing ? true : undefined}
              value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" aria-label="العنوان" rows={1}
              className={cx("flex-1 resize-none bg-transparent t-title3 outline-none placeholder:text-label-3 [field-sizing:content]", existing?.completed && "strike text-label-2")}
            />
          </div>
          <div className="row-sep px-4 pb-3 pt-2" style={{ ["--sep-inset" as string]: "1rem" }}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات" aria-label="ملاحظات" rows={2}
              className="min-h-14 w-full resize-none bg-transparent t-callout text-label-2 outline-none placeholder:text-label-3 [field-sizing:content]" />
          </div>
        </Group>

        {/* Date & time */}
        <Group>
          <Row icon={<CalendarDays size={18} />} color="#FF3B30" label="التاريخ" sub={day ? fmt.relDay(combine(day, null)) : undefined}>
            <Switch checked={!!day} onChange={(v) => { setDay(v ? dayKey(today) : null); if (!v) { setTime(null); setCustomRemind(null); } }} label="تحديد تاريخ" />
          </Row>
          <AnimatePresence initial={false}>
            {day && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-4 pb-3 ps-[3.75rem]">
                  {[["اليوم", 0], ["غدًا", 1], ["بعد أسبوع", 7]].map(([l, n]) => {
                    const k = dayKey(addDays(today, n as number));
                    return <Pill key={k} on={day === k} onClick={() => setDay(k)}>{l}</Pill>;
                  })}
                  <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="اختر التاريخ"
                    className="h-9 rounded-full bg-fill px-3 t-foot font-semibold outline-none" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <Row icon={<Clock size={18} />} color="#007AFF" label="الوقت" sub={time ? fmt.time(combine(day ?? dayKey(today), time)) : undefined}>
            <Switch checked={!!time} onChange={(v) => { if (v && !day) setDay(dayKey(today)); setTime(v ? nextHalfHour() : null); }} label="تحديد وقت" />
          </Row>
          <AnimatePresence initial={false}>
            {time && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-4 pb-3 ps-[3.75rem]">
                  <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label="اختر الوقت"
                    className="h-10 rounded-xl bg-fill px-3 t-callout font-semibold outline-none" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <Row icon={<Bell size={18} />} color="#FF9500" label="التذكير">
            <select
              value={reminderValue} aria-label="التذكير"
              onChange={(e) => {
                const v = e.target.value;
                if (v === "custom") { setCustomRemind(toLocalInput((dueAt ?? new Date(Date.now() + 3600_000)).toISOString())); setOffset(null); }
                else { setCustomRemind(null); setOffset(v === "none" ? null : Number(v)); }
              }}
              className="max-w-[55%] cursor-pointer appearance-none rounded-lg bg-transparent py-1 text-end t-callout text-label-2 outline-none"
            >
              {reminderOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Row>
          {customRemind && (
            <div className="px-4 pb-3 ps-[3.75rem]">
              <input type="datetime-local" value={customRemind} onChange={(e) => setCustomRemind(e.target.value)} aria-label="وقت التذكير"
                className="h-10 rounded-xl bg-fill px-3 t-callout font-semibold outline-none" />
            </div>
          )}
        </Group>

        {/* Priority & list */}
        <Group>
          <Row icon={<Flag size={18} />} color="#FF3B30" label="الأولوية" />
          <div className="px-4 pb-3">
            <Segmented id="prio" value={priority} onChange={(v) => setPriority(v as Priority)}
              options={PRIORITY.map((p, i) => ({ value: i, label: p.label }))} />
          </div>
          <div className="row-sep" style={{ ["--sep-inset" as string]: "3.75rem" }}>
            <Row icon={<Tag size={18} />} color="#5856D6" label="القائمة" />
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
            <Pill on={!categoryId} onClick={() => setCategoryId(null)}>بدون قائمة</Pill>
            {cats.map((c) => (
              <Pill key={c.id} on={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                <CategoryIcon icon={c.icon} color={c.color} size={18} />{c.name}
              </Pill>
            ))}
          </div>
        </Group>

        {/* Subtasks */}
        <Group>
          <Row icon={<ListChecks size={18} />} color="#34C759" label="المهام الفرعية"
            sub={subs.length ? `${fmt.num(doneCount)} من ${fmt.num(subs.length)}` : undefined}>
            {subs.length > 0 && <span className="t-foot font-semibold text-label-2 num">{fmt.pct(doneCount / subs.length)}</span>}
          </Row>
          {subs.length > 0 && (
            <div className="mx-4 mb-2 h-1.5 overflow-hidden rounded-full bg-fill">
              <motion.div className="h-full rounded-full bg-ios-green" initial={false} animate={{ width: `${(doneCount / subs.length) * 100}%` }} />
            </div>
          )}
          <AnimatePresence initial={false}>
            {subs.map((s) => (
              <motion.div key={s.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 px-4 py-2">
                <Checkbox checked={s.done} size={21} color="var(--green)" onToggle={() => updateSubtask(s.id, { done: !s.done })} label="إكمال الخطوة" />
                <input defaultValue={s.title} aria-label="عنوان الخطوة"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.title) updateSubtask(s.id, { title: v }); else if (!v) deleteSubtask(s.id); }}
                  className={cx("min-w-0 flex-1 bg-transparent t-callout outline-none", s.done && "strike text-label-2")} />
                <button type="button" onClick={() => deleteSubtask(s.id)} aria-label="حذف الخطوة" className="grid size-7 place-items-center rounded-full text-label-3 hover:bg-fill"><X size={16} /></button>
              </motion.div>
            ))}
            {draftSubs.map((s, i) => (
              <motion.div key={`d${i}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-4 py-2">
                <span className="size-[21px] rounded-full border-2 border-label-3" />
                <span className="flex-1 t-callout">{s}</span>
                <button type="button" onClick={() => setDraftSubs(draftSubs.filter((_, j) => j !== i))} aria-label="حذف الخطوة" className="grid size-7 place-items-center rounded-full text-label-3"><X size={16} /></button>
              </motion.div>
            ))}
          </AnimatePresence>
          <form onSubmit={(e) => { e.preventDefault(); addSub(); }} className="flex items-center gap-3 px-4 pb-3 pt-1">
            <Plus size={21} className="text-accent" />
            <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="إضافة خطوة" aria-label="إضافة خطوة"
              className="min-w-0 flex-1 bg-transparent t-callout outline-none placeholder:text-label-3" />
            {newSub.trim() && <button type="submit" className="t-foot font-semibold text-accent">إضافة</button>}
          </form>
        </Group>

        {/* Calendar + actions */}
        {existing && preview && (
          <Group>
            {preview.dueAt ? (
              <>
                <ActionRow icon={<Download size={18} />} onClick={() => downloadIcs(preview as TaskRec)}>إضافة إلى التقويم (‎.ics)</ActionRow>
                <ActionRow icon={<CalendarPlus size={18} />} href={googleCalendarUrl(preview as TaskRec)}>فتح في تقويم Google</ActionRow>
              </>
            ) : (
              <p className="px-4 py-3 t-foot text-label-2">حدّد تاريخًا لإضافة المهمة إلى التقويم.</p>
            )}
            <ActionRow icon={<Check size={18} />} onClick={() => { toggleTask(existing.id); close(); }}>
              {existing.completed ? "إعادة فتح المهمة" : "تعليم كمكتملة"}
            </ActionRow>
            <ActionRow icon={<Trash2 size={18} />} onClick={remove} danger>حذف المهمة</ActionRow>
          </Group>
        )}

        {existing && (
          <p className="pb-4 text-center t-cap text-label-3">
            أُنشئت {fmt.relDay(existing.createdAt)} · {fmt.time(existing.createdAt)}
            {existing.completedAt && ` · اكتملت ${fmt.relDay(existing.completedAt)}`}
          </p>
        )}
      </div>
    </>
  );
}

function nextHalfHour() {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return timeKey(d);
}
function toLocalInput(iso: string) {
  const d = new Date(iso);
  return `${dayKey(d)}T${timeKey(d)}`;
}

function Group({ children }: { children: ReactNode }) {
  return <div className="glass mb-4 overflow-hidden rounded-[20px]">{children}</div>;
}

function Row({ icon, color, label, sub, children }: { icon: ReactNode; color: string; label: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="row-sep flex min-h-[52px] items-center gap-3 px-4 py-2" style={{ ["--sep-inset" as string]: "3.75rem" }}>
      <span className="grid size-[30px] shrink-0 place-items-center rounded-[8px] text-white" style={{ background: color }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="t-callout">{label}</p>
        {sub && <p className="t-foot text-accent">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function ActionRow({ icon, children, onClick, href, danger }: { icon: ReactNode; children: ReactNode; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = cx("row-sep flex h-[50px] w-full items-center gap-3 px-4 t-callout active:bg-fill", danger ? "text-ios-red" : "text-accent");
  const style = { ["--sep-inset" as string]: "3rem" };
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{icon}{children}</a>
  ) : (
    <button type="button" onClick={onClick} className={cls} style={style}>{icon}{children}</button>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Press onClick={onClick} scale={0.94}
      className={cx("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 t-foot font-semibold", on ? "glass-pill text-white" : "bg-fill")}>
      {children}
    </Press>
  );
}
