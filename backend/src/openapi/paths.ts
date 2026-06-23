import { errorResponse } from "./schemas.js";
import { curl, js, py, SAMPLE_KEY } from "./samples.js";

const BASE = "https://gemcheck.co.uk/v1";

export const paths = {
  "/crop": {
    post: {
      tags: ["Crop"],
      summary: "Crop a card from an image",
      description: `Detects the front-most trading card, straightens it, removes the background, and returns a **transparent PNG**.

**Input:** multipart \`image\`, or JSON \`image_url\` / \`image_base64\`.

**Output:** JSON by default; send \`Accept: image/png\` for raw bytes.

**Metering:** Only **successful** extractions count toward rate limits.`,
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
                  description: "JPEG, PNG, WEBP, PDF, HEIC, DNG — max 50 MB.",
                },
                params: { type: "string", description: "JSON-encoded CropParams object." },
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
                metadata_level: { type: "string", enum: ["full", "minimal"] },
                include_suitability: { type: "boolean" },
              },
            },
            examples: {
              url: {
                summary: "Crop from public URL",
                value: { image_url: "https://example.com/card-scan.jpg" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Cropped card (JSON or PNG).",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CropResult" } },
            "image/png": { schema: { type: "string", format: "binary" } },
          },
        },
        "400": errorResponse("Invalid request — missing image or bad params."),
        "401": errorResponse("Missing or invalid API key."),
        "403": errorResponse("Requires active API plan."),
        "413": errorResponse("Image exceeds 50 MB."),
        "415": errorResponse("Unsupported file type."),
        "422": {
          description: "No card could be detected.",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/Error" },
                  { type: "object", properties: { candidates_found: { type: "integer" } } },
                ],
              },
            },
          },
        },
        "429": errorResponse("Rate limit exceeded — see Retry-After header."),
      },
      "x-codeSamples": [
        curl(
          "cURL — save PNG",
          `curl -X POST ${BASE}/crop \\
  -H "Authorization: Bearer ${SAMPLE_KEY}" \\
  -H "Accept: image/png" \\
  -F "image=@card.jpg" \\
  -o cropped.png`
        ),
        curl(
          "cURL — JSON + metadata",
          `curl -X POST ${BASE}/crop \\
  -H "Authorization: Bearer ${SAMPLE_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"image_url":"https://example.com/card.jpg","metadata_level":"full"}'`
        ),
        py(
          "Python — requests",
          `import os, requests

r = requests.post(
    "${BASE}/crop",
    headers={"Authorization": f"Bearer {os.environ['GEMCHECK_API_KEY']}"},
    files={"image": open("card.jpg", "rb")},
)
r.raise_for_status()
open("cropped.png", "wb").write(r.content)  # with Accept: image/png`
        ),
        js(
          "JavaScript — fetch",
          `const form = new FormData();
form.append("image", fileInput.files[0]);
const res = await fetch("${BASE}/crop", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.GEMCHECK_API_KEY}\` },
  body: form,
});
const { image_base64, metadata } = await res.json();`
        ),
      ],
    },
  },
  "/crop/limits": {
    get: {
      tags: ["Crop"],
      summary: "Crop rate limit and daily usage",
      description:
        "Returns burst rate-limit state and successful crop count for today (account-wide). Does not consume quota.",
      responses: {
        "200": {
          description: "Current limits.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CropLimits" } },
          },
        },
        "401": errorResponse("Missing or invalid API key."),
        "403": errorResponse("Requires active API plan."),
      },
      "x-codeSamples": [
        curl(
          "cURL",
          `curl ${BASE}/crop/limits \\
  -H "Authorization: Bearer ${SAMPLE_KEY}"`
        ),
      ],
    },
  },
  "/grade": {
    post: {
      tags: ["Grade"],
      summary: "Run an AI pre-grade",
      description: `Upload card photos for a full **pre-grade condition report** — the same analysis as the web grader.

**JSON (default):** \`{ result, quota, capture_quality }\`

**PDF:** add \`?format=pdf\`, \`Accept: application/pdf\`, or form field \`format=pdf\`. Returns the downloadable PDF report (identical to the web app).

**Idempotency:** \`Idempotency-Key\` header recommended for safe retries.

**Quota:** 20 grades/day on API plan. \`not_a_card\` does not consume quota.`,
      parameters: [
        {
          name: "format",
          in: "query",
          schema: { type: "string", enum: ["json", "pdf"], default: "json" },
        },
        {
          name: "Idempotency-Key",
          in: "header",
          schema: { type: "string", minLength: 8, maxLength: 128 },
          description: "Unique per grade attempt. Replays return cached result.",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                front: { type: "string", format: "binary", description: "Required." },
                back: { type: "string", format: "binary" },
                angled_front: { type: "string", format: "binary" },
                angled_back: { type: "string", format: "binary" },
                closeups: { type: "array", items: { type: "string", format: "binary" }, maxItems: 6 },
                centering: {
                  type: "string",
                  description: 'JSON MeasuredCentering, e.g. {"front":{"leftRight":"55/45"}}',
                },
                format: { type: "string", enum: ["json", "pdf"] },
              },
              required: ["front"],
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Grade JSON or PDF report.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/GradeResponse" } },
            "application/pdf": { schema: { type: "string", format: "binary" } },
          },
        },
        "400": errorResponse("Missing front image."),
        "401": errorResponse("Missing or invalid API key."),
        "403": errorResponse("API plan required or account suspended."),
        "422": {
          description: "Capture quality too low.",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/Error" },
                  {
                    type: "object",
                    properties: { capture_quality: { $ref: "#/components/schemas/CaptureQuality" } },
                  },
                ],
              },
            },
          },
        },
        "429": errorResponse("Grade quota exceeded or idempotency conflict."),
        "502": errorResponse("Grading pipeline failed."),
        "503": errorResponse("AI grading not configured on server."),
      },
      "x-codeSamples": [
        curl(
          "cURL — JSON grade",
          `curl -X POST ${BASE}/grade \\
  -H "Authorization: Bearer ${SAMPLE_KEY}" \\
  -H "Idempotency-Key: grade-charizard-001" \\
  -F "front=@front.jpg" \\
  -F "back=@back.jpg"`
        ),
        curl(
          "cURL — PDF report",
          `curl -X POST "${BASE}/grade?format=pdf" \\
  -H "Authorization: Bearer ${SAMPLE_KEY}" \\
  -H "Idempotency-Key: grade-charizard-001" \\
  -F "front=@front.jpg" \\
  -F "back=@back.jpg" \\
  -o pregrade-report.pdf`
        ),
        py(
          "Python — PDF report",
          `import os, requests

r = requests.post(
    "${BASE}/grade",
    params={"format": "pdf"},
    headers={
        "Authorization": f"Bearer {os.environ['GEMCHECK_API_KEY']}",
        "Idempotency-Key": "grade-001",
    },
    files={
        "front": open("front.jpg", "rb"),
        "back": open("back.jpg", "rb"),
    },
)
r.raise_for_status()
open("report.pdf", "wb").write(r.content)`
        ),
      ],
    },
  },
  "/grade/quota": {
    get: {
      tags: ["Grade"],
      summary: "Grading allowance",
      description: "Check remaining daily grade quota and purchased credits before submitting photos.",
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
        "403": errorResponse("Requires active API plan."),
      },
      "x-codeSamples": [
        curl(
          "cURL",
          `curl ${BASE}/grade/quota \\
  -H "Authorization: Bearer ${SAMPLE_KEY}"`
        ),
      ],
    },
  },
  "/grade/straighten": {
    post: {
      tags: ["Grade"],
      summary: "Straighten a card photo",
      description:
        "Runs one image through the grading-safe crop pipeline for centering measurement. **Not** metered against grade quota. Rate limited to 30/min per account.",
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
          description: "Base64 PNG of straightened card.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { png: { type: "string", description: "Base64-encoded PNG." } },
              },
            },
          },
        },
        "401": errorResponse("Missing or invalid API key."),
        "422": errorResponse("Could not detect a card."),
        "429": errorResponse("Straighten rate limit exceeded."),
      },
      "x-codeSamples": [
        curl(
          "cURL",
          `curl -X POST ${BASE}/grade/straighten \\
  -H "Authorization: Bearer ${SAMPLE_KEY}" \\
  -F "image=@front.jpg"`
        ),
      ],
    },
  },
  "/account": {
    get: {
      tags: ["Account"],
      summary: "Account snapshot",
      description: "Plan, grade quota, active API key count, and today's successful crop count.",
      responses: {
        "200": {
          description: "Account overview.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Account" } },
          },
        },
        "401": errorResponse("Missing or invalid API key."),
        "403": errorResponse("Requires active API plan."),
      },
      "x-codeSamples": [
        curl(
          "cURL",
          `curl ${BASE}/account \\
  -H "Authorization: Bearer ${SAMPLE_KEY}"`
        ),
      ],
    },
  },
  "/usage": {
    get: {
      tags: ["Account"],
      summary: "API usage history",
      description: "Paginated log of API-sourced crops and grades. Web-app actions are excluded.",
      parameters: [
        { name: "kind", in: "query", schema: { type: "string", enum: ["crop", "grade"] } },
        { name: "q", in: "query", schema: { type: "string" }, description: "Search event summary." },
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
          description: "Paginated events.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UsageHistory" } },
          },
        },
        "401": errorResponse("Missing or invalid API key."),
      },
      "x-codeSamples": [
        curl(
          "cURL — recent grades",
          `curl "${BASE}/usage?kind=grade&pageSize=10" \\
  -H "Authorization: Bearer ${SAMPLE_KEY}"`
        ),
      ],
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
                  spec: { type: "string", example: "1.2.0" },
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
      description: "Machine-readable OpenAPI 3.1 document (this spec).",
      security: [],
      responses: { "200": { description: "OpenAPI JSON." } },
    },
  },
};
