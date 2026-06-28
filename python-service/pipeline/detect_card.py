"""Dual-path card detection: segmentation, classical, scan mode, ensemble."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np

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
        return None

    candidates = [c for c in candidates if not _reject_blank_hallucination(working, c[1])]

    if not candidates:
        return None

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
