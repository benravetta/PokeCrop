import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createCollectorCard } from "../api";

export function CollectorNewCardPage() {
  const navigate = useNavigate();
  const [cardName, setCardName] = useState("");
  const [setName, setSetName] = useState("");
  const [sections, setSections] = useState<string[]>(["showcase"]);
  const [error, setError] = useState<string | null>(null);

  const toggleSection = (s: string) => {
    setSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { card } = await createCollectorCard({ card_name: cardName, set_name: setName, sections });
      navigate(`/collector/cards/${card.public_id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-text-primary">Add a card</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          className="w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
          placeholder="Card name"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
          placeholder="Set name"
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {["showcase", "for_trade", "wanted", "private_collection"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSection(s)}
              className={`px-3 py-1 rounded-full text-sm border ${
                sections.includes(s) ? "border-accent bg-accent/10 text-accent" : "border-border-subtle"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" className="w-full py-2.5 rounded-lg bg-accent text-white font-medium">
          Continue to upload
        </button>
      </form>
    </div>
  );
}
