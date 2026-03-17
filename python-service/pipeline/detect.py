"""Stage 2: Candidate detection — multi-pass contour finding."""

import cv2
import numpy as np
from typing import List
from utils.geometry import contour_iou
from utils.colour import detect_background_colour


def detect_candidates(
    image: np.ndarray,
    edge_sensitivity: float = 0.5,
    contour_threshold: float = 0.5,
) -> List[np.ndarray]:
    """Run multiple detection passes and return de-duplicated card-like candidates."""
    h, w = image.shape[:2]
    min_area = h * w * 0.03
    max_area = h * w * 0.95

    candidates: List[np.ndarray] = []

    candidates.extend(_pass_adaptive_threshold(image, min_area, max_area, contour_threshold))
    candidates.extend(_pass_canny(image, min_area, max_area, edge_sensitivity))
    candidates.extend(_pass_colour_segmentation(image, min_area, max_area))
    candidates.extend(_pass_otsu(image, min_area, max_area))
    candidates.extend(_pass_hierarchical(image, min_area, max_area, edge_sensitivity))

    candidates = _deduplicate(candidates, image.shape)
    return candidates


def _filter_contours(contours: list, min_area: float, max_area: float) -> List[np.ndarray]:
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

        if 4 <= len(approx) <= 16:
            rect = cv2.minAreaRect(cnt)
            rect_area = rect[1][0] * rect[1][1]
            if rect_area > 0 and area / rect_area > 0.65:
                results.append(cnt)

    return results


def _pass_adaptive_threshold(
    image: np.ndarray, min_area: float, max_area: float, threshold: float
) -> List[np.ndarray]:
    """Pass A: adaptive threshold + contour detection."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 11, 75, 75)

    block_size = int(11 + (1 - threshold) * 20)
    if block_size % 2 == 0:
        block_size += 1
    block_size = max(block_size, 3)

    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block_size, 2
    )

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    found = _filter_contours(contours, min_area, max_area)

    thresh_inv = cv2.bitwise_not(thresh)
    contours_inv, _ = cv2.findContours(thresh_inv, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    found.extend(_filter_contours(contours_inv, min_area, max_area))

    return found


def _pass_canny(
    image: np.ndarray, min_area: float, max_area: float, sensitivity: float
) -> List[np.ndarray]:
    """Pass B: Canny edge detection + contour finding."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    low = int(30 + (1 - sensitivity) * 70)
    high = low * 3

    edges = cv2.Canny(blurred, low, high)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=2)
    edges = cv2.erode(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return _filter_contours(contours, min_area, max_area)


def _pass_colour_segmentation(
    image: np.ndarray, min_area: float, max_area: float
) -> List[np.ndarray]:
    """Pass C: Background colour removal + contour detection."""
    bg_colour = detect_background_colour(image)

    bg_lab = cv2.cvtColor(bg_colour.reshape(1, 1, 3), cv2.COLOR_BGR2LAB).astype(np.float64)
    img_lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float64)

    diff = np.sqrt(np.sum((img_lab - bg_lab) ** 2, axis=2))

    results = []
    for thresh_val in [20, 30, 45]:
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
    """Pass D: Otsu's global threshold — good for high-contrast scans."""
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
    """Pass E: Hierarchical contour detection — finds nested shapes (card inside wrapper).

    Uses RETR_TREE to capture parent-child relationships, then extracts both
    outer and inner contours that pass the card-shape filter.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    low = int(20 + (1 - sensitivity) * 50)
    high = low * 3
    edges = cv2.Canny(blurred, low, high)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=2)

    contours, hierarchy = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    if hierarchy is None or len(contours) == 0:
        return []

    results = []
    hier = hierarchy[0]

    for i, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue

        peri = cv2.arcLength(cnt, True)
        if peri == 0:
            continue
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

        if 4 <= len(approx) <= 16:
            rect = cv2.minAreaRect(cnt)
            rect_area = rect[1][0] * rect[1][1]
            if rect_area > 0 and area / rect_area > 0.65:
                results.append(cnt)

                # Also check children of this contour (inner shapes)
                child_idx = hier[i][2]
                while child_idx >= 0:
                    child = contours[child_idx]
                    child_area = cv2.contourArea(child)
                    if child_area >= min_area and child_area <= max_area:
                        child_peri = cv2.arcLength(child, True)
                        if child_peri > 0:
                            child_approx = cv2.approxPolyDP(child, 0.02 * child_peri, True)
                            if 4 <= len(child_approx) <= 16:
                                child_rect = cv2.minAreaRect(child)
                                child_rect_area = child_rect[1][0] * child_rect[1][1]
                                if child_rect_area > 0 and child_area / child_rect_area > 0.65:
                                    results.append(child)
                    child_idx = hier[child_idx][0]

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
