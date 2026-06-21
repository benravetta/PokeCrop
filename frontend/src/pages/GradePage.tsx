import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  ShieldCheck,
  Upload,
  X,
  Sparkles,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import {
  gradeCard,
  getGradeQuota,
  type GradeQuota,
  type GradeResult,
  type GradeImages,
} from "../lib/api";

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

  useEffect(() => {
    getGradeQuota()
      .then((r) => setQuota(r.quota))
      .catch(() => {});
  }, []);

  const setSlot = useCallback((slot: Slot, file: File | null) => {
    setFiles((prev) => ({ ...prev, [slot]: file }));
    setPreviews((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot]);
      const next = { ...prev };
      if (file) next[slot] = URL.createObjectURL(file);
      else delete next[slot];
      return next;
    });
  }, []);

  const run = useCallback(async () => {
    if (!files.front) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const payload: GradeImages = { front: await downscale(files.front) };
      if (files.back) payload.back = await downscale(files.back);
      if (files.angled_front) payload.angled_front = await downscale(files.angled_front);
      if (files.angled_back) payload.angled_back = await downscale(files.angled_back);
      const res = await gradeCard(payload);
      setResult(res.result);
      setQuota(res.quota);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed.");
    } finally {
      setRunning(false);
    }
  }, [files]);

  const outOfQuota = quota ? quota.remaining <= 0 : false;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full">
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

      <div className="grid grid-cols-2 gap-4 mb-4">
        <ImageSlot label="Front (required)" preview={previews.front} onPick={(f) => setSlot("front", f)} onClear={() => setSlot("front", null)} />
        <ImageSlot label="Back" preview={previews.back} onPick={(f) => setSlot("back", f)} onClear={() => setSlot("back", null)} />
      </div>

      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="mb-2 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        Angled / holo shots (improve surface accuracy)
      </button>
      {showAdvanced && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <ImageSlot label="Angled front (holo glare)" preview={previews.angled_front} onPick={(f) => setSlot("angled_front", f)} onClear={() => setSlot("angled_front", null)} />
          <ImageSlot label="Angled back" preview={previews.angled_back} onPick={(f) => setSlot("angled_back", f)} onClear={() => setSlot("angled_back", null)} />
        </div>
      )}

      {!files.back && files.front && (
        <p className="mb-4 flex items-center gap-2 text-xs text-amber-300/90">
          <AlertTriangle className="w-3.5 h-3.5" />
          No back image — confidence will be capped and it can't be a strong PSA 10 call.
        </p>
      )}

      <button
        onClick={run}
        disabled={!files.front || running || outOfQuota}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {running ? "Inspecting…" : outOfQuota ? "No grades left" : "Run pre-grade"}
      </button>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && <GradeReport result={result} />}
    </div>
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
        accept="image/png,image/jpeg,image/webp"
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
  strong_psa_candidate: "Strong PSA candidate",
  possible_candidate_inspect_first: "Possible — inspect first",
  only_if_value_justifies: "Only if value justifies it",
  sell_raw: "Sell raw instead",
  do_not_grade: "Do not grade",
  needs_better_photos: "Needs better photos",
};
const REC_TONE: Record<string, string> = {
  strong_psa_candidate: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  possible_candidate_inspect_first: "bg-accent/15 text-accent border-accent/30",
  only_if_value_justifies: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  sell_raw: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  do_not_grade: "bg-red-500/15 text-red-300 border-red-500/30",
  needs_better_photos: "bg-surface-overlay text-text-secondary border-border-subtle",
};

function GradeReport({ result }: { result: GradeResult }) {
  const range = asObj(result.estimated_grade_range);
  const rec = asObj(result.submission_recommendation);
  const confidence = asObj(result.confidence);
  const blockers = asObj(result.grade_blockers);
  const caps = asArr(result.hard_grade_caps);
  const ident = asObj(result.card_identification);
  const recVerdict = asStr(rec.verdict);

  return (
    <div className="mt-8 space-y-5 animate-[fade-in_0.25s_ease-out]">
      <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-text-muted">Most likely</div>
            <div className="text-3xl font-semibold text-text-primary">
              {asStr(range.most_likely) || "—"}
            </div>
            <div className="text-sm text-text-secondary mt-1">
              Range {asStr(range.conservative) || "?"} – {asStr(range.optimistic) || "?"} · PSA 10
              likelihood: <span className="text-text-primary">{asStr(range.psa10_likelihood) || "—"}</span>
            </div>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard label="Corners" obj={result.corners} />
        <ScoreCard label="Edges" obj={result.edges} />
        <ScoreCard label="Surface" obj={result.surface} />
        <ScoreCard label="Eye appeal" obj={result.eye_appeal} />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <BlockerList title="Blocks PSA 10" items={asArr(blockers.psa10)} tone="red" />
        <BlockerList title="Blocks PSA 9" items={asArr(blockers.psa9)} tone="amber" />
        <BlockerList title="Blocks PSA 8" items={asArr(blockers.psa8)} tone="muted" />
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

      <Centering obj={result.centering} />

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
          <h3 className="text-sm font-medium text-text-primary mb-2">Card</h3>
          <dl className="text-sm space-y-1">
            <Field k="Name" v={asStr(ident.name)} />
            <Field k="Set" v={asStr(ident.set)} />
            <Field k="Number" v={asStr(ident.number)} />
            <Field k="Variant" v={asStr(ident.variant)} />
          </dl>
        </div>
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
      </div>

      {asStr(result.summary) && (
        <p className="text-sm text-text-secondary border-l-2 border-accent/40 pl-4">
          {asStr(result.summary)}
        </p>
      )}

      <p className="text-xs text-text-muted">{asStr(result.disclaimer)}</p>
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
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
      <h3 className="text-sm font-medium text-text-primary mb-2">Centering</h3>
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

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{k}</dt>
      <dd className="text-text-primary">{v || "—"}</dd>
    </div>
  );
}
