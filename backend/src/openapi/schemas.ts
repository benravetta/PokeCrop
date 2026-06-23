const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string", example: "unauthorized" },
        message: { type: "string", example: "Missing API key." },
      },
      required: ["code", "message"],
    },
  },
};

export const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

export const components = {
  securitySchemes: {
    bearerApiKey: {
      type: "http",
      scheme: "bearer",
      description:
        "GemCheck API key from Account → API keys. Format: pk_live_ followed by a secret token.",
    },
  },
  schemas: {
    Error: errorSchema,
    CropParams: {
      type: "object",
      description:
        "Optional crop tuning. Defaults are applied when omitted. Pass as JSON object (JSON body) or stringified JSON (multipart `params` field).",
      properties: {
        corner_radius: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.5,
          description: "Rounded corner strength (0 = square, 1 = full card radius).",
        },
        crop_padding: {
          type: "integer",
          minimum: 0,
          maximum: 100,
          default: 8,
          description: "Extra pixels around the detected card edge.",
        },
        output_rotation: {
          type: "integer",
          enum: [0, 90, 180, 270],
          default: 0,
          description: "Clockwise rotation applied to the output.",
        },
        output_size: {
          type: "string",
          enum: ["standard", "high"],
          default: "standard",
          description: "Output resolution preset.",
        },
        grading_safe: {
          type: "boolean",
          default: false,
          description:
            "Perspective-correct crop without beautification — use before measuring centering or grading.",
        },
        background: {
          type: "string",
          description: "Fill colour: white, black, grey, #rrggbb, or omit for transparent PNG.",
        },
        roi: {
          type: "array",
          items: { type: "number" },
          minItems: 4,
          maxItems: 4,
          description: "Normalised hint [x, y, w, h] in 0–1 coordinates.",
        },
        manual_corners: {
          type: "array",
          description: "Four [x, y] corner points in source image pixels.",
          items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
          minItems: 4,
          maxItems: 4,
        },
        manual_transform: {
          type: "array",
          description: "3×3 homography (row-major, 9 numbers) from manual editor.",
          items: { type: "number" },
          minItems: 9,
          maxItems: 9,
        },
        rotation_deg: { type: "number", description: "Fine rotation in degrees." },
      },
    },
    CropResult: {
      type: "object",
      properties: {
        image_base64: {
          type: "string",
          description: "Base64-encoded transparent PNG of the extracted card.",
        },
        metadata: { $ref: "#/components/schemas/CropMetadata" },
      },
      required: ["image_base64", "metadata"],
    },
    CropMetadata: {
      type: "object",
      description:
        "Detection metadata. `full` mode returns pipeline fields; `minimal` returns a stable subset.",
      properties: {
        width: { type: "integer" },
        height: { type: "integer" },
        confidence: { type: "number", description: "Detection confidence 0–1." },
        needs_manual: { type: "boolean", description: "True if manual corner adjustment is recommended." },
        rotation_deg: { type: "number" },
        corner_radius_px: { type: "number" },
        corners: {
          type: "array",
          description: "Detected corners as [x, y] pairs in source pixels.",
          items: { type: "array", items: { type: "number" } },
        },
        processing_ms: { type: "number" },
        candidates_found: { type: "integer" },
        score_breakdown: { type: "object", additionalProperties: true },
        bbox: { type: "array", items: { type: "number" } },
        suitability: {
          type: "object",
          description: "GPT pre-crop assessment (when include_suitability is true).",
          additionalProperties: true,
        },
      },
    },
    CropLimits: {
      type: "object",
      properties: {
        plan: { type: "string", example: "api" },
        rate_limit_scope: {
          type: "string",
          example: "account",
          description: "Burst and daily caps apply per account, not per API key.",
        },
        rate_limit_per_minute: { type: "integer", example: 60 },
        remaining_this_minute: { type: "integer", example: 59 },
        reset_at: { type: "string", format: "date-time" },
        crops_today: {
          type: "integer",
          description: "Successful API crops today, summed across all keys on the account.",
        },
        daily_soft_cap: { type: "integer", example: 5000 },
      },
    },
    MeasuredCentering: {
      type: "object",
      description: "User-measured centering ratios (larger side first), e.g. 55/45.",
      properties: {
        front: {
          type: "object",
          properties: {
            leftRight: { type: "string", example: "55/45" },
            topBottom: { type: "string", example: "50/50" },
          },
        },
        back: {
          type: "object",
          properties: {
            leftRight: { type: "string", example: "52/48" },
            topBottom: { type: "string", example: "50/50" },
          },
        },
      },
    },
    GradeQuota: {
      type: "object",
      properties: {
        plan: { type: "string", enum: ["free", "unlimited", "api"], example: "api" },
        limit: { type: "integer", example: 20, description: "Allowance per window." },
        used: { type: "integer", example: 3 },
        remaining: {
          type: "integer",
          example: 17,
          description: "Plan allowance left + purchased credits.",
        },
        window: { type: "string", enum: ["day", "month"] },
        allowanceRemaining: {
          type: "integer",
          example: 17,
          description: "Plan allowance only (excludes purchased credits).",
        },
        credits: {
          type: "integer",
          example: 0,
          description: "Unused one-off purchased grade credits.",
        },
      },
    },
    GradeResult: {
      type: "object",
      description: "Merged AI inspection + adjudication report.",
      properties: {
        card_identification: {
          type: "object",
          properties: {
            name: { type: "string", example: "Charizard" },
            set: { type: "string", example: "Base Set" },
            number: { type: "string", example: "4" },
            set_total: { type: "string", example: "102" },
            variant: { type: "string" },
            rarity: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
        submission_recommendation: {
          type: "object",
          properties: {
            verdict: {
              type: "string",
              example: "strong_candidate",
              description:
                "strong_candidate | possible_candidate_inspect_first | only_if_value_justifies | sell_raw | do_not_grade",
            },
            best_for: { type: "string" },
            reason: { type: "string" },
          },
        },
        company_estimates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              company: { type: "string", example: "PSA" },
              likely: { type: "string", example: "9" },
              low: { type: "string", example: "8" },
              high: { type: "string", example: "10" },
              subgrades: {
                type: "object",
                properties: {
                  centering: { type: "string" },
                  corners: { type: "string" },
                  edges: { type: "string" },
                  surface: { type: "string" },
                },
              },
            },
          },
        },
        corners: { type: "object", properties: { score: { type: "number" }, verdict: { type: "string" } } },
        edges: { type: "object", properties: { score: { type: "number" }, verdict: { type: "string" } } },
        surface: { type: "object", properties: { score: { type: "number" }, verdict: { type: "string" } } },
        centering: { type: "object", additionalProperties: true },
        pricing: {
          type: "object",
          description: "Rough GBP value bands (AI estimate unless live market APIs configured).",
          additionalProperties: true,
        },
        preparation: {
          type: "object",
          description: "Defect-by-defect prep recommendations with regions.",
          additionalProperties: true,
        },
        summary: { type: "string" },
        disclaimer: { type: "string" },
        not_a_card: { type: "boolean", description: "True when upload was not a trading card." },
      },
    },
    CaptureQuality: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        score: { type: "number" },
        rating: { type: "string", enum: ["excellent", "good", "limited", "poor"] },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              severity: { type: "string", enum: ["block", "warn"] },
              message: { type: "string" },
            },
          },
        },
      },
    },
    GradeResponse: {
      type: "object",
      properties: {
        result: { $ref: "#/components/schemas/GradeResult" },
        quota: { $ref: "#/components/schemas/GradeQuota" },
        capture_quality: { $ref: "#/components/schemas/CaptureQuality" },
      },
    },
    Account: {
      type: "object",
      properties: {
        plan: { type: "string", example: "api" },
        grade_quota: { $ref: "#/components/schemas/GradeQuota" },
        active_api_keys: { type: "integer", example: 2 },
        crops_today: { type: "integer" },
      },
    },
    UsageEvent: {
      type: "object",
      properties: {
        id: { type: "integer" },
        kind: { type: "string", enum: ["crop", "grade"] },
        source: { type: "string", enum: ["web", "api"] },
        billing: { type: "string" },
        plan: { type: "string", nullable: true },
        summary: { type: "string", nullable: true },
        created_at: { type: "string", format: "date-time" },
      },
    },
    UsageHistory: {
      type: "object",
      properties: {
        events: { type: "array", items: { $ref: "#/components/schemas/UsageEvent" } },
        total: { type: "integer" },
        page: { type: "integer" },
        pageSize: { type: "integer" },
      },
    },
  },
};
