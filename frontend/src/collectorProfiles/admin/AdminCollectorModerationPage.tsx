import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../../lib/sessionFetch";

export function AdminCollectorReportsPage() {
  const [reports, setReports] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    apiFetch("/api/admin/collector/reports")
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? []));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary">Collector reports</h1>
      <ul className="mt-4 space-y-2">
        {reports.map((r) => (
          <li key={String(r.id)} className="p-3 rounded-lg border border-border-subtle">
            {String(r.entity_type)} — {String(r.reason_code)} — {String(r.status)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminCollectorModerationCasesPage() {
  const [cases, setCases] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    apiFetch("/api/admin/collector/moderation-cases")
      .then((r) => r.json())
      .then((d) => setCases(d.cases ?? []));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary">Moderation cases</h1>
      <ul className="mt-4 space-y-2">
        {cases.map((c) => (
          <li key={String(c.id)}>
            <Link
              to={`/admin/collector/moderation-cases/${c.id}`}
              className="block p-3 rounded-lg border border-border-subtle hover:border-accent/40"
            >
              {String(c.public_id)} — {String(c.status)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminCollectorModerationCasePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [caseRow, setCaseRow] = useState<Record<string, unknown> | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!caseId) return;
    apiFetch(`/api/admin/collector/moderation-cases/${caseId}`)
      .then((r) => r.json())
      .then((d) => setCaseRow(d.case));
  }, [caseId]);

  const accessConversation = async (conversationId: string) => {
    const res = await apiFetch(`/api/admin/collector/moderation-cases/${caseId}/access-conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, accessReason: reason }),
    });
    const d = await res.json();
    alert(`Loaded ${d.messages?.length ?? 0} messages (access logged)`);
  };

  if (!caseRow) return <p className="text-text-secondary">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Case {String(caseRow.public_id)}</h1>
      <p className="text-text-secondary">{String(caseRow.summary)}</p>
      <input
        className="w-full rounded-lg border border-border-subtle px-3 py-2"
        placeholder="Access reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Link
        to={`/admin/collector/conversations/${caseRow.id}`}
        className="text-accent hover:underline text-sm"
      >
        Open conversation view
      </Link>
    </div>
  );
}

export function AdminCollectorCardsPage() {
  return <p className="text-text-secondary">Collector cards admin list uses /api/admin/collector/cards.</p>;
}

export function AdminCollectorTradesPage() {
  return <p className="text-text-secondary">Trade enquiries admin list.</p>;
}

export function AdminCollectorConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<unknown[]>([]);

  useEffect(() => {
    if (!conversationId) return;
    apiFetch(`/api/admin/collector/conversations/${conversationId}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []));
  }, [conversationId]);

  return (
    <div>
      <h1 className="text-xl font-semibold">Conversation (audited access)</h1>
      <ul className="mt-4 space-y-2">
        {messages.map((m, i) => (
          <li key={i} className="p-3 rounded-lg border border-border-subtle text-sm">
            {JSON.stringify(m)}
          </li>
        ))}
      </ul>
    </div>
  );
}
