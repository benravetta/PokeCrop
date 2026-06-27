import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/sessionFetch";

export function AdminCollectorProfilesPage() {
  const [profiles, setProfiles] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    apiFetch("/api/admin/collector/profiles")
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles ?? []));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary">Collector profiles</h1>
      <ul className="mt-4 space-y-2">
        {profiles.map((p) => (
          <li key={String(p.id)} className="p-3 rounded-lg border border-border-subtle flex justify-between">
            <span>
              @{String(p.username)} — {String(p.status)}
            </span>
          </li>
        ))}
      </ul>
      <nav className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link to="/admin/collector/reports" className="text-accent hover:underline">
          Reports
        </Link>
        <Link to="/admin/collector/moderation-cases" className="text-accent hover:underline">
          Moderation cases
        </Link>
        <Link to="/admin/collector/settings" className="text-accent hover:underline">
          Settings
        </Link>
      </nav>
    </div>
  );
}
