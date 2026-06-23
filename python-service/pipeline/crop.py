"""Staged card crop orchestrator.

Runs the full pipeline:
  normalise (caller) -> localise -> boundary -> edges -> refine ->
  validate/confidence -> warp -> orient -> alpha -> enhance -> trim -> export.

Returns a structured result; the FastAPI layer maps it onto the (additive,
backward-compatible) HTTP response. Image-level failures are reported as a
user-facing ``error`` string rather than raised, so the API stays 200-friendly.
"""

import time
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import cv2
import numpy as np

from pipeline.localise import rough_roi
from pipeline.boundary import card_boundary
from pipeline.edges import fit_card_quad
from pipeline.refine_edges import refine_quad
from pipeline.validate import validate_quad
from pipeline.warp import warp_card, OUTPUT_SIZES
from pipeline.orientation import orient_upright
from pipeline.alpha import build_alpha
from pipeline.enhance import enhance_clean, glare_fraction
from pipeline import export as exp
from utils.geometry import order_corners

CONFIDENCE_MANUAL_THRESHOLD = 0.45

# The manual crop editor works on a straightened ("rectified") preview of the
# cropped card rather than the raw photo, so adjusting feels like fine-tuning the
# actual result. EDIT_MARGIN_FRAC leaves context around the card so a handle can
# still be dragged outward to recover an edge the auto-detector clipped.
EDIT_MARGIN_FRAC = 0.32
EDIT_CARD_LONG = 1000

# Grading wants the cleanest, highest-resolution crop the source can give (small
# scratches/print lines matter), so the grading-safe warp is sized to the card's
# native pixel count rather than the small canonical canvas — capped so a macro
# shot can't blow up memory, and floored so it's never worse than a normal crop.
GRADING_MAX_LONG = 3000
GRADING_MIN_LONG = OUTPUT_SIZES["standard"][1]  # 1760


@dataclass
class CropOptions:
    corner_radius: float = 0.5
    output_size: str = "standard"
    grading_safe: bool = False
    background: Optional[Tuple[int, int, int]] = None
    roi_hint: Optional[Tuple[int, int, int, int]] = None
    output_rotation: int = 0
    manual_corners: Optional[np.ndarray] = None  # (4,2) in working coords (legacy)
    manual_quad_full: Optional[np.ndarray] = None  # (4,2) in original coords
    crop_padding: int = 8


@dataclass
class CropResult:
    rgba: Optional[np.ndarray] = None
    confidence: float = 0.0
    needs_manual: bool = False
    aspect: float = 0.0
    estimated_radius: float = 0.0
    orientation_deg: int = 0
    output_size_px: Tuple[int, int] = (0, 0)
    glare: float = 0.0
    damaged: bool = False
    crop_corners: List[List[float]] = field(default_factory=list)
    # Straightened preview the manual editor draws on, plus the 3x3 homography
    # (row-major) mapping edit-image pixels back to original-image pixels.
    edit_image: Optional[np.ndarray] = None
    edit_transform: List[float] = field(default_factory=list)
    reasons: List[str] = field(default_factory=list)
    stage_times: dict = field(default_factory=dict)
    error: Optional[str] = None


def run_crop(
    working: np.ndarray,
    original: np.ndarray,
    scale: float,
    opts: CropOptions,
) -> CropResult:
    res = CropResult()
    times = res.stage_times

    def _t(label, t0):
        times[label] = int((time.time() - t0) * 1000)

    if opts.manual_quad_full is not None:
        # Corners already mapped into original-image coordinates (the editor
        # works in a rectified preview space; the caller applies the homography).
        quad_full = order_corners(opts.manual_quad_full.astype(np.float32)).astype(np.float64)
        res.confidence = 1.0
        res.needs_manual = False
        validation = validate_quad(quad_full, original.shape, [1.0, 1.0, 1.0, 1.0])
        res.aspect = validation.aspect
        damaged = False
    elif opts.manual_corners is not None:
        quad_full = order_corners(opts.manual_corners.astype(np.float32)).astype(np.float64) * float(scale)
        res.confidence = 1.0
        res.needs_manual = False
        validation = validate_quad(quad_full, original.shape, [1.0, 1.0, 1.0, 1.0])
        res.aspect = validation.aspect
        damaged = False
    else:
        t = time.time()
        roi = rough_roi(working, opts.roi_hint)
        _t("localise", t)

        t = time.time()
        boundary = card_boundary(working, roi)
        _t("boundary", t)
        if boundary is None:
            res.error = "No trading card detected. Make sure the whole card is visible."
            return res

        t = time.time()
        fit = fit_card_quad(boundary.mask)
        _t("edges", t)
        if fit is None:
            quad_working = _fallback_quad(boundary.mask)
            support = [0.2, 0.2, 0.2, 0.2]
        else:
            quad_working = fit.quad
            support = fit.support
        if quad_working is None:
            res.error = "Could not find the card edges clearly. Try a plainer background."
            return res

        t = time.time()
        if boundary.from_segment:
            # The learned segmentation mask already hugs the true card edge.
            # Gradient refinement here can snap outward onto background texture
            # (wood grain), so trust the segmentation-derived quad instead.
            quad_full = order_corners(quad_working.astype(np.float32)).astype(np.float64) * float(scale)
        else:
            quad_full = refine_quad(quad_working, original, scale)
        _t("refine", t)

        validation = validate_quad(quad_full, original.shape, support, boundary.area_frac)
        res.confidence = validation.confidence
        res.aspect = validation.aspect
        res.reasons = validation.reasons
        res.needs_manual = (not validation.ok) or validation.confidence < CONFIDENCE_MANUAL_THRESHOLD
        quad_full = validation.quad
        damaged = boundary.damaged

    res.damaged = damaged

    # Build the straightened preview the manual editor draws on, with the card's
    # corners reported in that preview's pixel space and a homography back to the
    # original. On any failure, fall back to working-image coordinates so the
    # editor still functions on the raw photo.
    try:
        edit_bgr, inset, h_edit2orig = build_edit_view(original, quad_full)
        res.edit_image = edit_bgr
        res.crop_corners = inset.astype(np.float64).tolist()
        res.edit_transform = [float(v) for v in np.asarray(h_edit2orig, np.float64).flatten()]
    except Exception as exc:
        # The editor is meant to draw on the straightened card; only the raw photo
        # is left if this fails. Log loudly so a regression is visible in prod
        # instead of silently degrading the adjust-crop experience.
        import traceback

        print(f"[edit-view] rectification failed, falling back to raw photo: {exc}", flush=True)
        traceback.print_exc()
        res.edit_image = None
        res.crop_corners = (quad_full / float(scale)).astype(np.float64).tolist()
        res.edit_transform = []

    t = time.time()
    if opts.grading_safe:
        qg = order_corners(quad_full.astype(np.float32)).astype(np.float32)
        native_long = max(
            (np.linalg.norm(qg[1] - qg[0]) + np.linalg.norm(qg[2] - qg[3])) / 2.0,
            (np.linalg.norm(qg[3] - qg[0]) + np.linalg.norm(qg[2] - qg[1])) / 2.0,
        )
        target_long = int(min(GRADING_MAX_LONG, max(GRADING_MIN_LONG, native_long)))
        warp = warp_card(original, quad_full, target_long=target_long)
    else:
        warp = warp_card(original, quad_full, opts.output_size)
    _t("warp", t)

    t = time.time()
    upright, deg = orient_upright(warp.image)
    res.orientation_deg = deg
    # 90-degree swap moves the card rect dimensions but keeps the uniform margin.
    m = warp.card_rect[0]
    ch, cw = upright.shape[0] - 2 * m, upright.shape[1] - 2 * m
    card_rect = (m, m, cw, ch)
    upright, manual_deg = _apply_manual_rotation(upright, opts.output_rotation)
    if manual_deg in (90, 270):
        card_rect = (m, m, upright.shape[1] - 2 * m, upright.shape[0] - 2 * m)
    _t("orient", t)

    t = time.time()
    rgba, est_radius = build_alpha(upright, card_rect, opts.corner_radius, damaged)
    res.estimated_radius = est_radius
    _t("alpha", t)

    res.glare = glare_fraction(rgba)

    if not opts.grading_safe:
        t = time.time()
        rgba = enhance_clean(rgba)
        _t("enhance", t)

    t = time.time()
    pad = max(4, int(round(min(warp.image.shape[:2]) * 0.006)))
    rgba = exp.trim_and_pad(rgba, pad=pad)
    if opts.background is not None:
        rgb = exp.composite_solid(rgba, opts.background)
        rgba[:, :, :3] = rgb
        rgba[:, :, 3] = 255
    res.rgba = rgba
    res.output_size_px = (rgba.shape[1], rgba.shape[0])
    _t("export", t)

    return res


def build_edit_view(original: np.ndarray, quad_full: np.ndarray):
    """Rectify the card region of ``original`` into a straightened preview.

    Returns ``(edit_bgr, inset_corners, H_edit2orig)`` where ``inset_corners`` are
    the card's four corners (TL,TR,BR,BL) in the preview's pixel space and
    ``H_edit2orig`` is the 3x3 homography mapping preview pixels back to original
    pixels. The card is centred with a uniform margin so handles can be dragged
    slightly outward to recover a clipped edge.
    """
    q = order_corners(quad_full.astype(np.float32)).astype(np.float32)
    # If the ordered quad is non-finite or degenerate, recover an oriented box
    # from the raw points (minAreaRect) so we STILL rectify to a straight card
    # rather than dropping the editor back onto the raw angled photo.
    if not np.all(np.isfinite(q)) or cv2.contourArea(q) < 100.0:
        pts = np.asarray(quad_full, dtype=np.float32).reshape(-1, 2)
        pts = pts[np.isfinite(pts).all(axis=1)]
        if len(pts) >= 3:
            box = cv2.boxPoints(cv2.minAreaRect(pts)).astype(np.float32)
            q = order_corners(box).astype(np.float32)
        if not np.all(np.isfinite(q)) or cv2.contourArea(q) < 100.0:
            raise ValueError("degenerate quad — cannot build a straightened view")
    width = (np.linalg.norm(q[1] - q[0]) + np.linalg.norm(q[2] - q[3])) / 2.0
    height = (np.linalg.norm(q[3] - q[0]) + np.linalg.norm(q[2] - q[1])) / 2.0
    portrait = height >= width
    long_side = max(width, height, 1.0)
    short_side = max(min(width, height), 1.0)

    sc = EDIT_CARD_LONG / long_side
    card_long = EDIT_CARD_LONG
    card_short = max(1, int(round(short_side * sc)))
    cw, ch = (card_short, card_long) if portrait else (card_long, card_short)

    mg = int(round(max(cw, ch) * EDIT_MARGIN_FRAC))
    ew, eh = cw + 2 * mg, ch + 2 * mg
    inset = np.array(
        [
            [mg, mg],
            [mg + cw - 1, mg],
            [mg + cw - 1, mg + ch - 1],
            [mg, mg + ch - 1],
        ],
        dtype=np.float32,
    )

    m_orig2edit = cv2.getPerspectiveTransform(q, inset)
    edit_bgr = cv2.warpPerspective(
        original,
        m_orig2edit,
        (ew, eh),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    h_edit2orig = cv2.getPerspectiveTransform(inset, q)
    return edit_bgr, inset, h_edit2orig


def _apply_manual_rotation(rgba_or_bgr: np.ndarray, output_rotation: int):
    deg = (round(int(output_rotation) / 90) * 90) % 360
    if deg == 90:
        return cv2.rotate(rgba_or_bgr, cv2.ROTATE_90_CLOCKWISE), 90
    if deg == 180:
        return cv2.rotate(rgba_or_bgr, cv2.ROTATE_180), 180
    if deg == 270:
        return cv2.rotate(rgba_or_bgr, cv2.ROTATE_90_COUNTERCLOCKWISE), 270
    return rgba_or_bgr, 0


def _fallback_quad(mask: np.ndarray) -> Optional[np.ndarray]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    box = cv2.boxPoints(cv2.minAreaRect(c)).astype(np.float32)
    return order_corners(box).astype(np.float64)
