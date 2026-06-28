"""GemCheck Python processing service — FastAPI entry point."""

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
from pipeline.manual_crop import parse_manual_corners
from pipeline.crop import run_crop, CropOptions
from pipeline import export as exp
from pipeline import segment

MAX_UPLOAD_BYTES = 50 * 1024 * 1024

app = FastAPI(title="GemCheck Processing Service")


@app.on_event("startup")
def _warm_segmentation() -> None:
    """Load the card segmentation model once at startup so the first crop isn't
    slowed by a cold model load. Failure is non-fatal — the pipeline falls back
    to classical boundary detection."""
    try:
        segment.warmup()
    except Exception:
        pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("CORS_ORIGIN", "http://localhost:5173")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/transcode")
async def transcode_image(image: UploadFile = File(...)):
    """Decode any supported input (incl. HEIC/HEIF, PDF page 1) and re-encode it
    as a plain JPEG. Used to normalise phone formats that downstream consumers
    (e.g. the OpenAI vision API) cannot read directly. No cropping is applied."""
    data = await image.read()
    if not data:
        return JSONResponse(status_code=400, content={"error": "Empty file."})
    if len(data) > MAX_UPLOAD_BYTES:
        return JSONResponse(status_code=413, content={"error": "File too large."})
    try:
        _working, original, _scale = normalise_input(data, image.filename or "image")
        jpeg = exp.white_jpeg(_to_rgba(original), quality=90)
        return {"jpeg": exp.to_base64(jpeg)}
    except Exception:
        traceback.print_exc()
        return JSONResponse(status_code=422, content={"error": "Could not read image."})


def _to_rgba(bgr: np.ndarray) -> np.ndarray:
    """BGR -> RGBA so it can flow through the JPEG encoder (which flattens alpha)."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    rgba = np.dstack([rgb, np.full((h, w), 255, np.uint8)])
    return rgba


def _clamp(val, lo, hi, default):
    try:
        v = float(val)
        if not (lo <= v <= hi):
            return default
        return v
    except (TypeError, ValueError):
        return default


def _as_bool(val, default=False):
    if isinstance(val, str):
        return val.lower() in ("true", "1", "yes")
    if val is None:
        return default
    return bool(val)


def _roi_hint_pixels(val, w, h):
    """Resolve an ROI hint to working-image pixels.

    Accepts either pixel coordinates or fractions of the image (0..1), which is
    what the GPT assessor returns. Returns (x, y, w, h) or None.
    """
    if not isinstance(val, (list, tuple)) or len(val) != 4:
        return None
    try:
        x, y, bw, bh = (float(v) for v in val)
    except (TypeError, ValueError):
        return None
    if max(x, y, bw, bh) <= 1.5:  # normalised fractions
        x, y, bw, bh = x * w, y * h, bw * w, bh * h
    return (int(round(x)), int(round(y)), int(round(bw)), int(round(bh)))


def _manual_quad_from_transform(manual_raw, transform_raw):
    """Map four edit-preview corners to original-image coordinates.

    ``manual_raw`` is a 4-point list in the rectified edit preview's pixel space;
    ``transform_raw`` is the 9-element row-major homography (edit -> original)
    that accompanied that preview. Returns a (4,2) float32 array or None.
    """
    if not isinstance(manual_raw, (list, tuple)) or len(manual_raw) != 4:
        return None
    if not isinstance(transform_raw, (list, tuple)) or len(transform_raw) != 9:
        return None
    try:
        pts = np.array([[float(c[0]), float(c[1])] for c in manual_raw], dtype=np.float64)
        H = np.array([float(v) for v in transform_raw], dtype=np.float64).reshape(3, 3)
        mapped = cv2.perspectiveTransform(pts.reshape(-1, 1, 2), H).reshape(-1, 2)
        if not np.all(np.isfinite(mapped)):
            return None
        return mapped.astype(np.float32)
    except (TypeError, ValueError, IndexError, cv2.error):
        return None


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

    corner_radius = _clamp(p.get("corner_radius", 0.5), 0, 1, 0.5)
    crop_padding = int(_clamp(p.get("crop_padding", 8), 0, 100, 8))

    output_size = str(p.get("output_size", "standard")).lower()
    if output_size not in ("standard", "high"):
        output_size = "standard"

    grading_safe = _as_bool(p.get("grading_safe", False))
    background = exp.parse_background(p.get("background"))
    roi_raw = p.get("roi")

    output_rotation = int(_clamp(p.get("output_rotation", 0), 0, 270, 0))
    full_resolution = _as_bool(p.get("full_resolution", False))
    identify = _as_bool(p.get("identify", False))

    manual_raw = p.get("manual_corners")
    manual_transform_raw = p.get("manual_transform")

    try:
        file_bytes = await image.read()
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            return JSONResponse(
                status_code=413,
                content={"error": "File too large. Maximum size is 50 MB."},
            )

        filename = image.filename or "upload.png"

        t = time.time()
        working, original, scale = normalise_input(file_bytes, filename)
        normalise_ms = int((time.time() - t) * 1000)

        wh, ww = working.shape[:2]
        roi_hint = _roi_hint_pixels(roi_raw, ww, wh)

        manual_corners = None
        manual_quad_full = None
        if manual_raw is not None:
            # New flow: corners come from the rectified edit preview; map them to
            # original-image coordinates with the supplied homography.
            manual_quad_full = _manual_quad_from_transform(manual_raw, manual_transform_raw)
            if manual_quad_full is None:
                # Legacy flow: corners already in working-image coordinates.
                parsed = parse_manual_corners(manual_raw, ww, wh)
                if parsed is not None:
                    manual_corners = parsed.reshape(4, 2).astype(np.float32)

        opts = CropOptions(
            corner_radius=corner_radius,
            output_size=output_size,
            grading_safe=grading_safe,
            background=background,
            roi_hint=roi_hint,
            output_rotation=output_rotation,
            manual_corners=manual_corners,
            manual_quad_full=manual_quad_full,
            crop_padding=crop_padding,
        )

        result = run_crop(working, original, scale, opts)

        if result.error is not None and result.rgba is None:
            return JSONResponse(
                status_code=200,
                content={"error": result.error, "candidates_found": 0},
            )

        result.stage_times["normalise"] = normalise_ms
        rgba = result.rgba

        # Build the edit image for the manual crop editor. Prefer the rectified
        # ("already cropped") preview from the pipeline; fall back to the raw
        # working photo if rectification was unavailable.
        edit_src = result.edit_image if result.edit_image is not None else working
        edit_h, edit_w = edit_src.shape[:2]
        edit_buf = io.BytesIO()
        Image.fromarray(cv2.cvtColor(edit_src, cv2.COLOR_BGR2RGB)).save(
            edit_buf, format="JPEG", quality=88
        )
        edit_image_jpeg = exp.to_base64(edit_buf.getvalue())

        web_png = exp.web_png(rgba)
        result_png_b64 = exp.to_base64(exp.encode_png(rgba)) if full_resolution else None

        elapsed = int((time.time() - start) * 1000)
        print(
            f"[process] total={elapsed}ms conf={result.confidence} "
            + " ".join(f"{k}={v}ms" for k, v in result.stage_times.items()),
            flush=True,
        )

        response_content = {
            "result_web_png": exp.to_base64(web_png),
            "edit_image_jpeg": edit_image_jpeg,
            "metadata": {
                "bbox": [0, 0, int(rgba.shape[1]), int(rgba.shape[0])],
                "confidence": result.confidence,
                "needs_manual": result.needs_manual,
                "needs_review": result.needs_review,
                "detection_path": result.detection_path,
                "scan_mode": result.scan_mode,
                "estimated_corner_radius_px": round(result.estimated_radius, 1),
                "rotation_deg": 0.0,
                "output_rotation": output_rotation,
                "orientation_deg": result.orientation_deg,
                "candidates_found": 1,
                "selected_candidate_index": 0,
                "pipeline_time_ms": elapsed,
                "stage_times_ms": result.stage_times,
                "crop_corners": result.crop_corners,
                "working_corners": result.working_corners,
                "working_size": [int(working.shape[1]), int(working.shape[0])],
                "edit_transform": result.edit_transform,
                "edit_image_size": [int(edit_w), int(edit_h)],
                "output_size": list(result.output_size_px),
                "aspect": result.aspect,
                "damaged": result.damaged,
                "glare": result.glare,
                "grading_safe": grading_safe,
                "score_breakdown": {
                    "aspect_ratio": result.aspect,
                    "card_target": 0.716,
                },
            },
        }
        if result.reasons:
            response_content["metadata"]["detection_notes"] = result.reasons
        if result_png_b64 is not None:
            response_content["result_png"] = result_png_b64

        if identify:
            try:
                response_content["id_image_jpeg"] = exp.to_base64(
                    exp.white_jpeg(_downscale_rgba(rgba, 900), quality=85)
                )
            except Exception:
                traceback.print_exc()

        return JSONResponse(content=response_content)

    except Exception:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": "Processing failed. Please try again."},
        )


def _downscale_rgba(rgba: np.ndarray, max_dim: int) -> np.ndarray:
    h, w = rgba.shape[:2]
    longest = max(h, w)
    if longest <= max_dim:
        return rgba
    sc = max_dim / float(longest)
    return cv2.resize(rgba, (max(1, int(w * sc)), max(1, int(h * sc))), interpolation=cv2.INTER_AREA)


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5001"))
    uvicorn.run(app, host=host, port=port)
