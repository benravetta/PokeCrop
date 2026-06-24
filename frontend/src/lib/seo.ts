import { useEffect, useMemo } from "react";
import type { SeoPageConfig } from "./marketingCopy";

export const SITE_ORIGIN =
  (import.meta.env.VITE_SITE_ORIGIN as string | undefined)?.replace(/\/$/, "") ||
  "https://gemcheck.co.uk";

export const SITE_NAME = "GemCheck";
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/gemcheck-logo.png`;

export type PageSeoInput = SeoPageConfig & {
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

function upsertMeta(
  selector: string,
  create: () => HTMLMetaElement,
  content: string
): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function removeLink(rel: string): void {
  document.head.querySelector(`link[rel="${rel}"]`)?.remove();
}

function upsertJsonLd(data: Record<string, unknown> | Record<string, unknown>[]): void {
  const payload = Array.isArray(data) ? data : [data];
  let el = document.getElementById("page-jsonld") as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = "page-jsonld";
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(payload.length === 1 ? payload[0] : payload);
}

function removeJsonLd(): void {
  document.getElementById("page-jsonld")?.remove();
}

/** Apply document head tags for the current route (SPA-safe). */
export function applyPageSeo(config: PageSeoInput): void {
  const robots = config.robots ?? "index, follow";
  const canonical = absoluteUrl(config.path);
  const ogImage = absoluteUrl(config.ogImage ?? DEFAULT_OG_IMAGE);
  const ogType = config.ogType ?? "website";

  document.title = config.title;

  upsertMeta(
    'meta[name="description"]',
    () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      return m;
    },
    config.description
  );

  upsertMeta(
    'meta[name="robots"]',
    () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "robots");
      return m;
    },
    robots
  );

  upsertLink("canonical", canonical);

  const ogTags: Record<string, string> = {
    "og:title": config.title,
    "og:description": config.description,
    "og:url": canonical,
    "og:type": ogType,
    "og:site_name": SITE_NAME,
    "og:locale": "en_GB",
    "og:image": ogImage,
  };

  for (const [property, content] of Object.entries(ogTags)) {
    upsertMeta(
      `meta[property="${property}"]`,
      () => {
        const m = document.createElement("meta");
        m.setAttribute("property", property);
        return m;
      },
      content
    );
  }

  const twitterTags: Record<string, string> = {
    "twitter:card": "summary_large_image",
    "twitter:title": config.title,
    "twitter:description": config.description,
    "twitter:image": ogImage,
  };

  for (const [name, content] of Object.entries(twitterTags)) {
    upsertMeta(
      `meta[name="${name}"]`,
      () => {
        const m = document.createElement("meta");
        m.setAttribute("name", name);
        return m;
      },
      content
    );
  }

  if (config.jsonLd) {
    upsertJsonLd(config.jsonLd);
  } else {
    removeJsonLd();
  }
}

export function usePageSeo(config: PageSeoInput): void {
  const stableKey = useMemo(
    () =>
      JSON.stringify({
        title: config.title,
        description: config.description,
        path: config.path,
        robots: config.robots,
        ogImage: config.ogImage,
        ogType: config.ogType,
        jsonLd: config.jsonLd,
      }),
    [
      config.title,
      config.description,
      config.path,
      config.robots,
      config.ogImage,
      config.ogType,
      config.jsonLd,
    ]
  );

  useEffect(() => {
    applyPageSeo(config);
  }, [stableKey]);
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    logo: DEFAULT_OG_IMAGE,
    description:
      "Independent trading card pre-grading — clear estimates across PSA, Beckett, CGC, ACE and TAG before you submit.",
  };
}

export function webSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_ORIGIN,
  };
}

export function faqJsonLd(
  items: readonly { q: string; a: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function howToJsonLd(
  name: string,
  steps: readonly { title: string; body: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    step: steps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.title,
      text: step.body,
    })),
  };
}
