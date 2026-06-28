import type { CollectorCardDraft } from "./types";
import { CardSpecSheet } from "../CardSpecSheet";
import { CollectorSection } from "../ui";
import { draftToSpec } from "./draftToSpec";

export function ReviewStep({
  draft,
  imagePaths,
}: {
  draft: CollectorCardDraft;
  imagePaths?: { frontDisplayUrl?: string | null; backDisplayUrl?: string | null };
}) {
  return (
    <CollectorSection title="Review" description="Check everything before publishing.">
      <CardSpecSheet spec={draftToSpec(draft, imagePaths)} />
      <p className="mt-4 text-xs text-text-muted">
        Sections: {draft.sections.join(", ") || "none selected"}
      </p>
    </CollectorSection>
  );
}
