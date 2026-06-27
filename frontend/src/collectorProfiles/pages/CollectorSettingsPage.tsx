import { Navigate } from "react-router-dom";

/** Legacy route — settings live on the overview page. */
export function CollectorSettingsPage() {
  return <Navigate to="/collector/profile" replace />;
}
