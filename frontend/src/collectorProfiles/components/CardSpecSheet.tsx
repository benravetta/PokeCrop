import { Award } from "lucide-react";
import type { ReactNode } from "react";

export interface CardSpecData {
  cardName: string;
  cardGame?: string | null;
  setName?: string | null;
  setCode?: string | null;
  cardNumber?: string | null;
  releaseYear?: number | null;
  language?: string | null;
  variant?: string | null;
  rarity?: string | null;
  finishType?: string | null;
  edition?: string | null;
  condition?: string | null;
  cardState?: string | null;
  gradingCompany?: string | null;
  officialGrade?: string | null;
  certificationNumber?: string | null;
  publicDescription?: string | null;
  tradeStatus?: string | null;
  tradeValueMinorUnits?: number | null;
  tradeValueCurrency?: string | null;
  identifiers?: string[];
  identificationConfidence?: number | null;
  frontDisplayUrl?: string | null;
  backDisplayUrl?: string | null;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-28 shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 text-text-primary">{value}</dd>
    </div>
  );
}

function formatTradeValue(minor: number | null | undefined, currency: string | null | undefined) {
  if (minor == null) return "";
  const cur = currency ?? "USD";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(minor / 100);
}

export function CardSpecSheet({ spec }: { spec: CardSpecData }) {
  const identityRows = [
    { k: "Game", v: spec.cardGame },
    { k: "Set", v: spec.setName },
    { k: "Set code", v: spec.setCode },
    { k: "Number", v: spec.cardNumber },
    { k: "Language", v: spec.language },
    { k: "Year", v: spec.releaseYear ? String(spec.releaseYear) : "" },
  ].filter((r) => r.v);

  const printRows = [
    { k: "Rarity", v: spec.rarity },
    { k: "Variant", v: spec.variant },
    { k: "Finish", v: spec.finishType },
    { k: "Edition", v: spec.edition },
    { k: "Condition", v: spec.condition },
  ].filter((r) => r.v);

  const tradeLabel =
    spec.tradeStatus && spec.tradeStatus !== "not_available" ? spec.tradeStatus.replace(/_/g, " ") : "";
  const tradeValue = formatTradeValue(spec.tradeValueMinorUnits, spec.tradeValueCurrency);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      {(spec.frontDisplayUrl || spec.backDisplayUrl) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <SpecImage label="Front" src={spec.frontDisplayUrl} />
          <SpecImage label="Back" src={spec.backDisplayUrl} placeholder="Back not available" />
        </div>
      )}

      <div className="space-y-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{spec.cardName || "Untitled card"}</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {[spec.setName, spec.cardNumber].filter(Boolean).join(" · ")}
              </p>
            </div>
            {spec.identificationConfidence != null && (
              <span className="shrink-0 rounded-full bg-surface-overlay px-2.5 py-1 text-[10px] uppercase tracking-wide text-text-muted">
                ID {Math.round(spec.identificationConfidence * 100)}%
              </span>
            )}
          </div>
        </div>

        {identityRows.length > 0 && (
          <SpecBlock title="Identity">
            {identityRows.map((r) => (
              <Field key={r.k} label={r.k} value={String(r.v)} />
            ))}
          </SpecBlock>
        )}

        {printRows.length > 0 && (
          <SpecBlock title="Print details">
            {printRows.map((r) => (
              <Field key={r.k} label={r.k} value={String(r.v)} />
            ))}
          </SpecBlock>
        )}

        {spec.identifiers && spec.identifiers.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Stamps & marks</p>
            <div className="flex flex-wrap gap-1.5">
              {spec.identifiers.map((id) => (
                <span key={id} className="rounded-md bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}

        {spec.cardState === "graded" && spec.officialGrade && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3 text-sm">
            <Award className="h-4 w-4 text-accent" />
            <span className="text-text-secondary">{spec.gradingCompany}</span>
            <span className="font-semibold text-text-primary">{spec.officialGrade}</span>
            {spec.certificationNumber && (
              <span className="text-text-muted">#{spec.certificationNumber}</span>
            )}
          </div>
        )}

        {(tradeLabel || tradeValue) && (
          <SpecBlock title="Trade">
            {tradeLabel && <Field label="Status" value={tradeLabel} />}
            {tradeValue && <Field label="Value" value={tradeValue} />}
          </SpecBlock>
        )}

        {spec.publicDescription && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Description</p>
            <p className="text-sm leading-relaxed text-text-primary">{spec.publicDescription}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SpecBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h3>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function SpecImage({
  label,
  src,
  placeholder,
}: {
  label: string;
  src?: string | null;
  placeholder?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
      <div className="border-b border-border-subtle px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="aspect-[3/4] bg-surface-overlay p-3">
        {src ? (
          <img
            src={src}
            alt={label}
            className="h-full w-full object-contain select-none"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">{placeholder}</div>
        )}
      </div>
    </div>
  );
}
