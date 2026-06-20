import { useAppStore } from "../hooks/useProcessing";
import { UploadZone } from "../components/UploadZone";
import { Workspace } from "../components/Workspace";
import { UpgradeModal } from "../components/UpgradeModal";
import { useLayout } from "../components/Layout";

export function ToolPage() {
  const { sessionId } = useAppStore();
  const { openHelp } = useLayout();

  return (
    <>
      {sessionId ? <Workspace /> : <UploadZone onHelp={openHelp} />}
      <UpgradeModal />
    </>
  );
}
