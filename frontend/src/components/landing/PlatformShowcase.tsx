import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Crop,
  Download,
  FileImage,
  ScanSearch,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { AFTER_IMG, BEFORE_IMG } from "./data";
import { AppWindow, DemoCardThumb, SectionHeading } from "./shared";

export function PlatformShowcase() {
  return (
    <section id="features" className="scroll-mt-20 border-y border-border-subtle bg-surface-raised/30 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          kicker="Two tools, one workflow"
          title="Everything you need before submission day."
          copy="Crop messy photos into clean scans. Run a full pre-grade with company-by-company estimates. Download a PDF you can keep, share, or reference at the card show."
        />

        <div className="mt-14 grid lg:grid-cols-2 gap-8">
          <FeatureCard
            icon={Crop}
            tag="Crop"
            title="Turn any photo into a clean card scan"
            copy="Drop a desk photo, binder snap, or PDF scan. GemCheck finds the frontmost card, straightens it, and exports a transparent PNG — borders intact, full resolution preserved."
            bullets={[
              "JPG, PNG, WEBP, HEIC, DNG & PDF",
              "Manual crop editor with corner snap",
              "Original & web-size exports",
            ]}
            cta={{ label: "Try Crop", to: "/crop" }}
            visual={<CropMockup />}
          />

          <FeatureCard
            icon={ScanSearch}
            tag="Grade"
            title="A pre-grade report you can actually use"
            copy="Photograph front and back. Get per-company grade estimates, measured centring, condition breakdown, value ranges, and a prep checklist with close-up snapshots of every flaw."
            bullets={[
              "PSA, Beckett, CGC, ACE & TAG",
              "Preparation plan with defect snapshots",
              "Downloadable PDF report",
            ]}
            cta={{ label: "Try Grade", to: "/grade" }}
            visual={<GradeMockup />}
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  tag,
  title,
  copy,
  bullets,
  cta,
  visual,
}: {
  icon: typeof Crop;
  tag: string;
  title: string;
  copy: string;
  bullets: string[];
  cta: { label: string; to: string };
  visual: ReactNode;
}) {
  return (
    <div className="group rounded-3xl border border-border-subtle bg-surface-raised overflow-hidden hover:border-accent/30 transition-colors">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex w-10 h-10 rounded-xl bg-accent/15 items-center justify-center">
            <Icon className="w-5 h-5 text-accent" />
          </span>
          <span className="rounded-full border border-border-subtle px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {tag}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm text-text-secondary leading-relaxed">{copy}</p>
        <ul className="mt-4 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-text-primary">
              <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
        <Link
          to={cta.to}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
        >
          {cta.label}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="border-t border-border-subtle bg-surface-overlay/30 p-4 sm:p-5">{visual}</div>
    </div>
  );
}

function CropMockup() {
  return (
    <AppWindow title="gemcheck.co.uk/crop">
      <div className="p-4">
        <div className="rounded-xl border-2 border-dashed border-border-subtle p-6 flex flex-col items-center gap-3 bg-surface-overlay/20">
          <div className="w-12 h-12 rounded-xl bg-surface-overlay flex items-center justify-center">
            <Upload className="w-6 h-6 text-text-muted" />
          </div>
          <p className="text-xs text-text-secondary text-center">Drag &amp; drop, or click to browse</p>
          <div className="flex gap-2 text-[10px] text-text-muted">
            <FileImage className="w-3 h-3" />
            JPG · PNG · PDF · HEIC
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="relative rounded-lg overflow-hidden aspect-[4/3] border border-border-subtle">
            <img src={BEFORE_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
              Before
            </span>
          </div>
          <div className="relative checkerboard rounded-lg aspect-[4/3] border border-border-subtle flex items-center justify-center p-2">
            <img src={AFTER_IMG} alt="" className="max-h-full max-w-full rounded-[2%] drop-shadow-md" />
            <span className="absolute right-1.5 top-1.5 rounded bg-accent/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              After
            </span>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-accent py-2 text-[10px] font-semibold text-white">
            <Download className="w-3 h-3" />
            Original PNG
          </span>
          <span className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-border-subtle py-2 text-[10px] font-medium text-text-secondary">
            Web PNG
          </span>
        </div>
      </div>
    </AppWindow>
  );
}

function GradeMockup() {
  return (
    <AppWindow title="gemcheck.co.uk/grade">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {["Front", "Back"].map((side) => (
            <div key={side} className="rounded-lg border border-border-subtle bg-surface-overlay/30 p-2">
              <div className="text-[9px] text-text-muted mb-1.5">{side}</div>
              {side === "Front" ? (
                <DemoCardThumb className="w-full aspect-[2.5/3.5]" />
              ) : (
                <div className="w-full aspect-[2.5/3.5] rounded bg-surface-overlay border border-dashed border-border-subtle" />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border-subtle bg-white text-[#181b21] p-3 text-[10px]">
          <div className="font-bold text-[11px]">Card Condition Pre-Grade Report</div>
          <div className="mt-1 text-[#6e7480]">Erika&apos;s Oddish · Gym Heroes</div>
          <div className="mt-2 grid grid-cols-5 gap-1 text-center">
            {[
              ["PSA", "8"],
              ["BGS", "8.5"],
              ["CGC", "8.5"],
              ["ACE", "8"],
              ["TAG", "8.2"],
            ].map(([co, g]) => (
              <div key={co} className="rounded bg-[#f3f4f6] py-1">
                <div className="text-[8px] text-[#6e7480]">{co}</div>
                <div className="font-bold">{g}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[#2563eb]">
            <ShieldCheck className="w-3 h-3" />
            Possible — inspect first
          </div>
        </div>
      </div>
    </AppWindow>
  );
}
