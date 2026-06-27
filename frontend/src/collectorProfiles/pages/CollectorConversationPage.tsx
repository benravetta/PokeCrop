import { useParams } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "../../lib/sessionFetch";

export function CollectorConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<{ id: string; body: string | null; message_type: string }[]>([]);
  const [body, setBody] = useState("");

  const load = () => {
    if (!conversationId) return;
    apiFetch(`/api/collector/conversations/${conversationId}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []));
  };

  useEffect(load, [conversationId]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!conversationId || !body.trim()) return;
    await apiFetch(`/api/collector/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setBody("");
    load();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col min-h-[60vh]">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-xl max-w-[85%] ${
              m.message_type === "moderator_notice"
                ? "bg-amber-500/10 border border-amber-500/30 text-sm mx-auto"
                : "bg-surface-raised border border-border-subtle"
            }`}
          >
            {m.body}
          </div>
        ))}
      </div>
      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-accent text-white font-medium">
          Send
        </button>
      </form>
    </div>
  );
}
