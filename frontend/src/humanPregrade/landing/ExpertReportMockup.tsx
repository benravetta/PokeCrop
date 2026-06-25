import { useState } from "react";
import { CheckCircle2, FileText, Layers, Sparkles } from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "condition", label: "Condition", icon: Layers },
  { id: "grades", label: "Predictions", icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

const GRADERS = [
  { name: "PSA", grade: "8", note: "Likely" },
  { name: "CGC", grade: "8.5", note: "Strong centreing" },
  { name: "BGS", grade: "8", note: "Surface micro-scratch noted" },
];

export function ExpertReportMockup() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-sky-500/20 via-cyan-500/10 to-transparent blur-2xl"
      />

      <div className="relative rounded-2xl border border-sky-500/25 bg-surface-raised/90 backdrop-blur-sm shadow-2xl shadow-black/40 overflow-hidden anim-rise">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface-overlay/60 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">Expert pre-grade report</p>
              <p className="text-[11px] text-text-muted">Example · Charizard Base Set</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
            Sample
          </span>
        </div>

        <div className="flex gap-1 border-b border-border-subtle bg-surface/40 p-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors sm:text-xs ${
                tab === id
                  ? "bg-sky-500/15 text-sky-200"
                  : "text-text-muted hover:bg-surface-overlay hover:text-text-secondary"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-[7.5rem_1fr] sm:p-5">
          <div className="relative mx-auto aspect-[5/7] w-full max-w-[7.5rem] overflow-hidden rounded-xl border border-border-subtle shadow-lg sm:mx-0">
            <img
              src="/demo-charizard-crop.png"
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
              <p className="text-[9px] font-medium text-white/90">Front scan</p>
            </div>
          </div>

          <div className="min-h-[11rem] text-sm">
            {tab === "overview" && (
              <div className="space-y-3 anim-fade">
                <p className="text-text-secondary leading-relaxed">
                  <span className="font-medium text-text-primary">Summary:</span> Strong candidate for
                  submission. Light holo scratching visible under raking light; corners are sharp with
                  minimal whitening on the back edge.
                </p>
                <ul className="space-y-2">
                  {["Recommend PSA Economy tier", "Centreing within PSA 8 tolerance", "No creases detected"].map(
                    (line) => (
                      <li key={line} className="flex items-start gap-2 text-text-secondary">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        {line}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            {tab === "condition" && (
              <div className="space-y-3 anim-fade">
                {[
                  { label: "Corners", score: 8.5, detail: "Top-left shows faint touch; others clean." },
                  { label: "Edges", score: 8, detail: "Back edge micro-whitening at 7 o'clock." },
                  { label: "Surface", score: 7.5, detail: "Holo scratch ~4mm; no indentations." },
                  { label: "Centreing", score: 9, detail: "Front 55/45 L-R; back within tolerance." },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-text-primary">{row.label}</span>
                      <span className="tabular-nums text-sky-300">{row.score.toFixed(1)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-subtle">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-500"
                        style={{ width: `${(row.score / 10) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{row.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "grades" && (
              <div className="space-y-2 anim-fade">
                {GRADERS.map((g) => (
                  <div
                    key={g.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface/60 px-3 py-2.5"
                  >
                    <div>
                      <p className="font-semibold text-text-primary">{g.name}</p>
                      <p className="text-xs text-text-muted">{g.note}</p>
                    </div>
                    <span className="rounded-lg bg-sky-500/15 px-2.5 py-1 text-lg font-bold tabular-nums text-sky-200">
                      {g.grade}
                    </span>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-text-muted">
                  Predictions are estimates based on photos — not guaranteed outcomes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
