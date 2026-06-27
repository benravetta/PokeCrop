import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { listCollectorCards } from "../api";

export function CollectorCardsPage() {
  const [cards, setCards] = useState<{ public_id: string; card_name: string; status: string }[]>([]);

  useEffect(() => {
    listCollectorCards().then((d) => setCards(d.cards ?? []));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Your cards</h1>
        <Link to="/collector/cards/new" className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium">
          Add card
        </Link>
      </div>
      <ul className="mt-6 space-y-2">
        {cards.map((c) => (
          <li key={c.public_id}>
            <Link
              to={`/collector/cards/${c.public_id}/edit`}
              className="flex justify-between p-4 rounded-xl border border-border-subtle hover:border-accent/40"
            >
              <span className="font-medium text-text-primary">{c.card_name}</span>
              <span className="text-sm text-text-secondary">{c.status}</span>
            </Link>
          </li>
        ))}
        {cards.length === 0 && (
          <p className="text-text-secondary text-center py-12">No cards yet.</p>
        )}
      </ul>
    </div>
  );
}
