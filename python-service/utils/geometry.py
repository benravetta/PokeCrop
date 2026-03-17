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
    """Order 4 corners as: top-left, top-right, bottom-right, bottom-left."""
    pts = box.reshape(4, 2)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).flatten()
    ordered = np.zeros((4, 2), dtype=np.float32)
    ordered[0] = pts[np.argmin(s)]   # top-left
    ordered[2] = pts[np.argmax(s)]   # bottom-right
    ordered[1] = pts[np.argmin(d)]   # top-right
    ordered[3] = pts[np.argmax(d)]   # bottom-left
    return ordered
