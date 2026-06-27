import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createCollectorProfile } from "../api";
import { useCollectorProfilesConfig } from "../hooks/useCollectorProfilesConfig";
import { COLLECTOR_COPY } from "../copy";
import {
  CollectorButton,
  CollectorField,
  CollectorInput,
  CollectorLoading,
  CollectorPageHeader,
  CollectorSection,
} from "../components/ui";

export function CollectorSetupPage() {
  const navigate = useNavigate();
  const { enabled, loading: configLoading } = useCollectorProfilesConfig();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (configLoading) return <CollectorLoading />;
  if (!enabled) {
    return (
      <CollectorEmptyUnavailable />
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createCollectorProfile({ username, displayName: displayName || username });
      navigate("/collector/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 anim-rise">
      <Link
        to="/account"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to account
      </Link>

      <CollectorPageHeader
        title="Create your collector profile"
        description={COLLECTOR_COPY.tagline}
      />

      <CollectorSection
        icon={<Sparkles className="h-4 w-4" />}
        title="Choose your public URL"
        description="You can update your bio and visibility after setup"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <CollectorField label="Username" hint="gemcheck.co.uk/u/yourname — letters, numbers, underscores">
            <CollectorInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="my_collection"
              autoComplete="off"
              required
            />
          </CollectorField>
          <CollectorField label="Display name" hint="Shown at the top of your public profile">
            <CollectorInput
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your collector name"
            />
          </CollectorField>
          {error && <p className="text-sm text-error">{error}</p>}
          <CollectorButton type="submit" loading={loading} className="w-full">
            Create profile
          </CollectorButton>
        </form>
      </CollectorSection>
    </div>
  );
}

function CollectorEmptyUnavailable() {
  return (
    <div className="py-12 text-center">
      <p className="text-text-secondary">Collector profiles are not available yet.</p>
      <Link to="/account" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
        Back to account
      </Link>
    </div>
  );
}
