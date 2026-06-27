import { Plus, X } from "lucide-react";
import type { CollectorCardDraft } from "./types";
import {
  CollectorField,
  CollectorInput,
  CollectorSection,
  CollectorSelect,
  CollectorTextarea,
} from "../ui";

export function MetadataStep({
  draft,
  onChange,
  lowConfidenceFields,
}: {
  draft: CollectorCardDraft;
  onChange: (patch: Partial<CollectorCardDraft>) => void;
  lowConfidenceFields?: Set<string>;
}) {
  const warn = (field: string) =>
    lowConfidenceFields?.has(field) ? "Could not read — please fill in" : undefined;

  const addIdentifier = () => {
    onChange({ identifiers: [...draft.identifiers, ""] });
  };

  const updateIdentifier = (index: number, value: string) => {
    const next = [...draft.identifiers];
    next[index] = value;
    onChange({ identifiers: next });
  };

  const removeIdentifier = (index: number) => {
    onChange({ identifiers: draft.identifiers.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-5">
      {draft.identificationConfidence != null && (
        <p className="text-xs text-text-muted">
          Autofill confidence: {Math.round(draft.identificationConfidence * 100)}%
        </p>
      )}

      <CollectorSection title="Identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <CollectorField label="Card name" hint={warn("cardName")}>
            <CollectorInput
              value={draft.cardName}
              onChange={(e) => onChange({ cardName: e.target.value })}
              required
            />
          </CollectorField>
          <CollectorField label="Game">
            <CollectorInput
              value={draft.cardGame}
              onChange={(e) => onChange({ cardGame: e.target.value })}
            />
          </CollectorField>
          <CollectorField label="Set name" hint={warn("setName")}>
            <CollectorInput
              value={draft.setName}
              onChange={(e) => onChange({ setName: e.target.value })}
            />
          </CollectorField>
          <CollectorField label="Set code">
            <CollectorInput
              value={draft.setCode}
              onChange={(e) => onChange({ setCode: e.target.value })}
            />
          </CollectorField>
          <CollectorField label="Card number" hint={warn("cardNumber")}>
            <CollectorInput
              value={draft.cardNumber}
              onChange={(e) => onChange({ cardNumber: e.target.value })}
              placeholder="025/203"
            />
          </CollectorField>
          <CollectorField label="Release year">
            <CollectorInput
              value={draft.releaseYear}
              onChange={(e) => onChange({ releaseYear: e.target.value })}
              inputMode="numeric"
            />
          </CollectorField>
          <CollectorField label="Language">
            <CollectorInput
              value={draft.language}
              onChange={(e) => onChange({ language: e.target.value })}
            />
          </CollectorField>
        </div>
      </CollectorSection>

      <CollectorSection title="Print details">
        <div className="grid gap-4 sm:grid-cols-2">
          <CollectorField label="Rarity" hint={warn("rarity")}>
            <CollectorInput
              value={draft.rarity}
              onChange={(e) => onChange({ rarity: e.target.value })}
            />
          </CollectorField>
          <CollectorField label="Variant">
            <CollectorInput
              value={draft.variant}
              onChange={(e) => onChange({ variant: e.target.value })}
            />
          </CollectorField>
          <CollectorField label="Finish type">
            <CollectorInput
              value={draft.finishType}
              onChange={(e) => onChange({ finishType: e.target.value })}
            />
          </CollectorField>
          <CollectorField label="Edition">
            <CollectorInput
              value={draft.edition}
              onChange={(e) => onChange({ edition: e.target.value })}
            />
          </CollectorField>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-text-secondary">Stamps & marks</span>
            <button
              type="button"
              onClick={addIdentifier}
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {draft.identifiers.map((id, i) => (
              <div key={i} className="flex gap-2">
                <CollectorInput
                  value={id}
                  onChange={(e) => updateIdentifier(i, e.target.value)}
                  placeholder="e.g. 1st Edition"
                />
                <button
                  type="button"
                  onClick={() => removeIdentifier(i)}
                  className="rounded-lg border border-border-subtle px-2 text-text-muted hover:text-error"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </CollectorSection>

      <CollectorSection title="Condition & grading">
        <div className="grid gap-4 sm:grid-cols-2">
          <CollectorField label="Card state">
            <CollectorSelect
              value={draft.cardState}
              onChange={(e) => onChange({ cardState: e.target.value })}
            >
              <option value="raw">Raw</option>
              <option value="graded">Graded</option>
            </CollectorSelect>
          </CollectorField>
          {draft.cardState === "graded" && (
            <>
              <CollectorField label="Grading company">
                <CollectorInput
                  value={draft.gradingCompany}
                  onChange={(e) => onChange({ gradingCompany: e.target.value })}
                />
              </CollectorField>
              <CollectorField label="Official grade">
                <CollectorInput
                  value={draft.officialGrade}
                  onChange={(e) => onChange({ officialGrade: e.target.value })}
                />
              </CollectorField>
              <CollectorField label="Cert number">
                <CollectorInput
                  value={draft.certificationNumber}
                  onChange={(e) => onChange({ certificationNumber: e.target.value })}
                />
              </CollectorField>
            </>
          )}
          <CollectorField label="Condition notes">
            <CollectorInput
              value={draft.condition}
              onChange={(e) => onChange({ condition: e.target.value })}
            />
          </CollectorField>
        </div>
      </CollectorSection>

      <CollectorSection title="Listing">
        <div className="space-y-4">
          <CollectorField label="Public description">
            <CollectorTextarea
              value={draft.publicDescription}
              onChange={(e) => onChange({ publicDescription: e.target.value })}
              rows={4}
            />
          </CollectorField>
          <CollectorField label="Visibility">
            <CollectorSelect
              value={draft.visibility}
              onChange={(e) => onChange({ visibility: e.target.value })}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </CollectorSelect>
          </CollectorField>
        </div>
      </CollectorSection>

      {draft.sections.includes("for_trade") && (
        <CollectorSection title="Trade">
          <div className="grid gap-4 sm:grid-cols-2">
            <CollectorField label="Trade status">
              <CollectorSelect
                value={draft.tradeStatus}
                onChange={(e) => onChange({ tradeStatus: e.target.value })}
              >
                <option value="not_available">Not for trade</option>
                <option value="open_to_offers">Open to offers</option>
                <option value="for_sale">For sale</option>
                <option value="trade_only">Trade only</option>
              </CollectorSelect>
            </CollectorField>
            <CollectorField label="Value (minor units)">
              <CollectorInput
                value={draft.tradeValueMinorUnits}
                onChange={(e) => onChange({ tradeValueMinorUnits: e.target.value })}
                inputMode="numeric"
              />
            </CollectorField>
            <CollectorField label="Currency">
              <CollectorInput
                value={draft.tradeValueCurrency}
                onChange={(e) => onChange({ tradeValueCurrency: e.target.value })}
              />
            </CollectorField>
          </div>
          <CollectorField label="Trade notes (owner only)">
            <CollectorTextarea
              value={draft.tradeNotes}
              onChange={(e) => onChange({ tradeNotes: e.target.value })}
              rows={3}
            />
          </CollectorField>
        </CollectorSection>
      )}

      {draft.ownershipType === "wanted" && (
        <CollectorSection title="Wanted">
          <CollectorField label="Wanted notes">
            <CollectorTextarea
              value={draft.wantedNotes}
              onChange={(e) => onChange({ wantedNotes: e.target.value })}
              rows={3}
            />
          </CollectorField>
          <CollectorField label="Priority">
            <CollectorSelect
              value={draft.wantedPriority}
              onChange={(e) => onChange({ wantedPriority: e.target.value })}
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="grail">Grail</option>
            </CollectorSelect>
          </CollectorField>
          <CollectorField label="Preferred grader">
            <CollectorInput
              value={draft.wantedPreferredGrader}
              onChange={(e) => onChange({ wantedPreferredGrader: e.target.value })}
            />
          </CollectorField>
          <CollectorField label="Min grade">
            <CollectorInput
              value={draft.wantedMinGrade}
              onChange={(e) => onChange({ wantedMinGrade: e.target.value })}
            />
          </CollectorField>
          <CollectorField label="Max grade">
            <CollectorInput
              value={draft.wantedMaxGrade}
              onChange={(e) => onChange({ wantedMaxGrade: e.target.value })}
            />
          </CollectorField>
          <CollectorField label="Min condition">
            <CollectorInput
              value={draft.wantedMinCondition}
              onChange={(e) => onChange({ wantedMinCondition: e.target.value })}
            />
          </CollectorField>
        </CollectorSection>
      )}

      <CollectorSection title="Private notes">
        <CollectorField label="Owner notes (never public)">
          <CollectorTextarea
            value={draft.ownerPrivateNotes}
            onChange={(e) => onChange({ ownerPrivateNotes: e.target.value })}
            rows={3}
          />
        </CollectorField>
      </CollectorSection>
    </div>
  );
}
