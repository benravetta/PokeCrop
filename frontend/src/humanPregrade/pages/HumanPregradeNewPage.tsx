import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useHumanPregradeConfig } from "../hooks/useHumanPregradeConfig";
import { HumanPregradeNewForm } from "../components/HumanPregradeNewForm";

export function HumanPregradeNewPage() {
  const { config, loading, enabled } = useHumanPregradeConfig();

  if (loading) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sky-400" aria-label="Loading" />
      </div>
    );
  }

  if (!enabled || !config) {
    return (
      <div className="flex flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-text-muted">Expert review is not currently available.</p>
          <p className="mt-2 text-sm text-text-muted">Check back soon or contact support.</p>
          <Link
            to="/human-pregrade"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-sky-300 hover:text-sky-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to expert review
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <HumanPregradeNewForm config={config} />
    </div>
  );
}
