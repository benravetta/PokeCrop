import { useAppStore } from "./hooks/useProcessing";
import { UploadZone } from "./components/UploadZone";
import { Workspace } from "./components/Workspace";
import { Crop } from "lucide-react";

export default function App() {
  const { sessionId } = useAppStore();

  return (
    <div className="h-screen overflow-hidden bg-surface flex flex-col">
      <header className="border-b border-border-subtle px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
            <Crop className="w-[18px] h-[18px] text-accent" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-[17px] font-semibold text-text-primary tracking-tight">
              PokeCrop
            </h1>
            <span className="hidden sm:inline text-[11px] text-text-muted font-medium tracking-wide uppercase">
              Card Extraction
            </span>
          </div>
        </div>

        <a
          href="https://getlooky.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
          <img
            src="/looky-logo.png"
            alt="Looky Collectibles"
            className="h-5"
          />
        </a>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        {!sessionId ? <UploadZone /> : <Workspace />}
      </main>

      <footer className="border-t border-border-subtle px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-1.5">
        <p className="text-[11px] text-text-muted">
          A{" "}
          <a
            href="https://getlooky.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            Looky Collectibles
          </a>{" "}
          Tool
        </p>
        <p className="text-[11px] text-text-muted">
          Built with ❤️ in the English Lake District
        </p>
      </footer>
    </div>
  );
}
