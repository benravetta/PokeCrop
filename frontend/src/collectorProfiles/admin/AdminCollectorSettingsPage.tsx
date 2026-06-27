import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/sessionFetch";

export function AdminCollectorSettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/admin/collector/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings ?? null));
  }, []);

  const toggle = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/admin/collector/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const d = await res.json();
      setSettings(d.settings);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className="text-text-secondary">Loading…</p>;

  const flags = [
    ["collector_profiles_enabled", "Feature enabled"],
    ["collector_profile_messaging_enabled", "Messaging"],
    ["collector_profile_grading_enabled", "Grading"],
    ["collector_profile_trade_enquiries_enabled", "Trade enquiries"],
    ["collector_profile_discovery_enabled", "Discovery"],
  ] as const;

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary">Collector profile settings</h1>
      <ul className="mt-6 space-y-4">
        {flags.map(([key, label]) => (
          <li key={key} className="flex items-center justify-between p-3 rounded-lg border border-border-subtle">
            <span>{label}</span>
            <button
              type="button"
              disabled={saving}
              onClick={() => void toggle(key, !settings[key])}
              className={`px-3 py-1 rounded-full text-sm ${
                settings[key] ? "bg-accent/20 text-accent" : "bg-surface-overlay text-text-secondary"
              }`}
            >
              {settings[key] ? "On" : "Off"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
