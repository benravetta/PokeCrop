import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  ShieldCheck,
  Upload,
  X,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  Crop,
  ScanSearch,
  Square,
  Layers,
  Camera,
  Sun,
  RotateCcw,
  Wrench,
  ShieldAlert,
  CheckCircle2,
  RotateCw,
  Tag,
  FileDown,
} from "lucide-react";
import { buildGradeReportPdf } from "../lib/gradeReportPdf";
import {
  gradeCard,
  getGradeQuota,
  straightenForGrade,
  type GradeQuota,
  type GradeResult,
  type GradeImages,
  type MeasuredCentering,
  type Preparation,
  type PrepItem,
  type CardPricing,
} from "../lib/api";
import { CenteringTool } from "../components/grade/CenteringTool";
import { GradeProgress } from "../components/grade/GradeProgress";
import { borderRatios, type Box } from "../lib/centering";
import { loadImage, cropFromImage, resolveRect } from "../lib/cardRegions";
import { useAppStore } from "../hooks/useProcessing";

// ---- helpers to read the loosely-typed model result ----
const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNum = (v: unknown): number | null => (typeof v === "number" ? v : null);

async function downscale(file: File, max = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob((b) => r(b), "image/jpeg", 0.9)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

type Slot = "front" | "back" | "angled_front" | "angled_back";
type CardSlot = "front" | "back";

// Straightened-card state per side, used for centering measurement + as the
// (cleaner) image we send to the inspector.
interface SideProc {
  src?: string; // straightened PNG data URL (when detection succeeded)
  loading: boolean;
  failed: boolean;
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] || "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export function GradePage() {
  const [files, setFiles] = useState<Record<Slot, File | null>>({
    front: null,
    back: null,
    angled_front: null,
    angled_back: null,
  });
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [quota, setQuota] = useState<GradeQuota | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Optional close-up photos of problem areas — sharpen the surface/defect read.
  const [closeups, setCloseups] = useState<File[]>([]);
  const [closeupPreviews, setCloseupPreviews] = useState<string[]>([]);
  const addCloseup = useCallback((f: File) => {
    setCloseups((prev) => (prev.length >= 4 ? prev : [...prev, f]));
    setCloseupPreviews((prev) =>
      prev.length >= 4 ? prev : [...prev, URL.createObjectURL(f)]
    );
  }, []);
  const removeCloseup = useCallback((i: number) => {
    setCloseupPreviews((prev) => {
      const url = prev[i];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, j) => j !== i);
    });
    setCloseups((prev) => prev.filter((_, j) => j !== i));
  }, []);

  // Centering measurement state, per side.
  const [proc, setProc] = useState<Record<CardSlot, SideProc>>({
    front: { loading: false, failed: false },
    back: { loading: false, failed: false },
  });
  const [outers, setOuters] = useState<Record<CardSlot, Box | null>>({
    front: null,
    back: null,
  });
  const [inners, setInners] = useState<Record<CardSlot, Box | null>>({
    front: null,
    back: null,
  });
  const [skip, setSkip] = useState<Record<CardSlot, boolean>>({
    front: false,
    back: false,
  });

  useEffect(() => {
    getGradeQuota()
      .then((r) => setQuota(r.quota))
      .catch(() => {});
  }, []);

  // Consume a "Send to grading" hand-off from the crop tool: prefill the front
  // slot with the already-cropped/straightened card and skip re-straightening.
  const gradePrefill = useAppStore((s) => s.gradePrefill);
  const clearGradePrefill = useAppStore((s) => s.clearGradePrefill);
  const prefillConsumed = useRef(false);
  useEffect(() => {
    if (prefillConsumed.current || !gradePrefill) return;
    prefillConsumed.current = true;
    const dataUrl = `data:image/png;base64,${gradePrefill.pngBase64}`;
    const base = gradePrefill.filename.replace(/\.[^/.]+$/, "") || "card";
    const file = dataUrlToFile(dataUrl, `${base}.png`);
    setFiles((prev) => ({ ...prev, front: file }));
    setPreviews((prev) => {
      if (prev.front) URL.revokeObjectURL(prev.front);
      return { ...prev, front: URL.createObjectURL(file) };
    });
    // The crop is already straightened, so use it directly for centering and
    // do not re-run straightenForGrade.
    setProc((p) => ({ ...p, front: { src: dataUrl, loading: false, failed: false } }));
    clearGradePrefill();
  }, [gradePrefill, clearGradePrefill]);

  // Straighten a freshly-picked front/back so centering can be measured on a
  // clean card. Falls back to the original photo if no card is detected.
  const straighten = useCallback(async (slot: CardSlot, file: File) => {
    setProc((p) => ({ ...p, [slot]: { loading: true, failed: false } }));
    setOuters((b) => ({ ...b, [slot]: null }));
    setInners((b) => ({ ...b, [slot]: null }));
    try {
      const src = await straightenForGrade(file);
      setProc((p) => ({ ...p, [slot]: { src: src ?? undefined, loading: false, failed: !src } }));
    } catch {
      setProc((p) => ({ ...p, [slot]: { loading: false, failed: true } }));
    }
  }, []);

  const setSlot = useCallback(
    (slot: Slot, file: File | null) => {
      setFiles((prev) => ({ ...prev, [slot]: file }));
      setPreviews((prev) => {
        if (prev[slot]) URL.revokeObjectURL(prev[slot]);
        const next = { ...prev };
        if (file) next[slot] = URL.createObjectURL(file);
        else delete next[slot];
        return next;
      });
      if (slot === "front" || slot === "back") {
        if (file) {
          void straighten(slot, file);
        } else {
          setProc((p) => ({ ...p, [slot]: { loading: false, failed: false } }));
          setOuters((b) => ({ ...b, [slot]: null }));
          setInners((b) => ({ ...b, [slot]: null }));
          setSkip((s) => ({ ...s, [slot]: false }));
        }
      }
    },
    [straighten]
  );

  // Build the measured-centering payload from the (un-skipped) boxes.
  const buildCentering = useCallback((): MeasuredCentering | undefined => {
    const out: MeasuredCentering = {};
    if (!skip.front && outers.front && inners.front) {
      const r = borderRatios(outers.front, inners.front);
      out.front = { leftRight: r.leftRight.ratio, topBottom: r.topBottom.ratio };
    }
    if (files.back && !skip.back && outers.back && inners.back) {
      const r = borderRatios(outers.back, inners.back);
      out.back = { leftRight: r.leftRight.ratio, topBottom: r.topBottom.ratio };
    }
    return out.front || out.back ? out : undefined;
  }, [outers, inners, skip, files.back]);

  // The image we send for inspection: the straightened card when available
  // (cleaner read), otherwise the downscaled original.
  const imageFor = useCallback(
    async (slot: CardSlot): Promise<File | null> => {
      const f = files[slot];
      if (!f) return null;
      const s = proc[slot];
      if (s?.src) return dataUrlToFile(s.src, `${slot}.png`);
      return downscale(f);
    },
    [files, proc]
  );

  const run = useCallback(async () => {
    if (!files.front) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const front = await imageFor("front");
      if (!front) return;
      const payload: GradeImages = { front };
      const back = await imageFor("back");
      if (back) payload.back = back;
      if (files.angled_front) payload.angled_front = await downscale(files.angled_front);
      if (files.angled_back) payload.angled_back = await downscale(files.angled_back);
      if (closeups.length)
        payload.closeups = await Promise.all(closeups.map((f) => downscale(f, 2000)));
      const res = await gradeCard(payload, buildCentering());
      setResult(res.result);
      setQuota(res.quota);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed.");
    } finally {
      setRunning(false);
    }
  }, [files, imageFor, buildCentering, closeups]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const outOfQuota = quota ? quota.remaining <= 0 : false;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
    <div className={`mx-auto px-4 sm:px-6 py-8 w-full ${result ? "max-w-6xl xl:max-w-7xl" : "max-w-6xl"}`}>
      <div className="flex items-center gap-3 mb-1">
        <ShieldCheck className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-semibold text-text-primary">AI Pre-Grader</h1>
      </div>
      <p className="text-text-secondary text-sm mb-6 max-w-2xl">
        A ruthless pre-check before you waste money submitting. Upload sharp,
        glare-free photos of the front and back — the cleaner the photos, the more
        the estimate is worth.
      </p>

      {quota && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-overlay px-3 py-1.5 text-xs text-text-secondary">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          {quota.remaining} of {quota.limit} grades left{" "}
          {quota.window === "month" ? "this month" : "today"}
        </div>
      )}

      {running && (
        <div className="max-w-2xl mx-auto">
          <GradeProgress />
        </div>
      )}

      {!result && !running && (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <ImageSlot label="Front (required)" preview={previews.front} onPick={(f) => setSlot("front", f)} onClear={() => setSlot("front", null)} />
              <ImageSlot label="Back" preview={previews.back} onPick={(f) => setSlot("back", f)} onClear={() => setSlot("back", null)} />
            </div>

            <div>
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                Angled / holo shots (improve surface accuracy)
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <ImageSlot label="Angled front (holo glare)" preview={previews.angled_front} onPick={(f) => setSlot("angled_front", f)} onClear={() => setSlot("angled_front", null)} />
                    <ImageSlot label="Angled back" preview={previews.angled_back} onPick={(f) => setSlot("angled_back", f)} onClear={() => setSlot("angled_back", null)} />
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary mb-2">
                      Close-ups of any problem areas (optional, up to 4) — sharpens the surface and defect read.
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {closeups.map((_, i) => (
                        <ImageSlot
                          key={i}
                          label={`Close-up ${i + 1}`}
                          preview={closeupPreviews[i]}
                          onPick={() => {}}
                          onClear={() => removeCloseup(i)}
                        />
                      ))}
                      {closeups.length < 4 && (
                        <ImageSlot label="Add close-up" onPick={addCloseup} onClear={() => {}} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!files.back && files.front && (
              <p className="flex items-center gap-2 text-xs text-amber-300/90">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                No back image — confidence will be capped and it can't be a strong gem-grade call.
              </p>
            )}

            {(files.front || files.back) && (
              <div className="grid xl:grid-cols-2 gap-4">
                {files.front && (
                  <CenteringPanel
                    side="front"
                    label="Front"
                    proc={proc.front}
                    displaySrc={proc.front.src ?? previews.front}
                    outer={outers.front}
                    inner={inners.front}
                    onOuter={(b) => setOuters((prev) => ({ ...prev, front: b }))}
                    onInner={(b) => setInners((prev) => ({ ...prev, front: b }))}
                    skip={skip.front}
                    onSkip={(v) => setSkip((s) => ({ ...s, front: v }))}
                  />
                )}
                {files.back && (
                  <CenteringPanel
                    side="back"
                    label="Back"
                    proc={proc.back}
                    displaySrc={proc.back.src ?? previews.back}
                    outer={outers.back}
                    inner={inners.back}
                    onOuter={(b) => setOuters((prev) => ({ ...prev, back: b }))}
                    onInner={(b) => setInners((prev) => ({ ...prev, back: b }))}
                    skip={skip.back}
                    onSkip={(v) => setSkip((s) => ({ ...s, back: v }))}
                  />
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={run}
                disabled={!files.front || running || outOfQuota}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {running ? "Inspecting…" : outOfQuota ? "No grades left" : "Run pre-grade"}
              </button>
              {(proc.front.loading || proc.back.loading) && (
                <span className="text-xs text-text-muted inline-flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Straightening card…
                </span>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>

          <aside className="lg:col-span-2 space-y-5">
            <WhatWeCheck />
            <PhotoTips />
            <CenteringGuide />
            <ScaleLegend />
          </aside>
        </div>
      )}

      {result && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Grade another card
            </button>
            <button
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await buildGradeReportPdf(result, {
                    front: proc.front.src ?? previews.front,
                    back: proc.back.src ?? previews.back,
                  });
                } catch {
                  setError("Couldn't build the PDF report.");
                } finally {
                  setPdfBusy(false);
                }
              }}
              disabled={pdfBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {pdfBusy ? "Building PDF…" : "Download PDF report"}
            </button>
          </div>
          <GradeReport
            result={result}
            images={{
              front: proc.front.src ?? previews.front,
              back: proc.back.src ?? previews.back,
            }}
          />
        </>
      )}
    </div>
    </div>
  );
}

function CenteringPanel({
  side,
  label,
  proc,
  displaySrc,
  outer,
  inner,
  onOuter,
  onInner,
  skip,
  onSkip,
}: {
  side: CardSlot;
  label: string;
  proc: SideProc;
  displaySrc?: string;
  outer: Box | null;
  inner: Box | null;
  onOuter: (b: Box) => void;
  onInner: (b: Box) => void;
  skip: boolean;
  onSkip: (v: boolean) => void;
}) {
  if (!displaySrc && !proc.loading) return null;
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <h3 className="text-sm font-medium text-text-primary flex items-center gap-2 mb-3">
        <ScanSearch className="w-4 h-4 text-accent" />
        Measure centering — {label}
      </h3>
      {proc.loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" /> Straightening…
        </div>
      ) : displaySrc ? (
        <>
          {proc.failed && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-300/90">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Couldn't auto-straighten — adjust the borders by hand or tick "No border".
            </p>
          )}
          <CenteringTool
            side={side}
            imageSrc={displaySrc}
            outer={outer}
            inner={inner}
            onOuter={onOuter}
            onInner={onInner}
            skipped={skip}
            onSkip={onSkip}
          />
        </>
      ) : null}
    </div>
  );
}

function WhatWeCheck() {
  const rows = [
    { icon: ScanSearch, t: "Centering", d: "How even the borders are, front and back." },
    { icon: Square, t: "Corners", d: "Sharpness, whitening, rounding or dents." },
    { icon: Crop, t: "Edges", d: "Whitening, chips, nicks and rough cuts." },
    { icon: Layers, t: "Surface", d: "Scratches, print lines, dents and creases." },
  ];
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3">What we check</h3>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.t} className="flex items-start gap-3">
            <span className="mt-0.5 w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
              <r.icon className="w-4 h-4 text-accent" />
            </span>
            <div>
              <div className="text-sm text-text-primary">{r.t}</div>
              <div className="text-xs text-text-secondary">{r.d}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhotoTips() {
  const tips = [
    { icon: Sun, t: "Flat, even light", d: "Avoid glare and harsh shadows." },
    { icon: Camera, t: "Fill the frame", d: "Shoot square-on, card flat, in focus." },
    { icon: Layers, t: "Front and back", d: "Both sides — a missing back caps the grade." },
  ];
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Photo tips</h3>
      <ul className="space-y-3">
        {tips.map((r) => (
          <li key={r.t} className="flex items-start gap-3">
            <span className="mt-0.5 w-8 h-8 rounded-lg bg-surface-overlay flex items-center justify-center shrink-0">
              <r.icon className="w-4 h-4 text-text-secondary" />
            </span>
            <div>
              <div className="text-sm text-text-primary">{r.t}</div>
              <div className="text-xs text-text-secondary">{r.d}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Small SVG card illustrating an inner design box offset from centre.
function CenterEg({ dx, dy, label, ok }: { dx: number; dy: number; label: string; ok: "good" | "ok" | "bad" }) {
  const tone =
    ok === "good" ? "fill-emerald-400/30" : ok === "ok" ? "fill-accent/30" : "fill-amber-400/30";
  const stroke =
    ok === "good" ? "stroke-emerald-400" : ok === "ok" ? "stroke-accent" : "stroke-amber-400";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 60 84" className="w-14 h-[4.7rem]">
        <rect x="1" y="1" width="58" height="82" rx="4" className="fill-surface-overlay stroke-border-strong" strokeWidth="1.5" />
        <rect
          x={14 + dx}
          y={14 + dy}
          width="32"
          height="56"
          rx="2"
          className={`${tone} ${stroke}`}
          strokeWidth="1.5"
        />
      </svg>
      <span className="text-[11px] text-text-secondary">{label}</span>
    </div>
  );
}

function CenteringGuide() {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-1">How centering works</h3>
      <p className="text-xs text-text-secondary mb-4">
        We compare the border widths on opposite sides. The worst axis sets the ceiling —
        PSA 10 needs 55/45 or better on the front.
      </p>
      <div className="flex items-end justify-between gap-2">
        <CenterEg dx={0} dy={0} label="50/50" ok="good" />
        <CenterEg dx={5} dy={2} label="60/40" ok="ok" />
        <CenterEg dx={10} dy={4} label="70/30" ok="bad" />
      </div>
      <div className="mt-4 rounded-lg bg-surface-overlay/60 p-3 flex items-center gap-3">
        <svg viewBox="0 0 60 84" className="w-12 shrink-0">
          <rect x="1" y="1" width="58" height="82" rx="4" className="fill-surface stroke-border-strong" strokeWidth="1.5" />
          <rect x="12" y="12" width="36" height="60" rx="2" className="fill-accent/20 stroke-accent" strokeWidth="1.5" />
          <line x1="1" y1="42" x2="12" y2="42" className="stroke-accent" strokeWidth="1.5" />
          <line x1="48" y1="42" x2="59" y2="42" className="stroke-accent" strokeWidth="1.5" />
        </svg>
        <p className="text-xs text-text-secondary">
          Set the dashed box to the card's outer edge and the solid box to where the artwork
          starts. We measure the border band between them on each side.
        </p>
      </div>
    </div>
  );
}

function ScaleLegend() {
  const rows = [
    ["PSA", "Whole grades 1–10, Gem Mint 10"],
    ["Beckett", "Half grades + subgrades, Black Label = all 10s"],
    ["CGC", "Half grades, Pristine 10"],
    ["TAG", "One-decimal grades (e.g. 9.4)"],
    ["ACE", "One-decimal grades + subgrades"],
  ];
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3">The graders we compare</h3>
      <ul className="space-y-2">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-baseline gap-3 text-xs">
            <span className="w-16 shrink-0 font-semibold text-text-primary">{k}</span>
            <span className="text-text-secondary">{v}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-text-muted">
        Estimates only. Official grades are decided by each company after inspecting the
        physical card.
      </p>
    </div>
  );
}

function ImageSlot({
  label,
  preview,
  onPick,
  onClear,
}: {
  label: string;
  preview?: string;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/x-adobe-dng,.heic,.heif,.dng"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      {preview ? (
        <div className="relative aspect-[5/7] overflow-hidden rounded-xl border border-border-subtle bg-surface-overlay">
          <img src={preview} alt={label} className="h-full w-full object-contain" />
          <button
            onClick={onClear}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[5/7] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-overlay/40 text-text-secondary hover:border-accent/50 hover:text-text-primary transition-colors"
        >
          <Upload className="w-5 h-5" />
          <span className="text-xs px-2 text-center">{label}</span>
        </button>
      )}
    </div>
  );
}

const REC_LABELS: Record<string, string> = {
  strong_candidate: "Strong candidate",
  // legacy value kept so older responses still render
  strong_psa_candidate: "Strong candidate",
  possible_candidate_inspect_first: "Possible — inspect first",
  only_if_value_justifies: "Only if value justifies it",
  sell_raw: "Sell raw instead",
  do_not_grade: "Do not grade",
  needs_better_photos: "Needs better photos",
};
const REC_TONE: Record<string, string> = {
  strong_candidate: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  strong_psa_candidate: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  possible_candidate_inspect_first: "bg-accent/15 text-accent border-accent/30",
  only_if_value_justifies: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  sell_raw: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  do_not_grade: "bg-red-500/15 text-red-300 border-red-500/30",
  needs_better_photos: "bg-surface-overlay text-text-secondary border-border-subtle",
};

const LIKELIHOOD_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  very_low: "Very low",
  cannot_assess: "Can't assess",
};

function CompanyEstimate({ obj }: { obj: unknown }) {
  const o = asObj(obj);
  const subs = asObj(o.subgrades);
  const hasSubs = Object.keys(subs).length > 0;
  const likelihood = asStr(o.top_grade_likelihood);
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-text-primary">{asStr(o.company) || "—"}</span>
        {likelihood && (
          <span className="text-[11px] text-text-muted">
            Gem: {LIKELIHOOD_LABELS[likelihood] ?? likelihood}
          </span>
        )}
      </div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">{asStr(o.likely) || "—"}</div>
      <div className="text-xs text-text-secondary mt-0.5">
        Range {asStr(o.low) || "?"} – {asStr(o.high) || "?"}
      </div>
      {hasSubs && (
        <div className="mt-3 grid grid-cols-4 gap-1 text-center">
          {(["centering", "corners", "edges", "surface"] as const).map((k) => (
            <div key={k}>
              <div className="text-[10px] uppercase tracking-wide text-text-muted">{k.slice(0, 4)}</div>
              <div className="text-xs text-text-primary">{asStr(subs[k]) || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardImages({ images }: { images?: { front?: string; back?: string } }) {
  const shots = [
    { label: "Front", src: images?.front },
    { label: "Back", src: images?.back },
  ].filter((s): s is { label: string; src: string } => Boolean(s.src));
  if (shots.length === 0) return null;
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-3">
      <div className={`grid gap-3 ${shots.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {shots.map((s) => (
          <div key={s.label}>
            <div className="rounded-lg overflow-hidden border border-border-subtle bg-surface-overlay">
              <img src={s.src} alt={s.label} className="w-full h-auto object-contain" />
            </div>
            <div className="mt-1.5 text-center text-[11px] text-text-muted">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtMoney(n: number, currency: string): string {
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  return `${sym}${Math.round(n).toLocaleString()}`;
}

function fmtRange(low: number, high: number, currency: string): string {
  if (Math.round(low) === Math.round(high)) return fmtMoney(low, currency);
  return `${fmtMoney(low, currency)}–${fmtMoney(high, currency)}`;
}

function PriceEstimate({ pricing }: { pricing?: CardPricing }) {
  if (!pricing || !pricing.raw) return null;
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
      <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
        <Tag className="w-4 h-4 text-accent" />
        Estimated value
        <span className="rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-semibold px-2 py-0.5">
          ESTIMATE
        </span>
      </h3>
      <div className="flex items-baseline justify-between border-b border-border-subtle pb-2">
        <span className="text-sm text-text-secondary">Raw / ungraded</span>
        <span className="text-base font-semibold text-text-primary">
          {fmtRange(pricing.raw.low, pricing.raw.high, pricing.currency)}
        </span>
      </div>
      {pricing.graded.length > 0 && (
        <ul className="divide-y divide-border-subtle">
          {pricing.graded.map((g, i) => (
            <li key={i} className="flex items-baseline justify-between py-2">
              <span className="text-sm text-text-secondary">
                {g.company}
                {g.grade ? <span className="text-text-muted"> · {g.grade}</span> : null}
              </span>
              <span className="text-sm font-medium text-text-primary">
                {fmtRange(g.low, g.high, pricing.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-snug text-text-muted">
        Rough estimate (confidence: {pricing.confidence}){pricing.note ? ` — ${pricing.note}` : ""}
      </p>
    </div>
  );
}

function GradeReport({
  result,
  images,
}: {
  result: GradeResult;
  images?: { front?: string; back?: string };
}) {
  const rec = asObj(result.submission_recommendation);
  const confidence = asObj(result.confidence);
  const blockers = asObj(result.grade_blockers);
  const caps = asArr(result.hard_grade_caps);
  const ident = asObj(result.card_identification);
  const recVerdict = asStr(rec.verdict);
  const companies = asArr(result.company_estimates);
  const bestFor = asStr(rec.best_for);
  const authentic = asObj(result.authentic);
  const isAuthenticOnly = authentic.is_authentic_only === true;

  return (
    <div className="mt-8 animate-[fade-in_0.25s_ease-out]">
      {isAuthenticOnly && (
        <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-5">
          <div className="flex items-center gap-2 text-red-300 font-semibold">
            <AlertTriangle className="w-5 h-5" />
            Authentic / Altered — not gradeable as Mint
          </div>
          <p className="mt-2 text-sm text-red-200/90">
            {asStr(authentic.reason) ||
              "Structural damage or alteration was detected (e.g. a tear, missing piece, or trimming). This card cannot receive a numeric mint grade."}
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-5 items-start">
        {/* Left rail: the card, what it is, what it's worth, centering */}
        <div className="space-y-5 lg:sticky lg:top-4">
          <CardImages images={images} />

          <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
            <h3 className="text-sm font-medium text-text-primary mb-2">Card</h3>
            <dl className="text-sm space-y-1">
              <Field k="Name" v={asStr(ident.name)} />
              <Field k="Set" v={asStr(ident.set)} />
              <Field k="Number" v={asStr(ident.number)} />
              <Field k="Variant" v={asStr(ident.variant)} />
            </dl>
          </div>

          <PriceEstimate pricing={result.pricing as CardPricing | undefined} />

          <Centering obj={result.centering} />
        </div>

        {/* Right column: the verdict and condition breakdown */}
        <div className="space-y-5 min-w-0">
          <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-text-muted">Recommendation</div>
                <div className="text-2xl font-semibold text-text-primary mt-1">
                  {REC_LABELS[recVerdict] ?? recVerdict ?? "—"}
                </div>
                {bestFor && (
                  <div className="text-sm text-text-secondary mt-1">
                    Best fit: <span className="text-text-primary">{bestFor}</span>
                  </div>
                )}
              </div>
              {recVerdict && (
                <span
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    REC_TONE[recVerdict] ?? REC_TONE.needs_better_photos
                  }`}
                >
                  {REC_LABELS[recVerdict] ?? recVerdict}
                </span>
              )}
            </div>
            {asStr(rec.reason) && (
              <p className="mt-3 text-sm text-text-secondary">{asStr(rec.reason)}</p>
            )}
          </div>

          {companies.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-text-muted mb-2">
                Estimated grade by company
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {companies.map((c, i) => (
                  <CompanyEstimate key={i} obj={c} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ScoreCard label="Corners" obj={result.corners} />
            <ScoreCard label="Edges" obj={result.edges} />
            <ScoreCard label="Surface" obj={result.surface} />
            <ScoreCard label="Eye appeal" obj={result.eye_appeal} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <BlockerList title="Blocks gem mint" items={asArr(blockers.gem_mint)} tone="red" />
            <BlockerList title="Blocks mint (≈9)" items={asArr(blockers.mint)} tone="amber" />
            <BlockerList title="Blocks near-mint (≈8)" items={asArr(blockers.near_mint)} tone="muted" />
          </div>

          {caps.length > 0 && (
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
              <h3 className="text-sm font-medium text-text-primary mb-2">Hard caps applied</h3>
              <ul className="space-y-1.5">
                {caps.map((c, i) => {
                  const o = asObj(c);
                  return (
                    <li key={i} className="text-sm text-text-secondary">
                      <span className="text-text-primary">{asStr(o.cap)}</span>
                      {asStr(o.reason) ? ` — ${asStr(o.reason)}` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <InspectionNotes result={result} />

          <PreparationSection preparation={result.preparation as Preparation | undefined} images={images} />

          <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
            <h3 className="text-sm font-medium text-text-primary mb-2">
              Confidence: <span className="capitalize text-text-primary">{asStr(confidence.rating) || "—"}</span>
            </h3>
            {asArr(confidence.improve_with).length > 0 && (
              <ul className="text-sm text-text-secondary list-disc list-inside space-y-1">
                {asArr(confidence.improve_with).map((x, i) => (
                  <li key={i}>{asStr(x)}</li>
                ))}
              </ul>
            )}
          </div>

          {asStr(result.summary) && (
            <p className="text-sm text-text-secondary border-l-2 border-accent/40 pl-4">
              {asStr(result.summary)}
            </p>
          )}
        </div>
      </div>

      <p className="mt-5 text-xs text-text-muted">{asStr(result.disclaimer)}</p>
    </div>
  );
}

const RISK_TONE: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  high: "bg-red-500/15 text-red-300",
};

function PreparationSection({
  preparation,
  images,
}: {
  preparation?: Preparation;
  images?: { front?: string; back?: string };
}) {
  const [shots, setShots] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!preparation || preparation.items.length === 0) return;
    let cancelled = false;
    const cache: Partial<Record<"front" | "back", HTMLImageElement | null>> = {};
    const getImg = async (side: "front" | "back") => {
      if (!(side in cache)) {
        const src = side === "back" ? images?.back : images?.front;
        cache[side] = src ? await loadImage(src).catch(() => null) : null;
      }
      return cache[side] ?? null;
    };
    (async () => {
      const out: Record<number, string> = {};
      for (let i = 0; i < preparation.items.length; i++) {
        const it = preparation.items[i];
        const img = await getImg(it.side);
        if (!img) continue;
        const url = cropFromImage(img, resolveRect(it.region, it.bbox));
        if (url) out[i] = url;
      }
      if (!cancelled) setShots(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [preparation, images?.front, images?.back]);

  if (!preparation) return null;

  const safe = preparation.items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.canAttempt);
  const avoid = preparation.items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !it.canAttempt);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
      <div className="flex items-center gap-2 mb-1">
        <Wrench className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-text-primary">Preparation plan</h3>
      </div>
      <p className="text-sm text-text-secondary mb-4">{preparation.summary}</p>

      {safe.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs uppercase tracking-wide text-emerald-300/90 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Safe to prep ({safe.length})
          </h4>
          <div className="space-y-3">
            {safe.map(({ it, i }) => (
              <PrepCard key={i} item={it} shot={shots[i]} />
            ))}
          </div>
        </div>
      )}

      {avoid.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wide text-red-300/90 mb-2 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Leave alone — don't touch ({avoid.length})
          </h4>
          <div className="space-y-3">
            {avoid.map(({ it, i }) => (
              <PrepCard key={i} item={it} shot={shots[i]} />
            ))}
          </div>
        </div>
      )}

      {preparation.items.length === 0 && (
        <p className="text-sm text-text-muted">No locatable defects to prepare.</p>
      )}

      <p className="mt-4 text-xs text-text-muted border-t border-border-subtle pt-3">
        {preparation.disclaimer}
      </p>
    </div>
  );
}

function PrepCard({ item, shot }: { item: PrepItem; shot?: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-border-subtle bg-surface-overlay/40 p-3">
      <div className="w-20 h-20 shrink-0 rounded-md overflow-hidden border border-border-subtle bg-surface-overlay flex items-center justify-center">
        {shot ? (
          <img src={shot} alt={item.label} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-text-muted text-center px-1">No snapshot</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{item.label}</span>
          <span className="text-xs text-text-muted">· {item.location}</span>
          <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${RISK_TONE[item.risk] ?? RISK_TONE.high}`}>
            {item.risk} risk
          </span>
          {item.canAttempt && (
            <span className="text-[10px] rounded-full px-2 py-0.5 font-medium bg-surface-overlay text-text-secondary inline-flex items-center gap-1">
              {item.reversible ? <RotateCw className="w-3 h-3" /> : null}
              {item.difficulty}
            </span>
          )}
        </div>
        <div className="text-sm text-text-primary mt-1">{item.action}</div>
        {item.method && <p className="text-xs text-text-secondary mt-1">{item.method}</p>}
        {item.tools.length > 0 && (
          <p className="text-xs text-text-muted mt-1">Tools: {item.tools.join(", ")}</p>
        )}
        {item.caution && (
          <p className="text-xs text-amber-300/90 mt-1 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {item.caution}
          </p>
        )}
        {item.expectedUpside && (
          <p className="text-xs text-text-secondary mt-1">
            <span className="text-text-muted">Upside:</span> {item.expectedUpside}
          </p>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, obj }: { label: string; obj: unknown }) {
  const o = asObj(obj);
  const score = asNum(o.score);
  const pct = score != null ? Math.max(0, Math.min(100, score * 10)) : 0;
  const tone = score == null ? "bg-text-muted" : score >= 8.5 ? "bg-emerald-400" : score >= 7 ? "bg-accent" : "bg-amber-400";
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="text-lg font-semibold text-text-primary">
          {score != null ? score.toFixed(1) : "—"}
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {asStr(o.verdict) && (
        <p className="mt-2 text-[11px] leading-tight text-text-muted">{asStr(o.verdict)}</p>
      )}
    </div>
  );
}

function BlockerList({
  title,
  items,
  tone,
}: {
  title: string;
  items: unknown[];
  tone: "red" | "amber" | "muted";
}) {
  const border =
    tone === "red" ? "border-red-500/30" : tone === "amber" ? "border-amber-500/30" : "border-border-subtle";
  return (
    <div className={`rounded-xl border ${border} bg-surface-raised p-4`}>
      <h3 className="text-sm font-medium text-text-primary mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-text-muted">No clear blocker (limited by photo quality).</p>
      ) : (
        <ul className="text-sm text-text-secondary space-y-1 list-disc list-inside">
          {items.map((x, i) => (
            <li key={i}>{asStr(x)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Centering({ obj }: { obj: unknown }) {
  const o = asObj(obj);
  const measured = o.measured === true;
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
      <h3 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
        Centering
        {measured && (
          <span className="rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold px-2 py-0.5">
            MEASURED
          </span>
        )}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Field k="Front L/R" v={asStr(o.front_left_right)} />
        <Field k="Front T/B" v={asStr(o.front_top_bottom)} />
        <Field k="Back L/R" v={asStr(o.back_left_right)} />
        <Field k="Back T/B" v={asStr(o.back_top_bottom)} />
      </div>
      {asStr(o.verdict) && <p className="mt-3 text-sm text-text-secondary">{asStr(o.verdict)}</p>}
    </div>
  );
}

const SEV_TONE: Record<string, string> = {
  major: "bg-red-500/15 text-red-300",
  moderate: "bg-amber-500/15 text-amber-300",
  minor: "bg-surface-overlay text-text-secondary",
};

// Surfaces the raw inspection findings the model reported: structural damage
// (breaks in the card itself) and broader observations, so nothing is hidden.
function InspectionNotes({ result }: { result: GradeResult }) {
  const structural = asArr(result.structural_damage).map(asObj);
  const obs = asArr(result.observations).map(asObj);
  if (structural.length === 0 && obs.length === 0) return null;
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
      <div className="flex items-center gap-2 mb-3">
        <ScanSearch className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-text-primary">Inspection notes</h3>
      </div>

      {structural.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs uppercase tracking-wide text-red-300/90 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Structural damage ({structural.length})
          </h4>
          <ul className="space-y-2">
            {structural.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 text-[10px] rounded-full px-2 py-0.5 font-medium shrink-0 ${SEV_TONE[asStr(d.severity)] ?? SEV_TONE.minor}`}>
                  {asStr(d.severity) || "—"}
                </span>
                <span className="text-text-secondary">
                  <span className="text-text-primary capitalize">{asStr(d.type).replace(/_/g, " ") || "Damage"}</span>
                  {asStr(d.where) ? ` — ${asStr(d.where)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {obs.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wide text-text-muted mb-2">Other observations</h4>
          <ul className="space-y-2">
            {obs.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 text-[10px] rounded-full px-2 py-0.5 font-medium shrink-0 ${SEV_TONE[asStr(o.severity)] ?? SEV_TONE.minor}`}>
                  {asStr(o.severity) || "note"}
                </span>
                <span className="text-text-secondary">
                  <span className="text-text-primary">{asStr(o.issue) || "Observation"}</span>
                  {asStr(o.where) ? ` — ${asStr(o.where)}` : ""}
                  {asStr(o.likely) ? <span className="text-text-muted"> ({asStr(o.likely)})</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{k}</dt>
      <dd className="text-text-primary">{v || "—"}</dd>
    </div>
  );
}
