import { useEffect, useState } from "react";
import { COLLECTOR_COPY, formatStatus } from "../copy";
import {
  CollectorEmptyState,
  CollectorListRow,
  CollectorLoading,
  CollectorPageHeader,
  CollectorStatusBadge,
} from "../components/ui";

type TradeEnquiry = {
  public_id: string;
  status: string;
  created_at?: string;
  initial_message?: string | null;
  conversation_id?: string | null;
};

function formatDate(iso?: string) {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return undefined;
  }
}

export function CollectorTradesPage() {
  const [enquiries, setEnquiries] = useState<TradeEnquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("../api")
      .then((m) => m.listCollectorTradeEnquiries())
      .then((d) => setEnquiries((d.enquiries ?? []) as TradeEnquiry[]))
      .catch(() => setEnquiries([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CollectorLoading label="Loading trade enquiries…" />;

  return (
    <div className="space-y-6">
      <CollectorPageHeader
        title="Trade enquiries"
        description="Structured offers from other collectors. GemCheck does not handle payment, delivery, or custody of cards."
      />

      {enquiries.length === 0 ? (
        <CollectorEmptyState
          title={COLLECTOR_COPY.empty.trades.title}
          body={COLLECTOR_COPY.empty.trades.body}
        />
      ) : (
        <div className="space-y-3">
          {enquiries.map((e) => (
            <CollectorListRow
              key={e.public_id}
              title={e.initial_message?.trim() || `Trade enquiry ${e.public_id.slice(0, 8)}`}
              subtitle={[formatStatus(COLLECTOR_COPY.tradeStatus, e.status), formatDate(e.created_at)]
                .filter(Boolean)
                .join(" · ")}
              badge={
                <CollectorStatusBadge tone={e.status === "accepted" ? "success" : "neutral"}>
                  {formatStatus(COLLECTOR_COPY.tradeStatus, e.status)}
                </CollectorStatusBadge>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
