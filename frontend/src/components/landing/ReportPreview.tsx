import type { ReactNode } from "react";
import {
  AFTER_IMG,
  EXAMPLE_COMPANIES,
  EX_IDENT,
  EX_SCORES,
  formatExampleSubgrades,
} from "./data";
import { SectionHeading } from "./shared";

const RPT_INK = "#181b21";
const RPT_MUTE = "#6e7480";
const RPT_LINE = "#dde0e6";
const RPT_ACCENT = "#2563eb";

function scoreColor(s: number): string {
  return s >= 8.5 ? "#10a05a" : s >= 7 ? RPT_ACCENT : "#b4780a";
}

function PaperSec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h4 className="text-[12.5px] font-bold" style={{ color: RPT_INK }}>
        {title}
      </h4>
      <div className="mt-1.5 border-t" style={{ borderColor: RPT_LINE }} />
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ScoreBar({ label, score, verdict }: { label: string; score: number; verdict: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="w-20 text-[12px] font-bold shrink-0" style={{ color: RPT_INK }}>
          {label}
        </span>
        <span className="w-7 text-[12px] tabular-nums" style={{ color: RPT_INK }}>
          {score.toFixed(1)}
        </span>
        <span className="relative flex-1 h-1.5 rounded-full" style={{ backgroundColor: RPT_LINE }}>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${(score / 10) * 100}%`, backgroundColor: scoreColor(score) }}
          />
        </span>
      </div>
      <p className="mt-1 ml-[6.5rem] text-[10.5px]" style={{ color: RPT_MUTE }}>
        {verdict}
      </p>
    </div>
  );
}

function Snap({ position }: { position: string }) {
  return (
    <div
      className="w-[44px] h-[44px] rounded border shrink-0 bg-cover"
      style={{
        backgroundImage: `url(${AFTER_IMG})`,
        backgroundSize: "300%",
        backgroundPosition: position,
        borderColor: RPT_LINE,
      }}
    />
  );
}

export function ReportPreview({ asPage = false }: { asPage?: boolean }) {
  return (
    <section
      className={asPage ? "pb-4" : "relative scroll-mt-20 py-16 sm:py-24"}
    >
      <div className={`mx-auto px-4 sm:px-6 ${asPage ? "max-w-4xl" : "max-w-6xl"}`}>
        <SectionHeading
          kicker="Sample report"
          title="This is what you download"
          copy="One full PDF per check: card ID, all five grading companies, condition breakdown, centring, value estimates and a prep plan. Shown here with a real example."
        />

        <div className="mt-12 mx-auto max-w-3xl">
          <div className="relative rounded-xl bg-white text-[#181b21] shadow-2xl ring-1 ring-black/10 overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: RPT_ACCENT }} />
            <span
              className="absolute right-4 top-4 rounded-full text-[10px] font-semibold px-2 py-0.5"
              style={{ backgroundColor: "#eef2ff", color: RPT_ACCENT }}
            >
              EXAMPLE
            </span>

            <div className="p-6 sm:p-9">
              <h3 className="text-[19px] font-bold tracking-tight">Card Condition Pre-Grade Report</h3>
              <p className="mt-1 text-[11px]" style={{ color: RPT_MUTE }}>
                GemCheck Pre-Grader · 23 June 2026
              </p>
              <div className="mt-2 border-t" style={{ borderColor: RPT_LINE }} />

              <div className="mt-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold">Erika&apos;s Oddish</div>
                  <dl className="mt-2 space-y-0.5 text-[11.5px]" style={{ color: RPT_MUTE }}>
                    {EX_IDENT.map(([k, v]) => (
                      <div key={k} className="flex gap-1.5">
                        <dt>{k}:</dt>
                        <dd style={{ color: RPT_INK }}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["1st Edition stamp", "Set symbol: Gym"].map((m) => (
                      <span
                        key={m}
                        className="rounded text-[10px] px-1.5 py-0.5"
                        style={{ backgroundColor: "#eef2ff", color: RPT_ACCENT }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[10.5px]" style={{ color: RPT_MUTE }}>
                    ID confidence: high
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {["Front", "Back"].map((side) => (
                    <div key={side} className="text-center">
                      <div
                        className="w-[58px] h-[80px] rounded border bg-contain bg-no-repeat bg-center"
                        style={{
                          backgroundImage: `url(${AFTER_IMG})`,
                          borderColor: RPT_LINE,
                          backgroundColor: "#f3f4f6",
                        }}
                      />
                      <div className="mt-1 text-[9px]" style={{ color: RPT_MUTE }}>
                        {side}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <PaperSec title="Likely best fit">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[14px] font-bold">Possible. Inspect first</div>
                  <span
                    className="rounded-full text-[10px] font-semibold px-2 py-0.5"
                    style={{ backgroundColor: "#eef2ff", color: RPT_ACCENT }}
                  >
                    Inspect first
                  </span>
                </div>
                <p className="mt-1 text-[11.5px]" style={{ color: RPT_INK }}>
                  Best fit: CGC or Beckett
                </p>
                <p className="mt-1 text-[11px]" style={{ color: RPT_MUTE }}>
                  Strong centring and a clean surface, but corner whitening on the back likely caps
                  a gem mint. A grader that weights centring more favourably may return a higher
                  number.
                </p>
              </PaperSec>

              <PaperSec title="Grader estimates">
                <div className="grid grid-cols-[1.5fr_0.7fr_1fr_1.6fr] gap-x-2 text-[11px]">
                  {["Company", "Likely", "Range", "Subgrades (C / Co / E / S)"].map((h) => (
                    <div key={h} className="font-bold pb-1.5" style={{ color: RPT_MUTE }}>
                      {h}
                    </div>
                  ))}
                  {EXAMPLE_COMPANIES.map((c) => (
                    <div key={c.name} className="contents">
                      <div className="py-1.5 font-bold border-t" style={{ borderColor: RPT_LINE }}>
                        {c.name}
                      </div>
                      <div className="py-1.5 border-t tabular-nums" style={{ borderColor: RPT_LINE }}>
                        {c.likely}
                      </div>
                      <div
                        className="py-1.5 border-t tabular-nums"
                        style={{ borderColor: RPT_LINE, color: RPT_MUTE }}
                      >
                        {c.low} – {c.high}
                      </div>
                      <div
                        className="py-1.5 border-t tabular-nums"
                        style={{ borderColor: RPT_LINE, color: RPT_MUTE }}
                      >
                        {formatExampleSubgrades(c)}
                      </div>
                    </div>
                  ))}
                </div>
              </PaperSec>

              <PaperSec title="Condition breakdown">
                <div className="space-y-3">
                  {EX_SCORES.map((s) => (
                    <ScoreBar key={s.label} {...s} />
                  ))}
                </div>
              </PaperSec>

              <PaperSec title="Centering (measured)">
                <div className="grid grid-cols-2 gap-4 text-[11.5px]">
                  <div>
                    <div className="text-[10px] mb-0.5" style={{ color: RPT_MUTE }}>
                      Front
                    </div>
                    <div>55 / 45 left-right</div>
                    <div>52 / 48 top-bottom</div>
                  </div>
                  <div>
                    <div className="text-[10px] mb-0.5" style={{ color: RPT_MUTE }}>
                      Back
                    </div>
                    <div>60 / 40 left-right</div>
                    <div>54 / 46 top-bottom</div>
                  </div>
                </div>
              </PaperSec>

              <PaperSec title="Estimated value (rough)">
                <div className="text-[11.5px] space-y-0.5">
                  <div>
                    Raw / ungraded: <span className="font-semibold">£18 – £30</span>
                  </div>
                  <div style={{ color: RPT_MUTE }}>PSA · 8: £45 – £70</div>
                  <div style={{ color: RPT_MUTE }}>CGC · 8.5: £55 – £85</div>
                  <p className="mt-1 text-[10px]" style={{ color: RPT_MUTE }}>
                    Confidence: medium — based on recent comparable sales.
                  </p>
                </div>
              </PaperSec>

              <PaperSec title="What limits the grade">
                <div className="text-[11px] space-y-2">
                  <div>
                    <div className="font-bold" style={{ color: "#c82626" }}>
                      Blocks gem mint
                    </div>
                    <ul className="mt-1 space-y-0.5" style={{ color: RPT_INK }}>
                      <li>· Rear top-left corner whitening</li>
                      <li>· Light edge wear, right border</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-bold" style={{ color: "#b4780a" }}>
                      Blocks mint (~9)
                    </div>
                    <ul className="mt-1 space-y-0.5" style={{ color: RPT_INK }}>
                      <li>· Surface scuff under glare</li>
                    </ul>
                  </div>
                </div>
              </PaperSec>

              <PaperSec title="Preparation plan">
                <p className="text-[11px]" style={{ color: RPT_MUTE }}>
                  Two light issues are reasonable to address on a raw card; nothing here is
                  permanent damage.
                </p>
                <div className="mt-2 text-[11px] font-bold" style={{ color: "#10a05a" }}>
                  Safe to prep (2)
                </div>
                <div className="mt-2 space-y-3">
                  {[
                    {
                      pos: "18% 14%",
                      label: "Lift surface debris",
                      meta: "Front, lower-left · low risk, easy",
                      action:
                        "A fleck of debris sits on the surface — gently lift it with a clean microfibre, no pressure.",
                    },
                    {
                      pos: "82% 30%",
                      label: "Ease light edge dust",
                      meta: "Right border · low risk, easy",
                      action:
                        "Loose dust along the right edge can be brushed off so it isn't read as wear.",
                    },
                  ].map((it) => (
                    <div key={it.label} className="flex gap-3">
                      <Snap position={it.pos} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold" style={{ color: RPT_INK }}>
                          {it.label}
                        </div>
                        <div className="text-[10px]" style={{ color: "#b4780a" }}>
                          {it.meta}
                        </div>
                        <p className="mt-0.5 text-[10.5px]" style={{ color: RPT_INK }}>
                          {it.action}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </PaperSec>

              <PaperSec title="Summary">
                <p className="text-[11.5px]" style={{ color: RPT_INK }}>
                  A solid NM-MT example. Submit to a centring-friendly grader for the best shot at a
                  9; otherwise it sells well raw.
                </p>
              </PaperSec>

              <div className="mt-5 border-t pt-3" style={{ borderColor: RPT_LINE }}>
                <p className="text-[9.5px]" style={{ color: RPT_MUTE }}>
                  Not an official grade from PSA, Beckett, CGC, TAG, ACE or any grader. A pre-check
                  estimate from photos to help you decide whether to submit, sell raw, or inspect
                  further. Values shown are rough estimates, not live market prices.
                </p>
                <p className="mt-2 text-[9px]" style={{ color: RPT_MUTE }}>
                  GemCheck pre-grade report · page 1 of 1
                </p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-text-muted">
            Every card check includes this as a downloadable PDF, with close-up snapshots of any flaws.
          </p>
        </div>
      </div>
    </section>
  );
}
