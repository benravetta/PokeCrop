"""Dual-path card detection: segmentation, classical, scan mode, ensemble."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np

from pipeline import segment
from pipeline.boundary import Boundary, card_boundary, classical_boundary, scan_boundary
from pipeline.edges import fit_card_quad
from pipeline.localise import rough_roi
from pipeline.refine_edges import refine_quad
from pipeline.validate import Validation, validate_quad
from utils.geometry import order_corners

CONFIDENCE_MANUAL_THRESHOLD = 0.50
CONFIDENCE_AUTO_THRESHOLD = 0.70
ENSEMBLE_DISAGREE = 0.15
# Scan inset is only valid when the card (or candidates) nearly fill the frame.
FULLBLEED_AREA = 0.85


def strict_gating_enabled() -> bool:
    return os.environ.get("CROP_STRICT_GATING", "1") != "0"


def ensemble_enabled() -> bool:
    return os.environ.get("CROP_ENSEMBLE", "1") != "0"


@dataclass
class DetectionResult:
    quad_full: np.ndarray
    validation: Validation
    damaged: bool
    detection_path: str
    scan_mode: bool
    needs_manual: bool
    needs_review: bool
    reasons: List[str]


def _quad_area_frac(quad: np.ndarray, shape) -> float:
    h, w = shape[:2]
    if h <= 0 or w <= 0:
        return 0.0
    return float(cv2.contourArea(quad.astype(np.float32))) / float(h * w)


def _reject_blank_hallucination(working: np.ndarray, quad: np.ndarray) -> bool:
    """True when a large quad on an empty desk is almost certainly a false positive."""
    gray = cv2.cvtColor(working, cv2.COLOR_BGR2GRAY)
    std = float(gray.std())
    lap = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    area = _quad_area_frac(quad, working.shape)
    return std < 8.0 and lap < 35.0 and area > 0.25


def _maybe_add_scan_candidate(
    working: np.ndarray,
    original: np.ndarray,
    scale: float,
    candidates: List[Tuple[str, np.ndarray, Validation, bool, bool]],
) -> None:
    if not candidates:
        return
    max_area = max(_quad_area_frac(c[1], working.shape) for c in candidates)
    if max_area < FULLBLEED_AREA:
        return
    scan_b = scan_boundary(working)
    if scan_b is None:
        return
    parsed = _quad_from_boundary(scan_b, working, original, scale)
    if parsed is None:
        return
    q, v, damaged = parsed
    candidates.append(("scan", q, v, damaged, True))


def _pick_best_candidate(
    candidates: List[Tuple[str, np.ndarray, Validation, bool, bool]],
    working: np.ndarray,
) -> Tuple[str, np.ndarray, Validation, bool, bool]:
    max_area = max(_quad_area_frac(c[1], working.shape) for c in candidates)
    scan_cands = [c for c in candidates if c[4]]
    if scan_cands and max_area >= FULLBLEED_AREA:
        scan_cands.sort(key=lambda c: c[2].confidence, reverse=True)
        return scan_cands[0]
    pool = [c for c in candidates if not c[4]] or candidates
    pool.sort(key=lambda c: c[2].confidence, reverse=True)
    return pool[0]


def _quad_from_boundary(
    boundary: Boundary,
    working: np.ndarray,
    original: np.ndarray,
    scale: float,
) -> Optional[Tuple[np.ndarray, Validation, bool]]:
    fit = fit_card_quad(boundary.mask)
    if fit is None:
        quad_working = _fallback_quad(boundary.mask)
        support = [0.2, 0.2, 0.2, 0.2]
    else:
        quad_working = fit.quad
        support = fit.support
    if quad_working is None:
        return None

    if boundary.from_segment and not boundary.scan_mode:
        quad_full = order_corners(quad_working.astype(np.float32)).astype(np.float64) * float(scale)
    else:
        quad_full = refine_quad(quad_working, original, scale)

    validation = validate_quad(quad_full, original.shape, support, boundary.area_frac)
    return quad_full, validation, boundary.damaged


def detect_card_quad(
    working: np.ndarray,
    original: np.ndarray,
    scale: float,
    roi_hint: Optional[Tuple[int, int, int, int]] = None,
    force_review: bool = False,
) -> Optional[DetectionResult]:
    roi = rough_roi(working, roi_hint)
    candidates: List[Tuple[str, np.ndarray, Validation, bool, bool]] = []

    if ensemble_enabled():
        seg_b = card_boundary(working, roi)
        if seg_b is not None:
            parsed = _quad_from_boundary(seg_b, working, original, scale)
            if parsed:
                q, v, damaged = parsed
                candidates.append(("segment", q, v, damaged, seg_b.scan_mode))

        class_b = classical_boundary(working, roi)
        if class_b is not None:
            parsed = _quad_from_boundary(class_b, working, original, scale)
            if parsed:
                q, v, damaged = parsed
                candidates.append(("classical", q, v, damaged, class_b.scan_mode))

        # Learned segmentation oriented-box: a background-independent straightener
        # for a card that sits within the frame with a visible margin (the case
        # classical/GrabCut mishandles on wood, playmats and low-contrast desks).
        # Skipped when it hugs the frame edge (likely a full-bleed scan whose own
        # border the mask can clip — those defer to the scan/classical paths).
        seg_box = _segment_card_quad(working, original, scale)
        if seg_box is not None and not seg_box[1].touches_edge:
            q, v, damaged = seg_box
            candidates.append(("segment_box", q, v, damaged, False))

        _maybe_add_scan_candidate(working, original, scale, candidates)
    else:
        boundary = card_boundary(working, roi)
        if boundary is not None:
            parsed = _quad_from_boundary(boundary, working, original, scale)
            if parsed:
                q, v, damaged = parsed
                path = "scan" if boundary.scan_mode else ("segment" if boundary.from_segment else "classical")
                candidates.append((path, q, v, damaged, boundary.scan_mode))

    if not candidates:
        return _segment_fallback(working, original, scale)

    candidates = [c for c in candidates if not _reject_blank_hallucination(working, c[1])]

    if not candidates:
        return _segment_fallback(working, original, scale)

    path, quad_full, validation, damaged, scan_mode = _pick_best_candidate(candidates, working)
    detection_path = path

    if len(candidates) >= 2:
        delta = abs(candidates[0][2].confidence - candidates[1][2].confidence)
        if delta > ENSEMBLE_DISAGREE:
            detection_path = "ensemble"
            force_review = True

    manual_threshold = CONFIDENCE_MANUAL_THRESHOLD if strict_gating_enabled() else 0.45
    auto_threshold = CONFIDENCE_AUTO_THRESHOLD if strict_gating_enabled() else 0.45

    needs_manual = (not validation.ok) or validation.confidence < manual_threshold
    needs_review = (
        strict_gating_enabled()
        and not needs_manual
        and (validation.confidence < auto_threshold or force_review)
    )

    return DetectionResult(
        quad_full=validation.quad,
        validation=validation,
        damaged=damaged,
        detection_path=detection_path,
        scan_mode=scan_mode,
        needs_manual=needs_manual,
        needs_review=needs_review,
        reasons=validation.reasons,
    )


def _fallback_quad(mask: np.ndarray) -> Optional[np.ndarray]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    box = cv2.boxPoints(cv2.minAreaRect(c)).astype(np.float32)
    return order_corners(box).astype(np.float64)


def _is_damaged_contour(contour: np.ndarray) -> bool:
    """Irregular outline → solidity well below a clean rounded rectangle."""
    area = cv2.contourArea(contour)
    hull_area = cv2.contourArea(cv2.convexHull(contour))
    if hull_area <= 0:
        return False
    return (area / hull_area) < 0.90


def _segment_card_quad(
    working: np.ndarray,
    original: np.ndarray,
    scale: float,
) -> Optional[Tuple[np.ndarray, Validation, bool]]:
    """Oriented card box from the learned segmentation mask.

    Returns ``(quad_full, validation, damaged)`` or None. The minimum-area
    rectangle of the segmented card is a straight, background-independent quad,
    so warping to it straightens the card on any surface. None is returned when
    the segmentation model is unavailable or finds no plausible card-sized blob
    (so a genuinely empty scene still reports no card).
    """
    try:
        mask = segment.card_mask(working, min_area_frac=0.03)
    except Exception:
        mask = None
    if mask is None:
        return None

    h, w = working.shape[:2]
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    area_frac = float(cv2.contourArea(c)) / float(h * w) if h * w > 0 else 0.0
    if area_frac < 0.03:
        return None

    box = cv2.boxPoints(cv2.minAreaRect(c)).astype(np.float32)
    quad_working = order_corners(box).astype(np.float64)
    quad_full = quad_working * float(scale)
    # The segmentation edge is a strong, model-backed signal, so credit the box
    # with high edge support; validate_quad still gates aspect/convexity/area.
    validation = validate_quad(quad_full, original.shape, [0.8, 0.8, 0.8, 0.8], area_frac)
    damaged = area_frac < 0.85 and _is_damaged_contour(c)
    return quad_full, validation, damaged


def _segment_fallback(
    working: np.ndarray,
    original: np.ndarray,
    scale: float,
) -> Optional[DetectionResult]:
    """Guaranteed straightened crop when every other path failed.

    Uses the learned segmentation box so a real card on a hard background still
    yields a usable, straightened result (flagged ``needs_manual`` so the editor
    invites a quick corner check). Returns None only when segmentation finds no
    plausible card — genuinely empty scenes keep reporting no card.
    """
    seg_box = _segment_card_quad(working, original, scale)
    if seg_box is None:
        return None
    quad_full, validation, damaged = seg_box
    reasons = list(validation.reasons)
    reasons.append("low-confidence crop from segmentation — check the corners")
    return DetectionResult(
        quad_full=validation.quad,
        validation=validation,
        damaged=damaged,
        detection_path="segment_fallback",
        scan_mode=False,
        needs_manual=True,
        needs_review=True,
        reasons=reasons,
    )
