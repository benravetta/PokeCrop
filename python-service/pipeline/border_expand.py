"""Border expansion — detect and include the card's full physical border.

Problem: contour detection may lock onto either:
  (a) the artwork edge (inside the border) — needs outward expansion, OR
  (b) the card's physical border — already correct, should NOT expand

Strategy:
1. Check if the contour is already sitting on a strong edge (the card border).
   If so, the contour is already at the right place — minimal expansion needed.
2. If the contour is NOT on a strong edge (it's on the artwork boundary),
   probe outward to find the card's physical border.
3. When probing outward, find the FIRST significant gradient peak after a
   quiet zone (the border colour band), not the outermost peak (which could
   be the wrapper edge).
"""

import cv2
import numpy as np
from typing import Optional


def expand_to_card_border(
    contour: np.ndarray,
    image: np.ndarray,
) -> np.ndarray:
    """Expand a contour outward to include the card's full physical border.

    Detects whether the contour is already at the card edge (don't expand)
    or at the artwork edge (expand to the border).
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    mag_fine = _gradient_magnitude(gray)
    blurred = cv2.GaussianBlur(gray, (5, 5), 1.5)
    mag_coarse = _gradient_magnitude(blurred)
    mag = np.maximum(mag_fine, mag_coarse)

    pts = contour.reshape(-1, 2).astype(np.float64)
    n = len(pts)
    if n < 8:
        return contour

    rect = cv2.minAreaRect(contour)
    card_short = min(rect[1][0], rect[1][1])
    if card_short < 20:
        return contour

    # Step 1: Check if the contour is ALREADY on the card's outer edge.
    # Sample gradient values directly on the contour. If the contour sits
    # on a strong, consistent edge, it's likely already at the card border.
    on_edge_strength = _contour_edge_strength(pts, mag, h, w, n)

    if on_edge_strength > 0.6:
        # The contour is already on a strong edge — likely the card border.
        # Only do a tiny refinement (snap to nearest strong edge within ±5px).
        return _snap_to_nearest_edge(contour, mag, h, w, snap_range=5)

    # Step 2: The contour is NOT on a strong edge — it's probably on the
    # artwork boundary. Probe outward to find the card border.
    max_probe = max(int(card_short * 0.18), 25)
    max_probe = min(max_probe, 100)

    # Adaptive threshold
    contour_grad_samples = []
    for pt in pts[::max(1, n // 50)]:
        x, y = int(round(pt[0])), int(round(pt[1]))
        if 0 <= x < w and 0 <= y < h:
            contour_grad_samples.append(mag[y, x])

    if contour_grad_samples:
        baseline_grad = np.median(contour_grad_samples)
    else:
        baseline_grad = 50.0

    min_peak_strength = max(baseline_grad * 0.4, 35.0)

    sample_step = max(1, n // 200)
    raw_distances = np.full(n, np.nan)

    for i in range(0, n, sample_step):
        normal = _outward_normal(pts, i, n, contour)
        if normal is None:
            continue

        peak_d = _find_border_edge(
            pts[i], normal, mag, h, w, max_probe, min_peak_strength
        )
        if peak_d is not None:
            raw_distances[i] = peak_d

    valid_mask = ~np.isnan(raw_distances)
    valid_dists = raw_distances[valid_mask]
    if len(valid_dists) < 6:
        return contour

    median_dist = np.median(valid_dists)
    if median_dist < 2:
        return contour

    # Outlier rejection
    q25, q75 = np.percentile(valid_dists, 25), np.percentile(valid_dists, 75)
    iqr = q75 - q25
    lower = max(median_dist - max(iqr * 2.0, 8), 1)
    upper = median_dist + max(iqr * 2.0, 8)

    for i in range(n):
        if not np.isnan(raw_distances[i]):
            if raw_distances[i] < lower or raw_distances[i] > upper:
                raw_distances[i] = np.nan

    distances = _interpolate_and_smooth(raw_distances, kernel_size=max(n // 15, 7))

    # Small offset past the gradient peak to capture the full border edge
    distances = distances + 4

    expanded_pts = pts.copy()
    for i in range(n):
        normal = _outward_normal(pts, i, n, contour)
        if normal is None:
            continue
        expanded_pts[i] = pts[i] + normal * distances[i]

    expanded_pts[:, 0] = np.clip(expanded_pts[:, 0], 0, w - 1)
    expanded_pts[:, 1] = np.clip(expanded_pts[:, 1], 0, h - 1)

    # Sanity check: the expanded contour should not be MORE than 50% larger
    # in area than the original. If it is, the expansion went wrong.
    orig_area = cv2.contourArea(contour)
    expanded_contour = expanded_pts.reshape(-1, 1, 2).astype(np.int32)
    new_area = cv2.contourArea(expanded_contour)
    if orig_area > 0 and new_area / orig_area > 1.50:
        # Over-expansion — fall back to a gentle snap instead
        return _snap_to_nearest_edge(contour, mag, h, w, snap_range=8)

    return expanded_contour


def _contour_edge_strength(
    pts: np.ndarray, mag: np.ndarray, h: int, w: int, n: int
) -> float:
    """Measure what fraction of contour points sit on a strong gradient edge."""
    strong_count = 0
    total = 0
    threshold = 60.0

    for pt in pts[::max(1, n // 80)]:
        x, y = int(round(pt[0])), int(round(pt[1]))
        if 0 <= x < w and 0 <= y < h:
            total += 1
            # Check a small neighbourhood
            y1, y2 = max(0, y - 1), min(h, y + 2)
            x1, x2 = max(0, x - 1), min(w, x + 2)
            if np.max(mag[y1:y2, x1:x2]) > threshold:
                strong_count += 1

    if total == 0:
        return 0.0
    return strong_count / total


def _snap_to_nearest_edge(
    contour: np.ndarray, mag: np.ndarray, h: int, w: int, snap_range: int = 5
) -> np.ndarray:
    """Snap each contour point to the nearest strong gradient within snap_range pixels."""
    pts = contour.reshape(-1, 2).astype(np.float64)
    n = len(pts)
    result = pts.copy()

    for i in range(n):
        normal = _outward_normal(pts, i, n, contour)
        if normal is None:
            continue

        best_offset = 0.0
        best_val = 0.0

        for d in range(-snap_range, snap_range + 1):
            sx = int(round(pts[i][0] + normal[0] * d))
            sy = int(round(pts[i][1] + normal[1] * d))
            if 0 <= sx < w and 0 <= sy < h:
                val = mag[sy, sx]
                if val > best_val:
                    best_val = val
                    best_offset = float(d)

        if best_val > 30:
            result[i][0] = pts[i][0] + normal[0] * best_offset
            result[i][1] = pts[i][1] + normal[1] * best_offset

    return result.reshape(-1, 1, 2).astype(np.int32)


def _find_border_edge(
    start: np.ndarray,
    normal: np.ndarray,
    mag: np.ndarray,
    h: int, w: int,
    max_probe: int,
    min_strength: float,
) -> Optional[float]:
    """Find the card's border edge along the outward normal.

    When the contour is on the artwork edge, the outward profile looks like:
      [artwork edge (we're here)] → [quiet border colour band] → [card outer edge]

    We want the FIRST significant peak AFTER a quiet zone, not the outermost peak
    (which could be the wrapper edge) or the strongest (which is the artwork edge
    we're already on).
    """
    min_d = 3
    profile = []

    for d in range(min_d, max_probe + 1):
        sx = int(round(start[0] + normal[0] * d))
        sy = int(round(start[1] + normal[1] * d))
        if not (0 <= sx < w and 0 <= sy < h):
            break
        profile.append((d, float(mag[sy, sx])))

    if len(profile) < 5:
        return None

    # Find the first significant peak after a quiet zone.
    # A "quiet zone" is where gradient values drop below the threshold.
    in_quiet_zone = False

    for j in range(len(profile)):
        d, val = profile[j]
        if val < min_strength * 0.5:
            in_quiet_zone = True
        elif in_quiet_zone and val > min_strength:
            # Found a peak after a quiet zone — this is likely the card border
            return float(d)

    # Fallback: if no quiet zone was found, find the first peak
    for j in range(1, len(profile) - 1):
        d, val = profile[j]
        _, prev_val = profile[j - 1]
        _, next_val = profile[j + 1]
        if val >= prev_val and val >= next_val and val > min_strength:
            return float(d)

    return None


def _interpolate_and_smooth(
    distances: np.ndarray,
    kernel_size: int,
) -> np.ndarray:
    """Interpolate NaN values and smooth the distance array circularly."""
    n = len(distances)
    result = distances.copy()

    valid = ~np.isnan(result)
    if not np.any(valid):
        return np.full(n, 0.0)

    valid_indices = np.where(valid)[0]
    valid_values = result[valid]

    for i in range(n):
        if np.isnan(result[i]):
            dists_to_valid = np.minimum(
                np.abs(valid_indices - i),
                n - np.abs(valid_indices - i)
            )
            nearest_idx = np.argmin(dists_to_valid)
            result[i] = valid_values[nearest_idx]

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
