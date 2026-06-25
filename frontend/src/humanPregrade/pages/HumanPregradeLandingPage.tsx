import { Link } from "react-router-dom";
import { UserCheck } from "lucide-react";
import { useHumanPregradeConfig, formatMinorUnits } from "../hooks/useHumanPregradeConfig";

export function HumanPregradeLandingPage() {
  const { config, loading, enabled } = useHumanPregradeConfig();

  if (loading) return <div className="p-8 text-text-muted">Loading…</div>;
  if (!enabled || !config) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <p className="text-text-muted">This service is not currently available.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <UserCheck className="w-8 h-8 text-accent" />
        <h1 className="text-2xl font-semibold text-text-primary">{config.productName}</h1>
      </div>
      <p className="text-text-secondary">{config.productDescription || "A real human expert reviews your card images and returns a bespoke pre-grading report."}</p>
      <ul className="text-sm text-text-muted space-y-2 list-disc pl-5">
        <li>Review completed by a human based on your digital images.</li>
        <li>Independent pre-grading opinion — not official grading or authentication.</li>
        <li>Final third-party grade may differ after physical inspection.</li>
        <li>Poor images may require replacement before completion.</li>
        <li>Turnaround is an estimate, not a guarantee.</li>
      </ul>
      <p className="text-lg font-medium text-text-primary">
        {formatMinorUnits(config.priceMinorUnits, config.currency)} · ~{config.expectedTurnaroundHours}h turnaround
      </p>
      <Link
        to="/human-pregrade/new"
        className="inline-flex items-center justify-center rounded-lg bg-accent text-white px-5 py-2.5 text-sm font-medium hover:opacity-90"
      >
        Start expert review
      </Link>
    </div>
  );
}
