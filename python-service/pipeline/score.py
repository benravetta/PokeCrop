"""Stage 3: Candidate scoring — identify the true front card.

This is a LAYERED CARD SEGMENTATION problem.  The image contains multiple
overlapping rectangular objects:
  - plastic wrapper (outermost, irregular edges, contains everything)
  - rear/backing card (partially occluded, incomplete border, visible around edges)
  - front printed card (complete border, coherent printed face, correct aspect ratio)

The goal is NOT to find the biggest rectangle.  It is to find the rectangle
that most plausibly corresponds to the visible printed front card.

Key discrimination signals:
  - Front card: complete rectangular border, high interior variance (printed art),
    correct trading-card aspect ratio, nested inside wrapper, does NOT contain
    another card-shaped child.
  - Rear card: INCOMPLETE border (occluded by front card), visible only as
    edge strips, similar size to front card but with gaps/dents in contour.
  - Wrapper: outermost contour, softer/irregular edges, lower rectangularity,
    contains card-shaped children, may be slightly larger than the card.

Scoring weights are tuned so that:
  - nesting (nested inside larger shape, no card-child inside) is the strongest signal
  - border_band (visible coloured border strip) is the second strongest
  - aspect ratio match to trading card dimensions is the third strongest
  - wrapper-like properties (contains children, soft edges) are penalised
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


CARD_RATIO = 2.5 / 3.5  # ~0.714


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

        # Size scoring — prefer mid-range, heavily penalize extremes
        rel_size = areas[i] / img_area
        if rel_size > 0.85:
            breakdown["size"] = 0.05
        elif rel_size > 0.70:
            breakdown["size"] = 0.30
        elif rel_size > 0.15:
            breakdown["size"] = 1.0
        elif rel_size > 0.08:
            breakdown["size"] = 0.70
        elif rel_size > 0.04:
            breakdown["size"] = 0.40
        else:
            breakdown["size"] = 0.10

        # Interior structure (printed artwork = high variance)
        eroded = cv2.erode(masks[i], np.ones((15, 15), np.uint8))
        breakdown["interior"] = min(region_variance(image, eroded) / 2000.0, 1.0)

        # Border continuity — fraction of contour on a real image edge
        breakdown["border"] = _border_continuity(cnt, gray)

        # Contour completeness — how close to a closed rectangle
        breakdown["completeness"] = _contour_completeness(cnt)

        # Edge sharpness — card borders are sharp and consistent
        breakdown["edge_sharpness"] = _edge_sharpness(cnt, gray)

        # Nesting — the critical "is this the front card?" signal
        breakdown["nesting"] = _nesting_score(i, candidates, masks, areas)

        # Border band — does this contour have a visible coloured border strip?
        breakdown["border_band"] = _border_band_score(cnt, image, masks[i])

        # Size plausibility — absolute dimensions match a real card?
        breakdown["size_plausibility"] = _size_plausibility(rect, h, w)

        # Occlusion awareness — does this contour look like it's being
        # occluded (rear card) vs fully visible (front card)?
        breakdown["visibility"] = _visibility_score(cnt, gray, masks[i])

        # Weighted total — nesting and border_band are the strongest signals
        # because they directly answer "is this the front card, not the wrapper
        # or rear card?"
        score = (
            breakdown["aspect"]           * 0.12
            + breakdown["rectangularity"] * 0.08
            + breakdown["size"]           * 0.06
            + breakdown["border"]         * 0.08
            + breakdown["interior"]       * 0.07
            + breakdown["smoothness"]     * 0.02
            + breakdown["centrality"]     * 0.05
            + breakdown["nesting"]        * 0.16
            + breakdown["completeness"]   * 0.07
            + breakdown["edge_sharpness"] * 0.06
            + breakdown["border_band"]    * 0.12
            + breakdown["size_plausibility"] * 0.05
            + breakdown["visibility"]     * 0.06
        )

        results.append((i, score, breakdown))

    results.sort(key=lambda x: x[1], reverse=True)
    return results


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

    A fully visible front card has solidity ~1.0 and 4 vertices.
    A partially-occluded rear card has dents/gaps (lower solidity, more vertices).
    """
    area = cv2.contourArea(contour)
    if area < 1:
        return 0.0
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    if hull_area < 1:
        return 0.0
    solidity = area / hull_area
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

    Card borders produce strong, consistent gradients.
    Wrapper plastic produces weaker, more variable gradients.
    """
    gx = cv2.Scharr(gray, cv2.CV_64F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_64F, 0, 1)
    mag = np.sqrt(gx ** 2 + gy ** 2)

    h, w = gray.shape[:2]
    pts = contour.reshape(-1, 2)
    r = 3

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
    """Mask-based nesting analysis — the most important scoring signal.

    The front card is:
      - nested inside a larger shape (the wrapper)
      - does NOT contain a well-shaped card inside itself

    The wrapper is:
      - the outermost shape
      - DOES contain a card-shaped child

    The rear card is:
      - similar size to front card but partially occluded
      - may or may not be nested
    """
    my_area = areas[idx]
    is_nested = False
    contains_card_child = False
    parent_count = 0

    for j in range(len(candidates)):
        if j == idx:
            continue

        other_area = areas[j]

        # Check if I'm inside a larger candidate
        if other_area > my_area * 1.05:
            overlap = np.count_nonzero(masks[idx] & masks[j])
            if my_area > 0 and overlap / my_area > 0.80:
                is_nested = True
                parent_count += 1

        # Check if a smaller card-shaped candidate is inside me
        if other_area < my_area * 0.92 and other_area > my_area * 0.15:
            overlap = np.count_nonzero(masks[idx] & masks[j])
            if other_area > 0 and overlap / other_area > 0.80:
                child_rect = cv2.minAreaRect(candidates[j])
                child_aspect = aspect_ratio_score(child_rect[1])
                if child_aspect > 0.4:
                    contains_card_child = True

    # Best case: nested inside wrapper, no card child (= front card)
    if is_nested and not contains_card_child:
        return 1.0
    # Nested but contains a child (= could be rear card or intermediate layer)
    if is_nested and contains_card_child:
        return 0.25
    # Not nested but contains a child (= wrapper or rear card)
    if contains_card_child:
        return 0.0
    # Not nested, no child (= standalone card, no wrapper context)
    return 0.45


def _border_band_score(
    contour: np.ndarray, image: np.ndarray, mask: np.ndarray
) -> float:
    """Detect whether the contour has a visible coloured border band.

    A real trading card has a coloured border strip (the card's frame) between
    the printed artwork and the physical edge.  This strip is MORE UNIFORM
    than the artwork interior.

    An artwork-only contour (too small) won't have this border strip.
    A wrapper contour will have plastic texture instead of a uniform border.
    """
    h, w = image.shape[:2]
    rect = cv2.minAreaRect(contour)
    card_short = min(rect[1][0], rect[1][1])
    if card_short < 30:
        return 0.0

    border_width = max(int(card_short * 0.07), 5)
    kernel = np.ones((border_width, border_width), np.uint8)
    inner = cv2.erode(mask, kernel)
    border_ring = mask.copy()
    border_ring[inner > 0] = 0

    border_pixels = image[border_ring > 0]
    if border_pixels.ndim == 1:
        border_pixels = border_pixels.reshape(-1, 3)
    if len(border_pixels) < 20:
        return 0.0

    inner_pixels = image[inner > 0]
    if inner_pixels.ndim == 1:
        inner_pixels = inner_pixels.reshape(-1, 3)
    if len(inner_pixels) < 20:
        return 0.0

    border_var = np.mean(np.var(border_pixels.astype(np.float64), axis=0))
    inner_var = np.mean(np.var(inner_pixels.astype(np.float64), axis=0))

    if inner_var < 1:
        return 0.0

    uniformity_ratio = border_var / inner_var

    # Also check if the border has a distinct colour (not just noise)
    border_lab = cv2.cvtColor(
        border_pixels.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_BGR2LAB
    ).reshape(-1, 3).astype(np.float64)
    border_chroma = np.mean(np.sqrt(
        (border_lab[:, 1] - 128) ** 2 + (border_lab[:, 2] - 128) ** 2
    ))

    # A good border band: lower variance than artwork AND has some colour
    if uniformity_ratio < 0.25:
        base = 1.0
    elif uniformity_ratio < 0.5:
        base = 0.8
    elif uniformity_ratio < 0.8:
        base = 0.5
    elif uniformity_ratio < 1.2:
        base = 0.3
    else:
        base = 0.1

    # Bonus for chromatic border (coloured frame, not gray wrapper)
    chroma_bonus = min(border_chroma / 30.0, 0.3)

    return min(base + chroma_bonus, 1.0)


def _size_plausibility(rect, img_h: int, img_w: int) -> float:
    """Score whether the contour's absolute dimensions are plausible for a card."""
    rw, rh = sorted(rect[1])
    if rw < 1 or rh < 1:
        return 0.0

    ratio = rw / rh
    ratio_diff = abs(ratio - CARD_RATIO)

    img_short = min(img_h, img_w)
    card_short_frac = rw / img_short

    if 0.20 <= card_short_frac <= 0.80:
        size_score = 1.0
    elif 0.15 <= card_short_frac <= 0.85:
        size_score = 0.7
    elif 0.10 <= card_short_frac <= 0.90:
        size_score = 0.4
    else:
        size_score = 0.1

    ratio_score = max(0.0, 1.0 - ratio_diff * 3)

    return size_score * 0.5 + ratio_score * 0.5


def _visibility_score(
    contour: np.ndarray, gray: np.ndarray, mask: np.ndarray
) -> float:
    """Measure how "fully visible" a contour is vs partially occluded.

    The front card is fully visible — its entire perimeter sits on a real edge.
    The rear card is partially occluded — parts of its perimeter have no edge
    (they're hidden behind the front card).

    We measure this by checking what fraction of the contour perimeter has
    consistent gradient support on ALL four sides.
    """
    h, w = gray.shape[:2]
    gx = cv2.Scharr(gray, cv2.CV_64F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_64F, 0, 1)
    mag = np.sqrt(gx ** 2 + gy ** 2)

    rect = cv2.minAreaRect(contour)
    box = cv2.boxPoints(rect).astype(np.float64)

    if len(box) != 4:
        return 0.5

    # For each of the 4 edges, measure what fraction has gradient support
    edge_scores = []
    for ei in range(4):
        p1 = box[ei]
        p2 = box[(ei + 1) % 4]
        edge_len = np.linalg.norm(p2 - p1)
        if edge_len < 10:
            continue

        supported = 0
        total = 0
        for t in np.linspace(0.05, 0.95, 20):
            pt = p1 + (p2 - p1) * t
            px, py = int(round(pt[0])), int(round(pt[1]))
            if 0 <= px < w and 0 <= py < h:
                total += 1
                # Check 3px neighbourhood for gradient
                y1 = max(0, py - 2)
                y2 = min(h, py + 3)
                x1 = max(0, px - 2)
                x2 = min(w, px + 3)
                if np.max(mag[y1:y2, x1:x2]) > 40:
                    supported += 1

        if total > 0:
            edge_scores.append(supported / total)

    if not edge_scores:
        return 0.5

    # Front card: all 4 edges have high support
    # Rear card: 1-2 edges have low support (occluded by front card)
    min_edge = min(edge_scores)
    mean_edge = np.mean(edge_scores)

    # Penalize contours where any edge has poor gradient support
    return min_edge * 0.5 + mean_edge * 0.5
