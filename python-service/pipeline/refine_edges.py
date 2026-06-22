"""Stage: refine the four edges against the full-resolution image.

The rough quad comes from a downscaled working image. Here we take the four
fitted edge lines as starting estimates and snap them onto the strongest
consistent card-boundary transition in the original full-resolution pixels,
using a perpendicular-strip search at many sample points per edge. Edges are
refit from the inlier samples and re-intersected, giving subpixel corners.
"""

from typing import Optional

import cv2
import numpy as np

from pipeline.edges import _fit_line, _intersect
from utils.geometry import order_corners

# top, right, bottom, left as corner-index pairs of an ordered TL,TR,BR,BL quad.
_SIDE_PAIRS = ((0, 1), (1, 2), (2, 3), (3, 0))


def refine_quad(quad_working: np.ndarray, original: np.ndarray, scale: float) -> np.ndarray:
    """Refine ``quad_working`` against ``original`` (full res). Returns full-res quad."""
    quad = order_corners(quad_working.astype(np.float32)).astype(np.float64) * float(scale)

    gray = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gray = cv2.GaussianBlur(gray, (0, 0), 1.0)
    gx = cv2.Scharr(gray, cv2.CV_32F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_32F, 0, 1)
    mag = cv2.magnitude(gx, gy)
    H, W = gray.shape

    side_len = min(
        np.linalg.norm(quad[1] - quad[0]),
        np.linalg.norm(quad[2] - quad[1]),
        np.linalg.norm(quad[3] - quad[2]),
        np.linalg.norm(quad[0] - quad[3]),
    )
    band = float(np.clip(side_len * 0.02, 4.0, 18.0))
    resid = max(side_len * 0.003, 1.2)
    n_samples = 64

    refined_lines = []
    for i, j in _SIDE_PAIRS:
        a, b = quad[i], quad[j]
        edge = b - a
        length = np.linalg.norm(edge)
        if length < 8:
            refined_lines.append((a.copy(), edge / (length or 1.0)))
            continue
        u = edge / length
        normal = np.array([-u[1], u[0]])

        samples = []
        strengths = []
        for t in np.linspace(0.12, 0.88, n_samples):
            base = a + edge * t
            best_pt = None
            best_val = -1.0
            for d in np.arange(-band, band + 0.5, 0.5):
                q = base + normal * d
                m = _bilinear(mag, q, W, H)
                if m <= 0:
                    continue
                # Weight by how perpendicular the gradient is to this side. A real
                # card edge runs parallel to the side, so its gradient points along
                # the side's normal; background clutter (wood grain, fabric, other
                # straight lines at an angle) is suppressed. This keeps the snap on
                # the true boundary instead of the strongest nearby texture edge.
                gxv = _bilinear(gx, q, W, H)
                gyv = _bilinear(gy, q, W, H)
                gn = float(np.hypot(gxv, gyv)) or 1.0
                cons = abs((gxv * normal[0] + gyv * normal[1]) / gn)
                v = m * (cons * cons)
                if v > best_val:
                    best_val = v
                    best_pt = q
            if best_pt is not None:
                samples.append(best_pt)
                strengths.append(best_val)

        if len(samples) >= 10:
            samples = np.array(samples)
            strengths = np.array(strengths)
            keep = strengths > max(8.0, 0.4 * np.median(strengths))
            pts = samples[keep] if int(keep.sum()) >= 8 else samples
            line, _ = _fit_line(pts, a, b, resid)
        else:
            line = (a.copy(), u)
        refined_lines.append(line)

    pairs = [(3, 0), (0, 1), (1, 2), (2, 3)]
    corners = [_intersect(refined_lines[s1], refined_lines[s2]) for s1, s2 in pairs]
    if any(c is None for c in corners):
        return quad

    refined = order_corners(np.array(corners, dtype=np.float32)).astype(np.float64)

    # Reject a refinement that moved any corner implausibly far (kept conservative).
    max_move = band * 2.5
    if np.max(np.linalg.norm(refined - quad, axis=1)) > max_move:
        return quad
    return refined


def _bilinear(img: np.ndarray, p: np.ndarray, w: int, h: int) -> float:
    x, y = float(p[0]), float(p[1])
    if x < 0 or y < 0 or x > w - 1 or y > h - 1:
        return 0.0
    x0, y0 = int(np.floor(x)), int(np.floor(y))
    x1, y1 = min(x0 + 1, w - 1), min(y0 + 1, h - 1)
    fx, fy = x - x0, y - y0
    v00 = img[y0, x0]
    v01 = img[y0, x1]
    v10 = img[y1, x0]
    v11 = img[y1, x1]
    return float((v00 * (1 - fx) + v01 * fx) * (1 - fy) + (v10 * (1 - fx) + v11 * fx) * fy)
