import { Link } from "react-router-dom";
import { CollectorProfilePage } from "./CollectorProfilePage";

export function CollectorSettingsPage() {
  return (
    <div>
      <CollectorProfilePage />
      <div className="max-w-2xl mx-auto px-4 pb-8">
        <Link to="/collector/setup" className="text-sm text-text-secondary hover:text-accent">
          Profile setup
        </Link>
      </div>
    </div>
  );
}
