import { Fragment } from "react";
import { Check, Minus } from "lucide-react";
import {
  COMPARE_SECTIONS,
  PLAN_COLUMNS,
  type CompareCell,
  type PlanColumn,
} from "./pricingCompare";

function Cell({ value }: { value: CompareCell }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center w-full">
        <Check className="w-4 h-4 text-accent" aria-label="Included" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center w-full">
        <Minus className="w-4 h-4 text-text-muted/50" aria-label="Not included" />
      </span>
    );
  }
  return <span className="text-[12.5px] text-text-secondary leading-snug">{value}</span>;
}

export function FeatureCompareTable({ highlightPlan }: { highlightPlan?: PlanColumn }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border-subtle">
            <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted w-[34%]">
              Feature
            </th>
            {PLAN_COLUMNS.map((col) => {
              const highlighted = highlightPlan === col.id;
              return (
                <th
                  key={col.id}
                  className={`py-3 px-2 text-center min-w-[108px] ${
                    highlighted ? "bg-accent/5 rounded-t-lg" : ""
                  }`}
                >
                  <div className="text-sm font-semibold text-text-primary">{col.name}</div>
                  <div className="mt-0.5 text-xs text-text-muted">
                    {col.price}
                    {col.cadence && (
                      <span className="text-text-muted/80"> {col.cadence}</span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {COMPARE_SECTIONS.map((section) => (
            <Fragment key={section.title}>
              <tr className="border-b border-border-subtle/60">
                <td
                  colSpan={5}
                  className="pt-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted"
                >
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-border-subtle/40 hover:bg-surface-overlay/30 transition-colors"
                >
                  <td className="py-3 pr-4 align-middle">
                    <div className="text-[13px] font-medium text-text-primary">{row.label}</div>
                    {row.hint && (
                      <div className="text-[11px] text-text-muted mt-0.5 leading-snug">{row.hint}</div>
                    )}
                  </td>
                  {(["free", "unlimited", "api", "single"] as const).map((plan) => (
                    <td
                      key={plan}
                      className={`py-3 px-2 text-center align-middle ${
                        highlightPlan === plan ? "bg-accent/5" : ""
                      }`}
                    >
                      <Cell value={row[plan]} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
