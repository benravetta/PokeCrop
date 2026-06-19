"""Dedicated top-edge cleanup — remove rear-card remnants above the front card.

Approach:
1. Identify the card's top edge line from the refined contour (a straight
   horizontal or near-horizontal segment).
2. Define a cleanup zone above and slightly below that line.
3. In LAB colour space, classify every pixel in the zone as:
   - front-card border colour  → keep
   - rear-card / backing colour → remove
   - background colour          → remove
4. Use the classification to carve the mask, then smooth the result with
   morphological ops to avoid jagged edges.
5. Validate: never remove more than 10% of the card area.

All colour comparisons use CIE LAB ΔE for perceptual uniformity.
"""

import cv2
import numpy as np
from typing import Optional, Tuple
from utils.colour import dominant_colour


def cleanup_top_edge(
    mask: np.ndarray,
    image: np.ndarray,
    contour: np.ndarray,
    strength: float = 0.7,
) -> np.ndarray:
    if strength <= 0.01:
        return mask

    # Ensure dimensions match
    mh, mw = mask.shape[:2]
    ih, iw = image.shape[:2]
    if mh != ih or mw != iw:
        mask = cv2.resize(mask, (iw, ih), interpolation=cv2.INTER_NEAREST)

    h, w = image.shape[:2]
    rect = cv2.boundingRect(contour)
    rx, ry, rw, rh = rect
    if rh < 30 or rw < 30:
        return mask

    # ── 1. Locate the top edge of the card ──
    top_y = ry
    strip_h = max(int(rh * 0.10 * strength), 8)

    # ── 2. Sample reference colours ──
    front_border_lab = _sample_region_lab(
        image, mask, rx, ry + int(rh * 0.02), rw, max(int(rh * 0.06), 6)
    )
    front_interior_lab = _sample_region_lab(
        image, mask, rx + int(rw * 0.15), ry + int(rh * 0.15),
        int(rw * 0.7), max(int(rh * 0.12), 8)
    )
    rear_lab = _sample_rear_colour_lab(image, mask, rect)

    if rear_lab is None:
        return mask

    # ── 3. Convert the cleanup zone to LAB ──
    zone_y1 = max(top_y - strip_h, 0)
    zone_y2 = min(top_y + int(strip_h * 0.6), h)
    zone_x1 = rx
    zone_x2 = min(rx + rw, w)

    if zone_y2 <= zone_y1 or zone_x2 <= zone_x1:
        return mask

    zone_bgr = image[zone_y1:zone_y2, zone_x1:zone_x2]
    zone_lab = cv2.cvtColor(zone_bgr, cv2.COLOR_BGR2LAB).astype(np.float64)

    # ── 4. Vectorised colour distance classification ──
    dist_rear = np.sqrt(np.sum((zone_lab - rear_lab) ** 2, axis=2))
    dist_front_border = np.sqrt(np.sum((zone_lab - front_border_lab) ** 2, axis=2))
    dist_front_interior = np.sqrt(np.sum((zone_lab - front_interior_lab) ** 2, axis=2))
    dist_front = np.minimum(dist_front_border, dist_front_interior)

    # Threshold scales with strength: higher strength = more aggressive removal
    thresh = 25 + (1.0 - strength) * 30

    # A pixel is "rear contamination" if it's close to rear colour AND
    # significantly farther from front colour.
    is_rear = (dist_rear < thresh) & (dist_front > thresh * 1.2)

    # ── 5. Apply to mask ──
    refined_mask = mask.copy()
    zone_mask = refined_mask[zone_y1:zone_y2, zone_x1:zone_x2]

    # Only remove pixels that are currently IN the mask and classified as rear
    remove = is_rear & (zone_mask > 0)
    zone_mask[remove] = 0
    refined_mask[zone_y1:zone_y2, zone_x1:zone_x2] = zone_mask

    # ── 6. Smooth the carved edge ──
    smooth_y1 = max(zone_y1 - 2, 0)
    smooth_y2 = min(zone_y2 + 2, h)
    region = refined_mask[smooth_y1:smooth_y2, zone_x1:zone_x2].copy()

    # Close small holes, then smooth
    k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 3))
    region = cv2.morphologyEx(region, cv2.MORPH_CLOSE, k_close, iterations=1)
    region = cv2.GaussianBlur(region, (7, 3), 0)
    _, region = cv2.threshold(region, 127, 255, cv2.THRESH_BINARY)
    refined_mask[smooth_y1:smooth_y2, zone_x1:zone_x2] = region

    # ── 7. Also clean left, right, and bottom edges (lighter pass) ──
    if strength > 0.3:
        refined_mask = _cleanup_side_edges(
            refined_mask, image, rect, rear_lab, front_border_lab,
            front_interior_lab, strength * 0.5
        )

    # ── 8. Validate: never remove more than 10% of the card area ──
    # Rear-card bleed can be significant (especially at the top), so we allow
    # up to 10% removal.  If more than that is being removed, something is
    # wrong and we bail out to prevent destroying the card.
    orig_px = np.count_nonzero(mask)
    new_px = np.count_nonzero(refined_mask)
    if orig_px > 0 and (orig_px - new_px) / orig_px > 0.10:
        return mask

    return refined_mask


def _cleanup_side_edges(
    mask: np.ndarray,
    image: np.ndarray,
    rect: Tuple,
    rear_lab: np.ndarray,
    front_border_lab: np.ndarray,
    front_interior_lab: np.ndarray,
    strength: float,
) -> np.ndarray:
    """Light cleanup pass on left, right, and bottom edges."""
    rx, ry, rw, rh = rect
    h, w = image.shape[:2]
    strip = max(int(min(rw, rh) * 0.04 * strength), 4)
    thresh = 35 + (1.0 - strength) * 35

    edges = [
        # (y1, y2, x1, x2)  — the strip zone for each edge
        (ry, ry + rh, max(rx - strip, 0), rx + int(strip * 0.5)),             # left
        (ry, ry + rh, rx + rw - int(strip * 0.5), min(rx + rw + strip, w)),   # right
        (ry + rh - int(strip * 0.5), min(ry + rh + strip, h), rx, rx + rw),   # bottom
    ]

    for y1, y2, x1, x2 in edges:
        y1, y2 = max(0, y1), min(h, y2)
        x1, x2 = max(0, x1), min(w, x2)
        if y2 <= y1 or x2 <= x1:
            continue

        zone_lab = cv2.cvtColor(image[y1:y2, x1:x2], cv2.COLOR_BGR2LAB).astype(np.float64)
        dist_rear = np.sqrt(np.sum((zone_lab - rear_lab) ** 2, axis=2))
        dist_front = np.minimum(
            np.sqrt(np.sum((zone_lab - front_border_lab) ** 2, axis=2)),
            np.sqrt(np.sum((zone_lab - front_interior_lab) ** 2, axis=2)),
        )

        is_rear = (dist_rear < thresh) & (dist_front > thresh * 0.6)
        zone_mask = mask[y1:y2, x1:x2]
        zone_mask[is_rear & (zone_mask > 0)] = 0
        mask[y1:y2, x1:x2] = zone_mask

    return mask


def _sample_region_lab(
    image: np.ndarray,
    mask: np.ndarray,
    x: int, y: int, w_region: int, h_region: int,
) -> np.ndarray:
    """Sample the dominant LAB colour from a rectangular region inside the mask."""
    ih, iw = image.shape[:2]
    y1, y2 = max(0, y), min(ih, y + h_region)
    x1, x2 = max(0, x), min(iw, x + w_region)
    if y2 <= y1 or x2 <= x1:
        return np.array([128.0, 128.0, 128.0])

    region = image[y1:y2, x1:x2]
    region_mask = mask[y1:y2, x1:x2]

    if np.count_nonzero(region_mask) < 10:
        return np.array([128.0, 128.0, 128.0])

    bgr = dominant_colour(region, region_mask, k=2)
    lab = cv2.cvtColor(bgr.reshape(1, 1, 3), cv2.COLOR_BGR2LAB).flatten().astype(np.float64)
    return lab


def _sample_rear_colour_lab(
    image: np.ndarray,
    mask: np.ndarray,
    rect: Tuple,
) -> Optional[np.ndarray]:
    """Detect the rear/backing card colour from strips around the front card.

    Samples from regions that are OUTSIDE the current mask but INSIDE the
    general card area — these are the visible strips of the rear card.

    Returns None if no distinct rear card colour is found (e.g. card in a
    wrapper with no backing card, or background is uniform).
    """
    rx, ry, rw, rh = rect
    h, w = image.shape[:2]
    strip = max(int(rw * 0.06), 6)
    regions = []

    # Left strip
    lx1, lx2 = max(rx - strip * 2, 0), max(rx - 1, 0)
    ly1, ly2 = ry + int(rh * 0.15), ry + int(rh * 0.85)
    ly1, ly2 = max(0, ly1), min(h, ly2)
    if lx2 > lx1 and ly2 > ly1:
        inv_mask = (255 - mask[ly1:ly2, lx1:lx2])
        pixels = image[ly1:ly2, lx1:lx2][inv_mask > 0]
        if pixels.ndim == 1:
            pixels = pixels.reshape(-1, 3)
        if len(pixels) > 5:
            regions.append(pixels)

    # Right strip
    rx1, rx2 = min(rx + rw + 1, w), min(rx + rw + strip * 2, w)
    if rx2 > rx1 and ly2 > ly1:
        inv_mask = (255 - mask[ly1:ly2, rx1:rx2])
        pixels = image[ly1:ly2, rx1:rx2][inv_mask > 0]
        if pixels.ndim == 1:
            pixels = pixels.reshape(-1, 3)
        if len(pixels) > 5:
            regions.append(pixels)

    # Top strip (most important — this is where rear card peeks)
    ty1, ty2 = max(ry - int(rh * 0.08), 0), max(ry - 1, 0)
    tx1, tx2 = rx + int(rw * 0.15), rx + int(rw * 0.85)
    tx1, tx2 = max(0, tx1), min(w, tx2)
    if ty2 > ty1 and tx2 > tx1:
        pixels = image[ty1:ty2, tx1:tx2].reshape(-1, 3)
        if len(pixels) > 5:
            regions.append(pixels)

    if not regions:
        return None

    all_px = np.concatenate(regions)
    if all_px.ndim == 1:
        all_px = all_px.reshape(-1, 3)
    if len(all_px) < 10:
        return None

    bgr = dominant_colour(all_px, k=2)
    lab = cv2.cvtColor(bgr.reshape(1, 1, 3), cv2.COLOR_BGR2LAB).flatten().astype(np.float64)

    # Verify this is actually a distinct rear-card colour, not just
    # background/wrapper.  A rear card has saturated colour (not gray).
    # If the sampled colour is very neutral (low chromaticity), it's likely
    # just background/wrapper and there's no rear card to clean up.
    chroma = np.sqrt((lab[1] - 128) ** 2 + (lab[2] - 128) ** 2)
    if chroma < 10:
        return None

    return lab
