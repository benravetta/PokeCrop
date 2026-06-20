import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../hooks/useProcessing";
import { fetchExport } from "../lib/api";
import { baseName } from "../lib/mime";
import { Download, ChevronDown } from "lucide-react";

export function ExportControls() {
  const { sessionId, resultBase64, filename } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState<"original" | "web" | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  if (!resultBase64 || !sessionId) return null;

  const handleExport = async (size: "original" | "web") => {
    setMenuOpen(false);
    setDownloading(size);
    try {
      const blob = await fetchExport(sessionId, size);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName(filename)}_cropped.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        onClick={() => handleExport("original")}
        disabled={downloading !== null}
        className="inline-flex items-center gap-1.5 pl-4 pr-3 py-2 text-sm font-medium text-white
                   bg-accent rounded-l-lg hover:bg-accent-hover transition-colors
                   disabled:opacity-60 disabled:cursor-wait"
      >
        <Download className="w-4 h-4" />
        {downloading === "original" ? "Preparing…" : "Download"}
      </button>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        disabled={downloading !== null}
        aria-label="Download options"
        className="inline-flex items-center px-2 py-2 text-white bg-accent rounded-r-lg
                   border-l border-white/15 hover:bg-accent-hover transition-colors
                   disabled:opacity-60"
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      {menuOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-52 rounded-xl bg-surface-overlay border border-border-subtle shadow-2xl overflow-hidden anim-rise z-20">
          <button
            onClick={() => handleExport("original")}
            className="w-full text-left px-4 py-2.5 hover:bg-border-subtle transition-colors"
          >
            <span className="block text-sm text-text-primary">Original size</span>
            <span className="block text-[11px] text-text-muted">
              Full resolution PNG
            </span>
          </button>
          <button
            onClick={() => handleExport("web")}
            className="w-full text-left px-4 py-2.5 hover:bg-border-subtle transition-colors border-t border-border-subtle"
          >
            <span className="block text-sm text-text-primary">Web size</span>
            <span className="block text-[11px] text-text-muted">
              Smaller, max 1200px
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
