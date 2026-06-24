import { useEffect, useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";
import { HERO_CARD_BEFORE, HERO_CARD_IMG } from "./data";
import { SectionHeading } from "./shared";

/** The only place on the page (besides the report) that shows the card image. */
export function CropDemoSection() {
  return (
    <section id="crop" className="scroll-mt-20 py-16 sm:py-20 border-y border-border-subtle">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <SectionHeading
            kicker="Crop & centring"
            title="From desk photo to straight scan — with centring."
            copy="Phone photos work. GemCheck detects the card, straightens it, lifts it off the background as a transparent PNG, and lets you measure border centring on the same canvas — ready for listing or grading."
            center={false}
          />
          <BeforeAfter />
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
          src={HERO_CARD_BEFORE}
          alt="Charizard photographed on a desk"
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
            src={HERO_CARD_IMG}
            alt="The same Charizard after GemCheck crop"
            draggable={false}
            className="max-h-full max-w-full rounded-[3%] drop-shadow-[0_18px_38px_rgba(0,0,0,0.55)]"
          />
        </div>
        <span className="absolute right-3 top-3 rounded-md bg-accent/85 px-2 py-1 text-[11px] font-semibold text-white">
          Clean crop &amp; centring
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
