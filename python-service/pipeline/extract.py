"""Perspective-warp card extraction — flat, upright, tightly cropped RGBA output."""

import cv2
import numpy as np
from typing import Tuple, Optional

from pipeline.find_card import _warp_card_view, CARD_RATIO, _upright_score

try:  # OCR-based orientation (Tesseract OSD). Optional: handled gracefully if absent.
    import pytesseract
    from pytesseract import Output as _TESS_OUTPUT
except Exception:  # pragma: no cover
    pytesseract = None
    _TESS_OUTPUT = None
from pipeline.corners import handle_corners
from pipeline.top_edge import cleanup_top_edge
from pipeline.mask import (
    _feather_mask,
    _recrop_to_alpha_bounds,
    _remove_edge_connected_white_background,
)


def extract_warped_card(
    image: np.ndarray,
    contour: np.ndarray,
    corner_radius_param: float,
    top_edge_cleanup: float,
    crop_padding: int = 0,
    edge_trim: int = 0,
    bg_removal: float = 0.0,
) -> Tuple[np.ndarray, float]:
    """Warp to portrait, fix orientation once, mask, and return a tight RGBA crop."""
    warped = _warp_card_view(image, contour)
    if warped is None or warped.size == 0:
        raise ValueError("Could not warp card to flat view")

    warped = orient_warped_card(warped)
    colored_table = _has_colored_table_margin(warped)
    if colored_table:
        warped = _trim_warped_table_margin(warped)

    h, w = warped.shape[:2]
    if h < 20 or w < 20:
        raise ValueError("Card crop too small after edge detection")

    box_contour = np.array(
        [[[0, 0]], [[w - 1, 0]], [[w - 1, h - 1]], [[0, h - 1]]],
        dtype=np.int32,
    )

    mask, estimated_radius = handle_corners(
        box_contour, (h, w), corner_radius_param
    )
    mask = cleanup_top_edge(mask, warped, box_contour, top_edge_cleanup)

    alpha = _feather_mask(mask, feather_px=1)
    if colored_table:
        alpha = _suppress_background_alpha(warped, alpha)
    rgba = cv2.cvtColor(warped, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = alpha

    transparent = alpha == 0
    rgba[transparent, 0:3] = 0

    rgba = _cleanup_scan_background(rgba)

    # User-controlled clean-up tools (both default to no-op):
    #  - bg_removal: colour-based removal of background bleeding in from edges.
    #  - edge_trim: shave the outer edge inward to eat a residual background ring.
    if bg_removal > 0:
        rgba = _remove_edge_background_color(rgba, bg_removal)
    if edge_trim > 0:
        rgba = _trim_alpha_edges(rgba, edge_trim)

    rgba, _ = _recrop_to_alpha_bounds(rgba)

    pad = max(crop_padding, 0)
    if pad > 0:
        rgba = cv2.copyMakeBorder(
            rgba, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0)
        )

    return rgba, estimated_radius


def orient_warped_card(warped: np.ndarray) -> np.ndarray:
    """Pick the upright orientation for a portrait card crop.

    Primary method is OCR: Tesseract's OSD reads the actual text direction and
    reports how far the card is rotated, which works across every card type.
    When OCR is unavailable or not confident we fall back to a card-type-agnostic
    heuristic — rules/stat/flavour text and fine print cluster toward the bottom
    of virtually every trading and sports card, reinforced by specific cues for
    Pokémon (title strip at top) and One Piece (cost marker top-left). The manual
    rotate controls in the editor can always correct either result.
    """
    rotate = _ocr_orientation(warped)
    if rotate == 90:
        return cv2.rotate(warped, cv2.ROTATE_90_CLOCKWISE)
    if rotate == 180:
        return cv2.rotate(warped, cv2.ROTATE_180)
    if rotate == 270:
        return cv2.rotate(warped, cv2.ROTATE_90_COUNTERCLOCKWISE)
    if rotate == 0:
        return warped

    # OCR unavailable or unsure — fall back to the detail/text heuristic.
    flipped_img = cv2.rotate(warped, cv2.ROTATE_180)
    if _orientation_score(flipped_img) > _orientation_score(warped):
        return flipped_img
    return warped


def _ocr_orientation(card: np.ndarray) -> Optional[int]:
    """Clockwise rotation (one of {0, 90, 180, 270}) needed to make the card's
    text upright, via Tesseract OSD. Returns None when OCR is unavailable or not
    confident, so the caller can fall back to the heuristic.
    """
    if pytesseract is None or card is None or card.size == 0:
        return None
    h, w = card.shape[:2]
    if h < 60 or w < 40:
        return None

    # OSD is most reliable on a moderately sized grayscale image with a light
    # margin. Downscale tall crops to bound latency.
    scale = 900.0 / float(h)
    if scale < 1.0:
        card = cv2.resize(
            card, (max(1, int(w * scale)), 900), interpolation=cv2.INTER_AREA
        )
    gray = cv2.cvtColor(card, cv2.COLOR_BGR2GRAY)
    gray = cv2.copyMakeBorder(gray, 24, 24, 24, 24, cv2.BORDER_CONSTANT, value=255)

    try:
        osd = pytesseract.image_to_osd(gray, output_type=_TESS_OUTPUT.DICT)
    except Exception:
        return None

    try:
        rotate = int(osd.get("rotate", 0)) % 360
        conf = float(osd.get("orientation_conf", 0.0))
    except (TypeError, ValueError):
        return None

    if conf < 1.0 or rotate not in (0, 90, 180, 270):
        return None
    return rotate


def _red_band_coverage(img: np.ndarray) -> Tuple[float, float]:
    """Return (top_band_coverage, bottom_band_coverage) for red title/name strips."""
    h = img.shape[0]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m1 = cv2.inRange(hsv, (0, 80, 50), (12, 255, 255))
    m2 = cv2.inRange(hsv, (168, 80, 50), (180, 255, 255))
    red = cv2.bitwise_or(m1, m2)

    def band_cov(y0: int, y1: int) -> float:
        region = red[y0:y1]
        if region.size == 0:
            return 0.0
        row_fill = np.mean(region > 0, axis=1)
        return float(np.max(row_fill)) if len(row_fill) else 0.0

    top = band_cov(0, max(int(h * 0.22), 1))
    bottom = band_cov(int(h * 0.78), h)
    return top, bottom


def _cost_marker(card: np.ndarray) -> float:
    """Detail concentrated in the top-left vs bottom-right (One Piece cost circle)."""
    h, w = card.shape[:2]
    gray = cv2.cvtColor(card, cv2.COLOR_BGR2GRAY)
    lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F))
    mh, mw = max(int(h * 0.12), 8), max(int(w * 0.18), 8)
    tl_detail = float(np.mean(lap[:mh, :mw]))
    br_detail = float(np.mean(lap[-mh:, -mw:]))
    return tl_detail - br_detail


def _orientation_score(card: np.ndarray) -> float:
    """Higher score = more likely upright.

    The base score is the general, card-type-agnostic upright score (bottom-heavy
    fine print / text bands), which alone resolves most cards. Specific cues for
    Pokémon (red title strip at top) and One Piece (cost marker top-left, name
    banner at bottom) are added as confidence boosters, not as overrides.
    """
    if card.shape[0] < 40 or card.shape[1] < 20:
        return 0.0

    base = _upright_score(card)

    top_red, bot_red = _red_band_coverage(card)
    cost_marker = _cost_marker(card)

    bonus = 0.0
    if cost_marker > 2.0:
        # One Piece: cost circle top-left and name banner at the bottom.
        bonus += cost_marker + (bot_red - top_red) * 6.0
    elif (top_red - bot_red) > 0.10:
        # Pokémon and similar top-title cards: title strip at the top.
        bonus += (top_red - bot_red) * 8.0

    return base + bonus


def _has_colored_table_margin(warped: np.ndarray) -> bool:
    """True when the warp still contains a non-white table/scan margin to trim."""
    h, w = warped.shape[:2]
    if h < 40 or w < 30:
        return False

    hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)
    ring = max(int(min(w, h) * 0.05), 4)
    border_hsv = np.vstack(
        [
            hsv[:ring, :].reshape(-1, 3),
            hsv[-ring:, :].reshape(-1, 3),
            hsv[:, :ring].reshape(-1, 3),
            hsv[:, -ring:].reshape(-1, 3),
        ]
    )
    bright_neutral = np.mean(
        (border_hsv[:, 2] > 190) & (border_hsv[:, 1] < 35)
    )
    if bright_neutral > 0.72:
        return False

    lab = cv2.cvtColor(warped, cv2.COLOR_BGR2LAB).astype(np.float32)
    border_lab = np.vstack(
        [
            lab[:ring, :].reshape(-1, 3),
            lab[-ring:, :].reshape(-1, 3),
            lab[:, :ring].reshape(-1, 3),
            lab[:, -ring:].reshape(-1, 3),
        ]
    )
    bg_lab = np.median(border_lab, axis=0)
    dist = np.linalg.norm(lab - bg_lab, axis=2)
    border_dist = np.concatenate(
        [dist[0, :], dist[-1, :], dist[:, 0], dist[:, -1]]
    )
    return float(np.mean(border_dist < 18)) >= 0.45


def _trim_warped_table_margin(warped: np.ndarray) -> np.ndarray:
    """Remove any table/scan margin still present inside the warped crop."""
    h, w = warped.shape[:2]
    if h < 40 or w < 30:
        return warped

    lab = cv2.cvtColor(warped, cv2.COLOR_BGR2LAB).astype(np.float32)
    ring = max(int(min(w, h) * 0.05), 4)
    border_pixels = np.vstack(
        [
            lab[:ring, :].reshape(-1, 3),
            lab[-ring:, :].reshape(-1, 3),
            lab[:, :ring].reshape(-1, 3),
            lab[:, -ring:].reshape(-1, 3),
        ]
    )
    bg_lab = np.median(border_pixels, axis=0)
    dist = np.linalg.norm(lab - bg_lab, axis=2)

    border_dist = np.concatenate(
        [dist[0, :], dist[-1, :], dist[:, 0], dist[:, -1]]
    )
    if float(np.mean(border_dist < 18)) < 0.45:
        return warped

    threshold = float(np.clip(np.percentile(border_dist, 65), 12.0, 26.0))
    y0, y1 = int(h * 0.08), int(h * 0.92)
    x0, x1 = int(w * 0.08), int(w * 0.92)
    if y1 - y0 < 20 or x1 - x0 < 20:
        return warped

    top = 0
    for y in range(0, h // 2):
        if float(np.mean(dist[y, x0:x1] > threshold)) > 0.5:
            top = y
            break

    bottom = h - 1
    for y in range(h - 1, h // 2, -1):
        if float(np.mean(dist[y, x0:x1] > threshold)) > 0.5:
            bottom = y
            break

    left = 0
    for x in range(0, w // 2):
        if float(np.mean(dist[y0:y1, x] > threshold)) > 0.5:
            left = x
            break

    right = w - 1
    for x in range(w - 1, w // 2, -1):
        if float(np.mean(dist[y0:y1, x] > threshold)) > 0.5:
            right = x
            break

    if right - left < w * 0.55 or bottom - top < h * 0.55:
        return warped

    return warped[top : bottom + 1, left : right + 1].copy()


def _suppress_background_alpha(warped: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Remove table pixels connected to the border without touching card interior."""
    h, w = warped.shape[:2]
    if h < 20 or w < 20:
        return alpha

    lab = cv2.cvtColor(warped, cv2.COLOR_BGR2LAB).astype(np.float32)
    ring = max(int(min(w, h) * 0.05), 4)
    border_pixels = np.vstack(
        [
            lab[:ring, :].reshape(-1, 3),
            lab[-ring:, :].reshape(-1, 3),
            lab[:, :ring].reshape(-1, 3),
            lab[:, -ring:].reshape(-1, 3),
        ]
    )
    bg_lab = np.median(border_pixels, axis=0)
    dist = np.linalg.norm(lab - bg_lab, axis=2)

    border_dist = np.concatenate(
        [dist[0, :], dist[-1, :], dist[:, 0], dist[:, -1]]
    )
    threshold = float(np.clip(np.percentile(border_dist, 55), 16.0, 32.0))
    bg_like = (dist <= threshold).astype(np.uint8) * 255

    flood = bg_like.copy()
    edge_mask = np.zeros((h + 2, w + 2), np.uint8)
    for seed in (
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (w // 2, h - 1),
        (0, h // 2),
        (w - 1, h // 2),
    ):
        if flood[seed[1], seed[0]] > 0:
            cv2.floodFill(flood, edge_mask, seed, 128)

    spill = flood == 128
    max_band = max(int(min(w, h) * 0.14), 10)
    edge_band = cv2.distanceTransform(
        np.ones((h, w), np.uint8),
        cv2.DIST_L2,
        3,
    )
    spill &= edge_band <= max_band

    out = alpha.copy()
    out[spill] = 0
    return out


def _trim_alpha_edges(rgba: np.ndarray, px: int) -> np.ndarray:
    """Erode the alpha inward by ``px`` pixels to remove a thin background ring."""
    if px <= 0 or rgba.size == 0:
        return rgba
    alpha = rgba[:, :, 3]
    k = 2 * int(px) + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    # Treat the image border as background so the outer ring is shaved even
    # when the card alpha reaches the edge of the frame.
    eroded = cv2.erode(
        alpha, kernel, borderType=cv2.BORDER_CONSTANT, borderValue=0
    )
    out = rgba.copy()
    out[:, :, 3] = eroded
    out[eroded == 0, 0:3] = 0
    return out


def _remove_edge_background_color(rgba: np.ndarray, strength: float) -> np.ndarray:
    """Erase background-coloured pixels bleeding in from the edges.

    Samples the colour around the crop border, then removes pixels of a similar
    colour that are connected to the border, limited to a band near the edge so
    interior artwork of the same colour is never touched. ``strength`` (0..1)
    widens both the colour tolerance and the protected band.
    """
    h, w = rgba.shape[:2]
    if h < 20 or w < 20 or strength <= 0:
        return rgba

    alpha = rgba[:, :, 3]
    opaque = alpha > 0
    if np.count_nonzero(opaque) == 0:
        return rgba

    lab = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2LAB).astype(np.float32)
    ring = max(int(min(w, h) * 0.04), 3)
    border = np.vstack(
        [
            lab[:ring, :].reshape(-1, 3),
            lab[-ring:, :].reshape(-1, 3),
            lab[:, :ring].reshape(-1, 3),
            lab[:, -ring:].reshape(-1, 3),
        ]
    )
    border_a = np.concatenate(
        [
            alpha[:ring, :].reshape(-1),
            alpha[-ring:, :].reshape(-1),
            alpha[:, :ring].reshape(-1),
            alpha[:, -ring:].reshape(-1),
        ]
    )
    # Sample only opaque border pixels so the zeroed transparent corners (from
    # the rounded mask) don't skew the background colour toward black.
    visible = border_a > 0
    if np.count_nonzero(visible) < 8:
        return rgba
    bg_lab = np.median(border[visible], axis=0)
    dist = np.linalg.norm(lab - bg_lab, axis=2)

    tol = 8.0 + float(strength) * 52.0
    bg_like = ((dist <= tol) & opaque).astype(np.uint8) * 255
    if np.count_nonzero(bg_like) == 0:
        return rgba

    flood = bg_like.copy()
    flood_mask = np.zeros((h + 2, w + 2), np.uint8)
    for sx, sy in (
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (w // 2, h - 1),
        (0, h // 2),
        (w - 1, h // 2),
    ):
        if flood[sy, sx] > 0:
            cv2.floodFill(flood, flood_mask, (sx, sy), 128)

    spill = flood == 128
    band = max(int(min(w, h) * (0.10 + strength * 0.22)), 10)
    # Distance from the outer image border inward. Leftover background sits at
    # the crop edge, so only pixels within this band are eligible for removal —
    # central artwork of a similar colour is always protected.
    yy, xx = np.indices((h, w))
    edge_dist = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy])
    spill &= edge_dist <= band

    if np.count_nonzero(spill) == 0:
        return rgba

    out = rgba.copy()
    out[spill, 3] = 0
    out[spill, 0:3] = 0
    return out


def _cleanup_scan_background(rgba: np.ndarray) -> np.ndarray:
    """Remove scanner-white margins without touching card interior artwork."""
    if rgba.size == 0:
        return rgba

    hsv = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2HSV)
    ring = max(int(min(rgba.shape[:2]) * 0.05), 4)
    border_hsv = np.vstack(
        [
            hsv[:ring, :].reshape(-1, 3),
            hsv[-ring:, :].reshape(-1, 3),
            hsv[:, :ring].reshape(-1, 3),
            hsv[:, -ring:].reshape(-1, 3),
        ]
    )
    bright_neutral = np.mean(
        (border_hsv[:, 2] > 190) & (border_hsv[:, 1] < 35)
    )
    if bright_neutral < 0.55:
        return rgba

    opaque = rgba[:, :, 3] > 0
    cleaned = _remove_edge_connected_white_background(rgba.copy())
    lost = opaque & (cleaned[:, :, 3] == 0)
    if lost.sum() == 0:
        return rgba
    if lost.sum() / max(opaque.sum(), 1) > 0.025:
        return rgba
    return cleaned
