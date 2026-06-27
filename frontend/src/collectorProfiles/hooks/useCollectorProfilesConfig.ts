import { useEffect, useState } from "react";
import {
  fetchCollectorProfilesConfig,
  fetchCollectorProfilesConfigPublic,
  type CollectorProfilesConfig,
} from "../api";

export function useCollectorProfilesConfig() {
  const [config, setConfig] = useState<CollectorProfilesConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCollectorProfilesConfigPublic(), fetchCollectorProfilesConfig()])
      .then(([pub, authed]) => {
        if (cancelled) return;
        const enabled = Boolean(pub?.enabled || authed?.enabled);
        if (authed) setConfig({ ...authed, enabled });
        else if (enabled) {
          setConfig({
            enabled: true,
            messagingEnabled: false,
            gradingEnabled: false,
            discoveryEnabled: false,
            tradeEnquiriesEnabled: false,
            supportedCardGames: ["Pokemon"],
            allowViewerGradingDefault: true,
          });
        }
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
