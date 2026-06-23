// OpenAPI 3.1 description of the public GemCheck API (/v1). Served verbatim at
// GET /v1/openapi.json and rendered by the /docs page. Quickstart prose lives in
// info.description (markdown) and per-language samples in x-codeSamples so the
// docs UI stays in sync with this single source of truth.

const DESCRIPTION = `
The **GemCheck API** extracts a trading card from a scan or photo: it finds the
front-most card, straightens it, removes the background, preserves the rounded
corners, and returns a transparent PNG.

## Authentication

All endpoints (except \`/health\` and \`/version\`) require an API key, available
on the **API plan**. Create keys on your [Account page](/account). Send the key
as a Bearer token:

\`\`\`
Authorization: Bearer pk_live_xxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

## Quickstart

\`\`\`bash
curl -X POST https://gemcheck.co.uk/v1/crop \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Accept: image/png" \\
  -F "image=@card.jpg" \\
  -o cropped.png
\`\`\`

## Input

Send the image one of three ways:
- **multipart/form-data** with an \`image\` file (recommended), or
- **JSON** with an \`image_url\` (must be a public http/https URL), or
- **JSON** with \`image_base64\` (raw base64 or a data URL).

## Output

By default you get JSON \`{ image_base64, metadata }\`. Send
\`Accept: image/png\` to get the raw PNG bytes instead.

## Rate limits

Requests are rate limited per key (see the \`X-RateLimit-*\` response headers).
The API plan is unlimited for normal use; a generous daily cap guards against
abuse. A \`429\` response includes a \`Retry-After\` header.
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

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "GemCheck API",
    version: "1.0.0",
    description: DESCRIPTION,
    contact: { name: "GemCheck", url: "https://gemcheck.co.uk" },
  },
  servers: [
    { url: "https://gemcheck.co.uk/v1", description: "Production" },
    { url: "/v1", description: "Relative to this host" },
  ],
  security: [{ bearerApiKey: [] }],
  tags: [{ name: "Crop" }, { name: "Meta" }],
  paths: {
    "/crop": {
      post: {
        tags: ["Crop"],
        summary: "Crop a card from an image",
        description:
          "Detects and extracts the front-most card and returns a transparent PNG. Provide the image via multipart `image`, or JSON `image_url` / `image_base64`.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  image: {
                    type: "string",
                    format: "binary",
                    description: "Image or PDF file (JPEG, PNG, WEBP, PDF; up to 50 MB).",
                  },
                  params: {
                    type: "string",
                    description: "Optional JSON-encoded CropParams.",
                  },
                },
                required: ["image"],
              },
            },
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  image_url: {
                    type: "string",
                    format: "uri",
                    description: "Public http/https URL of the image.",
                  },
                  image_base64: {
                    type: "string",
                    description: "Base64-encoded image, or a data URL.",
                  },
                  params: { $ref: "#/components/schemas/CropParams" },
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
              "image/png": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          "400": errorResponse("Invalid request."),
          "401": errorResponse("Missing or invalid API key."),
          "403": errorResponse("API plan required."),
          "413": errorResponse("Image too large."),
          "415": errorResponse("Unsupported media type."),
          "422": errorResponse("No card could be detected."),
          "429": errorResponse("Rate limit exceeded."),
        },
        "x-codeSamples": [
          {
            lang: "curl",
            label: "cURL (file → PNG)",
            source:
              'curl -X POST https://gemcheck.co.uk/v1/crop \\\n  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\\n  -H "Accept: image/png" \\\n  -F "image=@card.jpg" \\\n  -o cropped.png',
          },
          {
            lang: "python",
            label: "Python (requests)",
            source:
              'import os, requests\n\nresp = requests.post(\n    "https://gemcheck.co.uk/v1/crop",\n    headers={"Authorization": f"Bearer {os.environ[\'GEMCHECK_API_KEY\']}", "Accept": "image/png"},\n    files={"image": open("card.jpg", "rb")},\n)\nresp.raise_for_status()\nwith open("cropped.png", "wb") as f:\n    f.write(resp.content)',
          },
          {
            lang: "javascript",
            label: "JavaScript (fetch, URL input)",
            source:
              'const res = await fetch("https://gemcheck.co.uk/v1/crop", {\n  method: "POST",\n  headers: {\n    Authorization: `Bearer ${process.env.GEMCHECK_API_KEY}`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({ image_url: "https://example.com/card.jpg" }),\n});\nconst { image_base64, metadata } = await res.json();',
          },
        ],
      },
    },
    "/crop/limits": {
      get: {
        tags: ["Crop"],
        summary: "Current rate limit and usage",
        responses: {
          "200": {
            description: "Caller's limits and today's usage.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Limits" },
              },
            },
          },
          "401": errorResponse("Missing or invalid API key."),
          "403": errorResponse("API plan required."),
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
                  properties: { api: { type: "string", example: "v1" } },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerApiKey: {
        type: "http",
        scheme: "bearer",
        description: "Your GemCheck API key (pk_live_...).",
      },
    },
    schemas: {
      CropParams: {
        type: "object",
        description: "Optional tuning parameters; all have sensible defaults.",
        properties: {
          crop_padding: { type: "integer", minimum: 0, maximum: 100, default: 0 },
          edge_trim: { type: "integer", minimum: 0, maximum: 40, default: 0 },
          bg_removal: { type: "number", minimum: 0, maximum: 1, default: 0 },
          corner_radius: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
          top_edge_cleanup: { type: "number", minimum: 0, maximum: 1, default: 0.7 },
          edge_sensitivity: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
          contour_threshold: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
          rotate_correction: { type: "boolean", default: true },
        },
      },
      CropResult: {
        type: "object",
        properties: {
          image_base64: {
            type: "string",
            description: "Base64-encoded transparent PNG of the cropped card.",
          },
          metadata: { $ref: "#/components/schemas/CropMetadata" },
        },
        required: ["image_base64", "metadata"],
      },
      CropMetadata: {
        type: "object",
        description: "Stable metadata about the crop.",
        properties: {
          width: { type: "integer", description: "Output PNG width in pixels." },
          height: { type: "integer", description: "Output PNG height in pixels." },
          confidence: {
            type: "number",
            description: "Detection confidence, 0-1.",
          },
          rotation_deg: {
            type: "number",
            description: "Rotation applied to straighten the card, in degrees.",
          },
          corner_radius_px: {
            type: "number",
            description: "Estimated corner radius in pixels.",
          },
          corners: {
            type: "array",
            description: "Detected card corners as [x, y] pairs in source pixels.",
            items: { type: "array", items: { type: "number" } },
          },
          processing_ms: {
            type: "number",
            description: "Server-side processing time in milliseconds.",
          },
        },
      },
      Limits: {
        type: "object",
        properties: {
          plan: { type: "string", example: "api" },
          rate_limit_per_minute: { type: "integer" },
          remaining_this_minute: { type: "integer" },
          reset_at: { type: "string", format: "date-time" },
          crops_today: { type: "integer" },
          daily_soft_cap: { type: "integer" },
        },
      },
      Error: errorSchema,
    },
  },
};
