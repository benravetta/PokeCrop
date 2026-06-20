import {
  X,
  Upload,
  Crop,
  SlidersHorizontal,
  Download,
  Sparkles,
  MousePointerClick,
} from "lucide-react";
import type { ReactNode } from "react";

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="text-[12.5px] leading-relaxed text-text-secondary flex flex-col gap-1.5 pl-9">
        {children}
      </div>
    </section>
  );
}

export function HelpDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`fixed top-0 right-0 z-40 h-[100dvh] w-full max-w-md bg-surface-raised border-l border-border-subtle
                    flex flex-col shadow-2xl transition-transform duration-300 ease-out
                    ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-label="How to use CardCrop"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">How CardCrop works</h2>
            <p className="text-[11px] text-text-muted">
              A quick guide to getting a clean cut every time.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
            aria-label="Close help"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-7">
          <Section icon={<Upload className="w-4 h-4" />} title="1 · Upload">
            <p>
              Drop in a scan or phone photo (JPG, PNG, WEBP or PDF, up to 50 MB).
              CardCrop finds the front-most card, straightens it, and lifts it off
              the background as a transparent PNG.
            </p>
            <p className="text-text-muted">
              Tip: an even, contrasting background and the whole card in frame give
              the best automatic detection.
            </p>
          </Section>

          <Section icon={<Sparkles className="w-4 h-4" />} title="2 · Review">
            <p>
              The result appears on a checkerboard so you can see exactly what's
              transparent. Use the{" "}
              <span className="text-text-primary font-medium">Before / After</span>{" "}
              toggle at the top to compare against your original.
            </p>
          </Section>

          <Section icon={<Crop className="w-4 h-4" />} title="3 · Adjust the crop">
            <p>
              If the auto-crop is slightly off, hit{" "}
              <span className="text-text-primary font-medium">Adjust crop</span> to
              fine-tune by hand:
            </p>
            <ul className="list-disc pl-4 flex flex-col gap-1 marker:text-text-muted">
              <li>
                Drag a{" "}
                <span style={{ color: "var(--color-handle-corner)" }} className="font-medium">
                  corner bracket
                </span>{" "}
                onto each card corner. A magnifier pops up on that side for
                pixel-precise placement.
              </li>
              <li>
                <span className="inline-flex items-center gap-1 text-text-primary font-medium">
                  <MousePointerClick className="w-3.5 h-3.5" /> Corner snap
                </span>
                : when you release a corner it auto-clicks onto the nearest real
                corner edge — a quick pulse confirms the snap.
              </li>
              <li>
                Drag a{" "}
                <span style={{ color: "var(--color-handle-edge)" }} className="font-medium">
                  square edge handle
                </span>{" "}
                to move a whole side in (trim background) or out (keep more border).
              </li>
              <li>
                <span className="text-text-primary font-medium">Reset to auto</span>{" "}
                restores the detected crop;{" "}
                <span className="text-text-primary font-medium">Cancel</span> discards
                your edits.
              </li>
            </ul>
          </Section>

          <Section
            icon={<SlidersHorizontal className="w-4 h-4" />}
            title="4 · Advanced clean-up"
          >
            <p>For stubborn cases, open the Advanced panel:</p>
            <ul className="list-disc pl-4 flex flex-col gap-1 marker:text-text-muted">
              <li>
                <span className="text-text-primary font-medium">Background removal</span> —
                erase leftover table or scan colour bleeding in from the edges.
              </li>
              <li>
                <span className="text-text-primary font-medium">Edge trim</span> — shave
                the outer edge inward to remove a thin background ring.
              </li>
              <li>
                <span className="text-text-primary font-medium">Corner rounding</span> —
                match your card's corner radius.
              </li>
              <li>
                <span className="text-text-primary font-medium">Edge detection</span> /{" "}
                <span className="text-text-primary font-medium">strictness</span> — adjust
                if the card isn't found on a busy background.
              </li>
            </ul>
            <p className="text-text-muted">
              Changes only re-run when you press{" "}
              <span className="text-text-primary font-medium">Apply changes</span>.
            </p>
          </Section>

          <Section icon={<Download className="w-4 h-4" />} title="5 · Download">
            <p>
              Grab the finished cut-out as a transparent PNG.{" "}
              <span className="text-text-primary font-medium">Original size</span> keeps
              full resolution; <span className="text-text-primary font-medium">Web size</span>{" "}
              is a lighter ~1200px version for quick sharing.
            </p>
          </Section>
        </div>

        <div className="px-5 py-4 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white
                       bg-accent rounded-lg hover:bg-accent-hover transition-colors"
          >
            Got it
          </button>
        </div>
      </aside>
    </>
  );
}
