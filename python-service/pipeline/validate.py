"""Stage: order/validate the quad and compute a confidence score.

Validates that the recovered quadrilateral is geometrically sensible before we
commit to a perspective transform, and produces a 0..1 confidence used to decide
whether to request manual corner adjustment. We never force the card aspect ratio
here — we only check it is *plausible*.
"""

from dataclasses import dataclass
from typing import List, Tuple

import cv2
import numpy as np

from utils.geometry import order_corners

CARD_RATIO = 63.0 / 88.0  # 0.7159 (short / long)


@dataclass
class Validation:
    ok: bool
    confidence: float
    quad: np.ndarray
    aspect: float
    reasons: List[str]
    touches_edge: bool


def validate_quad(
    quad: np.ndarray,
    image_shape: Tuple[int, int],
    edge_support: List[float],
    area_frac_hint: float = 0.0,
) -> Validation:
    h, w = image_shape[:2]
    reasons: List[str] = []
    q = order_corners(quad.astype(np.float32)).astype(np.float64)

    if not np.all(np.isfinite(q)):
        return Validation(False, 0.0, q, 0.0, ["non-finite corners"], False)

    # Convexity / non-self-intersecting.
    convex = bool(cv2.isContourConvex(q.astype(np.int32)))
    if not convex:
        reasons.append("not convex")

    # Side lengths and aspect.
    top = np.linalg.norm(q[1] - q[0])
    right = np.linalg.norm(q[2] - q[1])
    bottom = np.linalg.norm(q[3] - q[2])
    left = np.linalg.norm(q[0] - q[3])
    width = (top + bottom) / 2.0
    height = (left + right) / 2.0
    short, long = sorted([width, height])
    aspect = short / long if long > 0 else 0.0

    # Area as a fraction of the frame.
    area = cv2.contourArea(q.astype(np.float32))
    area_frac = area / float(h * w) if h * w > 0 else 0.0
    if area_frac < 0.02:
        reasons.append("card too small")
    if area_frac > 1.02:
        reasons.append("implausible area")

    # Opposite edges sensible (no extreme keystone).
    wh_skew = abs(top - bottom) / max(top, bottom, 1.0)
    hh_skew = abs(left - right) / max(left, right, 1.0)
    if wh_skew > 0.5 or hh_skew > 0.5:
        reasons.append("extreme perspective")

    # Inside the frame?
    margin = max(2.0, min(h, w) * 0.005)
    touches_edge = bool(
        q[:, 0].min() <= margin
        or q[:, 1].min() <= margin
        or q[:, 0].max() >= w - 1 - margin
        or q[:, 1].max() >= h - 1 - margin
    )

    # Aspect plausibility: cards are ~0.716; allow a wide band for perspective.
    aspect_plausible = 0.45 <= aspect <= 0.98

    # ── Confidence ──
    support = float(np.mean(edge_support)) if edge_support else 0.0
    support_score = float(np.clip(support, 0.0, 1.0))
    aspect_score = float(np.exp(-((aspect - CARD_RATIO) ** 2) / (2 * 0.12 ** 2)))
    skew_score = float(np.clip(1.0 - (wh_skew + hh_skew), 0.0, 1.0))
    area_score = 1.0 if 0.05 <= area_frac <= 1.0 else 0.3
    convex_score = 1.0 if convex else 0.0

    confidence = (
        support_score * 0.35
        + aspect_score * 0.25
        + skew_score * 0.15
        + area_score * 0.10
        + convex_score * 0.15
    )
    confidence = float(round(np.clip(confidence, 0.0, 1.0), 3))

    ok = (
        convex
        and aspect_plausible
        and 0.02 <= area_frac <= 1.02
        and wh_skew <= 0.6
        and hh_skew <= 0.6
    )

    return Validation(
        ok=ok,
        confidence=confidence,
        quad=q,
        aspect=float(round(aspect, 4)),
        reasons=reasons,
        touches_edge=touches_edge,
    )
