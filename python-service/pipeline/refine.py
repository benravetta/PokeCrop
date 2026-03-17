"""Stage 4: Front card refinement.

Key improvements over the naive approach:
1. Edge snapping searches along the contour NORMAL (outward direction), not in
   a square patch.  This prevents snapping to interior artwork edges.
2. After snapping, a tight minAreaRect is fitted and the contour is replaced
   with the rectangle's 4 box-points — giving a clean rectangular outline
   that faithfully follows the card border.
3. Rotation correction uses the minAreaRect angle directly.
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
    # Step 1: snap contour points along their outward normals
    snapped = _normal_snap(contour, image)

    # Step 2: fit a tight minAreaRect to the snapped contour
    rect = cv2.minAreaRect(snapped)
    angle = rect[2]

    # Normalise angle to [-45, 45]
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

    # Step 3: derive a clean rectangular contour from the fitted rect
    box = cv2.boxPoints(rect).astype(np.int32)
    refined = box.reshape(-1, 1, 2)

    # Step 4: one more normal-snap pass on the 4-point rectangle to lock onto
    # the true card edge at sub-contour-point precision
    refined = _refine_box_edges(refined, processed)

    return refined, processed, rotation_applied


def _normal_snap(contour: np.ndarray, image: np.ndarray) -> np.ndarray:
    """Snap each contour point along its outward normal to the outermost
    significant edge.

    Prefers the outermost edge above a threshold rather than the absolute
    strongest.  This prevents snapping inward to artwork edges when the
    contour is already near the card border.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mag = _gradient_magnitude(gray)

    h, w = image.shape[:2]
    pts = contour.reshape(-1, 2).astype(np.float64)
    n = len(pts)
    if n < 8:
        return contour

    result = pts.copy()
    search_out = 12
    search_in = 4
    min_edge_strength = 30

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

        # Scan from outermost to innermost; take the first (outermost) edge
        # that exceeds the threshold.  This avoids snapping to interior artwork.
        best_offset = 0.0
        found = False

        for d in np.linspace(search_out, -search_in, 32):
            sx = int(round(pts[i][0] + normal[0] * d))
            sy = int(round(pts[i][1] + normal[1] * d))
            if 0 <= sx < w and 0 <= sy < h:
                val = mag[sy, sx]
                if val > min_edge_strength:
                    best_offset = d
                    found = True
                    break

        if found:
            result[i][0] = pts[i][0] + normal[0] * best_offset
            result[i][1] = pts[i][1] + normal[1] * best_offset

    return result.reshape(-1, 1, 2).astype(np.int32)


def _refine_box_edges(box_contour: np.ndarray, image: np.ndarray) -> np.ndarray:
    """Given a 4-point box, refine each edge by scanning perpendicular strips.

    For each of the 4 edges, sample gradient profiles at multiple points along
    the edge.  At each sample, find the OUTERMOST edge above threshold (not the
    strongest), then shift the entire edge to the median of those positions.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mag = _gradient_magnitude(gray)
    h, w = image.shape[:2]

    pts = box_contour.reshape(-1, 2).astype(np.float64)
    if len(pts) != 4:
        return box_contour

    # Determine which direction is "outward" for the box
    centre = pts.mean(axis=0)

    refined = pts.copy()

    for edge_idx in range(4):
        p1 = pts[edge_idx]
        p2 = pts[(edge_idx + 1) % 4]
        edge_vec = p2 - p1
        edge_len = np.linalg.norm(edge_vec)
        if edge_len < 5:
            continue
        edge_dir = edge_vec / edge_len
        normal = np.array([-edge_dir[1], edge_dir[0]])

        # Ensure normal points outward (away from box centre)
        edge_mid = (p1 + p2) / 2
        if np.dot(normal, edge_mid - centre) < 0:
            normal = -normal

        offsets = []
        for t in np.linspace(0.15, 0.85, 10):
            sample_pt = p1 + edge_vec * t

            # Scan from outermost to innermost: take the first edge above threshold
            found_d = None
            for d in np.linspace(10, -6, 33):
                sx = int(round(sample_pt[0] + normal[0] * d))
                sy = int(round(sample_pt[1] + normal[1] * d))
                if 0 <= sx < w and 0 <= sy < h:
                    val = mag[sy, sx]
                    if val > 30:
                        found_d = d
                        break

            if found_d is not None:
                offsets.append(found_d)

        if len(offsets) >= 4:
            median_shift = np.median(offsets)
            refined[edge_idx] += normal * median_shift
            refined[(edge_idx + 1) % 4] += normal * median_shift

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
    ones = np.ones((len(pts), 1))
    pts_h = np.hstack([pts, ones])
    transformed = (M @ pts_h.T).T
    new_contour = transformed.reshape(-1, 1, 2).astype(np.int32)

    return rotated, new_contour
