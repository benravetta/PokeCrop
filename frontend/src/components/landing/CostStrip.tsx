import { AlertTriangle, Clock, Wallet } from "lucide-react";

export function CostStrip() {
  const items = [
    {
      icon: Wallet,
      stat: "£15–£150",
      label: "per card to grade",
      copy: "Submission, postage and insurance add up fast — before you know the result.",
    },
    {
      icon: Clock,
      stat: "Weeks to months",
      label: "of waiting",
      copy: "Turnaround is long. A low grade you could've spotted stings even more.",
    },
    {
      icon: AlertTriangle,
      stat: "No refunds",
      label: "for a low grade",
      copy: "Graders charge the same whether your card comes back a 10 or a 6.",
    },
  ];

  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-base text-text-secondary max-w-2xl mx-auto leading-relaxed">
          Grading is a gamble when you can&apos;t see what the grader sees.{" "}
          <span className="text-text-primary font-medium">
            GemCheck takes the guesswork out first.
          </span>
        </p>
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          {items.map((it) => (
            <div
              key={it.label}
              className="rounded-2xl border border-border-subtle bg-surface-raised p-6 text-center sm:text-left"
            >
              <span className="inline-flex w-11 h-11 rounded-xl bg-accent/15 items-center justify-center mx-auto sm:mx-0">
                <it.icon className="w-5 h-5 text-accent" />
              </span>
              <div className="mt-4 text-2xl font-semibold text-text-primary">{it.stat}</div>
              <div className="text-xs uppercase tracking-wide text-text-muted mt-0.5">{it.label}</div>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">{it.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
