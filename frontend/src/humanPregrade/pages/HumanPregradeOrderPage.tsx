import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  getHumanPregradeOrder,
  getHumanPregradeReport,
  getHumanPregradeStatus,
  fulfilHumanPregradeImageRequest,
  submitHumanPregradeOrder,
  downloadHumanPregradeReportPdf,
} from "../api";
import { HumanPregradeProgress } from "../components/HumanPregradeProgress";
import { resolveCustomerProgress } from "../copy";
import { useHumanPregradeConfig } from "../hooks/useHumanPregradeConfig";

export function HumanPregradeOrderPage() {
  const { publicId } = useParams();
  const [params] = useSearchParams();
  const { enabled, config } = useHumanPregradeConfig();
  const [data, setData] = useState<Awaited<ReturnType<typeof getHumanPregradeOrder>> | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const refresh = () => {
    if (!publicId) return;
    getHumanPregradeOrder(publicId).then(setData);
  };

  useEffect(() => {
    if (!enabled || !publicId) return;
    refresh();
  }, [enabled, publicId]);

  useEffect(() => {
    if (!publicId || params.get("purchase") !== "success") return;
    submitHumanPregradeOrder(publicId).then(refresh).catch(() => undefined);
  }, [publicId, params]);

  useEffect(() => {
    if (!enabled || !publicId || !data) return;
    const terminal = ["completed", "cancelled", "refunded", "unable_to_assess"];
    if (terminal.includes(data.order.status)) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const st = await getHumanPregradeStatus(publicId);
        if (st.status !== data.order.status) refresh();
      } catch {
        /* ignore */
      }
    }, 30_000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [enabled, publicId, data?.order.status]);

  if (!enabled || !data) return <p className="p-8 text-text-muted">Loading…</p>;
  const order = data.order;
  const progress =
    order.progress ?? resolveCustomerProgress(order.status);
  const openRequests = (data as { openImageRequests?: { id: string; instructions: string; required_image_type: string }[] })
    .openImageRequests;

  const handleFulfil = async (requestId: string, file: File) => {
    if (!publicId) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      await fulfilHumanPregradeImageRequest(publicId, requestId, file);
      refresh();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">{order.cardName ?? "Expert review"}</h1>
      <p className="text-sm text-text-muted">Ref: {order.publicId}</p>

      <HumanPregradeProgress progress={progress} />

      <div className="rounded-xl border border-border-subtle p-4 space-y-2 text-sm">
        <p><strong>Service:</strong> {order.serviceName}</p>
        {order.estimatedCompletionAt ? (
          <p><strong>Est. completion:</strong> {new Date(order.estimatedCompletionAt).toLocaleDateString()}</p>
        ) : null}
        {order.submittedAt ? (
          <p><strong>Submitted:</strong> {new Date(order.submittedAt).toLocaleDateString()}</p>
        ) : null}
      </div>

      {order.status === "awaiting_customer_images" && openRequests?.length ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <p className="text-sm font-medium text-amber-200">Additional images required</p>
          {openRequests.map((req) => (
            <div key={req.id} className="space-y-2">
              <p className="text-xs text-text-secondary">{req.instructions}</p>
              <label className="block text-xs">
                Upload {req.required_image_type}
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block"
                  disabled={uploadBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFulfil(req.id, f);
                  }}
                />
              </label>
            </div>
          ))}
          {uploadError ? <p className="text-xs text-error">{uploadError}</p> : null}
        </div>
      ) : null}

      {order.status === "completed" ? (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/human-pregrade/orders/${publicId}/report`}
            className="inline-block rounded-lg bg-accent text-white px-4 py-2 text-sm"
          >
            View human expert report
          </Link>
          <button
            type="button"
            className="inline-block rounded-lg border border-border-subtle px-4 py-2 text-sm"
            onClick={() => publicId && downloadHumanPregradeReportPdf(publicId)}
          >
            Download PDF
          </button>
        </div>
      ) : null}

      {order.hasAiSnapshot ? (
        <p className="text-xs text-text-muted border border-border-subtle rounded-lg p-3">
          This order includes read-only reference to an existing AI analysis. Your human expert report is separate and independent.
        </p>
      ) : null}
      <Link to="/human-pregrade/orders" className="text-sm text-text-muted">← All reviews</Link>
    </div>
  );
}

export function HumanPregradeReportPage() {
  const { publicId } = useParams();
  const { enabled } = useHumanPregradeConfig();
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!enabled || !publicId) return;
    getHumanPregradeReport(publicId).then((r) => setReport(r.report));
  }, [enabled, publicId]);

  if (!enabled) return null;
  if (!report) return <p className="p-8">Loading report…</p>;

  const reportData = (report.reportData ?? report.report_data ?? {}) as Record<string, unknown>;
  const card = (reportData.card ?? {}) as Record<string, unknown>;
  const a = (reportData.assessment ?? {}) as Record<string, unknown>;
  const predictions = (reportData.predictions ?? []) as Record<string, unknown>[];
  const defects = (reportData.defects ?? []) as Record<string, unknown>[];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">
        Human expert review
      </span>
      <h1 className="text-2xl font-semibold">{String(reportData.productName ?? "Expert Review")}</h1>
      <p className="text-sm text-text-muted">Order {String(reportData.orderReference ?? "")}</p>
      <h2 className="text-lg font-medium">{String(card.name ?? "Card")}</h2>
      <p className="text-text-secondary">{String(card.set ?? "")} {String(card.number ?? "")}</p>

      {a.conditionSummary ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Condition summary</h3>
          <p className="text-sm text-text-secondary">{String(a.conditionSummary)}</p>
          {a.mainGradeLimiter ? (
            <p className="text-sm"><strong>Main limiter:</strong> {String(a.mainGradeLimiter)}</p>
          ) : null}
        </section>
      ) : null}

      {predictions.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Grader predictions</h3>
          <ul className="space-y-2 text-sm">
            {predictions.map((p, i) => (
              <li key={i} className="rounded-lg border border-border-subtle p-3">
                Most likely <strong>{String(p.mostLikelyGrade)}</strong> (range {String(p.minimumGrade)}–{String(p.maximumGrade)}, confidence {String(p.confidence)})
                {p.explanation ? <p className="text-text-muted mt-1">{String(p.explanation)}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {defects.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Notable defects</h3>
          <ul className="list-disc pl-5 text-sm text-text-secondary">
            {defects.map((d, i) => (
              <li key={i}>{String(d.title)} ({String(d.severity)})</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-text-muted italic border-t border-border-subtle pt-4">
        This report is an independent human pre-grading opinion based solely on the digital images supplied.
        It is not official grading, certification or authentication.
      </p>
      <div className="flex gap-3">
        <Link to={`/human-pregrade/orders/${publicId}`} className="text-sm text-accent">← Back to order</Link>
        <button
          type="button"
          className="text-sm text-accent"
          onClick={() => publicId && downloadHumanPregradeReportPdf(publicId)}
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
