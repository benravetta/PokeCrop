import { useEffect } from "react";
import { useAppStore } from "../hooks/useProcessing";
import { UploadZone } from "../components/UploadZone";
import { Workspace } from "../components/Workspace";
import { UpgradeModal } from "../components/UpgradeModal";
import { useLayout } from "../components/Layout";
import { useMe } from "../hooks/useMe";
import { CropUsageCard } from "../components/plan/PlanUsageCard";

export function ToolPage() {
  const { sessionId } = useAppStore();
  const { openHelp } = useLayout();
  const me = useMe((s) => s.me);
  const refreshMe = useMe((s) => s.refresh);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  return (
    <>
      {sessionId ? <Workspace /> : <UploadZone onHelp={openHelp} cropUsage={<CropUsageCard me={me} className="mb-6" />} />}
      <UpgradeModal />
    </>
  );
}
