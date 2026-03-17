import { useAppStore } from "./hooks/useProcessing";
import { UploadZone } from "./components/UploadZone";
import { Workspace } from "./components/Workspace";
import { Scissors } from "lucide-react";

export default function App() {
  const { sessionId } = useAppStore();

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="border-b border-border-subtle px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
          <Scissors className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary tracking-tight">
            PokeCrop
          </h1>
          <p className="text-xs text-text-muted">
            Extract trading cards from scans and photos
          </p>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {!sessionId ? <UploadZone /> : <Workspace />}
      </main>
    </div>
  );
}
