"use client";
import { useEffect, useRef } from "react";

/** Live analog clock: smooth sweeping second hand (rAF), glass face, accent hands. */
export function AnalogClock({ size = 52 }: { size?: number }) {
  const h = useRef<SVGLineElement>(null);
  const m = useRef<SVGLineElement>(null);
  const s = useRef<SVGGElement>(null);

  useEffect(() => {
    let raf = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = () => {
      const d = new Date();
      const ms = d.getMilliseconds(), sec = d.getSeconds() + (reduce ? 0 : ms / 1000);
      const min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60;
      h.current?.setAttribute("transform", `rotate(${hr * 30} 50 50)`);
      m.current?.setAttribute("transform", `rotate(${min * 6} 50 50)`);
      s.current?.setAttribute("transform", `rotate(${sec * 6} 50 50)`);
      raf = reduce ? window.setTimeout(draw, 1000) as unknown as number : requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); clearTimeout(raf); };
  }, []);

  return (
    <div className="analog-clock glass-strong grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size }} role="img" aria-label="الساعة الآن">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="50" y1={i % 3 === 0 ? 9 : 11} x2="50" y2="15" stroke="var(--label)" strokeOpacity={i % 3 === 0 ? 0.85 : 0.35}
            strokeWidth={i % 3 === 0 ? 3.2 : 2} strokeLinecap="round" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <line ref={h} x1="50" y1="54" x2="50" y2="29" stroke="var(--label)" strokeWidth="5" strokeLinecap="round" />
        <line ref={m} x1="50" y1="56" x2="50" y2="19" stroke="var(--accent)" strokeWidth="3.6" strokeLinecap="round" />
        <g ref={s}>
          <line x1="50" y1="60" x2="50" y2="14" stroke="var(--red)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="50" cy="14" r="2.4" fill="var(--red)" />
        </g>
        <circle cx="50" cy="50" r="4" fill="var(--bg)" stroke="var(--red)" strokeWidth="2.2" />
      </svg>
    </div>
  );
}
