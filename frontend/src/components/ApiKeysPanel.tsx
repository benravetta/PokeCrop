import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy,
  Check,
  Trash2,
  Loader2,
  Plus,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  type ApiKeySummary,
} from "../lib/api";

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setKeys(await listApiKeys());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const { secret } = await createApiKey(label.trim() || undefined);
      setNewSecret(secret);
      setCopied(false);
      setLabel("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setRevokingId(id);
    try {
      await revokeApiKey(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key.");
    } finally {
      setRevokingId(null);
    }
  };

  const copySecret = async () => {
    if (!newSecret) return;
    try {
      await navigator.clipboard.writeText(newSecret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-text-secondary">
        Use these keys to call the GemCheck API. See the{" "}
        <Link to="/docs" className="text-accent hover:underline inline-flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" /> API docs
        </Link>{" "}
        to get started.
      </p>

      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-[13px] text-error">
          {error}
        </div>
      )}

      {newSecret && (
        <div className="rounded-lg bg-accent/10 border border-accent/30 p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-text-primary mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-accent" />
            Copy your key now — it won&apos;t be shown again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-md bg-surface/60 border border-border-subtle px-2.5 py-2 text-[12px] text-text-primary font-mono">
              {newSecret}
            </code>
            <button
              onClick={copySecret}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-white bg-accent rounded-md hover:bg-accent-hover transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            New key label (optional)
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Production server"
            className="w-full rounded-lg bg-surface-overlay/60 border border-border-subtle px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={create}
          disabled={creating}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 shrink-0"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create key
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-text-muted py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading keys…
        </div>
      ) : activeKeys.length === 0 ? (
        <p className="text-[13px] text-text-muted py-2">No API keys yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {activeKeys.map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-overlay/40 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-[12px] font-mono text-text-primary">
                    {k.key_prefix}…
                  </code>
                  {k.label && (
                    <span className="text-[12px] text-text-secondary truncate">
                      {k.label}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Created {new Date(k.created_at).toLocaleDateString()} ·{" "}
                  {k.last_used_at
                    ? `last used ${new Date(k.last_used_at).toLocaleDateString()}`
                    : "never used"}
                </p>
              </div>
              <button
                onClick={() => revoke(k.id)}
                disabled={revokingId === k.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-error border border-error/30 rounded-md hover:bg-error/10 transition-colors disabled:opacity-50 shrink-0"
              >
                {revokingId === k.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
