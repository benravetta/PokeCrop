"""Stage 2: Candidate detection — multi-pass contour finding.

Strategy for wrapped/packaged cards:
- Multiple detection passes at different scales and sensitivities
- Morphological blob detection to find the overall card region
- Gradient-based rectangle detection using Hough lines
- Hierarchical contour detection for nested card-in-wrapper scenarios
"""

import cv2
import numpy as np
from typing import List
from utils.geometry import contour_iou


def detect_candidates(
    image: np.ndarray,
    edge_sensitivity: float = 0.5,
    contour_threshold: float = 0.5,
) -> List[np.ndarray]:
    """Run multiple detection passes and return de-duplicated card-like candidates."""
    h, w = image.shape[:2]
    min_area = h * w * 0.02
    max_area = h * w * 0.95

    candidates: List[np.ndarray] = []

    candidates.extend(_pass_adaptive_threshold(image, min_area, max_area, contour_threshold))
    candidates.extend(_pass_canny(image, min_area, max_area, edge_sensitivity))
    candidates.extend(_pass_colour_segmentation(image, min_area, max_area))
    candidates.extend(_pass_otsu(image, min_area, max_area))
    candidates.extend(_pass_hierarchical(image, min_area, max_area, edge_sensitivity))
    candidates.extend(_pass_morphological_blob(image, min_area, max_area))
    candidates.extend(_pass_multi_scale_canny(image, min_area, max_area))
    candidates.extend(_pass_saturation_channel(image, min_area, max_area))

    candidates = _deduplicate(candidates, image.shape)
    return candidates


def _filter_contours(
    contours: list, min_area: float, max_area: float, min_rect_fill: float = 0.55
) -> List[np.ndarray]:
    """Keep contours that could be card-shaped rectangles."""
    results = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue

        peri = cv2.arcLength(cnt, True)
        if peri == 0:
            continue
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

        if 4 <= len(approx) <= 20:
            rect = cv2.minAreaRect(cnt)
            rect_area = rect[1][0] * rect[1][1]
            if rect_area > 0 and area / rect_area > min_rect_fill:
                results.append(cnt)

    return results


def _pass_adaptive_threshold(
    image: np.ndarray, min_area: float, max_area: float, threshold: float
) -> List[np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 11, 75, 75)

    results = []
    for block_offset in [0, 10, 20]:
        block_size = int(11 + (1 - threshold) * 20) + block_offset
        if block_size % 2 == 0:
            block_size += 1
        block_size = max(block_size, 3)

        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block_size, 2
        )

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results.extend(_filter_contours(contours, min_area, max_area))

        thresh_inv = cv2.bitwise_not(thresh)
        contours_inv, _ = cv2.findContours(thresh_inv, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results.extend(_filter_contours(contours_inv, min_area, max_area))

    return results


def _pass_canny(
    image: np.ndarray, min_area: float, max_area: float, sensitivity: float
) -> List[np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    results = []
    for low_base in [20, 40, 60, 80]:
        low = int(low_base + (1 - sensitivity) * 30)
        high = low * 3

        edges = cv2.Canny(blurred, low, high)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=2)
        edges = cv2.erode(edges, kernel, iterations=1)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results.extend(_filter_contours(contours, min_area, max_area))

    return results


def _pass_colour_segmentation(
    image: np.ndarray, min_area: float, max_area: float
) -> List[np.ndarray]:
    from utils.colour import detect_background_colour
    bg_colour = detect_background_colour(image)

    bg_lab = cv2.cvtColor(bg_colour.reshape(1, 1, 3), cv2.COLOR_BGR2LAB).astype(np.float64)
    img_lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float64)

    diff = np.sqrt(np.sum((img_lab - bg_lab) ** 2, axis=2))

    results = []
    for thresh_val in [15, 25, 35, 50]:
        fg_mask = (diff > thresh_val).astype(np.uint8) * 255

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=1)

        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results.extend(_filter_contours(contours, min_area, max_area))

    return results


def _pass_otsu(
    image: np.ndarray, min_area: float, max_area: float
) -> List[np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    found = _filter_contours(contours, min_area, max_area)

    thresh_inv = cv2.bitwise_not(thresh)
    contours_inv, _ = cv2.findContours(thresh_inv, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    found.extend(_filter_contours(contours_inv, min_area, max_area))

    return found


def _pass_hierarchical(
    image: np.ndarray, min_area: float, max_area: float, sensitivity: float
) -> List[np.ndarray]:
    """Hierarchical contour detection — finds nested shapes (card inside wrapper)."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    results = []
    for low_base in [15, 30, 50]:
        low = int(low_base + (1 - sensitivity) * 30)
        high = low * 3
        edges = cv2.Canny(blurred, low, high)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=2)

        contours, hierarchy = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        if hierarchy is None or len(contours) == 0:
            continue

        hier = hierarchy[0]

        for i, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)
            if area < min_area or area > max_area:
                continue

            peri = cv2.arcLength(cnt, True)
            if peri == 0:
                continue
            approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

            if 4 <= len(approx) <= 20:
                rect = cv2.minAreaRect(cnt)
                rect_area = rect[1][0] * rect[1][1]
                if rect_area > 0 and area / rect_area > 0.55:
                    results.append(cnt)

                    child_idx = hier[i][2]
                    while child_idx >= 0:
                        child = contours[child_idx]
                        child_area = cv2.contourArea(child)
                        if child_area >= min_area and child_area <= max_area:
                            child_peri = cv2.arcLength(child, True)
                            if child_peri > 0:
                                child_approx = cv2.approxPolyDP(child, 0.02 * child_peri, True)
                                if 4 <= len(child_approx) <= 20:
                                    child_rect = cv2.minAreaRect(child)
                                    child_rect_area = child_rect[1][0] * child_rect[1][1]
                                    if child_rect_area > 0 and child_area / child_rect_area > 0.55:
                                        results.append(child)
                        child_idx = hier[child_idx][0]

    return results


def _pass_morphological_blob(
    image: np.ndarray, min_area: float, max_area: float
) -> List[np.ndarray]:
    """Find the overall card blob using aggressive morphological operations.

    This is crucial for wrapped cards where the card+wrapper forms a single
    large blob.  We find the blob, then look for rectangular shapes within it.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    h, w = image.shape[:2]

    results = []

    # Approach 1: Strong blur + threshold to merge wrapper and card into one blob
    for ksize in [15, 25, 35]:
        blurred = cv2.GaussianBlur(gray, (ksize, ksize), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)
        opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=1)

        contours, _ = cv2.findContours(opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results.extend(_filter_contours(contours, min_area, max_area, min_rect_fill=0.50))

        inv = cv2.bitwise_not(opened)
        contours_inv, _ = cv2.findContours(inv, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results.extend(_filter_contours(contours_inv, min_area, max_area, min_rect_fill=0.50))

    # Approach 2: Edge-based with heavy dilation to connect broken edges
    edges = cv2.Canny(gray, 30, 90)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    edges = cv2.dilate(edges, kernel, iterations=5)
    edges = cv2.erode(edges, kernel, iterations=3)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    results.extend(_filter_contours(contours, min_area, max_area, min_rect_fill=0.50))

    return results


def _pass_multi_scale_canny(
    image: np.ndarray, min_area: float, max_area: float
) -> List[np.ndarray]:
    """Multi-scale edge detection — detect edges at multiple blur levels
    to catch both sharp card borders and soft wrapper boundaries."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    results = []

    for sigma in [1.0, 2.0, 4.0]:
        ksize = int(sigma * 6) | 1
        blurred = cv2.GaussianBlur(gray, (ksize, ksize), sigma)

        v = np.median(blurred)
        low = int(max(0, (1.0 - 0.33) * v))
        high = int(min(255, (1.0 + 0.33) * v))

        edges = cv2.Canny(blurred, low, high)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=2)
        edges = cv2.erode(edges, kernel, iterations=1)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results.extend(_filter_contours(contours, min_area, max_area))

    return results


def _pass_saturation_channel(
    image: np.ndarray, min_area: float, max_area: float
) -> List[np.ndarray]:
    """Use the saturation channel to separate colourful card from neutral wrapper/background."""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]

    results = []
    for thresh_val in [30, 50, 80]:
        _, mask = cv2.threshold(sat, thresh_val, 255, cv2.THRESH_BINARY)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results.extend(_filter_contours(contours, min_area, max_area, min_rect_fill=0.50))

    return results


def _deduplicate(candidates: List[np.ndarray], img_shape: tuple, iou_thresh: float = 0.7) -> List[np.ndarray]:
    """Remove near-duplicate candidates by IoU."""
    if len(candidates) <= 1:
        return candidates

    keep = []
    used = set()

    sorted_candidates = sorted(candidates, key=lambda c: cv2.contourArea(c), reverse=True)

    for i, c1 in enumerate(sorted_candidates):
        if i in used:
            continue
        keep.append(c1)
        for j in range(i + 1, len(sorted_candidates)):
            if j in used:
                continue
            if contour_iou(c1, sorted_candidates[j], img_shape) > iou_thresh:
                used.add(j)

    return keep
