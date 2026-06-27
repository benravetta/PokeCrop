import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { listCollectorCards } from "../api";
import { COLLECTOR_COPY } from "../copy";
import {
  CollectorCardGrid,
  CollectorEmptyState,
  CollectorLinkButton,
  CollectorLoading,
  CollectorPageHeader,
  type CollectorCardPreview,
} from "../components/ui";

export function CollectorCardsPage() {
  const [cards, setCards] = useState<CollectorCardPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCollectorCards()
      .then((d) =>
        setCards(
          (d.cards ?? []).map(
            (c: {
              public_id: string;
              card_name: string;
              set_name?: string;
              status: string;
              thumbnail_url?: string;
            }) => ({
              publicId: c.public_id,
              cardName: c.card_name,
              setName: c.set_name,
              status: c.status,
              thumbnailUrl: c.thumbnail_url,
            })
          )
        )
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CollectorLoading label="Loading cards…" />;

  return (
    <div className="space-y-6">
      <CollectorPageHeader
        title="Your cards"
        description="Upload photos, crop both sides, and publish cards to your public sections."
        actions={
          <CollectorLinkButton to="/collector/cards/new">
            <Plus className="h-4 w-4" />
            Add card
          </CollectorLinkButton>
        }
      />

      <CollectorCardGrid
        cards={cards}
        linkTo={(c) => `/collector/cards/${c.publicId}/edit`}
        empty={
          <CollectorEmptyState
            title={COLLECTOR_COPY.empty.cards.title}
            body={COLLECTOR_COPY.empty.cards.body}
            action={
              <CollectorLinkButton to="/collector/cards/new">
                {COLLECTOR_COPY.empty.cards.action}
              </CollectorLinkButton>
            }
          />
        }
      />
    </div>
  );
}
