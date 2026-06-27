import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { listCollectorConversations } from "../api";

export function CollectorMessagesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    listCollectorConversations()
      .then((d) => setItems(d.conversations ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-text-primary">Messages</h1>
      <ul className="mt-6 space-y-2">
        {items.map((p) => {
          const conv = p.collector_conversations as { public_id: string; conversation_type: string } | null;
          if (!conv) return null;
          return (
            <li key={conv.public_id}>
              <Link
                to={`/collector/messages/${conv.public_id}`}
                className="block p-4 rounded-xl border border-border-subtle hover:border-accent/40"
              >
                {conv.conversation_type.replace("_", " ")}
              </Link>
            </li>
          );
        })}
        {items.length === 0 && (
          <p className="text-center py-12 text-text-secondary">No conversations yet.</p>
        )}
      </ul>
    </div>
  );
}
