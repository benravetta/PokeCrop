"""PokeCrop Python processing service — FastAPI entry point."""

import time
import traceback
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import os

from pipeline.normalise import normalise_input
from pipeline.detect import detect_candidates
from pipeline.score import score_candidates
from pipeline.border_expand import expand_to_card_border
from pipeline.refine import refine_card
from pipeline.top_edge import cleanup_top_edge
from pipeline.corners import handle_corners
from pipeline.mask import create_alpha_output, create_overlay, create_web_size, to_base64

MAX_UPLOAD_BYTES = 50 * 1024 * 1024

app = FastAPI(title="PokeCrop Processing Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("CORS_ORIGIN", "http://localhost:5173")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


def _clamp(val, lo, hi, default):
    try:
        v = float(val)
        if not (lo <= v <= hi):
            return default
        return v
    except (TypeError, ValueError):
        return default


@app.post("/process")
async def process_card(
    image: UploadFile = File(...),
    params: str = Form("{}"),
):
    start = time.time()

    try:
        p = json.loads(params)
    except json.JSONDecodeError:
        p = {}

    if not isinstance(p, dict):
        p = {}

    edge_sensitivity = _clamp(p.get("edge_sensitivity", 0.5), 0, 1, 0.5)
    contour_threshold = _clamp(p.get("contour_threshold", 0.5), 0, 1, 0.5)
    crop_padding = int(_clamp(p.get("crop_padding", 0), 0, 100, 0))
    top_edge_cleanup = _clamp(p.get("top_edge_cleanup", 0.7), 0, 1, 0.7)
    corner_radius = _clamp(p.get("corner_radius", 0.5), 0, 1, 0.5)
    rotate_correction = p.get("rotate_correction", True)
    if isinstance(rotate_correction, str):
        rotate_correction = rotate_correction.lower() not in ("false", "0", "no")
    else:
        rotate_correction = bool(rotate_correction)

    try:
        file_bytes = await image.read()
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            return JSONResponse(
                status_code=413,
                content={"error": "File too large. Maximum size is 50 MB."},
            )

        filename = image.filename or "upload.png"

        working, original, scale = normalise_input(file_bytes, filename)

        candidates = detect_candidates(working, edge_sensitivity, contour_threshold)

        if not candidates:
            return JSONResponse(
                status_code=200,
                content={
                    "error": "No card-like shapes detected. Try adjusting edge sensitivity or contour threshold.",
                    "candidates_found": 0,
                },
            )

        scored = score_candidates(candidates, working)
        if not scored:
            return JSONResponse(
                status_code=200,
                content={"error": "Scoring failed — no valid candidates.", "candidates_found": len(candidates)},
            )

        best_idx, best_score, breakdown = scored[0]
        selected_contour = candidates[best_idx]

        expanded_contour = expand_to_card_border(selected_contour, working)

        overlay_png = create_overlay(working, expanded_contour, candidates, best_idx)

        refined_contour, processed_image, rotation_angle = refine_card(
            expanded_contour, working, rotate_correction
        )

        corner_mask, estimated_radius = handle_corners(
            refined_contour, processed_image.shape[:2], corner_radius
        )

        corner_mask = cleanup_top_edge(
            corner_mask, processed_image, refined_contour, top_edge_cleanup
        )

        if scale > 1.0:
            if rotation_angle != 0.0:
                h_orig, w_orig = original.shape[:2]
                centre = (w_orig / 2, h_orig / 2)
                M = cv2.getRotationMatrix2D(centre, rotation_angle, 1.0)
                cos_a = abs(M[0, 0])
                sin_a = abs(M[0, 1])
                new_w = int(h_orig * sin_a + w_orig * cos_a)
                new_h = int(h_orig * cos_a + w_orig * sin_a)
                M[0, 2] += (new_w - w_orig) / 2
                M[1, 2] += (new_h - h_orig) / 2
                result_image = cv2.warpAffine(original, M, (new_w, new_h), borderValue=(255, 255, 255))
            else:
                result_image = original
        else:
            result_image = processed_image

        result_png, bbox = create_alpha_output(
            result_image, corner_mask, scale, crop_padding
        )
        web_png = create_web_size(result_png)

        elapsed = int((time.time() - start) * 1000)

        return JSONResponse(content={
            "result_png": to_base64(result_png),
            "result_web_png": to_base64(web_png),
            "overlay_png": to_base64(overlay_png),
            "metadata": {
                "bbox": list(bbox),
                "confidence": round(best_score, 3),
                "estimated_corner_radius_px": round(estimated_radius, 1),
                "rotation_deg": round(rotation_angle, 2),
                "candidates_found": len(candidates),
                "selected_candidate_index": best_idx,
                "pipeline_time_ms": elapsed,
                "score_breakdown": {k: round(v, 3) for k, v in breakdown.items()},
            },
        })

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": "Processing failed. Please try again."},
        )


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5001"))
    uvicorn.run(app, host=host, port=port)
