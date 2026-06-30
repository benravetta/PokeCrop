/** In-app copy for grade, upload, report, processing and errors — en-GB, estimate-first. */

import {
  IMAGE_FORMATS_GRADE,
  IMAGE_MAX_SIZE,
  ESTIMATE_DISCLAIMER_LONG,
  SINGLE_REPORT_PRICE,
} from "./marketingCopy";

export const GRADE_UPLOAD = {
  pageHeading: "Grade this card",
  intro:
    "Upload clear photos of both sides. We will check the image quality before building your report.",
  frontLabel: "Front of card",
  frontHelp: "Show the full card and all four corners. Use bright, even light and no flash.",
  frontButton: "Add front photo",
  backLabel: "Back of card",
  backHelp: "Keep the card flat and make sure the edges are not cropped.",
  backButton: "Add back photo",
  readyState: "Both photos added",
  checkPhotos: "Check my photos",
  runCheck: "Run grade check",
  buyOne: `Buy 1 grade check (${SINGLE_REPORT_PRICE})`,
  noCredits: "No checks left",
  checking: "Checking…",
} as const;

export const PROCESSING_STAGES = [
  "Checking image quality",
  "Identifying the card",
  "Reviewing visible condition",
  "Comparing grader estimates",
  "Building your report",
] as const;

export const UPLOAD_ERRORS = {
  unreadable: `We could not read this photo. Upload a ${IMAGE_FORMATS_GRADE} image under ${IMAGE_MAX_SIZE}.`,
  blur: "This photo is too blurry to assess. Retake it in brighter, even light and keep the camera steady.",
  cropping: "Part of the card is missing. Retake the photo with all four corners visible.",
  glare:
    "Glare is hiding part of the surface. Move away from direct light or tilt the card slightly.",
  cardTooSmall:
    "The card is too small in the frame. Move closer while keeping every edge visible.",
  duplicateSide: "This looks like another front photo. Upload a clear photo of the back.",
  identifyFail:
    "We could not confidently identify this card. Check the photo and card details, then try again.",
  processingFail: "We could not complete this check.",
  creditNotUsed: "Your report credit has not been used.",
} as const;

export const REPORT = {
  mainHeading: "Your pre-grade report",
  likelyBestFit: "Likely best fit",
  confidence: {
    high: "High confidence",
    moderate: "Moderate confidence",
    limited: "Limited confidence",
  },
  sections: {
    graderEstimates: "Grader estimates",
    helped: "What helped the score",
    heldBack: "What held it back",
    breakdown: "Condition breakdown",
    photoLimits: "Photo limitations",
    nextStep: "Recommended next step",
    limitations: "Important limitations",
  },
  disclaimer: ESTIMATE_DISCLAIMER_LONG,
  actions: {
    another: "Check another card",
    download: "Download report",
    improvePhotos: "Improve my photos",
    compare: "Compare graders",
  },
  notACard: {
    heading: "That does not look like a trading card",
    body: `No report credit was used. Upload a clear, square-on photo of a single trading card.`,
    cta: "Try another image",
  },
} as const;

export const GRADE_PROGRESS = {
  heading: "Checking your card",
  sub: "Reviewing visible condition and comparing grader estimates.",
} as const;
