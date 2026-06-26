/** Strip PostgREST / ILIKE metacharacters from user search input. */
export function sanitizePostgrestSearch(raw: string, maxLen = 100): string {
  return raw
    .trim()
    .slice(0, maxLen)
    .replace(/[,().\\%_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
