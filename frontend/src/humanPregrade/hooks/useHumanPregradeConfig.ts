import { useEffect, useState } from "react";
import { fetchHumanPregradeConfig, type HumanPregradeConfig } from "../api";

export function useHumanPregradeConfig() {
  const [config, setConfig] = useState<HumanPregradeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchHumanPregradeConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading, enabled: Boolean(config?.enabled) };
}

export function formatMinorUnits(amount: number, currency: string): string {
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : "";
  return `${sym}${(amount / 100).toFixed(2)}`;
}
