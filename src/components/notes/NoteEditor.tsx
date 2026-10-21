"use client";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useFmt } from "@/client/format";
import { createNote, deleteNote, discardRecording, encodePeaks, restoreNote, saveRecording, updateNote } from "@/client/notes";
import { useStore } from "@/client/store";
import { confirmDialog, useUI } from "@/client/ui";
import type { NoteRec } from "@/lib/types";
import { cx, Press } from "../ui/primitives";
import { Sheet, SheetHeader } from "../ui/Sheet";
import { VoicePlayer, VoiceRecorder, type Recording } from "./Voice";

export const NOTE_COLORS = [null, "#FF9500", "#FFCC00", "#34C759", "#30B0C7", "#007AFF", "#AF52DE", "#FF2D55"] as const;

export function NoteEditor() {
  const st = useUI((s) => s.noteEditor);
  const close = useUI((s) => s.closeNote);
  return (
    <Sheet open={!!st} onClose={close} label="ملاحظة" height="full">
      {st && <Body key={st.id ?? "new"} id={st.id} autoRecord={st.autoRecord} />}
    </Sheet>
  );
}

function Body({ id, autoRecord }: { id?: string; autoRecord?: boolean }) {
  const close = useUI((s) => s.closeNote);
  const toast = useStore((s) => s.toast);
  const live = useStore((s) => (id ? s.notes[id] : undefined));
  const last = useRef(live);
  if (live) last.current = live;
  const existing = id ? last.current : undefined;
  const fmt = useFmt();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [color, setColor] = useState<string | null>(existing?.color ?? null);
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [audio, setAudio] = useState<Pick<NoteRec, "audioId" | "audioMime" | "audioDuration" | "audioPeaks">>({
    audioId: existing?.audioId ?? null, audioMime: existing?.audioMime ?? null,
    audioDuration: existing?.audioDuration ?? null, audioPeaks: existing?.audioPeaks ?? null,
  });
  const fresh = useRef<string | null>(null); // recording made in this session (discard on cancel)

  const onRecorded = useCallback(async (r: Recording) => {
    const audioId = await saveRecording(r.blob, r.mime);
    if (fresh.current) void discardRecording(fresh.current);
    fresh.current = audioId;
    setAudio({ audioId, audioMime: r.mime, audioDuration: Math.round(r.duration * 10) / 10, audioPeaks: encodePeaks(r.peaks) });
  }, []);

  const hasContent = title.trim() || body.trim() || audio.audioId;

  const save = () => {
    const data = { title: title.trim(), body: body.trim(), color, pinned, ...audio };
    if (existing) updateNote(existing.id, data);
    else if (hasContent) { createNote(data); toast({ text: audio.audioId ? "اتحفظت الملاحظة الصوتية" : "اتحفظت الملاحظة", icon: "check" }, 2000); }
    fresh.current = null;
    close();
  };

  const cancel = () => {
    if (fresh.current) void discardRecording(fresh.current);
    close();
  };

  const remove = async () => {
    if (!existing) return cancel();
    if (!(await confirmDialog({ title: "حذف الملاحظة؟", confirm: "حذف", destructive: true }))) return;
    const snap = deleteNote(existing.id);
    close();
    if (snap) toast({ text: "اتحذفت الملاحظة", icon: "trash", action: { label: "تراجع", run: () => restoreNote(snap) } }, 5000);
  };

  return (
    <div className="flex h-full flex-col" style={color ? { background: `linear-gradient(to bottom, color-mix(in srgb, ${color} 16%, transparent), transparent 45%)` } : undefined}>
      <SheetHeader
        title={existing ? "ملاحظة" : "ملاحظة جديدة"}
        start={<button type="button" onClick={cancel} className="px-1 t-body text-accent">إلغاء</button>}
        end={<button type="button" onClick={save} className={cx("px-1 t-body font-semibold text-accent", !hasContent && !existing && "opacity-50")}>تم</button>}
      />
      <div className="scroll-y flex-1 px-5 pb-[max(env(safe-area-inset-bottom),24px)]">
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" aria-label="عنوان الملاحظة"
          className="mt-2 w-full bg-transparent t-title2 outline-none placeholder:text-label-3"
          data-autofocus={!existing && !autoRecord ? true : undefined}
        />
        {existing && <p className="mt-1 t-cap text-label-3">{fmt.relDay(existing.updatedAt)} · {fmt.time(existing.updatedAt)}</p>}

        {/* Voice note */}
        <section className="glass mt-4 rounded-[22px] p-3">
          <p className="mb-1 px-1 t-foot font-semibold text-label-2">فويس نوت</p>
          {audio.audioId ? (
            <VoicePlayer audioId={audio.audioId} duration={audio.audioDuration} peaks={audio.audioPeaks} tint={color ?? "var(--accent)"}
              onDelete={() => { if (fresh.current === audio.audioId) { void discardRecording(audio.audioId!); fresh.current = null; } setAudio({ audioId: null, audioMime: null, audioDuration: null, audioPeaks: null }); }} />
          ) : (
            <VoiceRecorder onDone={onRecorded} autoStart={autoRecord} />
          )}
        </section>

        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب ملاحظتك…" aria-label="نص الملاحظة"
          className="mt-4 min-h-[38vh] w-full resize-none bg-transparent t-body leading-relaxed outline-none placeholder:text-label-3"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          {NOTE_COLORS.map((c) => (
            <Press key={c ?? "none"} onClick={() => setColor(c)} scale={0.86} aria-label={c ? `لون ${c}` : "بدون لون"} aria-pressed={color === c}
              className={cx("size-8 rounded-full border-2", color === c ? "border-label" : "border-transparent")}
              style={{ background: c ?? "var(--fill-2)" }} />
          ))}
          <span className="flex-1" />
          <Press onClick={() => setPinned(!pinned)} scale={0.9} aria-pressed={pinned}
            className={cx("inline-flex h-9 items-center gap-1.5 rounded-full px-3 t-foot font-semibold", pinned ? "glass-pill text-white" : "bg-fill")}>
            {pinned ? <PinOff size={15} /> : <Pin size={15} />}{pinned ? "إلغاء التثبيت" : "تثبيت"}
          </Press>
          {existing && (
            <Press onClick={remove} scale={0.9} aria-label="حذف الملاحظة" className="grid size-9 place-items-center rounded-full bg-fill text-ios-red">
              <Trash2 size={17} />
            </Press>
          )}
        </div>
      </div>
    </div>
  );
}
