import { API_DESCRIPTION } from "./description.js";
import { paths } from "./paths.js";
import { components } from "./schemas.js";

export const API_SPEC_VERSION = "1.2.0";

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "GemCheck API",
    version: API_SPEC_VERSION,
    description: API_DESCRIPTION,
    contact: { name: "GemCheck / Looky Collectibles", url: "https://gemcheck.co.uk" },
    license: { name: "Proprietary", url: "https://gemcheck.co.uk/pricing" },
  },
  servers: [
    { url: "https://gemcheck.co.uk/v1", description: "Production" },
    { url: "/v1", description: "Same host (relative)" },
  ],
  security: [{ bearerApiKey: [] }],
  tags: [
    {
      name: "Crop",
      description:
        "Detect, straighten, and extract trading cards from scans or photos. Returns transparent PNGs suitable for listings or grading prep.",
    },
    {
      name: "Grade",
      description:
        "AI pre-grade reports with per-company estimates, defect analysis, prep plan, optional PDF download, and capture quality gates.",
    },
    {
      name: "Account",
      description: "Introspect plan status, quotas, and API usage history.",
    },
    {
      name: "Meta",
      description: "Health, version, and OpenAPI spec endpoints (no authentication).",
    },
  ],
  paths,
  components,
};
