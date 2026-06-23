export type CodeSample = { lang: string; label: string; source: string };

export const SAMPLE_KEY = "pk_live_your_key_here";

export function curl(label: string, source: string): CodeSample {
  return { lang: "curl", label, source };
}

export function js(label: string, source: string): CodeSample {
  return { lang: "javascript", label, source };
}

export function py(label: string, source: string): CodeSample {
  return { lang: "python", label, source };
}
