"""PokeCrop Python processing service — FastAPI entry point."""

import time
import traceback
import cv2
import json
import os
import io
import numpy as np

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image

from pipeline.normalise import normalise_input
from pipeline.find_card import find_card, straighten_card
from pipeline.extract import extract_warped_card
from pipeline.manual_crop import parse_manual_corners, build_edit_frame
from pipeline.mask import create_web_from_rgba, encode_rgba_png, to_base64
from utils.geometry import order_corners

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
    edge_trim = int(_clamp(p.get("edge_trim", 0), 0, 40, 0))
    bg_removal = _clamp(p.get("bg_removal", 0.0), 0, 1, 0.0)
    top_edge_cleanup = _clamp(p.get("top_edge_cleanup", 0.7), 0, 1, 0.7)
    corner_radius = _clamp(p.get("corner_radius", 0.5), 0, 1, 0.5)
    rotate_correction = p.get("rotate_correction", True)
    if isinstance(rotate_correction, str):
        rotate_correction = rotate_correction.lower() not in ("false", "0", "no")
    else:
        rotate_correction = bool(rotate_correction)

    rotation_override = p.get("rotation_deg")
    try:
        rotation_override = float(rotation_override) if rotation_override is not None else None
    except (TypeError, ValueError):
        rotation_override = None

    manual_raw = p.get("manual_corners")

    # Full-resolution PNG is only needed for the original-size download, so the
    # interactive /process loop skips it and just returns a web-sized preview.
    full_resolution = p.get("full_resolution", False)
    if isinstance(full_resolution, str):
        full_resolution = full_resolution.lower() in ("true", "1", "yes")
    else:
        full_resolution = bool(full_resolution)

    try:
        file_bytes = await image.read()
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            return JSONResponse(
                status_code=413,
                content={"error": "File too large. Maximum size is 50 MB."},
            )

        filename = image.filename or "upload.png"

        stage_times: dict = {}

        def _stage(label, t0):
            stage_times[label] = int((time.time() - t0) * 1000)

        t = time.time()
        working, original, scale = normalise_input(file_bytes, filename)
        _stage("normalise", t)

        manual_contour = None
        edit_preview = None
        if manual_raw is not None:
            edit_preview = build_edit_frame(working, rotation_override or 0.0, rotate_correction)
            eh, ew = edit_preview.shape[:2]
            manual_contour = parse_manual_corners(manual_raw, ew, eh)

        t = time.time()
        card_contour, all_rects, selected_idx = find_card(
            working, edge_sensitivity, contour_threshold
        )
        _stage("detect", t)

        if manual_contour is None and card_contour is None:
            return JSONResponse(
                status_code=200,
                content={
                    "error": "No trading card detected. Try adjusting settings.",
                    "candidates_found": len(all_rects),
                },
            )

        t = time.time()
        rotation_angle = 0.0
        if manual_contour is not None:
            # Reuse the edit frame already built above instead of recomputing it.
            processed_image = edit_preview
            refined_contour = manual_contour.astype(np.int32)
            rotation_angle = float(rotation_override or 0.0)
        elif rotate_correction:
            refined_contour, processed_image, rotation_angle = straighten_card(
                card_contour, working
            )
        else:
            rect = cv2.minAreaRect(card_contour)
            box = cv2.boxPoints(rect).astype(np.float64)
            refined_contour = order_corners(box.astype(np.float32)).reshape(-1, 1, 2).astype(np.int32)
            processed_image = working
            rotation_angle = 0.0
        _stage("straighten", t)

        t = time.time()
        result_rgba, estimated_radius = extract_warped_card(
            processed_image,
            refined_contour,
            corner_radius,
            top_edge_cleanup,
            crop_padding,
            edge_trim,
            bg_removal,
        )
        _stage("extract", t)

        t_encode = time.time()
        edit_h, edit_w = processed_image.shape[:2]
        edit_buf = io.BytesIO()
        Image.fromarray(cv2.cvtColor(processed_image, cv2.COLOR_BGR2RGB)).save(
            edit_buf, format="JPEG", quality=88
        )
        edit_image_jpeg = to_base64(edit_buf.getvalue())

        crop_corners = order_corners(
            refined_contour.reshape(4, 2).astype(np.float32)
        ).tolist()

        # Web-sized preview is built directly from the (working-resolution) RGBA
        # array — a single resize + encode, no full-res round-trip.
        web_png = create_web_from_rgba(result_rgba)

        # The full-resolution PNG (for original-size download) is expensive to
        # build and is only needed at export time, so we skip it during the
        # interactive loop and produce it lazily when full_resolution is set.
        result_png_b64 = None
        if full_resolution:
            export_rgba = result_rgba
            if scale > 1.0:
                target_h = min(int(round(result_rgba.shape[0] * scale)), original.shape[0])
                target_w = min(int(round(result_rgba.shape[1] * scale)), original.shape[1])
                if target_h > result_rgba.shape[0] and target_w > result_rgba.shape[1]:
                    export_rgba = cv2.resize(
                        result_rgba,
                        (target_w, target_h),
                        interpolation=cv2.INTER_CUBIC,
                    )
            result_png_b64 = to_base64(encode_rgba_png(export_rgba))

        bbox = (0, 0, result_rgba.shape[1], result_rgba.shape[0])
        _stage("encode", t_encode)

        elapsed = int((time.time() - start) * 1000)
        print(
            f"[process] total={elapsed}ms "
            + " ".join(f"{k}={v}ms" for k, v in stage_times.items()),
            flush=True,
        )

        card_rect = cv2.minAreaRect(
            card_contour if card_contour is not None else refined_contour
        )
        rw, rh = card_rect[1]
        short, long = sorted([rw, rh])
        ratio = short / long if long > 0 else 0

        response_content = {
            "result_web_png": to_base64(web_png),
            "edit_image_jpeg": edit_image_jpeg,
            "metadata": {
                "bbox": list(bbox),
                "confidence": round(1.0 - abs(ratio - 0.716) * 5, 3),
                "estimated_corner_radius_px": round(estimated_radius, 1),
                "rotation_deg": round(rotation_angle, 2),
                "candidates_found": len(all_rects),
                "selected_candidate_index": selected_idx,
                "pipeline_time_ms": elapsed,
                "stage_times_ms": stage_times,
                "crop_corners": crop_corners,
                "edit_image_size": [int(edit_w), int(edit_h)],
                "score_breakdown": {
                    "aspect_ratio": round(ratio, 4),
                    "card_target": 0.716,
                },
            },
        }
        if result_png_b64 is not None:
            response_content["result_png"] = result_png_b64

        return JSONResponse(content=response_content)

    except Exception:
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
