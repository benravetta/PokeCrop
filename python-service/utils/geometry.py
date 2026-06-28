"""Geometry helpers for card detection and shape analysis."""

import cv2
import numpy as np
from typing import Tuple

TRADING_CARD_RATIO = 2.5 / 3.5  # width / height ≈ 0.714


def aspect_ratio_score(rect_wh: Tuple[float, float]) -> float:
    """Score how close a width/height pair is to standard trading card ratio.

    Uses a Gaussian-like falloff so near-misses still score reasonably.
    """
    w, h = sorted(rect_wh)
    if h == 0:
        return 0.0
    ratio = w / h
    diff = abs(ratio - TRADING_CARD_RATIO)
    # Gaussian falloff: σ ≈ 0.15 gives good discrimination
    return float(np.exp(-(diff ** 2) / (2 * 0.15 ** 2)))


def rectangularity(contour: np.ndarray) -> float:
    """Ratio of contour area to its minimum bounding rectangle area."""
    area = cv2.contourArea(contour)
    rect = cv2.minAreaRect(contour)
    rect_area = rect[1][0] * rect[1][1]
    if rect_area == 0:
        return 0.0
    return min(area / rect_area, 1.0)


def contour_smoothness(contour: np.ndarray) -> float:
    """Ratio of convex hull perimeter to contour perimeter.

    A smooth contour (card edge) has ratio close to 1.0.
    A jagged contour (wrapper with reflections) has ratio < 1.0.
    """
    peri = cv2.arcLength(contour, True)
    hull = cv2.convexHull(contour)
    hull_peri = cv2.arcLength(hull, True)
    if hull_peri == 0 or peri == 0:
        return 0.0
    return min(hull_peri / peri, 1.0)


def centrality(contour: np.ndarray, img_shape: Tuple[int, int]) -> float:
    """Score how centred the contour centroid is in the image."""
    M = cv2.moments(contour)
    if M["m00"] == 0:
        return 0.0
    cx = M["m10"] / M["m00"]
    cy = M["m01"] / M["m00"]
    h, w = img_shape[:2]
    dx = abs(cx - w / 2) / (w / 2)
    dy = abs(cy - h / 2) / (h / 2)
    return max(0.0, 1.0 - (dx + dy) / 2)


def contour_iou(c1: np.ndarray, c2: np.ndarray, img_shape: Tuple[int, int]) -> float:
    """Compute IoU between two contours by rasterising masks."""
    mask1 = np.zeros(img_shape[:2], dtype=np.uint8)
    mask2 = np.zeros(img_shape[:2], dtype=np.uint8)
    cv2.drawContours(mask1, [c1], -1, 255, -1)
    cv2.drawContours(mask2, [c2], -1, 255, -1)
    intersection = np.count_nonzero(mask1 & mask2)
    union = np.count_nonzero(mask1 | mask2)
    if union == 0:
        return 0.0
    return intersection / union


def order_corners(box: np.ndarray) -> np.ndarray:
    """Order 4 corners as: top-left, top-right, bottom-right, bottom-left.

    Uses a left/right split rather than the classic sum/diff trick. The sum/diff
    method (TL=min(x+y), TR=min(y-x), ...) can assign the SAME point to two roles
    once the quad is noticeably rotated, yielding a degenerate quad with duplicate
    corners — which makes cv2.getPerspectiveTransform raise. That broke the
    straightened edit-preview for angled cards (it silently fell back to the raw
    photo). Splitting the points into the two leftmost and two rightmost, then
    ordering each pair top-to-bottom, is stable for any realistic in-plane
    rotation and never duplicates a corner.
    """
    pts = np.asarray(box, dtype=np.float64).reshape(4, 2)
    by_x = pts[np.argsort(pts[:, 0], kind="stable")]
    left = by_x[:2]
    right = by_x[2:]
    tl, bl = left[np.argsort(left[:, 1], kind="stable")]
    tr, br = right[np.argsort(right[:, 1], kind="stable")]
    return np.array([tl, tr, br, bl], dtype=np.float32)


def expand_quad_outward(
    quad: np.ndarray,
    image_shape: Tuple[int, int],
    frac: float = 0.012,
) -> np.ndarray:
    """Scale a quad slightly outward from its centre so the warp keeps the full cut edge.

    Segmentation often hugs the inner frame; a ~1% outward bias preserves the outer
    silver border for centering without meaningfully increasing background area.
    """
    h, w = image_shape[:2]
    q = order_corners(np.asarray(quad, dtype=np.float64).reshape(4, 2))
    centre = q.mean(axis=0)
    scale = 1.0 + max(0.0, float(frac))
    out = centre + (q - centre) * scale
    out[:, 0] = np.clip(out[:, 0], 0.0, float(w - 1))
    out[:, 1] = np.clip(out[:, 1], 0.0, float(h - 1))
    return out.astype(np.float64)


def quad_area_frac(quad: np.ndarray, image_shape: Tuple[int, int]) -> float:
    h, w = image_shape[:2]
    if h <= 0 or w <= 0:
        return 0.0
    return float(cv2.contourArea(np.asarray(quad, dtype=np.float32).reshape(4, 2))) / float(h * w)
