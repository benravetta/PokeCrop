import { useEffect, useRef, useState } from "react";
import { Check, MoveHorizontal, ShieldCheck, Wrench } from "lucide-react";
import { AFTER_IMG, BEFORE_IMG } from "./data";
import { SectionHeading } from "./shared";

export function PrepareSection() {
  const prep = [
    "Spot light foil scrapes and surface marks worth easing",
    "Flatten gentle curl so centring reads true",
    "Lift loose surface debris before it scores as a flaw",
    "Sleeve and store right so it doesn't pick up new wear",
  ];

  return (
    <section
      id="prepare"
      className="relative scroll-mt-20 border-y border-border-subtle bg-surface-raised/40 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          kicker="Card preparation"
          title="Prep the card. Lift the grade."
          copy="GemCheck doesn't just score your card — it shows you what's holding the grade back and which light defects are worth carefully addressing before you submit, with a snapshot of the exact spot."
        />

        <div className="mt-12 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <BeforeAfter />
            <p className="mt-3 text-center text-xs text-text-muted">
              Start with a clean scan — GemCheck detects, de-skews and lifts the card off its
              background at full resolution.
            </p>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised px-3 py-1 text-xs text-text-secondary">
              <Wrench className="w-3.5 h-3.5 text-accent" />
              Preparation plan
            </div>
            <h3 className="mt-4 text-xl font-semibold tracking-tight">
              A clear to-do list — not false promises.
            </h3>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              We flag only what&apos;s reasonable to improve on a raw card, and we&apos;re upfront
              about what&apos;s permanent. No cleaning trick turns a creased card into a gem.
            </p>
            <ul className="mt-5 space-y-3">
              {prep.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3.5"
                >
                  <span className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-accent" />
                  </span>
                  <span className="text-sm text-text-primary">{p}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-start gap-2 text-xs text-text-muted">
              <ShieldCheck className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              Take care with valuable cards — improper cleaning can lower a grade. When in doubt,
              leave it and let the grader decide.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BeforeAfter() {
  const [pos, setPos] = useState(50);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(4, Math.min(96, pct)));
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragging.current) setFromClientX(e.clientX);
    };
    const up = () => (dragging.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative aspect-[3/2] w-full rounded-2xl overflow-hidden border border-border-subtle select-none cursor-ew-resize touch-none bg-surface-overlay shadow-xl"
      onPointerDown={(e) => {
        dragging.current = true;
        setFromClientX(e.clientX);
      }}
    >
      <div className="absolute inset-0">
        <img
          src={BEFORE_IMG}
          alt="A real card photographed on a desk"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white/90">
          Your photo
        </span>
      </div>

      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 120% at 60% 30%, #20232f 0%, #14161f 60%, #0d0f16 100%)",
          }}
        />
        <div className="checkerboard absolute inset-0 opacity-[0.25]" />
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <img
            src={AFTER_IMG}
            alt="The same card cleanly cropped and straightened"
            draggable={false}
            className="max-h-full max-w-full rounded-[3%] drop-shadow-[0_18px_38px_rgba(0,0,0,0.55)]"
          />
        </div>
        <span className="absolute right-3 top-3 rounded-md bg-accent/85 px-2 py-1 text-[11px] font-semibold text-white">
          Ready to grade
        </span>
      </div>

      <div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white text-surface flex items-center justify-center shadow-xl">
          <MoveHorizontal className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
