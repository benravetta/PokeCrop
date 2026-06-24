import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  AlertTriangle,
  ScanSearch,
  RotateCcw,
  Wrench,
  ShieldAlert,
  CheckCircle2,
  RotateCw,
  Tag,
  FileDown,
  Camera,
} from "lucide-react";
import { buildGradeReportPdf } from "../lib/gradeReportPdf";
import {
  gradeCard,
  getGradeQuota,
  startGradeCheckout,
  getPurchaseStatus,
  straightenForGrade,
  ApiError,
  type CaptureIssue,
  type CaptureQuality,
  type GradeQuota,
  type GradeResult,
  type GradeImages,
  type MeasuredCentering,
  type Preparation,
  type PrepItem,
  type CardPricing,
} from "../lib/api";
import { useMe } from "../hooks/useMe";
import { AdminBadge } from "../lib/adminAccess";
import { GradeProgress } from "../components/grade/GradeProgress";
import { GradeUploadWorkspace } from "../components/grade/GradeUploadWorkspace";
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
  const [captureBlockers, setCaptureBlockers] = useState<CaptureIssue[]>([]);
  const [frontLongEdge, setFrontLongEdge] = useState<number | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const refreshMe = useMe((s) => s.refresh);
  const isAdmin = useMe((s) => s.me?.isAdmin) === true;
  const purchaseStatus = searchParams.get("purchase");

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

  useEffect(() => {
    const f = files.front;
    if (!f) {
      setFrontLongEdge(null);
      return;
    }
    void createImageBitmap(f)
      .then((bitmap) => {
        setFrontLongEdge(Math.max(bitmap.width, bitmap.height));
        bitmap.close();
      })
      .catch(() => setFrontLongEdge(null));
  }, [files.front]);

  // Returning from a single-grade Checkout: poll until webhook credit lands.
  useEffect(() => {
    if (!purchaseStatus) return;
    if (purchaseStatus !== "success") {
      const t = window.setTimeout(() => {
        searchParams.delete("purchase");
        searchParams.delete("session_id");
        setSearchParams(searchParams, { replace: true });
      }, 5000);
      return () => window.clearTimeout(t);
    }

    const sessionId = searchParams.get("session_id");
    let cancelled = false;
    let attempts = 0;

    const refresh = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        if (sessionId) {
          const st = await getPurchaseStatus(sessionId);
          if (st.status === "credited" || st.status === "already_credited") {
            const r = await getGradeQuota();
            if (!cancelled) setQuota(r.quota);
            refreshMe();
            return;
          }
          if (st.status === "expired" || st.status === "unpaid") return;
        } else {
          const r = await getGradeQuota();
          if (!cancelled) setQuota(r.quota);
          refreshMe();
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled && attempts < 15) {
        window.setTimeout(refresh, 2000);
      }
    };

    void refresh();
    const t = window.setTimeout(() => {
      searchParams.delete("purchase");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    }, 35000);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [purchaseStatus, refreshMe, searchParams, setSearchParams]);

  const buyGrade = useCallback(async () => {
    if (isAdmin) return;
    setBuyBusy(true);
    setError(null);
    try {
      const { url } = await startGradeCheckout();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setBuyBusy(false);
    }
  }, [isAdmin]);

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
      // Straighten unavailable — still send a high-resolution original so the
      // inspection isn't reading a tiny image.
      return downscale(f, 2400);
    },
    [files, proc]
  );

  const run = useCallback(async () => {
    if (!files.front) return;
    setRunning(true);
    setError(null);
    setCaptureBlockers([]);
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
      if (err instanceof ApiError && err.status === 422) {
        const body = err.body as { capture_quality?: CaptureQuality } | null;
        if (body?.capture_quality) {
          setCaptureBlockers(body.capture_quality.issues.filter((i) => i.severity === "block"));
        }
      }
      setError(err instanceof Error ? err.message : "Grading failed.");
    } finally {
      setRunning(false);
    }
  }, [files, imageFor, buildCentering, closeups]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setCaptureBlockers([]);
  }, []);

  const centeringMeasured = Boolean(buildCentering());
  const localCaptureHints: CaptureIssue[] = [];
  if (files.front && frontLongEdge != null && frontLongEdge < 1200) {
    localCaptureHints.push({
      code: "resolution_low",
      severity: frontLongEdge < 720 ? "block" : "warn",
      message:
        frontLongEdge < 720
          ? `Front image is only ~${frontLongEdge}px — too small for a reliable grade. Use full camera resolution.`
          : `Front is ~${frontLongEdge}px — usable but low. Full camera quality (~1500px+) improves the read.`,
    });
  }
  if (files.front && !files.back) {
    localCaptureHints.push({
      code: "missing_back",
      severity: "warn",
      message: "No back photo — gem-grade calls won't be reliable.",
    });
  }
  if (files.front && !centeringMeasured) {
    localCaptureHints.push({
      code: "centering_not_measured",
      severity: "warn",
      message: "Centering not measured — confirm borders on the straightened card for accurate subgrades.",
    });
  }

  const outOfQuota = isAdmin ? false : quota ? quota.remaining <= 0 : false;

  const quotaLabel = quota ? (
    quota.isAdmin || isAdmin ? (
      <div className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm px-4 py-3 text-right">
        <div className="text-[11px] uppercase tracking-wide text-amber-200/80">Admin access</div>
        <div className="mt-1 flex justify-end">
          <AdminBadge />
        </div>
        <div className="text-[11px] text-amber-100/80 mt-1">Unlimited grades</div>
      </div>
    ) : (
    <div className="shrink-0 rounded-xl border border-border-subtle bg-surface/60 backdrop-blur-sm px-4 py-3 text-right">
      <div className="text-[11px] uppercase tracking-wide text-text-muted">Grades left</div>
      <div className="text-lg font-semibold text-text-primary tabular-nums">
        {quota.remaining}
        <span className="text-sm font-normal text-text-muted"> / {quota.limit + quota.credits}</span>
      </div>
      <div className="text-[11px] text-text-muted mt-0.5">
        {quota.allowanceRemaining} plan · {quota.window === "month" ? "this month" : "today"}
        {quota.credits > 0 && (
          <span className="text-accent"> · +{quota.credits} purchased</span>
        )}
      </div>
    </div>
    )
  ) : null;

  const purchaseBanner =
    purchaseStatus === "success" ? (
      <div className="mt-4 rounded-lg bg-success/10 border border-success/20 px-3 py-2 text-[13px] text-success">
        Payment received — a single grade has been added to your account.
      </div>
    ) : purchaseStatus === "cancel" ? (
      <div className="mt-4 rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2 text-[13px] text-text-secondary">
        Checkout cancelled — no charge was made.
      </div>
    ) : null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
    <div className={`mx-auto px-4 sm:px-6 py-8 w-full ${result ? "max-w-6xl xl:max-w-7xl" : "max-w-6xl pb-24"}`}>
      {running && (
        <div className="max-w-2xl mx-auto mb-8">
          <GradeProgress />
        </div>
      )}

      {!result && !running && (
        <GradeUploadWorkspace
          quotaLabel={quotaLabel}
          purchaseBanner={purchaseBanner}
          files={files}
          previews={previews}
          setSlot={setSlot}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          closeups={closeups}
          closeupPreviews={closeupPreviews}
          addCloseup={addCloseup}
          removeCloseup={removeCloseup}
          proc={proc}
          outers={outers}
          inners={inners}
          skip={skip}
          setOuters={setOuters}
          setInners={setInners}
          setSkip={setSkip}
          localCaptureHints={localCaptureHints}
          centeringMeasured={centeringMeasured}
          error={error}
          captureBlockers={captureBlockers}
          outOfQuota={outOfQuota}
          buyBusy={buyBusy}
          buyGrade={buyGrade}
          running={running}
          run={run}
        />
      )}

      {result && result.not_a_card === true && (
        <div className="max-w-xl mx-auto text-center rounded-2xl border border-border-subtle bg-surface-raised p-8 animate-[fade-in_0.25s_ease-out]">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-300" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">That doesn't look like a trading card</h2>
          <p className="mt-2 text-sm text-text-secondary">{asStr(result.reason)}</p>
          <p className="mt-1 text-xs text-text-muted">
            No grade was used. Upload a clear, square-on photo of the card front (and back).
          </p>
          <button
            onClick={reset}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try another image
          </button>
        </div>
      )}

      {result && result.not_a_card !== true && (
        <>
          <div className="mb-6 rounded-2xl border border-border-subtle bg-surface-raised p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 anim-rise">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-muted">Pre-grade complete</div>
              <h1 className="text-xl font-semibold text-text-primary mt-0.5">Your report</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl border border-border-strong px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Grade another
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
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-[0_4px_20px_-6px_var(--color-accent)]"
              >
                {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                {pdfBusy ? "Building PDF…" : "Download PDF"}
              </button>
            </div>
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
  const bgsTier = asStr(o.bgs_tier);
  const tierBadge =
    bgsTier === "black_label"
      ? { label: "Black Label", className: "bg-zinc-900 text-amber-200 border-amber-400/40" }
      : bgsTier === "pristine"
        ? { label: "Pristine", className: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" }
        : null;
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 hover:border-accent/30 hover:bg-surface-overlay/30 transition-colors group">
      <div className="h-0.5 w-full rounded-full bg-gradient-to-r from-accent/60 to-transparent mb-3 opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-text-primary">{asStr(o.company) || "—"}</span>
        {likelihood && (
          <span className="text-[10px] uppercase tracking-wide text-text-muted">
            Gem {LIKELIHOOD_LABELS[likelihood] ?? likelihood}
          </span>
        )}
      </div>
      <div className="mt-1 text-2xl font-semibold text-text-primary tracking-tight">
        {asStr(o.likely) || "—"}
      </div>
      {tierBadge && (
        <div
          className={`mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tierBadge.className}`}
        >
          {tierBadge.label}
        </div>
      )}
      <div className="text-xs text-text-muted mt-0.5">
        {asStr(o.low) || "?"} – {asStr(o.high) || "?"}
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
        {pricing.source && pricing.source !== "ai" && (
          <span className="text-text-secondary">
            Source: {pricing.source}
            {pricing.asOf ? ` · ${pricing.asOf}` : ""}.{" "}
          </span>
        )}
        Estimate confidence: {pricing.confidence}
        {pricing.note ? ` — ${pricing.note}` : ""}
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
  const captureQuality = asObj(result.capture_quality);
  const captureIssues = asArr(captureQuality.issues)
    .map(asObj)
    .filter((i) => asStr(i.message))
    .map((i) => ({
      code: asStr(i.code),
      severity: asStr(i.severity),
      message: asStr(i.message),
    }))
    .filter((i) => i.severity === "warn");
  const bgsInsight = asObj(result.bgs_insight);
  const bgsTier = asStr(bgsInsight.tier);
  const bgsLabel = asStr(bgsInsight.label);
  const bgsDetail = asStr(bgsInsight.detail);

  return (
    <div className="mt-8 animate-[fade-in_0.25s_ease-out]">
      {bgsTier && bgsLabel && (
        <div
          className={`mb-5 rounded-xl border p-5 ${
            bgsTier === "black_label"
              ? "border-amber-400/40 bg-gradient-to-br from-zinc-900/90 to-amber-950/40"
              : "border-emerald-500/30 bg-emerald-500/10"
          }`}
        >
          <div
            className={`flex items-center gap-2 font-semibold ${
              bgsTier === "black_label" ? "text-amber-200" : "text-emerald-200"
            }`}
          >
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                bgsTier === "black_label"
                  ? "border-amber-400/50 text-amber-100"
                  : "border-emerald-500/40 text-emerald-100"
              }`}
            >
              BGS {bgsLabel}
            </span>
            {bgsTier === "black_label" ? "Black Label candidate" : "Pristine 10 candidate"}
          </div>
          {bgsDetail && (
            <p
              className={`mt-2 text-sm leading-relaxed ${
                bgsTier === "black_label" ? "text-amber-100/85" : "text-emerald-100/85"
              }`}
            >
              {bgsDetail}
            </p>
          )}
        </div>
      )}

      {captureIssues.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-200 font-medium text-sm">
            <Camera className="w-4 h-4" />
            Photo quality notes
          </div>
          <ul className="mt-2 space-y-1.5 text-xs text-amber-100/90 list-disc pl-5">
            {captureIssues.map((i) => (
              <li key={i.code}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}

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

          <CardIdentity ident={ident} />

          <PriceEstimate pricing={result.pricing as CardPricing | undefined} />

          <Centering obj={result.centering} />
        </div>

        {/* Right column: the verdict and condition breakdown */}
        <div className="space-y-5 min-w-0">
          <div
            className={`rounded-2xl border p-5 sm:p-6 ${
              REC_TONE[recVerdict] ?? REC_TONE.needs_better_photos
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide opacity-70">Recommendation</div>
                <div className="text-2xl sm:text-3xl font-semibold mt-1 tracking-tight">
                  {REC_LABELS[recVerdict] ?? recVerdict ?? "—"}
                </div>
                {bestFor && (
                  <div className="text-sm opacity-80 mt-2">
                    Best fit: <span className="font-medium">{bestFor}</span>
                  </div>
                )}
              </div>
            </div>
            {asStr(rec.reason) && (
              <p className="mt-4 text-sm opacity-90 leading-relaxed border-t border-current/10 pt-4">
                {asStr(rec.reason)}
              </p>
            )}
          </div>

          {companies.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-text-muted mb-3">
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

// Renders the read-from-card identification. Number is shown with the set total
// when known ("025/203"); only fields the model actually read are listed so the
// panel stays clean for cards where some details aren't legible.
function CardIdentity({ ident }: { ident: Record<string, unknown> }) {
  const name = asStr(ident.name);
  const set = asStr(ident.set);
  const number = asStr(ident.number);
  const setTotal = asStr(ident.set_total);
  const rarity = asStr(ident.rarity);
  const variant = asStr(ident.variant);
  const holoType = asStr(ident.holo_type);
  const edition = asStr(ident.edition);
  const language = asStr(ident.language);
  const regMark = asStr(ident.regulation_mark);
  const illustrator = asStr(ident.illustrator);
  const confidence = asStr(ident.confidence);
  const identifiers = asArr(ident.identifiers)
    .map((x) => asStr(x).trim())
    .filter(Boolean);

  const numberDisplay = number && setTotal ? `${number}/${setTotal}` : number;
  const variantDisplay = [variant, holoType].filter(Boolean).join(" · ");

  const rows: { k: string; v: string }[] = [
    { k: "Name", v: name },
    { k: "Set", v: set },
    { k: "Number", v: numberDisplay },
    { k: "Rarity", v: rarity },
    { k: "Variant", v: variantDisplay },
    { k: "Edition", v: edition },
    { k: "Reg. mark", v: regMark },
    { k: "Language", v: language },
    { k: "Illustrator", v: illustrator },
  ].filter((r) => r.v);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-primary">Card</h3>
        {confidence && (
          <span className="text-[10px] uppercase tracking-wide text-text-muted">
            ID confidence: {confidence}
          </span>
        )}
      </div>
      {rows.length ? (
        <dl className="text-sm space-y-1">
          {rows.map((r) => (
            <Field key={r.k} k={r.k} v={r.v} />
          ))}
        </dl>
      ) : (
        <p className="text-sm text-text-secondary">Couldn't read the card details clearly.</p>
      )}
      {identifiers.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-text-muted mb-1.5">Stamps & marks</div>
          <div className="flex flex-wrap gap-1.5">
            {identifiers.map((id, i) => (
              <span
                key={i}
                className="rounded-md bg-accent/10 text-accent px-2 py-0.5 text-xs"
              >
                {id}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
