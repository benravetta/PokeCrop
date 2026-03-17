"""Border expansion — detect and include the card's coloured border.

Problem: contour detection often locks onto the artwork edge (high contrast
between printed art and the card border) rather than the card's outer edge
(lower contrast between border and wrapper/background).

Solution: from the detected contour, probe outward along normals.  If we find
a uniform-colour band (the card border), expand the contour to the outer edge
of that band — where the card border meets the background/wrapper.
"""

import cv2
import numpy as np
from typing import Optional


def expand_to_card_border(
    contour: np.ndarray,
    image: np.ndarray,
) -> np.ndarray:
    """Expand a contour outward to include the card's coloured border.

    Strategy: from the detected contour (which typically sits on the artwork
    edge), probe outward along normals.  If a uniform-colour border band
    exists, find the outermost strong gradient within or just beyond that
    band — that's the card's physical outer edge.

    Returns the original contour unchanged if no border band is detected.
    """
    h, w = image.shape[:2]
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float64)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mag = _gradient_magnitude(gray)

    pts = contour.reshape(-1, 2).astype(np.float64)
    n = len(pts)
    if n < 8:
        return contour

    border_lab = _sample_border_colour(contour, image, lab)
    if border_lab is None:
        return contour

    # For each sampled contour point, find the outer card edge by looking
    # for the outermost gradient peak within the border-colour zone.
    max_probe = 70
    expansions = []

    for i in range(0, n, max(1, n // 60)):
        normal = _outward_normal(pts, i, n, contour)
        if normal is None:
            continue

        outer_d = _find_outer_card_edge(
            pts[i], normal, lab, border_lab, mag, h, w, max_probe
        )
        if outer_d is not None and outer_d > 3:
            expansions.append(outer_d)

    if len(expansions) < 8:
        return contour

    dists_arr = np.array(expansions)
    median_dist = np.median(dists_arr)

    if median_dist < 5:
        return contour

    # Filter outliers: remove expansions that deviate too far from median
    iqr = np.percentile(dists_arr, 75) - np.percentile(dists_arr, 25)
    lower = median_dist - max(iqr * 1.5, 10)
    upper = median_dist + max(iqr * 1.5, 10)
    filtered = dists_arr[(dists_arr >= lower) & (dists_arr <= upper)]
    if len(filtered) > 4:
        median_dist = np.median(filtered)

    expanded_pts = pts.copy()
    for i in range(n):
        normal = _outward_normal(pts, i, n, contour)
        if normal is None:
            continue
        expanded_pts[i] = pts[i] + normal * median_dist

    expanded_pts[:, 0] = np.clip(expanded_pts[:, 0], 0, w - 1)
    expanded_pts[:, 1] = np.clip(expanded_pts[:, 1], 0, h - 1)

    return expanded_pts.reshape(-1, 1, 2).astype(np.int32)


def _sample_border_colour(
    contour: np.ndarray,
    image: np.ndarray,
    lab: np.ndarray,
) -> Optional[np.ndarray]:
    """Sample the dominant colour in a thin band just outside the contour."""
    h, w = image.shape[:2]
    pts = contour.reshape(-1, 2).astype(np.float64)
    n = len(pts)

    samples = []
    for i in range(0, n, max(1, n // 40)):
        normal = _outward_normal(pts, i, n, contour)
        if normal is None:
            continue

        # Sample 5-15px outside the contour
        for d in range(5, 16, 2):
            sx = int(round(pts[i][0] + normal[0] * d))
            sy = int(round(pts[i][1] + normal[1] * d))
            if 0 <= sx < w and 0 <= sy < h:
                samples.append(lab[sy, sx])

    if len(samples) < 20:
        return None

    samples_arr = np.array(samples)

    # Check if the samples are reasonably uniform (a real border band).
    # Lightness (L) can vary significantly due to wrapper reflections/shadows,
    # so we're more lenient on L and stricter on chromaticity (a, b).
    std_l = np.std(samples_arr[:, 0])
    std_a = np.std(samples_arr[:, 1])
    std_b = np.std(samples_arr[:, 2])

    if std_a > 25 or std_b > 25:
        return None

    # Even if L varies a lot, if chromaticity is tight it's a real border
    if std_l > 50 and (std_a > 15 or std_b > 15):
        return None

    return np.median(samples_arr, axis=0)


def _find_outer_card_edge(
    start: np.ndarray,
    normal: np.ndarray,
    lab: np.ndarray,
    border_lab: np.ndarray,
    mag: np.ndarray,
    h: int, w: int,
    max_probe: int,
) -> Optional[float]:
    """Find the outer edge of the card by combining colour and gradient info.

    Walks outward through the border-colour zone, collecting gradient peaks.
    Returns the outermost gradient peak that's still within (or at the edge of)
    the border-colour band.  This is the card's physical outer edge.
    """
    gradient_peaks = []
    in_border_zone = True
    border_exit_d = None

    for d in range(2, max_probe):
        sx = int(round(start[0] + normal[0] * d))
        sy = int(round(start[1] + normal[1] * d))
        if not (0 <= sx < w and 0 <= sy < h):
            break

        # Check colour match
        pixel_lab = lab[sy, sx]
        chroma_dist = np.sqrt(
            (pixel_lab[1] - border_lab[1]) ** 2 +
            (pixel_lab[2] - border_lab[2]) ** 2
        )

        is_border_colour = chroma_dist < 25

        # Track gradient peaks
        grad_val = mag[sy, sx]
        if grad_val > 40:
            gradient_peaks.append((d, grad_val))

        if not is_border_colour and in_border_zone and d > 5:
            border_exit_d = float(d)
            in_border_zone = False
            # Continue a bit past the border to catch the edge gradient
            if d > max_probe * 0.8:
                break

        # Stop searching well past the border zone
        if border_exit_d is not None and d > border_exit_d + 10:
            break

    if not gradient_peaks:
        return border_exit_d

    if border_exit_d is not None:
        # Find the gradient peak closest to (and not far past) the border exit
        best_peak = None
        best_score = -1
        for peak_d, peak_val in gradient_peaks:
            # Prefer peaks near the border exit, penalise peaks far inside
            proximity = max(0, 1.0 - abs(peak_d - border_exit_d) / 15.0)
            # Prefer peaks that are outward (positive offset from border exit)
            outward_bonus = 0.2 if peak_d >= border_exit_d - 3 else 0.0
            score = (peak_val / 500.0) * 0.3 + proximity * 0.5 + outward_bonus
            if score > best_score:
                best_score = score
                best_peak = peak_d
        return best_peak

    # No clear border exit found — take the outermost strong gradient
    # that's within the border zone
    for peak_d, peak_val in reversed(gradient_peaks):
        if peak_val > 60:
            return float(peak_d)

    return None


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
