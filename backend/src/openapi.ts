// OpenAPI 3.1 description of the public GemCheck API (/v1). Served at GET /v1/openapi.json.

const DESCRIPTION = `
The **GemCheck API** extracts trading cards from photos and runs AI pre-grade reports —
the same capabilities as the [GemCheck web app](https://gemcheck.co.uk), for automation.

## Authentication

All endpoints except \`/health\`, \`/version\`, and \`/openapi.json\` require an API key
from the **API plan** (£19.99/mo). Create keys on your [Account page](/account):

\`\`\`
Authorization: Bearer pk_live_xxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

You may also send \`X-API-Key: pk_live_...\`.

## Quickstart — crop

\`\`\`bash
curl -X POST https://gemcheck.co.uk/v1/crop \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Accept: image/png" \\
  -F "image=@card.jpg" \\
  -o cropped.png
\`\`\`

## Quickstart — grade

\`\`\`bash
curl -X POST https://gemcheck.co.uk/v1/grade \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Idempotency-Key: grade-$(date +%s)" \\
  -F "front=@front.jpg" \\
  -F "back=@back.jpg"
\`\`\`

## Grade PDF report

Send \`Accept: application/pdf\`, \`?format=pdf\`, or form field \`format=pdf\` on
\`POST /v1/grade\` to download the same pre-grade PDF as the web app (card photos,
company estimates, prep plan with defect snapshots). JSON is the default.

## Rate limits

Crop requests are rate limited **per account** (not per key). See \`X-RateLimit-*\` headers.
The API plan includes unlimited crops for normal use with a generous daily soft cap.
Grades use a separate quota (20/day on the API plan). Send \`Idempotency-Key\` on grade
requests to safely retry without double-charging.
`;

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string", example: "unauthorized" },
        message: { type: "string" },
      },
      required: ["code", "message"],
    },
  },
};

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const bearerSecurity = [{ bearerApiKey: [] }];

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "GemCheck API",
    version: "1.1.0",
    description: DESCRIPTION,
    contact: { name: "GemCheck", url: "https://gemcheck.co.uk" },
  },
  servers: [
    { url: "https://gemcheck.co.uk/v1", description: "Production" },
    { url: "/v1", description: "Relative to this host" },
  ],
  security: bearerSecurity,
  tags: [
    { name: "Crop", description: "Detect, straighten, and extract cards." },
    { name: "Grade", description: "AI pre-grade reports (same as the web grader)." },
    { name: "Account", description: "Plan, quota, and usage introspection." },
    { name: "Meta", description: "Health, version, and OpenAPI spec." },
  ],
  paths: {
    "/crop": {
      post: {
        tags: ["Crop"],
        summary: "Crop a card from an image",
        description:
          "Detects and extracts the front-most card and returns a transparent PNG. Provide the image via multipart `image`, or JSON `image_url` / `image_base64`. Optional `metadata_level` (`full`|`minimal`) and `include_suitability` (default true).",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  image: { type: "string", format: "binary" },
                  params: { type: "string", description: "JSON-encoded CropParams." },
                  metadata_level: { type: "string", enum: ["full", "minimal"], default: "full" },
                  include_suitability: { type: "boolean", default: true },
                },
                required: ["image"],
              },
            },
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  image_url: { type: "string", format: "uri" },
                  image_base64: { type: "string" },
                  params: { $ref: "#/components/schemas/CropParams" },
                  metadata_level: { type: "string", enum: ["full", "minimal"], default: "full" },
                  include_suitability: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Cropped card.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CropResult" },
              },
              "image/png": { schema: { type: "string", format: "binary" } },
            },
          },
          "400": errorResponse("Invalid request."),
          "401": errorResponse("Missing or invalid API key."),
          "403": errorResponse("API plan required."),
          "413": errorResponse("Image too large."),
          "415": errorResponse("Unsupported media type."),
          "422": {
            description: "No card could be detected.",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/Error" },
                    {
                      type: "object",
                      properties: {
                        candidates_found: { type: "integer" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "429": errorResponse("Rate limit exceeded."),
        },
      },
    },
    "/crop/limits": {
      get: {
        tags: ["Crop"],
        summary: "Crop rate limit and daily usage",
        responses: {
          "200": {
            description: "Current limits for this account.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CropLimits" },
              },
            },
          },
          "401": errorResponse("Missing or invalid API key."),
          "403": errorResponse("API plan required."),
        },
      },
    },
    "/grade": {
      post: {
        tags: ["Grade"],
        summary: "Run an AI pre-grade",
        description:
          "Multipart upload: `front` (required), optional `back`, `angled_front`, `angled_back`, `closeups` (up to 6). Optional form field `centering` — JSON with front/back leftRight and topBottom ratios like `\"55/45\"`. Send `Idempotency-Key` header to dedupe retries. Default response is JSON; send `Accept: application/pdf`, `?format=pdf`, or form field `format=pdf` for the full PDF report (same as the web app).",
        parameters: [
          {
            name: "format",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["json", "pdf"], default: "json" },
            description: "Response format (alternative to Accept header).",
          },
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string", minLength: 8, maxLength: 128 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  front: { type: "string", format: "binary" },
                  back: { type: "string", format: "binary" },
                  angled_front: { type: "string", format: "binary" },
                  angled_back: { type: "string", format: "binary" },
                  closeups: { type: "array", items: { type: "string", format: "binary" } },
                  centering: {
                    type: "string",
                    description: "JSON MeasuredCentering object.",
                  },
                  format: {
                    type: "string",
                    enum: ["json", "pdf"],
                    description: "Response format when Accept cannot be set.",
                  },
                },
                required: ["front"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Grade result (JSON) or PDF report.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GradeResponse" },
              },
              "application/pdf": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          "400": errorResponse("Missing front image or bad request."),
          "401": errorResponse("Missing or invalid API key."),
          "403": errorResponse("API plan required or account suspended."),
          "422": errorResponse("Capture quality too low for grading."),
          "429": errorResponse("Grade quota exceeded."),
          "502": errorResponse("Grading failed."),
          "503": errorResponse("Grading not configured."),
        },
      },
    },
    "/grade/quota": {
      get: {
        tags: ["Grade"],
        summary: "Grading allowance",
        responses: {
          "200": {
            description: "Quota snapshot.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { quota: { $ref: "#/components/schemas/GradeQuota" } },
                },
              },
            },
          },
          "401": errorResponse("Missing or invalid API key."),
          "403": errorResponse("API plan required."),
        },
      },
    },
    "/grade/straighten": {
      post: {
        tags: ["Grade"],
        summary: "Straighten a card for centering measurement",
        description: "Helper endpoint — not metered against crop quota.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: { image: { type: "string", format: "binary" } },
                required: ["image"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Straightened PNG (base64).",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { png: { type: "string", description: "Base64 PNG." } },
                },
              },
            },
          },
          "422": errorResponse("Could not detect a card."),
        },
      },
    },
    "/account": {
      get: {
        tags: ["Account"],
        summary: "Account snapshot",
        responses: {
          "200": {
            description: "Plan and quota overview.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Account" },
              },
            },
          },
          "401": errorResponse("Missing or invalid API key."),
        },
      },
    },
    "/usage": {
      get: {
        tags: ["Account"],
        summary: "API usage history",
        parameters: [
          { name: "kind", in: "query", schema: { type: "string", enum: ["crop", "grade"] } },
          { name: "q", in: "query", schema: { type: "string" }, description: "Search summary." },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated API-sourced events.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UsageHistory" },
              },
            },
          },
          "401": errorResponse("Missing or invalid API key."),
        },
      },
    },
    "/health": {
      get: {
        tags: ["Meta"],
        summary: "Health check",
        security: [],
        responses: {
          "200": {
            description: "Service is up.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/version": {
      get: {
        tags: ["Meta"],
        summary: "API version",
        security: [],
        responses: {
          "200": {
            description: "Version info.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    api: { type: "string", example: "v1" },
                    spec: { type: "string", example: "1.1.0" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/openapi.json": {
      get: {
        tags: ["Meta"],
        summary: "OpenAPI specification",
        security: [],
        responses: {
          "200": { description: "This document." },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerApiKey: {
        type: "http",
        scheme: "bearer",
        description: "GemCheck API key (pk_live_...).",
      },
    },
    schemas: {
      CropParams: {
        type: "object",
        description: "Optional crop tuning; sensible defaults apply.",
        properties: {
          corner_radius: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
          crop_padding: { type: "integer", minimum: 0, maximum: 100, default: 8 },
          output_rotation: { type: "integer", enum: [0, 90, 180, 270], default: 0 },
          output_size: { type: "string", enum: ["standard", "high"], default: "standard" },
          grading_safe: { type: "boolean", default: false },
          background: {
            type: "string",
            description: "white, black, grey, #rrggbb, or omit for transparent.",
          },
          roi: {
            type: "array",
            items: { type: "number" },
            minItems: 4,
            maxItems: 4,
            description: "Normalised [x, y, w, h] hint.",
          },
          manual_corners: {
            type: "array",
            items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
            minItems: 4,
            maxItems: 4,
          },
          manual_transform: {
            type: "array",
            items: { type: "number" },
            minItems: 9,
            maxItems: 9,
          },
          rotation_deg: { type: "number" },
        },
      },
      CropResult: {
        type: "object",
        properties: {
          image_base64: { type: "string" },
          metadata: { $ref: "#/components/schemas/CropMetadata" },
        },
        required: ["image_base64", "metadata"],
      },
      CropMetadata: {
        type: "object",
        description: "Pipeline metadata. Full mode includes score_breakdown, bbox, suitability, etc.",
        properties: {
          width: { type: "integer" },
          height: { type: "integer" },
          confidence: { type: "number" },
          needs_manual: { type: "boolean" },
          rotation_deg: { type: "number" },
          corner_radius_px: { type: "number" },
          corners: { type: "array", items: { type: "array", items: { type: "number" } } },
          processing_ms: { type: "number" },
          candidates_found: { type: "integer" },
          score_breakdown: { type: "object", additionalProperties: true },
          bbox: { type: "array", items: { type: "number" } },
          suitability: { type: "object", additionalProperties: true },
        },
      },
      CropLimits: {
        type: "object",
        properties: {
          plan: { type: "string", example: "api" },
          rate_limit_scope: { type: "string", example: "account" },
          rate_limit_per_minute: { type: "integer" },
          remaining_this_minute: { type: "integer" },
          reset_at: { type: "string", format: "date-time" },
          crops_today: {
            type: "integer",
            description: "Successful API crops today across all keys on this account.",
          },
          daily_soft_cap: { type: "integer" },
        },
      },
      GradeQuota: {
        type: "object",
        properties: {
          plan: { type: "string" },
          limit: { type: "integer" },
          used: { type: "integer" },
          remaining: { type: "integer" },
          window: { type: "string", enum: ["day", "month"] },
          allowanceRemaining: { type: "integer" },
          credits: { type: "integer" },
        },
      },
      GradeResponse: {
        type: "object",
        properties: {
          result: { type: "object", additionalProperties: true },
          quota: { $ref: "#/components/schemas/GradeQuota" },
          capture_quality: { type: "object", additionalProperties: true },
        },
      },
      Account: {
        type: "object",
        properties: {
          plan: { type: "string", example: "api" },
          grade_quota: { $ref: "#/components/schemas/GradeQuota" },
          active_api_keys: { type: "integer" },
          crops_today: {
            type: "integer",
            description: "Successful API crops today across all keys on this account.",
          },
        },
      },
      UsageHistory: {
        type: "object",
        properties: {
          events: { type: "array", items: { type: "object", additionalProperties: true } },
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
        },
      },
      Error: errorSchema,
    },
  },
};
