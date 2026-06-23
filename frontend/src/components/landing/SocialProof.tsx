import { STATS, REVIEWS } from "./data";
import { SectionHeading, StarRating } from "./shared";

export function StatsBar() {
  return (
    <section className="border-y border-border-subtle bg-surface-raised/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center lg:text-left">
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
                {s.value}
              </div>
              <div className="mt-0.5 text-sm text-text-secondary">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ReviewsSection() {
  return (
    <section id="reviews" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          kicker="From collectors like you"
          title="Real cards. Real decisions."
          copy="GemCheck is built by people who submit cards themselves — not a faceless tool. Here's what other collectors and sellers are saying."
        />

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REVIEWS.map((r) => (
            <article
              key={r.name}
              className="flex flex-col rounded-2xl border border-border-subtle bg-surface-raised p-5 hover:border-border-strong transition-colors"
            >
              <StarRating count={r.rating} />
              <blockquote className="mt-4 flex-1 text-sm text-text-secondary leading-relaxed">
                &ldquo;{r.text}&rdquo;
              </blockquote>
              <footer className="mt-5 flex items-center gap-3 pt-4 border-t border-border-subtle">
                <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent shrink-0">
                  {r.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-medium text-text-primary">{r.name}</div>
                  <div className="text-xs text-text-muted">
                    {r.role} · {r.location}
                  </div>
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
