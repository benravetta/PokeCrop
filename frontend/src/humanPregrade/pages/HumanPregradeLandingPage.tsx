import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listHumanPregradeOrders } from "../api";
import { useHumanPregradeConfig } from "../hooks/useHumanPregradeConfig";
import { ExpertReviewLanding } from "../landing/ExpertReviewLanding";

export function HumanPregradeLandingPage() {
  const { config, loading, enabled } = useHumanPregradeConfig();
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    listHumanPregradeOrders({ pageSize: 1 })
      .then((r) => setOrderCount(r.total))
      .catch(() => {});
  }, [enabled]);

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
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <ExpertReviewLanding config={config} orderCount={orderCount} />
    </div>
  );
}
