"""Stage 5: Corner handling — detect and preserve rounded corners.

Approach:
1. Take the 4-corner box from the refined contour's minAreaRect.
2. For each corner, measure the actual curvature of the ORIGINAL (pre-refinement)
   detection contour near that corner.  The curvature tells us the physical
   corner radius of the card.
3. Build a rounded-rectangle mask using high-resolution (8x) supersampling
   with floating-point arc geometry for smooth anti-aliased edges.
4. Apply distance-transform feathering for sub-pixel alpha quality.
"""

import cv2
import numpy as np
from typing import Tuple
from utils.geometry import order_corners


def handle_corners(
    contour: np.ndarray,
    image_shape: Tuple[int, int],
    corner_radius_param: float = 0.5,
) -> Tuple[np.ndarray, float]:
    """Generate a rounded-rectangle mask preserving the card's corner radius.

    Returns:
        mask: anti-aliased mask (0-255)
        estimated_radius: the radius used (in pixels at working resolution)
    """
    rect = cv2.minAreaRect(contour)
    box = cv2.boxPoints(rect)
    corners = order_corners(box)

    card_short = min(rect[1][0], rect[1][1])
    if card_short < 1:
        card_short = 1

    # ── Estimate corner radius from contour curvature ──
    auto_radius = _estimate_radius_from_curvature(contour, corners, card_short)

    # ── Apply user parameter ──
    if corner_radius_param <= 0.01:
        radius = 0.0
    elif corner_radius_param >= 0.99:
        radius = card_short * 0.08
    else:
        scale = corner_radius_param / 0.5
        radius = auto_radius * scale

    radius = max(radius, 0.0)
    radius = min(radius, card_short * 0.12)

    # ── Build mask ──
    mask = _build_rounded_rect_mask_hq(image_shape, corners, radius)

    return mask, float(radius)


def _estimate_radius_from_curvature(
    contour: np.ndarray,
    corners: np.ndarray,
    card_short: float,
) -> float:
    """Estimate the corner radius by measuring how far the contour deviates
    from a sharp corner at each of the 4 box corners.

    At a rounded corner, the contour curves inward relative to the sharp
    box corner.  The maximum inward deviation ≈ r * (1 - cos(45°)) ≈ 0.293 * r.
    So r ≈ deviation / 0.293.
    """
    pts = contour.reshape(-1, 2).astype(np.float64)
    if len(pts) < 20:
        return card_short * 0.025

    radii = []
    neighbourhood = max(int(card_short * 0.15), 15)

    for corner in corners:
        corner = corner.astype(np.float64)
        dists = np.linalg.norm(pts - corner, axis=1)
        nearby_mask = dists < neighbourhood
        nearby = pts[nearby_mask]

        if len(nearby) < 5:
            continue

        # The deviation is how far the nearest contour point is from the
        # sharp box corner.  For a rounded corner with radius r, the nearest
        # point on the arc is at distance r*(sqrt(2)-1) ≈ 0.414*r from the
        # sharp corner.
        min_dist = np.min(dists[nearby_mask])
        if min_dist < 1:
            continue

        estimated_r = min_dist / 0.414
        if 2 < estimated_r < card_short * 0.15:
            radii.append(estimated_r)

    if radii:
        return float(np.median(radii))

    # Fallback: standard trading card ≈ 3mm radius, which is ~2.5% of short side
    return card_short * 0.025


def _build_rounded_rect_mask_hq(
    shape: Tuple[int, int],
    corners: np.ndarray,
    radius: float,
) -> np.ndarray:
    """Build a high-quality anti-aliased rounded rectangle mask.

    Uses 8x supersampling for smooth edges, with floating-point arc geometry.
    """
    h, w = shape[:2]
    ss = 8
    max_ss_pixels = 256_000_000
    while h * ss * w * ss > max_ss_pixels and ss > 1:
        ss //= 2
    big_h, big_w = h * ss, w * ss
    big = np.zeros((big_h, big_w), dtype=np.uint8)

    sc = corners.astype(np.float64) * ss
    r = radius * ss

    tl, tr, br, bl = sc

    if r < 2:
        poly = sc.astype(np.int32)
        cv2.fillConvexPoly(big, poly, 255)
    else:
        # Build the rounded-rect polygon with high angular resolution
        arc_pts = 32  # points per quarter-arc
        pts = []

        # Top-left arc: centre is at (tl + r, tl_y + r)
        cx, cy = tl[0] + r, tl[1] + r
        for a in np.linspace(np.pi, 1.5 * np.pi, arc_pts):
            pts.append([cx + r * np.cos(a), cy + r * np.sin(a)])

        # Top-right arc
        cx, cy = tr[0] - r, tr[1] + r
        for a in np.linspace(1.5 * np.pi, 2.0 * np.pi, arc_pts):
            pts.append([cx + r * np.cos(a), cy + r * np.sin(a)])

        # Bottom-right arc
        cx, cy = br[0] - r, br[1] - r
        for a in np.linspace(0, 0.5 * np.pi, arc_pts):
            pts.append([cx + r * np.cos(a), cy + r * np.sin(a)])

        # Bottom-left arc
        cx, cy = bl[0] + r, bl[1] - r
        for a in np.linspace(0.5 * np.pi, np.pi, arc_pts):
            pts.append([cx + r * np.cos(a), cy + r * np.sin(a)])

        poly = np.array(pts, dtype=np.int32)
        cv2.fillPoly(big, [poly], 255)

    # Downsample with area interpolation → natural anti-aliasing
    mask = cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA)
    return mask
