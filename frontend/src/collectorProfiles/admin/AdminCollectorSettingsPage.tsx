import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchAdminCollectorSettings,
  updateAdminCollectorSettings,
} from "../api";
import type { CollectorProfileSettings } from "./collectorSettingsTypes";

function bytesToMb(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function mbToBytes(mb: number): number {
  return Math.round(mb * 1_048_576);
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border-subtle">
      <span>
        <span className="block text-sm text-text-primary">{label}</span>
        {hint ? <span className="block mt-0.5 text-xs text-text-muted">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function NumberField({
  label,
  hint,
  value,
  min = 1,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-text-primary">{label}</span>
      {hint ? <span className="block text-xs text-text-muted mt-0.5">{hint}</span> : null}
      <input
        type="number"
        min={min}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || min)}
      />
    </label>
  );
}

export function AdminCollectorSettingsPage() {
  const [settings, setSettings] = useState<CollectorProfileSettings | null>(null);
  const [envEnabled, setEnvEnabled] = useState(false);
  const [effectiveEnabled, setEffectiveEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminCollectorSettings()
      .then((d) => {
        setSettings(d.settings);
        setEnvEnabled(d.envEnabled);
        setEffectiveEnabled(d.effectiveEnabled);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const save = async (patch: Partial<CollectorProfileSettings>) => {
    setSaving(true);
    setError(null);
    try {
      const d = await updateAdminCollectorSettings(patch);
      setSettings(d.settings);
      setEnvEnabled(d.envEnabled);
      setEffectiveEnabled(d.effectiveEnabled);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const enableAll = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      collector_profiles_enabled: true,
      collector_profile_messaging_enabled: true,
      collector_profile_grading_enabled: true,
      collector_profile_discovery_enabled: true,
      collector_profile_trade_enquiries_enabled: true,
    });
  };

  if (!settings) {
    return <p className="text-text-secondary">{error ?? "Loading…"}</p>;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link to="/admin/operations" className="text-sm text-text-muted hover:text-text-secondary">
          ← Operations
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-text-primary">Collector profile settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Control feature flags, limits, and moderation policy without a deploy.
        </p>
      </div>

      {!envEnabled ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-medium">Deploy gate is off</p>
          <p className="mt-1 text-amber-100/90">
            Set <code className="rounded bg-black/20 px-1">COLLECTOR_PROFILES_ENABLED=1</code> on Fly,
            then save settings below. Customer routes stay hidden until both are on.
          </p>
        </div>
      ) : effectiveEnabled ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Collector profiles are live for customers.
        </div>
      ) : (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
          Env is enabled — turn on feature flags below and save to go live.
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Feature flags</h2>
          <button
            type="button"
            disabled={saving}
            onClick={enableAll}
            className="text-sm font-medium text-accent hover:text-accent-hover"
          >
            Enable all features
          </button>
        </div>
        <Toggle
          label="Feature enabled"
          hint="Master switch — requires env gate for customers"
          checked={settings.collector_profiles_enabled}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, collector_profiles_enabled: v })}
        />
        <Toggle
          label="Messaging"
          checked={settings.collector_profile_messaging_enabled}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, collector_profile_messaging_enabled: v })}
        />
        <Toggle
          label="Grading on profile cards"
          checked={settings.collector_profile_grading_enabled}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, collector_profile_grading_enabled: v })}
        />
        <Toggle
          label="Trade enquiries"
          checked={settings.collector_profile_trade_enquiries_enabled}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, collector_profile_trade_enquiries_enabled: v })}
        />
        <Toggle
          label="Discovery browse"
          hint="Public /api/collector/discover search"
          checked={settings.collector_profile_discovery_enabled}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, collector_profile_discovery_enabled: v })}
        />
        <Toggle
          label="Allow viewer grading by default"
          checked={settings.allow_viewer_grading_default}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, allow_viewer_grading_default: v })}
        />
        <Toggle
          label="Require reason for admin conversation access"
          checked={settings.require_admin_access_reason}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, require_admin_access_reason: v })}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Limits
        </h2>
        <NumberField
          label="Max cards per profile"
          value={settings.max_cards_per_profile}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, max_cards_per_profile: v })}
        />
        <NumberField
          label="Max wanted entries"
          value={settings.max_wanted_entries}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, max_wanted_entries: v })}
        />
        <NumberField
          label="Username change cooldown (days)"
          value={settings.username_change_interval_days}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, username_change_interval_days: v })}
        />
        <NumberField
          label="Username redirect (days)"
          value={settings.username_redirect_days}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, username_redirect_days: v })}
        />
        <NumberField
          label="Trade enquiries per day"
          value={settings.max_trade_enquiries_per_day}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, max_trade_enquiries_per_day: v })}
        />
        <NumberField
          label="Messages per minute"
          value={settings.max_messages_per_minute}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, max_messages_per_minute: v })}
        />
        <NumberField
          label="New conversations per hour"
          value={settings.max_new_conversations_per_hour}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, max_new_conversations_per_hour: v })}
        />
        <NumberField
          label="Message retention (days)"
          value={settings.message_retention_days}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, message_retention_days: v })}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Upload limits
        </h2>
        <NumberField
          label={`Profile image (${bytesToMb(settings.max_profile_image_bytes)})`}
          value={Math.round(settings.max_profile_image_bytes / 1_048_576)}
          min={1}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, max_profile_image_bytes: mbToBytes(v) })}
        />
        <NumberField
          label={`Card image (${bytesToMb(settings.max_card_image_bytes)})`}
          value={Math.round(settings.max_card_image_bytes / 1_048_576)}
          min={1}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, max_card_image_bytes: mbToBytes(v) })}
        />
        <NumberField
          label={`Message attachment (${bytesToMb(settings.max_message_attachment_bytes)})`}
          value={Math.round(settings.max_message_attachment_bytes / 1_048_576)}
          min={1}
          disabled={saving}
          onChange={(v) => setSettings({ ...settings, max_message_attachment_bytes: mbToBytes(v) })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Policy</h2>
        <label className="block text-sm">
          Supported card games (comma-separated)
          <input
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2"
            value={settings.supported_card_games.join(", ")}
            disabled={saving}
            onChange={(e) =>
              setSettings({
                ...settings,
                supported_card_games: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label className="block text-sm">
          External link policy
          <select
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2"
            value={settings.external_link_policy}
            disabled={saving}
            onChange={(e) => setSettings({ ...settings, external_link_policy: e.target.value })}
          >
            <option value="warn">Warn</option>
            <option value="block">Block</option>
            <option value="allow">Allow</option>
          </select>
        </label>
        <label className="block text-sm">
          Report reason codes (comma-separated)
          <textarea
            className="mt-1 w-full min-h-24 rounded-lg border border-border-subtle bg-surface px-3 py-2 font-mono text-xs"
            value={settings.report_reasons.join(", ")}
            disabled={saving}
            onChange={(e) =>
              setSettings({
                ...settings,
                report_reasons: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-6">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(settings)}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved ? <span className="text-sm text-emerald-400">Saved.</span> : null}
        {error ? <span className="text-sm text-red-400">{error}</span> : null}
      </div>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link to="/admin/collector/profiles" className="text-accent hover:text-accent-hover">
          Profiles
        </Link>
        <Link to="/admin/collector/reports" className="text-accent hover:text-accent-hover">
          Reports
        </Link>
        <Link to="/admin/collector/moderation-cases" className="text-accent hover:text-accent-hover">
          Moderation
        </Link>
      </nav>
    </div>
  );
}
