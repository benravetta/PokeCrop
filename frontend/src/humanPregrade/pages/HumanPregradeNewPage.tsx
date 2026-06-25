import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  createHumanPregradeOrder,
  patchHumanPregradeDraft,
  uploadHumanPregradeImage,
  startHumanPregradeCheckout,
  submitHumanPregradeOrder,
} from "../api";
import { useHumanPregradeConfig, formatMinorUnits } from "../hooks/useHumanPregradeConfig";

export function HumanPregradeNewPage() {
  const { config, enabled } = useHumanPregradeConfig();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const aiReportSnapshot = (location.state as { aiReportSnapshot?: Record<string, unknown> } | null)
    ?.aiReportSnapshot;
  const [step, setStep] = useState(0);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [form, setForm] = useState({
    cardGame: "Pokemon",
    cardName: "",
    setName: "",
    cardNumber: "",
    mainConcern: "",
    customerNotes: "",
    trainingConsent: false,
    termsAccepted: false,
    selectedGraderIds: [] as string[],
  });
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!config?.graders?.length) return;
    setForm((f) => ({
      ...f,
      selectedGraderIds: f.selectedGraderIds.length
        ? f.selectedGraderIds
        : [config.graders[0]!.id],
    }));
  }, [config]);

  if (!enabled || !config) return <p className="p-8 text-text-muted">Unavailable.</p>;

  const createOrder = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { ...form };
      if (params.get("aiReportId")) body.sourceAiReportId = params.get("aiReportId");
      if (aiReportSnapshot) body.aiReportSnapshot = aiReportSnapshot;
      const { order } = await createHumanPregradeOrder(body);
      setPublicId(order.publicId);
      return order.publicId as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleCheckout = async () => {
    let id = publicId;
    if (!id) id = await createOrder();
    if (!id) return;
    await patchHumanPregradeDraft(id, form);
    if (frontFile) await uploadHumanPregradeImage(id, frontFile, "front");
    if (backFile) await uploadHumanPregradeImage(id, backFile, "back");
    const { url } = await startHumanPregradeCheckout(id);
    window.location.href = url;
  };

  const handleSubmitAfterPayment = async () => {
    if (!publicId) return;
    setBusy(true);
    try {
      await submitHumanPregradeOrder(publicId);
      navigate(`/human-pregrade/orders/${publicId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">New {config.productName}</h1>
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {step === 0 ? (
        <div className="space-y-4">
          <label className="block text-sm">
            Card name
            <input className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2" value={form.cardName} onChange={(e) => setForm({ ...form, cardName: e.target.value })} />
          </label>
          <label className="block text-sm">
            Set
            <input className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2" value={form.setName} onChange={(e) => setForm({ ...form, setName: e.target.value })} />
          </label>
          <label className="block text-sm">
            Card number
            <input className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} />
          </label>
          <button type="button" className="rounded-lg bg-accent text-white px-4 py-2 text-sm" onClick={() => setStep(1)}>
            Continue
          </button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <label className="block text-sm">Front image (required)
            <input type="file" accept="image/*" className="mt-1 block" onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="block text-sm">Back image (required)
            <input type="file" accept="image/*" className="mt-1 block" onChange={(e) => setBackFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="rounded-lg bg-accent text-white px-4 py-2 text-sm" onClick={() => setStep(2)}>
            Continue
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {formatMinorUnits(config.priceMinorUnits, config.currency)} · {config.customerDisclaimer.slice(0, 120)}…
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={form.termsAccepted} onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })} />
            I understand this is a human pre-grading opinion, not official certification.
          </label>
          <button type="button" disabled={!form.termsAccepted || busy} className="rounded-lg bg-accent text-white px-4 py-2 text-sm disabled:opacity-50" onClick={handleCheckout}>
            Pay & continue
          </button>
          {publicId ? (
            <button type="button" className="block text-sm text-accent" onClick={handleSubmitAfterPayment}>
              Already paid? Submit order
            </button>
          ) : null}
        </div>
      ) : null}

      <Link to="/human-pregrade" className="text-sm text-text-muted hover:text-text-primary">← Back</Link>
    </div>
  );
}
