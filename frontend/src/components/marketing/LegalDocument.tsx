import type { LegalDocument as LegalDocumentContent } from "../../lib/legalCopy";
import { LEGAL_LAST_UPDATED } from "../../lib/legalCopy";
import { Link } from "react-router-dom";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refund", label: "Refunds" },
] as const;

export function LegalDocument({
  doc,
  currentPath,
}: {
  doc: LegalDocumentContent;
  currentPath?: string;
}) {
  const related = LEGAL_LINKS.filter((link) => link.href !== currentPath);

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
        {doc.kicker}
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-2 text-sm text-text-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
      <p className="mt-4 text-base text-text-secondary leading-relaxed">{doc.intro}</p>

      <div className="mt-10 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-semibold text-text-primary">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-sm text-text-secondary leading-relaxed">
                {paragraph}
              </p>
            ))}
            {section.bullets ? (
              <ul className="mt-3 space-y-2 text-sm text-text-secondary leading-relaxed list-disc pl-5">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-text-muted">
        Questions?{" "}
        <Link to="/contact" className="text-accent hover:text-accent-hover font-medium">
          Contact us
        </Link>
        {related.length > 0 ? (
          <>
            . See also{" "}
            {related.map((link, i) => (
              <span key={link.href}>
                {i > 0 ? (i === related.length - 1 ? " and " : ", ") : null}
                <Link to={link.href} className="text-accent hover:text-accent-hover font-medium">
                  {link.label}
                </Link>
              </span>
            ))}
            .
          </>
        ) : (
          "."
        )}
      </p>
    </>
  );
}
