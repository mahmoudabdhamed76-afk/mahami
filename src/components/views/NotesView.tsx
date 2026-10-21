"use client";
import { motion } from "motion/react";
import { Mic, NotebookPen, Pin, Plus, Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useFmt } from "@/client/format";
import { useStore } from "@/client/store";
import { normalizeAr } from "@/client/text";
import { useUI } from "@/client/ui";
import type { NoteRec } from "@/lib/types";
import { EmptyState, IconButton, Press } from "../ui/primitives";
import { Page } from "../ui/Page";
import { VoicePlayer } from "../notes/Voice";
import { SyncBadge } from "../SyncBadge";

export function NotesView() {
  const notesMap = useStore((s) => s.notes);
  const openNote = useUI((s) => s.openNote);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);

  const { pinned, others, total } = useMemo(() => {
    const all = Object.values(notesMap).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const n = normalizeAr(dq);
    const list = n ? all.filter((x) => normalizeAr(`${x.title} ${x.body}`).includes(n) || (n.includes("صوت") && x.audioId)) : all;
    return { pinned: list.filter((x) => x.pinned), others: list.filter((x) => !x.pinned), total: all.length };
  }, [notesMap, dq]);

  return (
    <Page
      title="الملاحظات"
      subtitle={total ? undefined : "اكتب أو سجّل بصوتك"}
      actions={
        <>
          <SyncBadge compact />
          <IconButton label="ملاحظة صوتية" onClick={() => openNote(undefined, true)}><Mic size={21} /></IconButton>
          <IconButton label="ملاحظة جديدة" onClick={() => openNote()}><Plus size={23} /></IconButton>
        </>
      }
      headerExtra={
        <>
          {total > 0 && (
            <label className="mb-4 flex h-10 items-center gap-2 rounded-xl bg-fill px-3 text-label-2">
              <Search size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في الملاحظات" aria-label="بحث في الملاحظات"
                className="min-w-0 flex-1 bg-transparent t-callout text-label outline-none placeholder:text-label-3" />
              {q && <button type="button" onClick={() => setQ("")} aria-label="مسح"><X size={16} /></button>}
            </label>
          )}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <Press onClick={() => openNote(undefined, true)} scale={0.96} className="voice-cta flex items-center gap-3 rounded-[20px] p-3.5 text-start text-white">
              <span className="grid size-11 place-items-center rounded-full bg-white/20"><Mic size={22} /></span>
              <span><b className="block t-sub">فويس نوت</b><span className="t-cap opacity-85">سجّل بصوتك</span></span>
            </Press>
            <Press onClick={() => openNote()} scale={0.96} className="glass flex items-center gap-3 rounded-[20px] p-3.5 text-start">
              <span className="grid size-11 place-items-center rounded-full bg-[rgb(var(--accent-rgb)/0.15)] text-accent"><NotebookPen size={21} /></span>
              <span><b className="block t-sub">ملاحظة</b><span className="t-cap text-label-2">اكتب فكرة</span></span>
            </Press>
          </div>
        </>
      }
    >
      {total === 0 ? (
        <EmptyState icon={<NotebookPen size={32} />} title="لا توجد ملاحظات" text="سجّل فويس نوت سريع أو اكتب فكرة — كله بيتزامن على أجهزتك ويشتغل من غير نت." />
      ) : !pinned.length && !others.length ? (
        <EmptyState icon={<Search size={30} />} title="لا نتائج" />
      ) : (
        <>
          {pinned.length > 0 && <Section title="مثبّتة" icon={<Pin size={14} />} notes={pinned} />}
          {others.length > 0 && <Section title={pinned.length ? "الكل" : undefined} notes={others} />}
        </>
      )}
    </Page>
  );
}

function Section({ title, icon, notes }: { title?: string; icon?: React.ReactNode; notes: NoteRec[] }) {
  return (
    <section className="mb-5">
      {title && <h2 className="mb-2 flex items-center gap-1.5 px-1 t-foot font-semibold text-label-2">{icon}{title}</h2>}
      <div className="columns-2 gap-3 [column-fill:_balance] sm:columns-3">
        {notes.map((n, i) => <NoteCard key={n.id} note={n} i={i} />)}
      </div>
    </section>
  );
}

function NoteCard({ note, i }: { note: NoteRec; i: number }) {
  const fmt = useFmt();
  const openNote = useUI((s) => s.openNote);
  const c = note.color;
  return (
    <motion.div
      layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}
      role="button" tabIndex={0} onClick={() => openNote(note.id)} onKeyDown={(e) => e.key === "Enter" && openNote(note.id)}
      className="glass mb-3 cursor-pointer break-inside-avoid overflow-hidden rounded-[20px] p-3.5 active:scale-[0.98]"
      style={c ? { background: `linear-gradient(160deg, color-mix(in srgb, ${c} 26%, var(--glass)), var(--glass))`, borderColor: `color-mix(in srgb, ${c} 40%, transparent)` } : undefined}
    >
      {note.title && <p className="mb-1 t-sub font-bold leading-snug">{note.title}</p>}
      {note.audioId && (
        <div className="my-1.5">
          <VoicePlayer audioId={note.audioId} duration={note.audioDuration} peaks={note.audioPeaks} compact tint={c ?? "var(--accent)"} />
        </div>
      )}
      {note.body && <p className="line-clamp-[8] whitespace-pre-line t-foot leading-relaxed text-label-2">{note.body}</p>}
      {!note.title && !note.body && !note.audioId && <p className="t-foot text-label-3">ملاحظة فاضية</p>}
      <p className="mt-2 flex items-center gap-1 t-cap text-label-3">
        {note.pinned && <Pin size={11} />}{fmt.relDay(note.updatedAt)}
      </p>
    </motion.div>
  );
}
