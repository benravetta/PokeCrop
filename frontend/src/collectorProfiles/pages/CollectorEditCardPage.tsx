import { useParams } from "react-router-dom";
import { useState } from "react";
import { apiFetch } from "../../lib/sessionFetch";

export function CollectorEditCardPage() {
  const { publicCardId } = useParams<{ publicCardId: string }>();
  const [status, setStatus] = useState<string | null>(null);

  const upload = async (role: "front" | "back", file: File) => {
    if (!publicCardId) return;
    const fd = new FormData();
    fd.append("image", file);
    fd.append("role", role);
    const res = await apiFetch(`/api/collector/cards/${publicCardId}/images`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    setStatus(`Uploaded ${role}`);
  };

  const process = async (role: "front" | "back") => {
    if (!publicCardId) return;
    const res = await apiFetch(`/api/collector/cards/${publicCardId}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error("Processing failed");
    setStatus(`Processed ${role}`);
  };

  const confirmCrop = async (role: "front" | "back") => {
    if (!publicCardId) return;
    const res = await apiFetch(`/api/collector/cards/${publicCardId}/crop/${role}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    if (!res.ok) throw new Error("Crop confirm failed");
    setStatus(`Confirmed ${role} crop`);
  };

  const publish = async () => {
    if (!publicCardId) return;
    const res = await apiFetch(`/api/collector/cards/${publicCardId}/publish`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Publish failed");
    }
    setStatus("Card published");
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">Edit card</h1>
      <p className="text-sm text-text-secondary">
        Upload front and back photos, run crop, confirm both sides, then publish.
      </p>
      {(["front", "back"] as const).map((role) => (
        <div key={role} className="p-4 rounded-xl border border-border-subtle space-y-3">
          <h2 className="font-medium capitalize">{role}</h2>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(role, f).catch((err) => setStatus(String(err)));
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="text-sm px-3 py-1.5 rounded-lg border border-border-subtle"
              onClick={() => void process(role).catch((e) => setStatus(String(e)))}
            >
              Auto crop
            </button>
            <button
              type="button"
              className="text-sm px-3 py-1.5 rounded-lg border border-border-subtle"
              onClick={() => void confirmCrop(role).catch((e) => setStatus(String(e)))}
            >
              Confirm crop
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => void publish().catch((e) => setStatus(String(e)))}
        className="w-full py-2.5 rounded-lg bg-accent text-white font-medium"
      >
        Publish card
      </button>
      {status && <p className="text-sm text-text-secondary">{status}</p>}
    </div>
  );
}
