import { Link } from "react-router-dom";
import { PRODUCT_PROOF } from "../../lib/marketingCopy";
import { SectionHeading } from "./shared";

export function ReviewsSection() {
  return (
    <section id="proof" className="scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          kicker={PRODUCT_PROOF.kicker}
          title={PRODUCT_PROOF.heading}
          copy={PRODUCT_PROOF.body}
        />

        <div className="mt-10 mx-auto max-w-2xl rounded-2xl border border-border-subtle bg-surface-raised p-6 sm:p-8 text-center">
          <p className="text-sm text-text-secondary leading-relaxed">
            GemCheck shows separate pre-grade estimates for each supported grader, a condition
            breakdown, confidence notes and a clear best-fit explanation. You decide whether to
            submit, sell raw or retake your photos.
          </p>
          <Link
            to="/sample-report"
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-border-strong bg-surface-overlay/40 px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
          >
            View a sample report
          </Link>
        </div>
      </div>
    </section>
  );
}
