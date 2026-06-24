import type { CardIdentity } from "../types.js";
import type { HistoricalSaleRecord } from "../types.js";

export interface ArchiveSourceConfig {
  name: string;
  domains: string[];
  enabled: boolean;
}

export const approvedArchiveSources: ArchiveSourceConfig[] = [
  {
    name: "PriceCharting",
    domains: ["pricecharting.com", "www.pricecharting.com"],
    enabled: true,
  },
  {
    name: "PSA Auction Prices",
    domains: ["psacard.com", "www.psacard.com"],
    enabled: true,
  },
];

export interface HistoricalSaleSource {
  name: string;
  supports(card: CardIdentity): boolean;
  fetch(card: CardIdentity, opts?: { timeoutMs?: number }): Promise<HistoricalFetchResult>;
}

export interface HistoricalFetchResult {
  records: HistoricalSaleRecord[];
  excluded: Array<{ title: string; url: string; reasonCode: string; reason: string }>;
  errorCode?: string;
  errorMessage?: string;
}

export function isAllowedArchiveUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return approvedArchiveSources.some(
      (s) => s.enabled && s.domains.some((d) => host === d || host.endsWith(`.${d}`))
    );
  } catch {
    return false;
  }
}
