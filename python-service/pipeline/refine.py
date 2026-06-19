"""Stage 4: Front card refinement.

After border expansion, the contour should roughly follow the card's outer edge.
This stage:
1. Snaps each point to the nearest strong gradient along its normal (fine-tune)
2. Fits a clean minAreaRect to get a 4-point box
3. Optionally rotates the image to straighten the card
4. Refines each box edge by scanning perpendicular gradient profiles
"""

import cv2
import numpy as np
from typing import Tuple


def refine_card(
    contour: np.ndarray,
    image: np.ndarray,
    rotate_correction: bool = True,
) -> Tuple[np.ndarray, np.ndarray, float]:
    """Refine the selected card contour.

    Returns:
        refined_contour: clean contour on the (possibly rotated) image
        processed_image: the image after any rotation correction
        rotation_angle: degrees rotated (0 if no correction)
    """
    snapped = _normal_snap(contour, image)

    rect = cv2.minAreaRect(snapped)
    angle = rect[2]

    if angle < -45:
        angle += 90
    elif angle > 45:
        angle -= 90

    processed = image
    rotation_applied = 0.0

    if rotate_correction and abs(angle) > 0.3:
        processed, snapped = _rotate_image_and_contour(image, snapped, angle)
        rotation_applied = angle
        rect = cv2.minAreaRect(snapped)

    box = cv2.boxPoints(rect).astype(np.int32)
    refined = box.reshape(-1, 1, 2)

    refined = _refine_box_edges(refined, processed)

    return refined, processed, rotation_applied


def _normal_snap(contour: np.ndarray, image: np.ndarray) -> np.ndarray:
    """Snap each contour point along its outward normal to the nearest
    significant edge, with a moderate search range."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mag = _gradient_magnitude(gray)

    h, w = image.shape[:2]
    pts = contour.reshape(-1, 2).astype(np.float64)
    n = len(pts)
    if n < 8:
        return contour

    result = pts.copy()
    search_out = 12
    search_in = 12
    min_edge_strength = 20

    for i in range(n):
        prev_pt = pts[(i - 3) % n]
        next_pt = pts[(i + 3) % n]
        tangent = next_pt - prev_pt
        length = np.linalg.norm(tangent)
        if length < 1e-6:
            continue
        tangent /= length

        normal = np.array([-tangent[1], tangent[0]])

        test_pt = pts[i] + normal * 5
        if cv2.pointPolygonTest(contour, (float(test_pt[0]), float(test_pt[1])), False) >= 0:
            normal = -normal

        best_offset = 0.0
        best_val = 0.0

        for d in np.linspace(-search_in, search_out, 48):
            sx = int(round(pts[i][0] + normal[0] * d))
            sy = int(round(pts[i][1] + normal[1] * d))
            if 0 <= sx < w and 0 <= sy < h:
                val = mag[sy, sx]
                if val > min_edge_strength and val > best_val:
                    best_val = val
                    best_offset = d

        if best_val > min_edge_strength:
            result[i][0] = pts[i][0] + normal[0] * best_offset
            result[i][1] = pts[i][1] + normal[1] * best_offset

    return result.reshape(-1, 1, 2).astype(np.int32)


def _refine_box_edges(box_contour: np.ndarray, image: np.ndarray) -> np.ndarray:
    """Given a 4-point box, refine each edge by scanning perpendicular strips.

    Uses per-edge shift accumulation to avoid double-shifting shared corners.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mag = _gradient_magnitude(gray)
    h, w = image.shape[:2]

    pts = box_contour.reshape(-1, 2).astype(np.float64)
    if len(pts) != 4:
        return box_contour

    centre = pts.mean(axis=0)

    corner_shifts = [np.zeros(2, dtype=np.float64) for _ in range(4)]
    corner_counts = [0 for _ in range(4)]

    for edge_idx in range(4):
        p1 = pts[edge_idx]
        p2 = pts[(edge_idx + 1) % 4]
        edge_vec = p2 - p1
        edge_len = np.linalg.norm(edge_vec)
        if edge_len < 5:
            continue
        edge_dir = edge_vec / edge_len
        normal = np.array([-edge_dir[1], edge_dir[0]])

        edge_mid = (p1 + p2) / 2
        if np.dot(normal, edge_mid - centre) < 0:
            normal = -normal

        offsets = []
        for t in np.linspace(0.1, 0.9, 20):
            sample_pt = p1 + edge_vec * t

            best_d = None
            best_val = 0.0
            for d in np.linspace(-12, 12, 49):
                sx = int(round(sample_pt[0] + normal[0] * d))
                sy = int(round(sample_pt[1] + normal[1] * d))
                if 0 <= sx < w and 0 <= sy < h:
                    val = mag[sy, sx]
                    if val > 20 and val > best_val:
                        best_val = val
                        best_d = d

            if best_d is not None:
                offsets.append(best_d)

        if len(offsets) >= 5:
            median_shift = np.median(offsets)
            shift_vec = normal * median_shift
            i1 = edge_idx
            i2 = (edge_idx + 1) % 4
            corner_shifts[i1] += shift_vec
            corner_counts[i1] += 1
            corner_shifts[i2] += shift_vec
            corner_counts[i2] += 1

    refined = pts.copy()
    for i in range(4):
        if corner_counts[i] > 0:
            refined[i] += corner_shifts[i] / corner_counts[i]

    return refined.reshape(-1, 1, 2).astype(np.int32)


def _gradient_magnitude(gray: np.ndarray) -> np.ndarray:
    gx = cv2.Scharr(gray, cv2.CV_64F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_64F, 0, 1)
    return np.sqrt(gx ** 2 + gy ** 2)


def _rotate_image_and_contour(
    image: np.ndarray, contour: np.ndarray, angle: float
) -> Tuple[np.ndarray, np.ndarray]:
    """Rotate image to straighten the card and transform the contour."""
    h, w = image.shape[:2]
    centre = (w / 2, h / 2)

    M = cv2.getRotationMatrix2D(centre, angle, 1.0)

    cos_a = abs(M[0, 0])
    sin_a = abs(M[0, 1])
    new_w = int(h * sin_a + w * cos_a)
    new_h = int(h * cos_a + w * sin_a)
    M[0, 2] += (new_w - w) / 2
    M[1, 2] += (new_h - h) / 2

    rotated = cv2.warpAffine(image, M, (new_w, new_h), borderValue=(255, 255, 255))

    pts = contour.reshape(-1, 2).astype(np.float64)

    # Clamp points to image bounds to avoid overflow in rotation matrix multiply
    pts[:, 0] = np.clip(pts[:, 0], 0, w - 1)
    pts[:, 1] = np.clip(pts[:, 1], 0, h - 1)

    ones = np.ones((len(pts), 1))
    pts_h = np.hstack([pts, ones])

    with np.errstate(all='ignore'):
        transformed = (M @ pts_h.T).T

    if not np.all(np.isfinite(transformed)):
        return image, contour

    new_contour = transformed.reshape(-1, 1, 2).astype(np.int32)

    return rotated, new_contour
