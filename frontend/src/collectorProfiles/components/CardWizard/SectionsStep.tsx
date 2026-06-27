import { COLLECTOR_COPY, sectionLabel } from "../../copy";
import { CollectorSection } from "../ui";

const SECTION_KEYS = ["showcase", "for_trade", "wanted", "private_collection"] as const;

export function SectionsStep({
  sections,
  onChange,
}: {
  sections: string[];
  onChange: (sections: string[]) => void;
}) {
  const toggle = (key: string) => {
    onChange(sections.includes(key) ? sections.filter((s) => s !== key) : [...sections, key]);
  };

  return (
    <CollectorSection
      title="Profile sections"
      description="Choose where this card appears on your public profile."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {SECTION_KEYS.map((key) => {
          const selected = sections.includes(key);
          const meta = COLLECTOR_COPY.sections[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                selected
                  ? "border-accent bg-accent/10"
                  : "border-border-subtle bg-surface hover:border-border-strong"
              }`}
            >
              <p className={`text-sm font-semibold ${selected ? "text-accent" : "text-text-primary"}`}>
                {meta?.label ?? sectionLabel(key)}
              </p>
              {meta?.hint && <p className="mt-0.5 text-xs text-text-muted">{meta.hint}</p>}
            </button>
          );
        })}
      </div>
    </CollectorSection>
  );
}
