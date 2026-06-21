"""Find the trading card rectangle in an image.

A trading card is always 63mm x 88mm (ratio 0.716).  This module finds all
rectangles in the image and picks the one that best matches those dimensions.

The approach is intentionally simple:
1. Find rectangles using multiple edge/threshold methods
2. For each rectangle, score it by how close its aspect ratio is to 0.716
3. Pick the best one
4. Optionally straighten it
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional
from utils.geometry import order_corners

CARD_RATIO = 63.0 / 88.0  # 0.7159


def find_card(
    image: np.ndarray,
    edge_sensitivity: float = 0.5,
    contour_threshold: float = 0.5,
) -> Tuple[Optional[np.ndarray], List[np.ndarray], int]:
    """Find the trading card in the image.

    Returns:
        card_rect_pts: 4-point array of the card corners (or None)
        all_rects: list of all detected rectangles (for overlay)
        selected_idx: index of the chosen rectangle in all_rects
    """
    h, w = image.shape[:2]
    img_area = h * w
    min_area = img_area * 0.01
    max_area = img_area * 0.98

    all_rects = _find_all_rectangles(image, min_area, max_area, edge_sensitivity, contour_threshold)

    if not all_rects:
        return None, [], -1

    best_idx = _choose_best_rectangle(all_rects, image, img_area)

    if best_idx < 0:
        return None, all_rects, -1

    return all_rects[best_idx], all_rects, best_idx


def _choose_best_rectangle(
    rects: List[np.ndarray],
    image: np.ndarray,
    img_area: float,
) -> int:
    """Choose the best rectangle that represents the physical card.

    Two structures look card-shaped and nest inside each other:
    - a plastic sleeve/toploader AROUND the card — only slightly larger, with a
      thin, UNIFORM (low-texture) plastic margin between it and the card.
    - the card's own inner ARTWORK frame — much smaller than the card and
      separated from the card edge by a TEXTURED, coloured border.

    A raw card always contains an inner artwork frame, so we must not treat the
    outer (real) card as a "wrapper" just because it has a card-shaped child.
    We disambiguate by measuring the texture of the ring between the two:
    uniform ring => the outer is a sleeve (prefer the inner); textured ring =>
    the outer is the real card (prefer the outer).
    """
    h, w = image.shape[:2]
    masks = []
    areas = []
    ratios = []
    base_scores = []

    for cnt in rects:
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(mask, [cnt], -1, 255, -1)
        masks.append(mask)
        areas.append(float(np.count_nonzero(mask)))

        rect = cv2.minAreaRect(cnt)
        rw, rh = rect[1]
        short, long = sorted([rw, rh])
        ratios.append(short / long if long > 0 else 0.0)
        base_scores.append(_score_rectangle(cnt, image, img_area))

    best_idx = -1
    best_score = -1e9

    for i in range(len(rects)):
        score = base_scores[i]
        rel_size = areas[i] / img_area if img_area > 0 else 0.0

        for j in range(len(rects)):
            if i == j or areas[i] <= 0 or areas[j] <= 0:
                continue
            overlap = float(np.count_nonzero(masks[i] & masks[j]))

            # --- i is nested inside the larger rectangle j ---
            if areas[j] > areas[i] * 1.03 and overlap / areas[i] > 0.82:
                child_rel = areas[i] / areas[j]
                if child_rel >= 0.80 and _ring_is_uniform(masks[j], masks[i], image):
                    # j is a sleeve/toploader hugging i: i is the real card.
                    score += 0.28
                elif child_rel <= 0.82:
                    # j is the real card and i is its inner artwork frame.
                    score -= 0.42

            # --- i contains the smaller rectangle j ---
            if areas[i] > areas[j] * 1.03 and overlap / areas[j] > 0.82:
                child_rel = areas[j] / areas[i]
                if child_rel >= 0.80 and _ring_is_uniform(masks[i], masks[j], image):
                    # i is a sleeve around j: penalise i.
                    score -= 0.30
                elif 0.30 <= child_rel <= 0.82 and abs(ratios[i] - CARD_RATIO) < 0.12:
                    # i is the real card containing its inner artwork frame.
                    score += 0.18

        # Only penalise rectangles that span almost the whole frame (likely the
        # background/scan bed), not a card photographed close up.
        if rel_size > 0.93:
            score -= 0.12

        if score > best_score:
            best_score = score
            best_idx = i

    return best_idx


def _ring_is_uniform(outer_mask: np.ndarray, inner_mask: np.ndarray, image: np.ndarray) -> bool:
    """True when the band between an outer and inner rectangle is low-texture.

    A plastic sleeve leaves a thin, near-uniform margin around the card; a card's
    coloured border between its edge and inner artwork is textured/saturated.
    """
    ring = cv2.subtract(outer_mask, inner_mask)
    # Pull the ring away from both edges so we sample the band itself, not the
    # high-contrast transitions at the rectangle boundaries.
    ring = cv2.erode(ring, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1)
    pixels = image[ring > 0]
    if pixels.ndim == 1:
        pixels = pixels.reshape(-1, 3)
    if len(pixels) < 80:
        return False
    lab = cv2.cvtColor(pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).astype(np.float32).reshape(-1, 3)
    spread = float(np.std(lab, axis=0).mean())
    return spread < 9.0


def detect_card_quad(card_contour: np.ndarray, image: np.ndarray) -> np.ndarray:
    """Locate the four outer corners of the physical card border.

    Recovers the true quadrilateral (so perspective tilt is corrected), expands
    only when the initial fit looks tight, refines in card-space, then snaps to
    the table→card transition so background is excluded.
    """
    box = _quad_from_contour(card_contour)
    if _box_needs_outward_expand(box, image):
        box = _expand_box_to_outer_border(box, image)
    box = _refine_box_in_card_space(box, image)
    box = _fit_box_to_card_edges(box, image)
    return order_corners(box.astype(np.float32))


def _quad_from_contour(card_contour: np.ndarray) -> np.ndarray:
    """Recover the card's true four corners, handling perspective tilt.

    ``cv2.minAreaRect`` only yields a rotated *rectangle*, which is wrong for a
    card photographed at an angle (its outline is a keystone trapezoid). We
    approximate the contour's convex hull down to a 4-point polygon to get the
    real corners, and fall back to the rotated rectangle when the contour is too
    noisy or partial to give a clean, full-size quad.
    """
    rect = cv2.minAreaRect(card_contour)
    box = cv2.boxPoints(rect).astype(np.float64)
    rect_area = float(rect[1][0]) * float(rect[1][1])
    if rect_area <= 0:
        return box

    hull = cv2.convexHull(card_contour)
    peri = cv2.arcLength(hull, True)
    hull_area = float(cv2.contourArea(hull))
    if peri <= 0 or hull_area <= 0:
        return box

    quad = None
    for frac in (0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10):
        approx = cv2.approxPolyDP(hull, frac * peri, True)
        if len(approx) == 4 and cv2.isContourConvex(approx):
            quad = approx.reshape(4, 2).astype(np.float64)
            break

    if quad is None:
        return box

    # The 4-point approximation should faithfully cover the contour's convex
    # hull. Compare against the hull (NOT the rotated bounding rect): a genuine
    # perspective trapezoid is legitimately smaller than its bounding rectangle,
    # so using the rect as reference would wrongly reject correct quads.
    quad_area = float(cv2.contourArea(quad.astype(np.float32)))
    if quad_area < hull_area * 0.88:
        return box

    # Reject degenerate quads (near-collinear points / slivers).
    side_lengths = [
        float(np.linalg.norm(quad[(k + 1) % 4] - quad[k])) for k in range(4)
    ]
    if min(side_lengths) < 0.05 * max(side_lengths):
        return box

    return order_corners(quad.astype(np.float32)).astype(np.float64)


def _box_needs_outward_expand(box: np.ndarray, image: np.ndarray) -> bool:
    """Return True only when the box likely cuts off the printed border."""
    if _box_has_table_margin(box, image):
        return False

    ordered = order_corners(box.reshape(4, 2).astype(np.float32))
    card_w = max(np.linalg.norm(ordered[1] - ordered[0]), np.linalg.norm(ordered[2] - ordered[1]))
    card_h = max(np.linalg.norm(ordered[3] - ordered[0]), np.linalg.norm(ordered[2] - ordered[1]))
    short = min(card_w, card_h)
    long = max(card_w, card_h)
    if short < 20:
        return True

    ratio = short / long if long > 0 else 0.0
    if abs(ratio - CARD_RATIO) > 0.06:
        return True

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    pad = int(np.clip(short * 0.04, 4, 14))
    x1 = int(max(0, np.floor(np.min(ordered[:, 0])) + pad))
    x2 = int(min(image.shape[1] - 1, np.ceil(np.max(ordered[:, 0])) - pad))
    y1 = int(max(0, np.floor(np.min(ordered[:, 1])) + pad))
    y2 = int(min(image.shape[0] - 1, np.ceil(np.max(ordered[:, 1])) - pad))
    if x2 <= x1 + 5 or y2 <= y1 + 5:
        return True

    edge_band = max(int(short * 0.05), 6)
    outer = np.concatenate(
        [
            gray[y1 : y1 + edge_band, x1:x2].reshape(-1),
            gray[y2 - edge_band : y2, x1:x2].reshape(-1),
            gray[y1:y2, x1 : x1 + edge_band].reshape(-1),
            gray[y1:y2, x2 - edge_band : x2].reshape(-1),
        ]
    )
    inner_y1 = y1 + edge_band * 2
    inner_y2 = y2 - edge_band * 2
    inner_x1 = x1 + edge_band * 2
    inner_x2 = x2 - edge_band * 2
    if inner_y2 <= inner_y1 or inner_x2 <= inner_x1:
        return True
    inner = gray[inner_y1:inner_y2, inner_x1:inner_x2].reshape(-1)
    if inner.size == 0 or outer.size ==  0:
        return True

    return float(np.mean(outer)) > float(np.mean(inner)) + 8.0


def _box_has_table_margin(box: np.ndarray, image: np.ndarray) -> bool:
    """True when the box interior still contains a uniform table/scan margin."""
    ordered = order_corners(box.reshape(4, 2).astype(np.float32))
    x1 = int(np.floor(np.min(ordered[:, 0])))
    x2 = int(np.ceil(np.max(ordered[:, 0])))
    y1 = int(np.floor(np.min(ordered[:, 1])))
    y2 = int(np.ceil(np.max(ordered[:, 1])))
    ih, iw = image.shape[:2]
    x1, x2 = max(0, x1), min(iw - 1, x2)
    y1, y2 = max(0, y1), min(ih - 1, y2)
    bw, bh = x2 - x1, y2 - y1
    if bw < 40 or bh < 40:
        return False

    band_x = max(int(bw * 0.08), 8)
    band_y = max(int(bh * 0.08), 8)
    top = image[y1 : y1 + band_y, x1 + band_x : x2 - band_x]
    bottom = image[y2 - band_y : y2, x1 + band_x : x2 - band_x]
    left = image[y1 + band_y : y2 - band_y, x1 : x1 + band_x]
    right = image[y1 + band_y : y2 - band_y, x2 - band_x : x2]
    if min(top.size, bottom.size, left.size, right.size) == 0:
        return False

    samples = np.vstack(
        [
            top.reshape(-1, 3),
            bottom.reshape(-1, 3),
            left.reshape(-1, 3),
            right.reshape(-1, 3),
        ]
    )
    lab = cv2.cvtColor(samples.reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).astype(np.float32).reshape(-1, 3)
    spread = np.std(lab, axis=0).mean()
    top_only = cv2.cvtColor(top.reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).astype(np.float32).reshape(-1, 3)
    top_spread = np.std(top_only, axis=0).mean()
    return spread < 8.0 or top_spread < 6.5


def straighten_card(
    card_contour: np.ndarray,
    image: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, float]:
    """Straighten the card and return the 4 corners on the straightened image.

    Returns:
        corners: 4-point contour on the (possibly rotated) image
        processed_image: the image after rotation
        rotation_angle: degrees rotated
    """
    rect = cv2.minAreaRect(card_contour)
    box = detect_card_quad(card_contour, image).astype(np.float64)
    angle = rect[2]

    if angle < -45:
        angle += 90
    elif angle > 45:
        angle -= 90

    processed = image
    rotation = 0.0

    if abs(angle) > 0.3:
        processed, box = _rotate_image_and_points(image, box, angle)
        rotation = angle
        box = _fit_box_to_card_edges(box, processed)
        box = _refine_box_in_card_space(box, processed)

    return box.astype(np.int32).reshape(-1, 1, 2), processed, rotation


def normalize_card_orientation(
    contour: np.ndarray,
    image: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, bool]:
    """Rotate the rectified card 180 degrees when it is upside down.

    The rectangle step solves arbitrary angle alignment, but a trading card
    still has a 180-degree ambiguity. We resolve that by warping the detected
    card to a canonical portrait crop and scoring whether the crop looks more
    like the top or bottom of a real card. If the upside-down version scores
    better, we rotate the working image and contour by 180 degrees.
    """
    warped = _warp_card_view(image, contour)
    if warped is None or warped.size == 0:
        return contour, image, False

    if not should_flip_card_180(warped):
        return contour, image, False

    rotated_image = cv2.rotate(image, cv2.ROTATE_180)
    h, w = image.shape[:2]
    pts = contour.reshape(-1, 2).astype(np.float64)
    pts[:, 0] = (w - 1) - pts[:, 0]
    pts[:, 1] = (h - 1) - pts[:, 1]
    rotated_contour = pts.reshape(-1, 1, 2).astype(np.int32)
    return rotated_contour, rotated_image, True


def _warp_card_view(image: np.ndarray, contour: np.ndarray) -> Optional[np.ndarray]:
    """Perspective-warp the detected card into a portrait crop for scoring."""
    pts = contour.reshape(-1, 2).astype(np.float32)
    if len(pts) != 4:
        rect = cv2.minAreaRect(contour)
        pts = cv2.boxPoints(rect).astype(np.float32)

    corners = order_corners(pts.astype(np.float32))
    tl, tr, br, bl = corners

    width_top = np.linalg.norm(tr - tl)
    width_bottom = np.linalg.norm(br - bl)
    height_left = np.linalg.norm(bl - tl)
    height_right = np.linalg.norm(br - tr)

    out_w = int(round(max(width_top, width_bottom)))
    out_h = int(round(max(height_left, height_right)))

    if out_w < 20 or out_h < 20:
        return None

    # Force portrait output (height > width) with a consistent corner order.
    if out_w > out_h:
        out_w, out_h = out_h, out_w
        corners = np.array([bl, tl, tr, br], dtype=np.float32)

    dst = np.array(
        [[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(corners, dst)
    warped = cv2.warpPerspective(
        image, M, (out_w, out_h), flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255)
    )
    return warped


def _outward_edge_normal(
    p1: np.ndarray,
    p2: np.ndarray,
    centre: np.ndarray,
) -> np.ndarray:
    edge_vec = p2 - p1
    edge_len = np.linalg.norm(edge_vec)
    if edge_len < 5:
        return np.zeros(2, dtype=np.float64)
    edge_dir = edge_vec / edge_len
    normal = np.array([-edge_dir[1], edge_dir[0]], dtype=np.float64)
    edge_mid = (p1 + p2) / 2.0
    if np.dot(normal, edge_mid - centre) < 0:
        normal = -normal
    return normal


def _corner_gradient_strength(
    mag: np.ndarray,
    pt: np.ndarray,
    image_shape: Tuple[int, int],
) -> float:
    h, w = image_shape
    x, y = int(round(pt[0])), int(round(pt[1]))
    r = 2
    x0, x1 = max(0, x - r), min(w, x + r + 1)
    y0, y1 = max(0, y - r), min(h, y + r + 1)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    return float(np.mean(mag[y0:y1, x0:x1]))


def _snap_corners_to_outer_edges(box: np.ndarray, image: np.ndarray) -> np.ndarray:
    """Snap each corner outward to the strongest visible outer border transition."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gx = cv2.Scharr(gray, cv2.CV_64F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_64F, 0, 1)
    mag = np.sqrt(gx ** 2 + gy ** 2)

    pts = order_corners(box.reshape(4, 2).astype(np.float64))
    centre = pts.mean(axis=0)
    short_side = min(
        np.linalg.norm(pts[1] - pts[0]),
        np.linalg.norm(pts[2] - pts[1]),
    )
    max_probe = int(np.clip(short_side * 0.06, 8, 24))
    refined = pts.copy()

    for i in range(4):
        prev_pt = pts[(i - 1) % 4]
        curr_pt = pts[i]
        next_pt = pts[(i + 1) % 4]

        e1 = _outward_edge_normal(prev_pt, curr_pt, centre)
        e2 = _outward_edge_normal(curr_pt, next_pt, centre)
        bisector = e1 + e2
        bn = np.linalg.norm(bisector)
        if bn > 0.2:
            bisector = bisector / bn
            if np.dot(bisector, curr_pt - centre) < 0:
                bisector = -bisector
        else:
            bisector = None

        base_score = _corner_gradient_strength(mag, curr_pt, image.shape[:2])
        best = curr_pt
        best_score = base_score

        directions = [e1, e2]
        if bisector is not None:
            directions.append(bisector)

        for direction in directions:
            if np.linalg.norm(direction) < 0.1:
                continue
            for d in range(1, max_probe + 1):
                cand = curr_pt + direction * d
                if np.linalg.norm(cand - centre) < np.linalg.norm(curr_pt - centre) - 0.5:
                    continue
                score = _corner_gradient_strength(mag, cand, image.shape[:2])
                if score > best_score:
                    best_score = score
                    best = cand

        refined[i] = best

    h, w = image.shape[:2]
    refined[:, 0] = np.clip(refined[:, 0], 0, w - 1)
    refined[:, 1] = np.clip(refined[:, 1], 0, h - 1)
    return refined


def _snap_axis_aligned_box_inward(box: np.ndarray, image: np.ndarray) -> np.ndarray:
    """Tighten an axis-aligned box by removing table/background margins inside it."""
    ordered = order_corners(box.reshape(4, 2).astype(np.float32))
    x1 = int(np.floor(np.min(ordered[:, 0])))
    x2 = int(np.ceil(np.max(ordered[:, 0])))
    y1 = int(np.floor(np.min(ordered[:, 1])))
    y2 = int(np.ceil(np.max(ordered[:, 1])))

    ih, iw = image.shape[:2]
    x1 = max(0, min(x1, iw - 2))
    x2 = max(x1 + 2, min(x2, iw - 1))
    y1 = max(0, min(y1, ih - 2))
    y2 = max(y1 + 2, min(y2, ih - 1))

    bw, bh = x2 - x1, y2 - y1
    if bw < 30 or bh < 30:
        return box

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mx = max(int(bw * 0.08), 8)
    my = max(int(bh * 0.08), 8)
    xs, xe = x1 + mx, x2 - mx

    search_y = min(max(int(bh * 0.12), 12), 80)
    search_x = min(max(int(bw * 0.12), 12), 60)

    def row_energy(y: int) -> float:
        if y < 0 or y >= ih:
            return 0.0
        return float(np.var(gray[y, xs:xe])) + float(np.mean(hsv[y, xs:xe, 1])) * 0.4

    def col_energy(x: int) -> float:
        if x < 0 or x >= iw:
            return 0.0
        return float(np.var(gray[y1:y2, x])) + float(np.mean(hsv[y1:y2, x, 1])) * 0.4

    top_scores = [row_energy(y) for y in range(y1, min(y1 + search_y, y2))]
    new_y1 = y1 + int(np.argmax(top_scores)) if top_scores else y1

    bottom_start = max(y2 - search_y, new_y1 + 10)
    bottom_scores = [row_energy(y) for y in range(bottom_start, y2)]
    new_y2 = bottom_start + int(np.argmax(bottom_scores)) if bottom_scores else y2

    left_scores = [col_energy(x) for x in range(x1, min(x1 + search_x, x2))]
    new_x1 = x1 + int(np.argmax(left_scores)) if left_scores else x1

    right_start = max(x2 - search_x, new_x1 + 10)
    right_scores = [col_energy(x) for x in range(right_start, x2)]
    new_x2 = right_start + int(np.argmax(right_scores)) if right_scores else x2

    if new_x2 - new_x1 < bw * 0.55 or new_y2 - new_y1 < bh * 0.55:
        return box

    tightened = np.array(
        [[new_x1, new_y1], [new_x2, new_y1], [new_x2, new_y2], [new_x1, new_y2]],
        dtype=np.float64,
    )
    return tightened


def should_flip_card_180(card_crop: np.ndarray) -> bool:
    """Return True when a portrait card crop appears upside down."""
    upright = _upright_score(card_crop)
    flipped = _upright_score(cv2.rotate(card_crop, cv2.ROTATE_180))
    margin = max(abs(upright), abs(flipped), 1.0) * 0.08 + 0.03
    return flipped > upright + margin


def _upright_score(card_crop: np.ndarray) -> float:
    """Score how likely a portrait card crop is upright (higher = more upright).

    Combines:
    - fine detail density (attack text / rules at bottom)
    - horizontal text-band energy (bottom-heavy on TCG cards)
    - title-bar contrast near the top edge
    """
    if card_crop.shape[0] < 40 or card_crop.shape[1] < 20:
        return 0.0

    target_h = 1000
    target_w = max(1, int(round(target_h * CARD_RATIO)))
    crop = cv2.resize(card_crop, (target_w, target_h), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    blackhat = cv2.morphologyEx(
        gray,
        cv2.MORPH_BLACKHAT,
        cv2.getStructuringElement(cv2.MORPH_RECT, (21, 5)),
    )
    edges = cv2.Canny(gray, 60, 160)
    vert = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3))
    horiz = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3))

    h = gray.shape[0]
    top = slice(0, int(h * 0.18))
    mid_top = slice(int(h * 0.08), int(h * 0.22))
    bottom = slice(int(h * 0.68), int(h * 0.98))

    top_detail = (
        float(np.mean(blackhat[top])) * 0.55
        + float(np.mean(edges[top])) * 0.30
        + float(np.mean(vert[top])) * 0.15
    )
    bottom_detail = (
        float(np.mean(blackhat[bottom])) * 0.55
        + float(np.mean(edges[bottom])) * 0.30
        + float(np.mean(vert[bottom])) * 0.15
    )
    detail_score = bottom_detail - top_detail

    top_text = float(np.mean(horiz[mid_top]))
    bottom_text = float(np.mean(horiz[bottom]))
    text_score = (bottom_text - top_text) / max(top_text, 1.0)

    return detail_score * 0.65 + text_score * 0.35


def _expand_box_to_outer_border(box: np.ndarray, image: np.ndarray) -> np.ndarray:
    """Expand a detected card-face box out to the visible outer card border.

    The selected rectangle often hugs the inner printed face and cuts off the
    coloured border. We fix that by shifting each of the 4 edges outward until
    we hit the first strong outer edge after a quiet border band.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gx = cv2.Scharr(gray, cv2.CV_64F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_64F, 0, 1)
    mag = np.sqrt(gx ** 2 + gy ** 2)

    pts = box.reshape(4, 2).astype(np.float64)
    centre = pts.mean(axis=0)
    short_side = min(
        np.linalg.norm(pts[1] - pts[0]),
        np.linalg.norm(pts[2] - pts[1]),
    )
    max_probe = int(np.clip(short_side * 0.16, 12, 52))

    corner_shifts = [np.zeros(2, dtype=np.float64) for _ in range(4)]
    corner_counts = [0, 0, 0, 0]
    safety_pad = float(np.clip(short_side * 0.012, 2.0, 6.0))

    for edge_idx in range(4):
        p1 = pts[edge_idx]
        p2 = pts[(edge_idx + 1) % 4]
        edge_vec = p2 - p1
        edge_len = np.linalg.norm(edge_vec)
        if edge_len < 5:
            continue

        edge_dir = edge_vec / edge_len
        normal = np.array([-edge_dir[1], edge_dir[0]], dtype=np.float64)
        edge_mid = (p1 + p2) / 2.0
        if np.dot(normal, edge_mid - centre) < 0:
            normal = -normal

        offsets = []
        for t in np.linspace(0.12, 0.88, 16):
            sample_pt = p1 + edge_vec * t
            d = _find_outer_edge_offset(sample_pt, normal, mag, image.shape[:2], max_probe)
            if d is not None:
                offsets.append(d)

        if len(offsets) < 4:
            continue

        # If some samples found a real outer edge but others returned zero,
        # a plain median is too conservative and shaves visible border off.
        # Bias slightly outward, then add a small safety pad so weak-contrast
        # edges still keep the full printed border.
        positive_offsets = [d for d in offsets if d > 0.5]
        if len(positive_offsets) >= 3:
            edge_shift = float(np.percentile(positive_offsets, 60))
        else:
            edge_shift = float(np.median(offsets))

        shift_vec = normal * (edge_shift + safety_pad)
        i1 = edge_idx
        i2 = (edge_idx + 1) % 4
        corner_shifts[i1] += shift_vec
        corner_counts[i1] += 1
        corner_shifts[i2] += shift_vec
        corner_counts[i2] += 1

    expanded = pts.copy()
    for i in range(4):
        if corner_counts[i] > 0:
            expanded[i] += corner_shifts[i] / corner_counts[i]

    h, w = image.shape[:2]
    expanded[:, 0] = np.clip(expanded[:, 0], 0, w - 1)
    expanded[:, 1] = np.clip(expanded[:, 1], 0, h - 1)
    return _pad_box_outward(expanded, safety_pad * 0.5, image.shape[:2])


def _refine_box_in_card_space(box: np.ndarray, image: np.ndarray) -> np.ndarray:
    """Refine box edges in a rectified card-space view.

    Local edge probes can fail when part of an edge is weak, reflective or low
    contrast. This pass warps a padded version of the card into card-space and
    scores each side using full-edge profiles, making the final border fit more
    stable for scans and flat-lay photos.
    """
    ordered = order_corners(box.astype(np.float32))
    tl, tr, br, bl = ordered

    width_top = np.linalg.norm(tr - tl)
    width_bottom = np.linalg.norm(br - bl)
    height_left = np.linalg.norm(bl - tl)
    height_right = np.linalg.norm(br - tr)
    card_w = int(round(max(width_top, width_bottom)))
    card_h = int(round(max(height_left, height_right)))

    if card_w < 30 or card_h < 30:
        return box

    margin = int(np.clip(min(card_w, card_h) * 0.08, 10, 32))
    padded = _pad_box_outward(ordered, float(margin), image.shape[:2]).astype(np.float32)
    padded = order_corners(padded)

    canvas_w = int(card_w + margin * 2)
    canvas_h = int(card_h + margin * 2)
    dst = np.array(
        [[0, 0], [canvas_w - 1, 0], [canvas_w - 1, canvas_h - 1], [0, canvas_h - 1]],
        dtype=np.float32,
    )

    M = cv2.getPerspectiveTransform(padded, dst)
    warped = cv2.warpPerspective(
        image,
        M,
        (canvas_w, canvas_h),
        flags=cv2.INTER_LINEAR,
        borderValue=(255, 255, 255),
    )

    warped_box = cv2.perspectiveTransform(ordered.reshape(1, 4, 2), M)[0]
    xs = warped_box[:, 0]
    ys = warped_box[:, 1]
    expected = {
        "left": float(np.min(xs)),
        "right": float(np.max(xs)),
        "top": float(np.min(ys)),
        "bottom": float(np.max(ys)),
    }

    refined_rect = _detect_outer_rect_in_warped(warped, expected, margin)
    if refined_rect is None:
        return box

    left, top, right, bottom = refined_rect
    max_outward = float(np.clip(min(card_w, card_h) * 0.02, 3.0, 8.0))
    max_inward = float(np.clip(min(card_w, card_h) * 0.04, 3.0, 18.0))

    left = float(np.clip(left, expected["left"] - max_outward, expected["left"] + max_inward))
    top = float(np.clip(top, expected["top"] - max_outward, expected["top"] + max_inward))
    right = float(np.clip(right, expected["right"] - max_inward, expected["right"] + max_outward))
    bottom = float(np.clip(bottom, expected["bottom"] - max_inward, expected["bottom"] + max_outward))

    refined_dst = np.array(
        [[left, top], [right, top], [right, bottom], [left, bottom]],
        dtype=np.float32,
    )

    M_inv = np.linalg.inv(M)
    refined_src = cv2.perspectiveTransform(refined_dst.reshape(1, 4, 2), M_inv)[0]
    refined_src = order_corners(refined_src)
    return refined_src.astype(np.float64)


def _fit_box_to_card_edges(box: np.ndarray, image: np.ndarray) -> np.ndarray:
    """Tighten a loose quad to the physical card border in rectified card-space.

    Samples the table/scan background from the padded canvas margin, then scans
    inward on each side for the first strong foreground transition.
    """
    ordered = order_corners(box.astype(np.float32))
    tl, tr, br, bl = ordered

    card_w = int(round(max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))))
    card_h = int(round(max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))))
    if card_w < 30 or card_h < 30:
        return box

    margin = int(np.clip(min(card_w, card_h) * 0.10, 12, 40))
    padded = _pad_box_outward(ordered, float(margin), image.shape[:2]).astype(np.float32)
    padded = order_corners(padded)

    canvas_w = int(card_w + margin * 2)
    canvas_h = int(card_h + margin * 2)
    dst = np.array(
        [[0, 0], [canvas_w - 1, 0], [canvas_w - 1, canvas_h - 1], [0, canvas_h - 1]],
        dtype=np.float32,
    )

    M = cv2.getPerspectiveTransform(padded, dst)
    warped = cv2.warpPerspective(
        image,
        M,
        (canvas_w, canvas_h),
        flags=cv2.INTER_LINEAR,
        borderValue=(255, 255, 255),
    )

    lab = cv2.cvtColor(warped, cv2.COLOR_BGR2LAB).astype(np.float32)
    ring = max(int(min(canvas_w, canvas_h) * 0.06), 6)
    border_pixels = np.vstack(
        [
            lab[:ring, :].reshape(-1, 3),
            lab[-ring:, :].reshape(-1, 3),
            lab[:, :ring].reshape(-1, 3),
            lab[:, -ring:].reshape(-1, 3),
        ]
    )
    bg_lab = np.median(border_pixels, axis=0)

    warped_box = cv2.perspectiveTransform(ordered.reshape(1, 4, 2), M)[0]
    xs = warped_box[:, 0]
    ys = warped_box[:, 1]
    expected = {
        "left": float(np.min(xs)),
        "right": float(np.max(xs)),
        "top": float(np.min(ys)),
        "bottom": float(np.max(ys)),
    }

    inner_top = lab[
        int(expected["top"]) : int(expected["top"]) + ring,
        int(expected["left"]) + ring : int(expected["right"]) - ring,
    ]
    if inner_top.size > 0:
        top_bg = np.median(inner_top.reshape(-1, 3), axis=0)
        if np.linalg.norm(top_bg - bg_lab) < 10.0:
            bg_lab = top_bg

    dist = np.linalg.norm(lab - bg_lab, axis=2)

    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    grad_x = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3))
    grad_y = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3))

    rect = _detect_outer_rect_in_warped(warped, expected, margin)
    if rect is not None:
        left, top, right, bottom = rect
        max_outward = float(np.clip(min(card_w, card_h) * 0.008, 1.0, 4.0))
        max_inward = float(np.clip(min(card_w, card_h) * 0.10, 8.0, 45.0))
        left = float(np.clip(left, expected["left"] - max_outward, expected["left"] + max_inward))
        top = float(np.clip(top, expected["top"] - max_outward, expected["top"] + max_inward))
        right = float(np.clip(right, expected["right"] - max_inward, expected["right"] + max_outward))
        bottom = float(np.clip(bottom, expected["bottom"] - max_inward, expected["bottom"] + max_outward))
    else:
        y0 = int(canvas_h * 0.08)
        y1 = int(canvas_h * 0.92)
        x0 = int(canvas_w * 0.08)
        x1 = int(canvas_w * 0.92)
        threshold = float(np.clip(np.percentile(dist[:ring, :], 70), 12.0, 28.0))
        edge_pad = float(np.clip(min(card_w, card_h) * 0.004, 1.0, 3.0))

        def row_score(y: int) -> float:
            band = dist[y, x0:x1]
            edge = float(np.mean(grad_y[max(0, y - 1) : min(canvas_h, y + 2), x0:x1]))
            fg = float(np.mean(band > threshold))
            return fg * 2.2 + edge * 0.01

        def col_score(x: int) -> float:
            band = dist[y0:y1, x]
            edge = float(np.mean(grad_x[y0:y1, max(0, x - 1) : min(canvas_w, x + 2)]))
            fg = float(np.mean(band > threshold))
            return fg * 2.2 + edge * 0.01

        top = 0.0
        for y in range(0, canvas_h // 2):
            if row_score(y) > 0.55:
                top = max(0.0, y - edge_pad)
                break

        bottom = float(canvas_h - 1)
        for y in range(canvas_h - 1, canvas_h // 2, -1):
            if row_score(y) > 0.55:
                bottom = min(float(canvas_h - 1), y + edge_pad)
                break

        left = 0.0
        for x in range(0, canvas_w // 2):
            if col_score(x) > 0.55:
                left = max(0.0, x - edge_pad)
                break

        right = float(canvas_w - 1)
        for x in range(canvas_w - 1, canvas_w // 2, -1):
            if col_score(x) > 0.55:
                right = min(float(canvas_w - 1), x + edge_pad)
                break

    border_pad = float(np.clip(min(card_w, card_h) * 0.004, 1.0, 3.0))
    left = max(0.0, left - border_pad)
    top = max(0.0, top - border_pad)
    right = min(float(canvas_w - 1), right + border_pad)
    bottom = min(float(canvas_h - 1), bottom + border_pad)

    if right - left < card_w * 0.55 or bottom - top < card_h * 0.55:
        return box

    fitted_dst = np.array(
        [[left, top], [right, top], [right, bottom], [left, bottom]],
        dtype=np.float32,
    )
    M_inv = np.linalg.inv(M)
    fitted_src = cv2.perspectiveTransform(fitted_dst.reshape(1, 4, 2), M_inv)[0]
    return order_corners(fitted_src).astype(np.float64)


def _detect_outer_rect_in_warped(
    warped: np.ndarray,
    expected: dict,
    margin: int,
) -> Optional[Tuple[float, float, float, float]]:
    """Find the physical outer card rectangle in the rectified padded crop."""
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    grad_x = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3))
    grad_y = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3))

    h, w = gray.shape[:2]
    x1 = int(np.clip(w * 0.16, 0, w - 1))
    x2 = int(np.clip(w * 0.84, x1 + 1, w))
    y1 = int(np.clip(h * 0.16, 0, h - 1))
    y2 = int(np.clip(h * 0.84, y1 + 1, h))

    search = max(int(margin * 1.45), 12)
    inward = max(int(margin * 0.95), 12)

    top = _pick_edge_position(
        gray,
        grad_y,
        axis="y",
        start=max(1, int(round(expected["top"])) - search),
        end=min(h - 2, int(round(expected["top"])) + inward),
        span_start=x1,
        span_end=x2,
        outward_first=True,
    )
    bottom = _pick_edge_position(
        gray,
        grad_y,
        axis="y",
        start=max(1, int(round(expected["bottom"])) - inward),
        end=min(h - 2, int(round(expected["bottom"])) + search),
        span_start=x1,
        span_end=x2,
        outward_first=False,
    )
    left = _pick_edge_position(
        gray,
        grad_x,
        axis="x",
        start=max(1, int(round(expected["left"])) - search),
        end=min(w - 2, int(round(expected["left"])) + inward),
        span_start=y1,
        span_end=y2,
        outward_first=True,
    )
    right = _pick_edge_position(
        gray,
        grad_x,
        axis="x",
        start=max(1, int(round(expected["right"])) - inward),
        end=min(w - 2, int(round(expected["right"])) + search),
        span_start=y1,
        span_end=y2,
        outward_first=False,
    )

    if None in (left, top, right, bottom):
        return None

    left_f = float(left)
    top_f = float(top)
    right_f = float(right)
    bottom_f = float(bottom)
    if right_f - left_f < w * 0.35 or bottom_f - top_f < h * 0.35:
        return None

    return left_f, top_f, right_f, bottom_f


def _pick_edge_position(
    gray: np.ndarray,
    grad: np.ndarray,
    axis: str,
    start: int,
    end: int,
    span_start: int,
    span_end: int,
    outward_first: bool,
) -> Optional[int]:
    """Pick a strong border transition from an aggregated edge profile."""
    if end <= start or span_end - span_start < 8:
        return None

    scores = []
    positions = list(range(start, end + 1))
    for pos in positions:
        if axis == "y":
            edge_band = grad[max(0, pos - 1):min(gray.shape[0], pos + 2), span_start:span_end]
            outside = gray[max(0, pos - 4):max(0, pos - 1), span_start:span_end]
            inside = gray[min(gray.shape[0], pos + 1):min(gray.shape[0], pos + 4), span_start:span_end]
        else:
            edge_band = grad[span_start:span_end, max(0, pos - 1):min(gray.shape[1], pos + 2)]
            outside = gray[span_start:span_end, max(0, pos - 4):max(0, pos - 1)]
            inside = gray[span_start:span_end, min(gray.shape[1], pos + 1):min(gray.shape[1], pos + 4)]

        edge_strength = float(np.mean(edge_band)) if edge_band.size else 0.0
        contrast = abs(float(np.mean(inside)) - float(np.mean(outside))) if inside.size and outside.size else 0.0
        scores.append(edge_strength * 0.7 + contrast * 0.3)

    if not scores:
        return None

    scores_arr = np.array(scores, dtype=np.float32).reshape(-1, 1)
    scores_arr = cv2.GaussianBlur(scores_arr, (1, 5), 0).reshape(-1)
    peak = float(np.max(scores_arr))
    if peak < 2.0:
        return None

    threshold = max(peak * 0.72, float(np.mean(scores_arr) + np.std(scores_arr) * 0.6))

    if outward_first:
        iterator = range(len(positions))
    else:
        iterator = range(len(positions) - 1, -1, -1)

    for idx in iterator:
        if scores_arr[idx] >= threshold:
            return positions[idx]

    return positions[int(np.argmax(scores_arr))]


def _pad_box_outward(
    box: np.ndarray,
    pad_px: float,
    image_shape: Tuple[int, int],
) -> np.ndarray:
    """Expand each edge of a 4-point box outward by a small fixed amount."""
    if pad_px <= 0:
        return box

    pts = box.reshape(4, 2).astype(np.float64)
    centre = pts.mean(axis=0)
    corner_shifts = [np.zeros(2, dtype=np.float64) for _ in range(4)]
    corner_counts = [0, 0, 0, 0]

    for edge_idx in range(4):
        p1 = pts[edge_idx]
        p2 = pts[(edge_idx + 1) % 4]
        edge_vec = p2 - p1
        edge_len = np.linalg.norm(edge_vec)
        if edge_len < 5:
            continue

        edge_dir = edge_vec / edge_len
        normal = np.array([-edge_dir[1], edge_dir[0]], dtype=np.float64)
        edge_mid = (p1 + p2) / 2.0
        if np.dot(normal, edge_mid - centre) < 0:
            normal = -normal

        shift_vec = normal * pad_px
        i1 = edge_idx
        i2 = (edge_idx + 1) % 4
        corner_shifts[i1] += shift_vec
        corner_counts[i1] += 1
        corner_shifts[i2] += shift_vec
        corner_counts[i2] += 1

    padded = pts.copy()
    for i in range(4):
        if corner_counts[i] > 0:
            padded[i] += corner_shifts[i] / corner_counts[i]

    h, w = image_shape
    padded[:, 0] = np.clip(padded[:, 0], 0, w - 1)
    padded[:, 1] = np.clip(padded[:, 1], 0, h - 1)
    return padded


def _find_outer_edge_offset(
    start: np.ndarray,
    normal: np.ndarray,
    mag: np.ndarray,
    image_shape: Tuple[int, int],
    max_probe: int,
) -> Optional[float]:
    """Find first strong outer border edge after a quiet border band.

    Profile model:
    current box edge -> quiet coloured border -> physical outer edge
    """
    h, w = image_shape
    vals = []
    for d in range(0, max_probe + 1):
        sx = int(round(start[0] + normal[0] * d))
        sy = int(round(start[1] + normal[1] * d))
        if not (0 <= sx < w and 0 <= sy < h):
            break
        vals.append(float(mag[sy, sx]))

    if len(vals) < 6:
        return None

    # If we are already on the outer border, don't move.
    if max(vals[:3]) > 70 and np.median(vals[3:7]) < 35:
        return 0.0

    strong_thresh = max(np.percentile(vals, 82), 45.0)
    low_thresh = strong_thresh * 0.45

    quiet_run = 0
    quiet_seen = False
    for d in range(2, len(vals) - 1):
        v = vals[d]
        if not quiet_seen:
            if v < low_thresh:
                quiet_run += 1
            else:
                quiet_run = 0
            if quiet_run >= 2:
                quiet_seen = True
        else:
            if vals[d] >= vals[d - 1] and vals[d] >= vals[d + 1] and vals[d] > strong_thresh:
                return float(d)

    # Fallback: if we saw a quiet band but no strong local peak, use the
    # strongest response after the quiet band.
    if quiet_seen:
        tail = vals[2:]
        if tail:
            best = int(np.argmax(tail)) + 2
            if vals[best] > strong_thresh * 0.7:
                return float(best)

    return 0.0


def _find_all_rectangles(
    image: np.ndarray,
    min_area: float,
    max_area: float,
    edge_sensitivity: float,
    contour_threshold: float,
) -> List[np.ndarray]:
    """Find all card-shaped rectangles using multiple methods."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    h, w = image.shape[:2]
    rects: List[np.ndarray] = []

    # Method 1: Canny at multiple thresholds.
    # The blur is identical across thresholds, so compute it once.
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    for low in [20, 40, 60, 80, 100]:
        high = low * 3
        edges = cv2.Canny(blurred, low, high)
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, k, iterations=2)
        edges = cv2.erode(edges, k, iterations=1)
        contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        rects.extend(_filter_to_card_rects(contours, min_area, max_area))

    # Method 2: Adaptive threshold
    blurred = cv2.bilateralFilter(gray, 11, 75, 75)
    for block in [11, 21, 31, 41]:
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY, block, 2)
        contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        rects.extend(_filter_to_card_rects(contours, min_area, max_area))
        inv = cv2.bitwise_not(thresh)
        contours, _ = cv2.findContours(inv, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        rects.extend(_filter_to_card_rects(contours, min_area, max_area))

    # Method 3: Otsu
    _, otsu = cv2.threshold(cv2.GaussianBlur(gray, (5, 5), 0), 0, 255,
                            cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(otsu, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    rects.extend(_filter_to_card_rects(contours, min_area, max_area))
    contours, _ = cv2.findContours(cv2.bitwise_not(otsu), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    rects.extend(_filter_to_card_rects(contours, min_area, max_area))

    # Method 4: Colour distance from background
    bg = _sample_background(image)
    img_lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float64)
    bg_lab = cv2.cvtColor(bg.reshape(1, 1, 3), cv2.COLOR_BGR2LAB).astype(np.float64)
    diff = np.sqrt(np.sum((img_lab - bg_lab) ** 2, axis=2))
    for t in [20, 35, 50]:
        mask = (diff > t).astype(np.uint8) * 255
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=2)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k, iterations=1)
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        rects.extend(_filter_to_card_rects(contours, min_area, max_area))

    # Method 5: Saturation channel for colourful cards
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]
    for t in [30, 60]:
        _, mask = cv2.threshold(sat, t, 255, cv2.THRESH_BINARY)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=3)
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        rects.extend(_filter_to_card_rects(contours, min_area, max_area))

    # Deduplicate by IoU
    rects = _deduplicate(rects, (h, w))
    return rects


def _filter_to_card_rects(
    contours: list,
    min_area: float,
    max_area: float,
) -> List[np.ndarray]:
    """Keep only contours that approximate to a 4-sided polygon with card-like ratio."""
    results = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue

        peri = cv2.arcLength(cnt, True)
        if peri == 0:
            continue

        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if not (4 <= len(approx) <= 8):
            continue

        rect = cv2.minAreaRect(cnt)
        rw, rh = rect[1]
        if rw < 1 or rh < 1:
            continue

        rect_area = rw * rh
        if rect_area < 1:
            continue

        # Must fill the bounding rectangle reasonably well
        if area / rect_area < 0.5:
            continue

        # Check aspect ratio is roughly card-shaped
        short, long = sorted([rw, rh])
        ratio = short / long
        if abs(ratio - CARD_RATIO) < 0.15:
            results.append(cnt)

    return results


def _score_rectangle(
    contour: np.ndarray,
    image: np.ndarray,
    img_area: float,
) -> float:
    """Score a rectangle by how likely it is to be the front card."""
    rect = cv2.minAreaRect(contour)
    rw, rh = rect[1]
    short, long = sorted([rw, rh])
    ratio = short / long if long > 0 else 0

    # 1. Aspect ratio match (most important — card is ALWAYS 0.716)
    ratio_diff = abs(ratio - CARD_RATIO)
    aspect_score = max(0.0, 1.0 - ratio_diff * 10)

    # 2. Rectangularity — how well does the contour fill its bounding rect
    area = cv2.contourArea(contour)
    rect_area = rw * rh
    fill = area / rect_area if rect_area > 0 else 0
    fill_score = min(fill / 0.85, 1.0)

    # 3. Size — prefer the card-sized rectangle, not tiny or full-image
    rel_size = area / img_area
    if 0.05 <= rel_size <= 0.85:
        size_score = 1.0
    elif rel_size > 0.85:
        size_score = 0.2
    else:
        size_score = 0.3

    # 4. Interior variance — a printed card has high colour variance
    h, w = image.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(mask, [contour], -1, 255, -1)
    eroded = cv2.erode(mask, np.ones((11, 11), np.uint8))
    pixels = image[eroded > 0]
    if pixels.ndim == 1:
        pixels = pixels.reshape(-1, 3)
    if len(pixels) > 50:
        var = float(np.mean(np.var(pixels.astype(np.float64), axis=0)))
        interior_score = min(var / 1500.0, 1.0)
    else:
        interior_score = 0.0

    # 5. Completeness — is the contour a clean closed shape?
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    solidity = area / hull_area if hull_area > 0 else 0
    completeness = solidity

    return (
        aspect_score * 0.35
        + fill_score * 0.20
        + size_score * 0.10
        + interior_score * 0.15
        + completeness * 0.20
    )


def _sample_background(image: np.ndarray) -> np.ndarray:
    """Sample background colour from image edges."""
    h, w = image.shape[:2]
    bw = max(int(w * 0.05), 5)
    bh = max(int(h * 0.05), 5)
    strips = np.concatenate([
        image[:bh, :].reshape(-1, 3),
        image[-bh:, :].reshape(-1, 3),
        image[:, :bw].reshape(-1, 3),
        image[:, -bw:].reshape(-1, 3),
    ])
    return np.median(strips, axis=0).astype(np.uint8)


def _deduplicate(
    rects: List[np.ndarray],
    img_shape: Tuple[int, int],
    iou_thresh: float = 0.6,
) -> List[np.ndarray]:
    """Remove near-duplicate rectangles by IoU."""
    if len(rects) <= 1:
        return rects

    sorted_rects = sorted(rects, key=lambda c: cv2.contourArea(c), reverse=True)
    keep = []
    used = set()

    for i, c1 in enumerate(sorted_rects):
        if i in used:
            continue
        keep.append(c1)
        m1 = np.zeros(img_shape[:2], dtype=np.uint8)
        cv2.drawContours(m1, [c1], -1, 255, -1)
        for j in range(i + 1, len(sorted_rects)):
            if j in used:
                continue
            m2 = np.zeros(img_shape[:2], dtype=np.uint8)
            cv2.drawContours(m2, [sorted_rects[j]], -1, 255, -1)
            intersection = np.count_nonzero(m1 & m2)
            union = np.count_nonzero(m1 | m2)
            if union > 0 and intersection / union > iou_thresh:
                used.add(j)

    return keep


def _rotate_image_and_points(
    image: np.ndarray,
    points: np.ndarray,
    angle: float,
) -> Tuple[np.ndarray, np.ndarray]:
    """Rotate image and transform points."""
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

    pts = points.reshape(-1, 2).astype(np.float64)
    pts = np.clip(pts, 0, max(w, h))
    ones = np.ones((len(pts), 1))
    pts_h = np.hstack([pts, ones])
    with np.errstate(all='ignore'):
        transformed = (M @ pts_h.T).T
    if not np.all(np.isfinite(transformed)):
        return image, points
    return rotated, transformed
