"""Stage: fit the four straight physical card edges.

A trading card has four straight sides joined by rounded corners. The correct
perspective quadrilateral is defined by the *intersections of the four straight
edge lines*, not by the rounded contour tips. We therefore:

1. Take the boundary mask's outer contour.
2. Use its minimum-area rectangle to split points into top/right/bottom/left.
3. Exclude the rounded-corner zones from each side's point set.
4. Fit a robust (RANSAC) line to each side.
5. Intersect adjacent lines to recover the four theoretical corners.
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np

from utils.geometry import order_corners

try:  # RANSAC line fitting (scikit-image is a declared dependency).
    from skimage.measure import LineModelND, ransac as _sk_ransac
    _HAVE_SKIMAGE = True
except Exception:  # pragma: no cover
    _HAVE_SKIMAGE = False


@dataclass
class EdgeFit:
    quad: np.ndarray              # (4,2) float TL,TR,BR,BL
    support: List[float]          # inlier fraction per side [top,right,bottom,left]
    edge_lines: List[Tuple[np.ndarray, np.ndarray]]  # (point, unit-dir) per side


# Order of sides around the card, matched to order_corners output (TL,TR,BR,BL).
# top: TL->TR, right: TR->BR, bottom: BR->BL, left: BL->TL
_SIDES = ("top", "right", "bottom", "left")


def fit_card_quad(mask: np.ndarray) -> Optional[EdgeFit]:
    """Fit the four straight edges of the card in ``mask`` and return the quad."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    pts = contour.reshape(-1, 2).astype(np.float64)
    if len(pts) < 16:
        return None

    rect = cv2.minAreaRect(contour)
    box = order_corners(cv2.boxPoints(rect).astype(np.float32)).astype(np.float64)
    short_side = float(min(rect[1])) if min(rect[1]) > 0 else 1.0
    corner_zone = max(short_side * 0.14, 6.0)
    resid = max(short_side * 0.004, 1.2)

    # Box edges as (a, b) endpoints, indexed to match _SIDES.
    box_edges = [
        (box[0], box[1]),  # top
        (box[1], box[2]),  # right
        (box[2], box[3]),  # bottom
        (box[3], box[0]),  # left
    ]

    # Distance from every point to every box corner, to mask out rounded zones.
    corner_d = np.min(
        np.stack([np.linalg.norm(pts - c, axis=1) for c in box], axis=1), axis=1
    )
    not_corner = corner_d > corner_zone

    # Assign each (non-corner) point to its nearest box edge.
    edge_d = np.stack(
        [_point_segment_distance(pts, a, b) for a, b in box_edges], axis=1
    )
    nearest = np.argmin(edge_d, axis=1)

    lines: List[Optional[Tuple[np.ndarray, np.ndarray]]] = []
    support: List[float] = []
    for i, (a, b) in enumerate(box_edges):
        sel = not_corner & (nearest == i) & (edge_d[:, i] < corner_zone)
        side_pts = pts[sel]
        line, frac = _fit_line(side_pts, a, b, resid)
        lines.append(line)
        support.append(frac)

    # Intersect adjacent edge lines to obtain corners.
    # corner[k] = intersection of side[k-1] and side[k] with sides ordered
    # top,right,bottom,left -> corners TL(left,top),TR(top,right),BR(right,bottom),BL(bottom,left)
    pairs = [(3, 0), (0, 1), (1, 2), (2, 3)]  # (left,top),(top,right),(right,bottom),(bottom,left)
    corners = []
    for s1, s2 in pairs:
        p = _intersect(lines[s1], lines[s2])
        corners.append(p)

    if any(c is None for c in corners):
        return None

    quad = order_corners(np.array(corners, dtype=np.float32)).astype(np.float64)
    return EdgeFit(quad=quad, support=support, edge_lines=[l for l in lines if l is not None])


def _fit_line(
    side_pts: np.ndarray,
    a: np.ndarray,
    b: np.ndarray,
    resid: float,
) -> Tuple[Tuple[np.ndarray, np.ndarray], float]:
    """Robustly fit a line to one side, falling back to the box edge."""
    fallback_dir = b - a
    n = np.linalg.norm(fallback_dir)
    fallback = (a.copy(), fallback_dir / n if n > 0 else np.array([1.0, 0.0]))

    if len(side_pts) < 8:
        return fallback, 0.0

    if _HAVE_SKIMAGE and len(side_pts) >= 12:
        try:
            with np.errstate(all="ignore"):
                model, inliers = _sk_ransac(
                    side_pts,
                    LineModelND,
                    min_samples=2,
                    residual_threshold=resid,
                    max_trials=120,
                )
            if inliers is not None and int(inliers.sum()) >= 8:
                origin, direction = model.params
                d = np.asarray(direction, dtype=np.float64)
                dn = np.linalg.norm(d)
                if dn > 0:
                    return (np.asarray(origin, dtype=np.float64), d / dn), float(inliers.mean())
        except Exception:
            pass

    # Total-least-squares fit on all side points (no RANSAC available / too few).
    centroid = side_pts.mean(axis=0)
    centred = side_pts - centroid
    _, _, vt = np.linalg.svd(centred, full_matrices=False)
    direction = vt[0]
    # Inlier fraction at the chosen residual for a support estimate.
    dists = np.abs(centred[:, 0] * -direction[1] + centred[:, 1] * direction[0])
    frac = float(np.mean(dists < resid))
    return (centroid, direction), frac


def _intersect(
    l1: Optional[Tuple[np.ndarray, np.ndarray]],
    l2: Optional[Tuple[np.ndarray, np.ndarray]],
) -> Optional[np.ndarray]:
    """Intersection of two lines given as (point, unit-direction)."""
    if l1 is None or l2 is None:
        return None
    p1, d1 = l1
    p2, d2 = l2
    # p1 + t1 d1 = p2 + t2 d2  ->  [d1, -d2] [t1, t2]^T = p2 - p1
    A = np.array([[d1[0], -d2[0]], [d1[1], -d2[1]]], dtype=np.float64)
    det = np.linalg.det(A)
    if abs(det) < 1e-6:
        return None
    t = np.linalg.solve(A, (p2 - p1))
    return p1 + t[0] * d1


def _point_segment_distance(pts: np.ndarray, a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Perpendicular distance from each point to the infinite line through a,b."""
    d = b - a
    n = float(np.hypot(d[0], d[1]))
    if n < 1e-6:
        return np.hypot(pts[:, 0] - a[0], pts[:, 1] - a[1])
    # |(p - a) x d| / |d| computed component-wise (avoids matmul FP warnings).
    cross = (pts[:, 0] - a[0]) * d[1] - (pts[:, 1] - a[1]) * d[0]
    return np.abs(cross) / n
