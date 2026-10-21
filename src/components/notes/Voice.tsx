"use client";
import { AnimatePresence, motion } from "motion/react";
import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFmt } from "@/client/format";
import { audioUrl, decodePeaks } from "@/client/notes";
import { cx } from "../ui/primitives";

const BARS = 48;
const MAX_SEC = 10 * 60;

export interface Recording { blob: Blob; mime: string; duration: number; peaks: number[] }

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

/** Squash a long amplitude trace into N bars (max per bucket), normalised to 0..1. */
function toBars(trace: number[], n = BARS) {
  if (!trace.length) return Array(n).fill(0.05);
  const out = Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * trace.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * trace.length) / n));
    return Math.max(...trace.slice(a, b));
  });
  const max = Math.max(...out, 0.01);
  return out.map((v) => Math.max(0.06, v / max));
}

export const fmtClock = (sec: number, num: (n: number) => string) => {
  const s = Math.max(0, Math.round(sec));
  return `${num(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0").replace(/\d/g, (d) => num(+d))}`;
};

/** Big mic button → live waveform + timer → onDone(recording). */
export function VoiceRecorder({ onDone, autoStart }: { onDone: (r: Recording) => void; autoStart?: boolean }) {
  const fmt = useFmt();
  const [state, setState] = useState<"idle" | "rec" | "denied" | "unsupported">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState<number[]>(Array(32).fill(0.05));
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; ctx: AudioContext; raf: number; trace: number[]; start: number; chunks: Blob[] } | null>(null);

  const stop = useCallback(() => {
    const r = rec.current;
    if (!r || r.mr.state === "inactive") return;
    r.mr.stop();
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setState("unsupported"); return; }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch { setState("denied"); return; }
    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const r = { mr, stream, ctx, raf: 0, trace: [] as number[], start: performance.now(), chunks: [] as Blob[] };
    rec.current = r;
    let lastSample = 0;
    const tick = (t: number) => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      const rms = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
      if (t - lastSample > 60) {
        lastSample = t;
        r.trace.push(rms);
        setLive((l) => [...l.slice(1), Math.max(0.05, rms)]);
        const secs = (t - r.start) / 1000;
        setElapsed(secs);
        if (secs >= MAX_SEC) stop();
      }
      r.raf = requestAnimationFrame(tick);
    };
    mr.ondataavailable = (e) => { if (e.data.size) r.chunks.push(e.data); };
    mr.onstop = () => {
      cancelAnimationFrame(r.raf);
      stream.getTracks().forEach((tr) => tr.stop());
      void ctx.close();
      const type = (mr.mimeType || mime || "audio/webm").split(";")[0];
      const blob = new Blob(r.chunks, { type });
      const duration = (performance.now() - r.start) / 1000;
      rec.current = null;
      setState("idle");
      setElapsed(0);
      if (blob.size > 0 && duration > 0.4) onDone({ blob, mime: type, duration, peaks: toBars(r.trace) });
    };
    mr.start(250);
    navigator.vibrate?.(15);
    setState("rec");
    r.raf = requestAnimationFrame(tick);
  }, [onDone, stop]);

  useEffect(() => { if (autoStart) void start(); }, [autoStart, start]);
  useEffect(() => () => {
    const r = rec.current;
    if (r) { r.mr.onstop = null; try { r.mr.stop(); } catch { /* */ } cancelAnimationFrame(r.raf); r.stream.getTracks().forEach((t) => t.stop()); void r.ctx.close(); }
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <AnimatePresence mode="wait">
        {state === "rec" ? (
          <motion.div key="wave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-14 w-full items-center justify-center gap-[3px]">
            {live.map((v, i) => (
              <span key={i} className="w-[4px] rounded-full bg-ios-red transition-[height] duration-75" style={{ height: `${Math.round(8 + v * 48)}px`, opacity: 0.4 + (i / live.length) * 0.6 }} />
            ))}
          </motion.div>
        ) : (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-14 content-center text-center t-sub text-label-2">
            {state === "denied" ? "اسمح باستخدام الميكروفون من إعدادات المتصفح" : state === "unsupported" ? "التسجيل غير مدعوم في هذا المتصفح" : "اضغط على الميكروفون وابدأ الكلام"}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="relative grid place-items-center">
        {state === "rec" && <span className="rec-ring absolute size-20 rounded-full bg-ios-red/25" aria-hidden />}
        <motion.button
          type="button" whileTap={{ scale: 0.9 }}
          onClick={() => (state === "rec" ? stop() : void start())}
          aria-label={state === "rec" ? "إيقاف التسجيل" : "ابدأ التسجيل"}
          className={cx("relative grid size-[68px] place-items-center rounded-full text-white shadow-lg", state === "rec" ? "bg-ios-red" : "glass-pill")}
        >
          {state === "rec" ? <Square size={24} fill="currentColor" /> : <Mic size={30} />}
        </motion.button>
      </div>
      <p className={cx("t-headline num", state === "rec" ? "text-ios-red" : "text-label-3")}>{fmtClock(elapsed, fmt.num)}</p>
    </div>
  );
}

/** Play/pause + waveform with progress. Loads the audio lazily (local cache → server). */
export function VoicePlayer({ audioId, duration, peaks, compact, onDelete, tint = "var(--accent)" }: {
  audioId: string; duration: number | null; peaks: string | null; compact?: boolean; onDelete?: () => void; tint?: string;
}) {
  const fmt = useFmt();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const el = useRef<HTMLAudioElement | null>(null);
  const bars = decodePeaks(peaks);
  const list = bars.length ? bars : Array(BARS).fill(0.3);
  const shown = compact ? list.filter((_, i) => i % 2 === 0) : list;

  useEffect(() => () => { el.current?.pause(); }, []);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setErr("");
    if (playing) { el.current?.pause(); return; }
    try {
      if (!el.current) {
        setLoading(true);
        const a = new Audio(await audioUrl(audioId));
        a.ontimeupdate = () => setProgress(a.duration && isFinite(a.duration) ? a.currentTime / a.duration : a.currentTime / (duration || 1));
        a.onplay = () => setPlaying(true);
        a.onpause = () => setPlaying(false);
        a.onended = () => { setPlaying(false); setProgress(0); };
        el.current = a;
      }
      await el.current.play();
    } catch (x) {
      setErr((x as Error).message || "تعذّر التشغيل");
    } finally { setLoading(false); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const a = el.current;
    if (!a || !a.duration || !isFinite(a.duration)) return;
    const r = e.currentTarget.getBoundingClientRect();
    const f = (r.right - e.clientX) / r.width; // RTL: starts at the right
    a.currentTime = Math.max(0, Math.min(1, f)) * a.duration;
  };

  return (
    <div className={cx("flex items-center gap-2.5", !compact && "rounded-2xl bg-fill p-2.5")} onClick={(e) => e.stopPropagation()}>
      <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={toggle} aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
        className={cx("grid shrink-0 place-items-center rounded-full text-white", compact ? "size-8" : "size-11")} style={{ background: tint }}>
        {loading ? <span className="size-3 animate-ping rounded-full bg-white" /> : playing ? <Pause size={compact ? 14 : 18} fill="currentColor" /> : <Play size={compact ? 14 : 18} fill="currentColor" className="-scale-x-100" />}
      </motion.button>
      <div className={cx("flex flex-1 cursor-pointer items-center gap-[2px]", compact ? "h-7" : "h-10")} onClick={seek} role="slider" aria-label="موضع التشغيل" aria-valuenow={Math.round(progress * 100)}>
        {shown.map((v, i) => {
          const done = (shown.length - 1 - i) / shown.length < progress; // fills right→left
          return <span key={i} className="flex-1 rounded-full transition-colors" style={{ height: `${Math.round(18 + v * 82)}%`, background: done ? tint : "var(--label-3)", opacity: done ? 1 : 0.55 }} />;
        })}
      </div>
      <span className={cx("shrink-0 num text-label-2", compact ? "t-cap" : "t-foot")}>{fmtClock(playing ? progress * (duration ?? 0) : duration ?? 0, fmt.num)}</span>
      {onDelete && (
        <button type="button" onClick={(e) => { e.stopPropagation(); el.current?.pause(); onDelete(); }} aria-label="حذف التسجيل" className="grid size-8 place-items-center rounded-full text-ios-red hover:bg-fill">
          <Trash2 size={16} />
        </button>
      )}
      {err && <span className="sr-only" role="alert">{err}</span>}
      {err && !compact && <span className="t-cap text-ios-red">{err}</span>}
    </div>
  );
}
