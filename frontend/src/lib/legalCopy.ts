/** Legal page copy — en-GB. Keep aligned with product behaviour in COPY_MANIFEST verified facts. */

import { FREE_GRADES_PER_MONTH } from "./marketingCopy";

export const LEGAL_LAST_UPDATED = "23 June 2026";

export const LEGAL_OPERATOR =
  "GemCheck is operated by Looky Collectibles (Looky Collectibles, England).";

export type LegalSection = {
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type LegalDocument = {
  kicker: string;
  title: string;
  intro: string;
  sections: readonly LegalSection[];
};

export const PRIVACY_POLICY: LegalDocument = {
  kicker: "Privacy",
  title: "Privacy policy",
  intro:
    "This policy explains what we collect when you use GemCheck, why we collect it, and the choices you have. We keep it plain because you should not need a law degree to understand your own data.",
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        LEGAL_OPERATOR,
        "GemCheck is a trading card pre-grading service available at gemcheck.co.uk. For privacy questions, contact us through the form on our contact page.",
      ],
    },
    {
      heading: "What we collect",
      paragraphs: ["Depending on how you use GemCheck, we may process:"],
      bullets: [
        "Account details you provide at registration (such as email address and password, handled by our authentication provider).",
        "Photos you upload for crop, centring or pre-grade checks.",
        "Report outputs and check history metadata (for example card name, estimates and dates).",
        "Billing information processed by Stripe when you purchase credits or subscriptions (we do not store full card numbers).",
        "Technical logs needed to run and secure the service (such as IP address, browser type and error logs).",
        "Messages you send through our contact or trade enquiry forms.",
      ],
    },
    {
      heading: "How we use photos and reports",
      paragraphs: [
        "Pre-grade photos are processed to generate your report. They are handled in memory for that check and are not stored as image files in your account history.",
        "Check history stores report metadata so you can review past checks without us keeping the original grade photos on file.",
        "Crop session files are temporary working files and are not kept as a permanent photo library in your account.",
        "We may retain anonymised or aggregated usage data to improve accuracy, reliability and abuse prevention.",
      ],
    },
    {
      heading: "Legal bases (UK GDPR)",
      paragraphs: ["We process personal data where one or more of the following applies:"],
      bullets: [
        "Contract — to provide the account, crop tool, pre-grade reports and billing you request.",
        "Legitimate interests — to secure the service, prevent fraud and improve the product in a way that respects your rights.",
        "Legal obligation — where we must keep records for tax, accounting or regulatory reasons.",
        "Consent — where required for optional communications or non-essential cookies (if offered).",
      ],
    },
    {
      heading: "Sharing and processors",
      paragraphs: [
        "We use trusted providers to run GemCheck. They process data only on our instructions and for the purposes described here.",
      ],
      bullets: [
        "Supabase — authentication and database hosting.",
        "Stripe — payments, subscriptions and refunds.",
        "Cloudflare — security checks (Turnstile) and infrastructure.",
        "AI and image-processing providers — to analyse uploaded card photos and generate reports.",
        "Cardmarket, PriceCharting and eBay — queried via automated web research to look up market pricing for identified cards (card name, set and number metadata only; not your photos).",
      ],
    },
    {
      heading: "Retention",
      paragraphs: [
        "We keep account and billing records for as long as your account is active and for a reasonable period afterwards where required by law or legitimate business needs.",
        "Activity and audit logs used for security may be kept for shorter rolling windows.",
        "You can ask us to delete your account by contacting us. Some records may need to be retained where law or payment rules require it.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "If you are in the UK or EEA, you may have rights to access, correct, delete or restrict processing of your personal data, and to object or withdraw consent where applicable.",
        "You may also have the right to complain to the Information Commissioner's Office (ICO) in the UK.",
        "To exercise your rights, contact us via the contact page with enough detail for us to verify your account.",
      ],
    },
    {
      heading: "Security",
      paragraphs: [
        "We use industry-standard measures including encrypted transport (HTTPS), access controls and provider security features. No online service can guarantee absolute security, but we work to protect your data proportionately.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        "GemCheck is not directed at children under 13. We do not knowingly collect personal data from children. If you believe a child has provided us data, contact us and we will take appropriate steps.",
      ],
    },
    {
      heading: "Changes",
      paragraphs: [
        "We may update this policy from time to time. The date at the top of this page shows when it was last revised. Continued use of GemCheck after changes means you accept the updated policy.",
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  kicker: "Terms",
  title: "Terms of service",
  intro:
    "These terms govern your use of GemCheck. By creating an account or using the service, you agree to them. If you do not agree, please do not use GemCheck.",
  sections: [
    {
      heading: "The service",
      paragraphs: [
        "GemCheck provides trading card pre-grade estimates from photographs you upload. It helps you decide whether to submit a card for official grading, choose a grader or keep the card raw.",
        "GemCheck does not issue official grades. Final grades are determined only by the grading company after physical inspection. We are not affiliated with, endorsed by or approved by any grading company named on the site.",
      ],
    },
    {
      heading: "Accounts",
      paragraphs: [
        "You must provide accurate registration details and keep your login credentials secure. You are responsible for activity under your account.",
        "You must be old enough to enter a binding contract in your jurisdiction. An account is required before uploading cards for crop or pre-grade checks.",
        "We may suspend or terminate accounts that breach these terms, abuse the service or create risk for other users or our infrastructure.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: ["You agree not to:"],
      bullets: [
        "Upload unlawful, infringing or abusive content.",
        "Attempt to reverse engineer, scrape or overload the service beyond normal use.",
        "Share API keys or account access in ways that breach your plan limits.",
        "Misrepresent GemCheck outputs as official grades or guarantees.",
        "Circumvent usage limits, security controls or payment requirements.",
      ],
    },
    {
      heading: "Plans, credits and billing",
      paragraphs: [
        "Free accounts include a limited number of card checks and crop sessions each month as described on the pricing page.",
        "Paid single-report credits and subscriptions are billed through Stripe. Prices shown on the site are the prices at checkout unless a stated promotion applies.",
        "VAT treatment follows our checkout and invoice configuration at the time of purchase.",
        "Subscription plans renew automatically until cancelled through the billing portal or as otherwise stated at purchase.",
      ],
    },
    {
      heading: "Estimates and reliance",
      paragraphs: [
        "Pre-grade reports are guidance based on visible evidence in your photos. They are not a guarantee of an official grade, market value or future sale price.",
        "Some defects may not be visible in photographs. You accept that official results may differ from GemCheck estimates.",
        "You are responsible for your grading, buying and selling decisions.",
      ],
    },
    {
      heading: "Market value estimates",
      paragraphs: [
        "When configured, pre-grade reports may include value ranges sourced from AI web research of third-party marketplaces and price guides (such as eBay sold listings and PriceCharting). These are automated comp aggregations for the identified card only — not a guarantee of sale price, appraisal or buyback offer.",
        "If we cannot match live comps for your card, the value section is omitted rather than guessed. Listing-based comps reflect asking prices at the time of lookup and may differ from completed sales.",
      ],
    },
    {
      heading: "Intellectual property",
      paragraphs: [
        "GemCheck software, branding, report format and site content are owned by us or our licensors. You receive a limited, non-exclusive licence to use the service for personal or internal business purposes according to your plan.",
        "You retain ownership of photos you upload. You grant us a licence to process those photos solely to provide the service.",
      ],
    },
    {
      heading: "Availability and changes",
      paragraphs: [
        "We aim to keep GemCheck available and accurate, but we do not guarantee uninterrupted access. Maintenance, third-party outages or model updates may affect results temporarily.",
        "We may change features, limits or pricing with reasonable notice where required. Material changes to paid plans will be communicated through the site or by email where appropriate.",
      ],
    },
    {
      heading: "Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by law, GemCheck and Looky Collectibles are not liable for indirect, incidental or consequential losses, including lost profits, grading fees or resale opportunities arising from reliance on estimates.",
        "Our total liability for any claim relating to the service is limited to the amount you paid us for GemCheck in the twelve months before the claim, except where liability cannot be limited by law.",
        "Nothing in these terms excludes liability for death or personal injury caused by negligence, fraud, or other rights that cannot be excluded under UK law.",
      ],
    },
    {
      heading: "Governing law",
      paragraphs: [
        "These terms are governed by the laws of England and Wales. Courts in England and Wales have exclusive jurisdiction, without prejudice to mandatory consumer protections in your home country if you are a consumer outside the UK.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        "Questions about these terms can be sent through our contact page.",
      ],
    },
  ],
};

export const REFUND_POLICY: LegalDocument = {
  kicker: "Refunds",
  title: "Refund policy",
  intro:
    "This policy explains when you can get money back for GemCheck purchases. We keep it straightforward: unused paid credits can usually be refunded; used credits and consumed subscription time generally cannot.",
  sections: [
    {
      heading: "Single report credits",
      paragraphs: [
        "One-off pre-grade report credits are sold at the price shown on the pricing page (currently £2.99 per report unless a promotion states otherwise).",
        "If you bought credits and have not used them, you may request a refund and we will process eligible refunds through Stripe to your original payment method.",
        "Once a purchased credit has been used to generate a report, that credit is consumed and cannot be refunded or restored automatically.",
        "Purchased credits do not expire while your account remains active.",
      ],
    },
    {
      heading: "Free monthly allowance",
      paragraphs: [
        `Each free account includes ${FREE_GRADES_PER_MONTH} card checks per calendar month at no charge. Free allowances are not billable items and are not refundable.`,
        "If a check does not complete because of photo quality issues, a not-a-card result, or a processing failure, your paid or free credit is not consumed, as described in the FAQ.",
      ],
    },
    {
      heading: "Subscriptions",
      paragraphs: [
        "Premium, Pro and Enterprise subscriptions are managed through Stripe. You can cancel future renewals at any time from the billing portal in your account.",
        "When you cancel, access continues until the end of the current billing period unless otherwise stated at purchase.",
        "We do not normally refund partial subscription periods already started, except where required by law or where we have explicitly agreed otherwise in writing.",
        "Promotional pricing (such as launch discounts) applies only for the stated promotional period and then renews at the standard price unless cancelled.",
      ],
    },
    {
      heading: "How to request a refund",
      paragraphs: [
        "Contact us through the contact page with the email address on your account and the date of purchase. For unused credits we will confirm your balance and process eligible refunds through Stripe.",
        "Refunds typically appear on your statement within five to ten business days, depending on your bank or card issuer.",
      ],
    },
    {
      heading: "Chargebacks and disputes",
      paragraphs: [
        "If you open a payment dispute or chargeback, we may suspend the related account until the matter is resolved. Fraudulent or abusive chargebacks may result in permanent account closure.",
        "Where a chargeback is decided in our favour after a report was delivered, we may revoke associated credits or access.",
      ],
    },
    {
      heading: "Changes",
      paragraphs: [
        "We may update this policy from time to time. The date at the top of this page shows when it was last revised.",
      ],
    },
  ],
};
