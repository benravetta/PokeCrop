import { useEffect, useState } from "react";
import { COLLECTOR_COPY } from "../copy";
import {
  CollectorEmptyState,
  CollectorListRow,
  CollectorLoading,
  CollectorPageHeader,
  CollectorStatusBadge,
} from "../components/ui";

type ConversationRow = {
  collector_conversations: {
    public_id: string;
    conversation_type: string;
    created_at?: string;
  } | null;
};

function conversationTitle(type: string) {
  return (
    COLLECTOR_COPY.conversationType[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function CollectorMessagesPage() {
  const [items, setItems] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("../api")
      .then((m) => m.listCollectorConversations())
      .then((d) => setItems((d.conversations ?? []) as ConversationRow[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CollectorLoading label="Loading messages…" />;

  const rows = items
    .map((p) => p.collector_conversations)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <div className="space-y-6">
      <CollectorPageHeader
        title="Messages"
        description="Conversations from trade enquiries and direct messages with other collectors."
      />

      {rows.length === 0 ? (
        <CollectorEmptyState
          title={COLLECTOR_COPY.empty.messages.title}
          body={COLLECTOR_COPY.empty.messages.body}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((conv) => (
            <CollectorListRow
              key={conv.public_id}
              to={`/collector/messages/${conv.public_id}`}
              title={conversationTitle(conv.conversation_type)}
              subtitle={conv.created_at ? new Date(conv.created_at).toLocaleDateString("en-GB") : undefined}
              badge={
                <CollectorStatusBadge tone="accent">
                  {conv.conversation_type === "trade_enquiry" ? "Trade" : "Message"}
                </CollectorStatusBadge>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
