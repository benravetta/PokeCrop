import { REVIEWS } from "./data";
import { SectionHeading, StarRating } from "./shared";

export function ReviewsSection() {
  return (
    <section id="reviews" className="scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          kicker="Collectors & sellers"
          title="Trusted before submission day."
          copy="A few words from people who use GemCheck to decide what to grade, what to sell raw, and what to leave alone."
        />

        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {REVIEWS.map((r) => (
            <article
              key={r.name}
              className="flex flex-col rounded-2xl border border-border-subtle bg-surface-raised p-5"
            >
              <StarRating count={r.rating} />
              <blockquote className="mt-3 flex-1 text-sm text-text-secondary leading-relaxed">
                &ldquo;{r.text}&rdquo;
              </blockquote>
              <footer className="mt-4 pt-4 border-t border-border-subtle">
                <div className="text-sm font-medium text-text-primary">{r.name}</div>
                <div className="text-xs text-text-muted">
                  {r.role} · {r.location}
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
