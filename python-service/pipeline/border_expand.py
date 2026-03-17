"""Border expansion — detect and include the card's coloured border.

Problem: contour detection often locks onto the artwork edge (high contrast
between printed art and the card border) rather than the card's outer edge
(lower contrast between border and wrapper/background).

Strategy: from the detected contour, probe outward along normals looking for
the card's physical outer edge.  The outer edge is characterised by:
  - A strong gradient peak (card border → background/wrapper transition)
  - Located beyond the initial artwork edge
  - At a consistent distance around the card perimeter

We look for the OUTERMOST strong gradient peak within a reasonable range,
then use the median distance for uniform expansion.
"""

import cv2
import numpy as np
from typing import Optional, List, Tuple


def expand_to_card_border(
    contour: np.ndarray,
    image: np.ndarray,
) -> np.ndarray:
    """Expand a contour outward to include the card's coloured border.

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

    # Maximum expansion: ~8% of the card's short dimension.
    # Standard trading card border is ~3-5% of card width.
    max_expansion = max(int(card_short * 0.10), 15)
    max_expansion = min(max_expansion, 80)

    sample_count = max(60, min(n // 2, 120))
    expansions: List[float] = []

    for i in range(0, n, max(1, n // sample_count)):
        normal = _outward_normal(pts, i, n, contour)
        if normal is None:
            continue

        outer_d = _find_outer_edge(
            pts[i], normal, mag, h, w, max_expansion
        )
        if outer_d is not None and outer_d > 2:
            expansions.append(outer_d)

    if len(expansions) < 6:
        return contour

    dists_arr = np.array(expansions)
    median_dist = np.median(dists_arr)

    if median_dist < 3:
        return contour

    # Filter outliers using IQR
    q25, q75 = np.percentile(dists_arr, 25), np.percentile(dists_arr, 75)
    iqr = q75 - q25
    lower = max(median_dist - max(iqr * 1.5, 8), 2)
    upper = median_dist + max(iqr * 1.5, 8)
    filtered = dists_arr[(dists_arr >= lower) & (dists_arr <= upper)]
    if len(filtered) > 4:
        median_dist = np.median(filtered)

    # Sanity check: don't expand more than max_expansion
    median_dist = min(median_dist, max_expansion)

    expanded_pts = pts.copy()
    for i in range(n):
        normal = _outward_normal(pts, i, n, contour)
        if normal is None:
            continue
        expanded_pts[i] = pts[i] + normal * median_dist

    expanded_pts[:, 0] = np.clip(expanded_pts[:, 0], 0, w - 1)
    expanded_pts[:, 1] = np.clip(expanded_pts[:, 1], 0, h - 1)

    return expanded_pts.reshape(-1, 1, 2).astype(np.int32)


def _find_outer_edge(
    start: np.ndarray,
    normal: np.ndarray,
    mag: np.ndarray,
    h: int, w: int,
    max_probe: int,
) -> Optional[float]:
    """Find the card's outer edge by looking for the outermost strong gradient
    peak within the probe range.

    The gradient profile outward from the artwork edge typically shows:
    1. The artwork edge itself (d≈0, which we skip)
    2. The card border (relatively uniform, low gradient)
    3. The card outer edge (strong gradient — border-to-background transition)
    4. Background/wrapper (low gradient)

    We want peak #3.
    """
    # Collect gradient values along the normal
    profile: List[Tuple[int, float]] = []
    for d in range(2, max_probe + 1):
        sx = int(round(start[0] + normal[0] * d))
        sy = int(round(start[1] + normal[1] * d))
        if not (0 <= sx < w and 0 <= sy < h):
            break
        profile.append((d, float(mag[sy, sx])))

    if len(profile) < 5:
        return None

    # Find gradient peaks (local maxima above a threshold)
    min_strength = 30
    peaks: List[Tuple[int, float]] = []

    for idx in range(1, len(profile) - 1):
        d, val = profile[idx]
        _, prev_val = profile[idx - 1]
        _, next_val = profile[idx + 1]
        if val > min_strength and val >= prev_val and val >= next_val:
            peaks.append((d, val))

    if not peaks:
        # No clear peaks — try the strongest gradient point
        best_d, best_val = max(profile, key=lambda x: x[1])
        if best_val > min_strength:
            return float(best_d)
        return None

    # Prefer the outermost strong peak.  "Strong" means at least 40% of the
    # maximum peak strength, to avoid noise.
    max_peak_val = max(p[1] for p in peaks)
    strong_threshold = max_peak_val * 0.35

    # Take the outermost peak that's strong enough
    best = None
    for d, val in reversed(peaks):
        if val >= strong_threshold:
            best = d
            break

    if best is not None:
        return float(best)

    # Fallback: strongest peak
    return float(max(peaks, key=lambda x: x[1])[0])


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
