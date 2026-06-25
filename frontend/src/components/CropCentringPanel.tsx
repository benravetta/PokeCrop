import { useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { CenteringTool } from "./grade/CenteringTool";
import { borderRatios, type Box } from "../lib/centering";
import { saveHistoryCentring } from "../lib/api";

export function CropCentringPanel({
  imageSrc,
  historyEventId,
}: {
  imageSrc: string;
  historyEventId: number | null;
}) {
  const [outer, setOuter] = useState<Box | null>(null);
  const [inner, setInner] = useState<Box | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOuter(null);
    setInner(null);
    setSkipped(false);
    setSaved(false);
  }, [imageSrc, historyEventId]);

  useEffect(() => {
    if (!historyEventId || skipped || !outer || !inner) return;
    const ratios = borderRatios(outer, inner);
    const front = {
      leftRight: ratios.leftRight.ratio,
      topBottom: ratios.topBottom.ratio,
    };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveHistoryCentring(historyEventId, front)
        .then(() => setSaved(true))
        .catch(() => setSaved(false));
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [historyEventId, outer, inner, skipped]);

  const ratios =
    outer && inner && !skipped ? borderRatios(outer, inner) : null;

  return (
    <div className="flex flex-col min-h-0 lg:w-[min(100%,22rem)] lg:shrink-0 rounded-2xl border border-border-subtle bg-surface-raised overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border-subtle flex items-center gap-2">
        <Crosshair className="w-4 h-4 text-accent shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-text-primary">Measure centring</div>
          <div className="text-[10px] text-text-muted leading-snug">
            Saved to your history when you adjust the borders.
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-[220px] lg:min-h-0 overflow-hidden">
        <CenteringTool
          side="front"
          imageSrc={imageSrc}
          outer={outer}
          inner={inner}
          onOuter={setOuter}
          onInner={setInner}
          skipped={skipped}
          onSkip={setSkipped}
        />
      </div>
      {ratios && !skipped && (
        <div className="px-3 py-2 border-t border-border-subtle text-[11px] text-text-secondary space-y-0.5">
          <div>
            L/R <span className="text-text-primary font-medium">{ratios.leftRight.ratio}</span>
            {" · "}
            T/B <span className="text-text-primary font-medium">{ratios.topBottom.ratio}</span>
          </div>
          {historyEventId && (
            <div className="text-text-muted">
              {saved ? "Saved to history" : "Saving…"}
            </div>
          )}
        </div>
      )}
      {!historyEventId && (
        <div className="px-3 py-2 border-t border-border-subtle text-[10px] text-text-muted">
          Centring is saved after your first metered crop on this upload.
        </div>
      )}
    </div>
  );
}
