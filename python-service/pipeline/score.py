"""Stage 3: Candidate scoring — identify the true front card.

Key discrimination signals:
- Front card: complete rectangular border, high interior variance, nested inside
  wrapper, no card-shaped child inside it.
- Rear/backing card: INCOMPLETE border (occluded by front card), lower interior
  variance (only edge strips visible), similar size to front card.
- Wrapper: outermost contour, lower rectangularity, soft/irregular edges,
  contains a card-shaped child.
"""

import cv2
import numpy as np
from typing import List, Tuple
from utils.geometry import (
    aspect_ratio_score,
    rectangularity,
    contour_smoothness,
    centrality,
)
from utils.colour import region_variance


def score_candidates(
    candidates: List[np.ndarray],
    image: np.ndarray,
) -> List[Tuple[int, float, dict]]:
    """Score each candidate and return sorted list of (index, score, breakdown)."""
    if not candidates:
        return []

    h, w = image.shape[:2]
    img_area = h * w
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Pre-compute masks for all candidates (used for containment checks)
    masks = []
    areas = []
    for cnt in candidates:
        m = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(m, [cnt], -1, 255, -1)
        masks.append(m)
        areas.append(np.count_nonzero(m))

    results = []

    for i, cnt in enumerate(candidates):
        breakdown = {}

        rect = cv2.minAreaRect(cnt)
        breakdown["aspect"] = aspect_ratio_score(rect[1])
        breakdown["rectangularity"] = rectangularity(cnt)
        breakdown["smoothness"] = contour_smoothness(cnt)
        breakdown["centrality"] = centrality(cnt, image.shape)

        # --- Size: prefer the mid-range (not wrapper-sized, not tiny) ---
        rel_size = areas[i] / img_area
        if rel_size > 0.85:
            breakdown["size"] = 0.15
        elif rel_size > 0.70:
            breakdown["size"] = 0.45
        elif rel_size > 0.15:
            breakdown["size"] = 1.0
        elif rel_size > 0.05:
            breakdown["size"] = 0.65
        else:
            breakdown["size"] = 0.15

        # --- Interior structure (printed artwork = high variance) ---
        eroded = cv2.erode(masks[i], np.ones((15, 15), np.uint8))
        breakdown["interior"] = min(region_variance(image, eroded) / 2000.0, 1.0)

        # --- Border continuity: what fraction of the contour perimeter sits on
        #     a real image edge?  A fully visible card has ~90%+ coverage.
        #     A partially-occluded rear card has gaps. ---
        breakdown["border"] = _border_continuity(cnt, gray)

        # --- Contour completeness: how close is the contour to a closed
        #     rectangle?  Rear cards have open/broken contours. ---
        breakdown["completeness"] = _contour_completeness(cnt)

        # --- Edge sharpness profile: card borders produce a strong, narrow
        #     gradient peak.  Wrapper edges are softer/wider. ---
        breakdown["edge_sharpness"] = _edge_sharpness(cnt, gray)

        # --- Nesting (mask-based area overlap, not point-sampling) ---
        breakdown["nesting"] = _nesting_score(i, candidates, masks, areas)

        # Weighted total — completeness and edge_sharpness are the new
        # high-value signals that separate front card from rear card.
        score = (
            breakdown["aspect"]         * 0.15
            + breakdown["rectangularity"] * 0.10
            + breakdown["size"]           * 0.08
            + breakdown["border"]         * 0.12
            + breakdown["interior"]       * 0.10
            + breakdown["smoothness"]     * 0.03
            + breakdown["centrality"]     * 0.07
            + breakdown["nesting"]        * 0.15
            + breakdown["completeness"]   * 0.10
            + breakdown["edge_sharpness"] * 0.10
        )

        results.append((i, score, breakdown))

    results.sort(key=lambda x: x[1], reverse=True)
    return results


# ── helpers ──────────────────────────────────────────────────────────────────

def _border_continuity(contour: np.ndarray, gray: np.ndarray) -> float:
    """Fraction of contour perimeter that coincides with a strong image edge."""
    edges = cv2.Canny(gray, 50, 150)

    contour_band = np.zeros_like(gray)
    cv2.drawContours(contour_band, [contour], -1, 255, 3)

    overlap = cv2.bitwise_and(edges, contour_band)
    band_px = np.count_nonzero(contour_band)
    if band_px == 0:
        return 0.0
    return min(np.count_nonzero(overlap) / band_px * 2.0, 1.0)


def _contour_completeness(contour: np.ndarray) -> float:
    """Measure how close the contour is to a complete, closed rectangle.

    A fully visible card produces a contour whose convex hull area ≈ contour area
    and whose approxPolyDP yields exactly 4 vertices.  A partially-occluded rear
    card has dents/gaps, so hull_area >> contour_area and vertex count != 4.
    """
    area = cv2.contourArea(contour)
    if area < 1:
        return 0.0

    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    if hull_area < 1:
        return 0.0

    # Solidity: contour_area / hull_area.  Perfect rectangle ≈ 1.0.
    solidity = area / hull_area

    # Vertex score: 4 vertices = perfect rectangle
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
    n_verts = len(approx)
    if n_verts == 4:
        vert_score = 1.0
    elif n_verts <= 6:
        vert_score = 0.8
    elif n_verts <= 8:
        vert_score = 0.5
    else:
        vert_score = 0.2

    return solidity * 0.6 + vert_score * 0.4


def _edge_sharpness(contour: np.ndarray, gray: np.ndarray) -> float:
    """Sample gradient magnitude along the contour perimeter.

    Card borders produce strong, consistent gradients.  Wrapper plastic produces
    weaker, more variable gradients.  Rear-card edges that are occluded have
    zero gradient in the occluded segments.

    Samples in a 3px neighbourhood around each contour point (findContours
    places points 1px inside the foreground, so the actual edge is offset).
    """
    gx = cv2.Scharr(gray, cv2.CV_64F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_64F, 0, 1)
    mag = np.sqrt(gx ** 2 + gy ** 2)

    h, w = gray.shape[:2]
    pts = contour.reshape(-1, 2)
    r = 3  # neighbourhood radius

    samples = []
    for px, py in pts[::3]:
        y1 = max(0, py - r)
        y2 = min(h, py + r + 1)
        x1 = max(0, px - r)
        x2 = min(w, px + r + 1)
        patch = mag[y1:y2, x1:x2]
        if patch.size > 0:
            samples.append(float(np.max(patch)))

    if len(samples) < 10:
        return 0.0

    arr = np.array(samples)
    median_mag = np.median(arr)
    strength = min(median_mag / 500.0, 1.0)

    mean_val = np.mean(arr)
    if mean_val < 1:
        consistency = 0.0
    else:
        cv_val = np.std(arr) / mean_val
        consistency = max(0.0, 1.0 - cv_val)

    return strength * 0.6 + consistency * 0.4


def _nesting_score(
    idx: int,
    candidates: List[np.ndarray],
    masks: List[np.ndarray],
    areas: List[int],
) -> float:
    """Mask-based nesting analysis.

    Uses actual pixel overlap instead of point-in-polygon sampling.
    Returns high score for a candidate that is inside a larger shape but does
    NOT contain a well-shaped card inside itself.
    """
    my_area = areas[idx]
    is_nested = False
    contains_child = False

    for j in range(len(candidates)):
        if j == idx:
            continue

        other_area = areas[j]

        if other_area > my_area * 1.08:
            # Check if I'm inside this larger candidate
            overlap = np.count_nonzero(masks[idx] & masks[j])
            if my_area > 0 and overlap / my_area > 0.85:
                is_nested = True

        if other_area < my_area * 0.90 and other_area > my_area * 0.20:
            # Check if this smaller candidate is inside me
            overlap = np.count_nonzero(masks[idx] & masks[j])
            if other_area > 0 and overlap / other_area > 0.85:
                child_rect = cv2.minAreaRect(candidates[j])
                child_aspect = aspect_ratio_score(child_rect[1])
                if child_aspect > 0.5:
                    contains_child = True

    if is_nested and not contains_child:
        return 1.0
    if is_nested and contains_child:
        return 0.35
    if contains_child:
        return 0.0
    return 0.5
