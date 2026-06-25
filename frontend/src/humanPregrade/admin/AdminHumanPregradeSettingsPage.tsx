import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminHumanPregradeSettings, updateAdminHumanPregradeSettings } from "../api";

export function AdminHumanPregradeSettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAdminHumanPregradeSettings().then((r) => setSettings(r.settings ?? null));
  }, []);

  if (!settings) return <p>Loading…</p>;

  return (
    <div className="max-w-xl space-y-4">
      <Link to="/admin/human-pregrades" className="text-sm text-text-muted">← Queue</Link>
      <h1 className="text-lg font-semibold">Expert review settings</h1>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(settings.enabled)} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
        Feature enabled
      </label>
      <label className="block text-sm">
        Product name
        <input className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2" value={String(settings.product_name ?? "")} onChange={(e) => setSettings({ ...settings, product_name: e.target.value })} />
      </label>
      <label className="block text-sm">
        Price (minor units)
        <input type="number" className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2" value={Number(settings.price_minor_units ?? 0)} onChange={(e) => setSettings({ ...settings, price_minor_units: parseInt(e.target.value, 10) })} />
      </label>
      <button
        type="button"
        className="rounded-lg bg-accent text-white px-4 py-2 text-sm"
        onClick={() =>
          updateAdminHumanPregradeSettings(settings).then(() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          })
        }
      >
        Save settings
      </button>
      {saved ? <p className="text-sm text-emerald-400">Saved.</p> : null}
    </div>
  );
}
