import { useEffect, useState } from "react";
import { listCollectorTradeEnquiries } from "../api";

export function CollectorTradesPage() {
  const [enquiries, setEnquiries] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    listCollectorTradeEnquiries()
      .then((d) => setEnquiries(d.enquiries ?? []))
      .catch(() => setEnquiries([]));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-text-primary">Trade enquiries</h1>
      <p className="mt-2 text-sm text-text-secondary">
        GemCheck does not handle payment, delivery or custody of cards exchanged between users.
      </p>
      <ul className="mt-6 space-y-3">
        {enquiries.map((e) => (
          <li key={String(e.public_id)} className="p-4 rounded-xl border border-border-subtle">
            <span className="font-medium">{String(e.status)}</span>
            <span className="ml-2 text-sm text-text-secondary">{String(e.public_id)}</span>
          </li>
        ))}
        {enquiries.length === 0 && (
          <p className="text-center py-12 text-text-secondary">No trade enquiries yet.</p>
        )}
      </ul>
    </div>
  );
}
