import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { apiFetch } from "../../lib/sessionFetch";
import { CollectorButton, CollectorInput, CollectorPageHeader } from "../components/ui";

type Message = {
  id: string;
  body: string | null;
  message_type: string;
  sent_at?: string;
};

export function CollectorConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = () => {
    if (!conversationId) return;
    apiFetch(`/api/collector/conversations/${conversationId}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []));
  };

  useEffect(load, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!conversationId || !body.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/collector/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      setBody("");
      load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col space-y-4">
      <Link
        to="/collector/messages"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        All messages
      </Link>

      <CollectorPageHeader title="Conversation" description="Messages are between collectors only — GemCheck does not mediate trades." />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">No messages yet. Say hello.</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                m.message_type === "moderator_notice"
                  ? "mx-auto border border-amber-500/30 bg-amber-500/10 text-amber-100"
                  : "border border-border-subtle bg-surface text-text-primary"
              }`}
            >
              {m.body}
              {m.sent_at && (
                <p className="mt-1.5 text-[10px] uppercase tracking-wide text-text-muted">
                  {new Date(m.sent_at).toLocaleString("en-GB", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={send}
          className="flex gap-2 border-t border-border-subtle bg-surface p-3 sm:p-4"
        >
          <CollectorInput
            className="flex-1"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
          />
          <CollectorButton type="submit" loading={sending} className="shrink-0">
            <Send className="h-4 w-4" />
            Send
          </CollectorButton>
        </form>
      </div>
    </div>
  );
}
