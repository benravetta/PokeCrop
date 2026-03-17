"""Border expansion — detect and include the card's coloured border.

Problem: contour detection often locks onto the artwork edge (high contrast
between printed art and the card border) rather than the card's outer edge.

Strategy: from the detected contour, probe outward along normals and find the
strongest gradient peak — this is the card's physical border-to-background
transition.  Each contour point is expanded individually to its own peak,
then smoothed to prevent jagged edges.
"""

import cv2
import numpy as np
from typing import Optional, List


def expand_to_card_border(
    contour: np.ndarray,
    image: np.ndarray,
) -> np.ndarray:
    """Expand a contour outward to include the card's coloured border.

    Uses per-point strongest-gradient expansion with smoothing.
    Returns the original contour unchanged if no consistent border is detected.
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mag = _gradient_magnitude(gray)

    pts = contour.reshape(-1, 2).astype(np.float64)
    n = len(pts)
    if n < 8:
        return contour

    rect = cv2.minAreaRect(contour)
    card_short = min(rect[1][0], rect[1][1])
    if card_short < 20:
        return contour

    max_probe = max(int(card_short * 0.12), 20)
    max_probe = min(max_probe, 80)

    # Phase 1: find the strongest gradient peak for each sampled point
    sample_step = max(1, n // 120)
    raw_distances = np.full(n, np.nan)

    for i in range(0, n, sample_step):
        normal = _outward_normal(pts, i, n, contour)
        if normal is None:
            continue

        peak_d = _find_strongest_edge(pts[i], normal, mag, h, w, max_probe)
        if peak_d is not None:
            raw_distances[i] = peak_d

    # Count valid samples
    valid_mask = ~np.isnan(raw_distances)
    valid_dists = raw_distances[valid_mask]
    if len(valid_dists) < 8:
        return contour

    median_dist = np.median(valid_dists)
    if median_dist < 3:
        return contour

    # Phase 2: outlier rejection — remove distances that deviate too far
    q25, q75 = np.percentile(valid_dists, 25), np.percentile(valid_dists, 75)
    iqr = q75 - q25
    lower = max(median_dist - max(iqr * 2.0, 8), 3)
    upper = median_dist + max(iqr * 2.0, 8)

    # Replace outliers with NaN so they get interpolated
    for i in range(n):
        if not np.isnan(raw_distances[i]):
            if raw_distances[i] < lower or raw_distances[i] > upper:
                raw_distances[i] = np.nan

    # Phase 3: interpolate missing values and smooth
    distances = _interpolate_and_smooth(raw_distances, kernel_size=max(n // 20, 5))

    # Add an offset past the peak centre to reach the outer edge of the
    # gradient transition (the peak is at the middle of the edge, not the outside)
    distances = distances + 8

    # Phase 4: expand each point along its normal
    expanded_pts = pts.copy()
    for i in range(n):
        normal = _outward_normal(pts, i, n, contour)
        if normal is None:
            continue
        expanded_pts[i] = pts[i] + normal * distances[i]

    expanded_pts[:, 0] = np.clip(expanded_pts[:, 0], 0, w - 1)
    expanded_pts[:, 1] = np.clip(expanded_pts[:, 1], 0, h - 1)

    return expanded_pts.reshape(-1, 1, 2).astype(np.int32)


def _find_strongest_edge(
    start: np.ndarray,
    normal: np.ndarray,
    mag: np.ndarray,
    h: int, w: int,
    max_probe: int,
) -> Optional[float]:
    """Find the strongest gradient peak along the outward normal.

    Skips the first few pixels (the artwork edge the contour sits on).
    """
    min_d = 5
    best_d = None
    best_val = 0.0

    for d in range(min_d, max_probe + 1):
        sx = int(round(start[0] + normal[0] * d))
        sy = int(round(start[1] + normal[1] * d))
        if not (0 <= sx < w and 0 <= sy < h):
            break

        val = float(mag[sy, sx])
        if val > best_val:
            best_val = val
            best_d = d

    if best_d is not None and best_val > 80:
        return float(best_d)

    return None


def _interpolate_and_smooth(
    distances: np.ndarray,
    kernel_size: int,
) -> np.ndarray:
    """Interpolate NaN values and smooth the distance array.

    The contour is circular, so we use circular interpolation and smoothing.
    """
    n = len(distances)
    result = distances.copy()

    # Interpolate NaN values from nearest valid neighbours
    valid = ~np.isnan(result)
    if not np.any(valid):
        return np.full(n, 0.0)

    valid_indices = np.where(valid)[0]
    valid_values = result[valid]

    for i in range(n):
        if np.isnan(result[i]):
            # Find nearest valid neighbours (circular)
            dists_to_valid = np.minimum(
                np.abs(valid_indices - i),
                n - np.abs(valid_indices - i)
            )
            nearest_idx = np.argmin(dists_to_valid)
            result[i] = valid_values[nearest_idx]

    # Smooth with a circular moving average
    if kernel_size < 3:
        kernel_size = 3
    if kernel_size % 2 == 0:
        kernel_size += 1

    padded = np.concatenate([result[-kernel_size:], result, result[:kernel_size]])
    kernel = np.ones(kernel_size) / kernel_size
    smoothed = np.convolve(padded, kernel, mode='same')
    result = smoothed[kernel_size:kernel_size + n]

    return result


def _outward_normal(
    pts: np.ndarray,
    i: int,
    n: int,
    contour: np.ndarray,
) -> Optional[np.ndarray]:
    """Compute the outward-pointing normal at contour point i."""
    span = max(3, n // 50)
    prev_pt = pts[(i - span) % n]
    next_pt = pts[(i + span) % n]
    tangent = next_pt - prev_pt
    length = np.linalg.norm(tangent)
    if length < 1e-6:
        return None
    tangent /= length

    normal = np.array([-tangent[1], tangent[0]])

    test_pt = pts[i] + normal * 5
    if cv2.pointPolygonTest(contour, (float(test_pt[0]), float(test_pt[1])), False) >= 0:
        normal = -normal

    return normal


def _gradient_magnitude(gray: np.ndarray) -> np.ndarray:
    gx = cv2.Scharr(gray, cv2.CV_64F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_64F, 0, 1)
    return np.sqrt(gx ** 2 + gy ** 2)
