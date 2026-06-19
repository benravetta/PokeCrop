"""Perspective-warp card extraction — flat, upright, tightly cropped RGBA output."""

import cv2
import numpy as np
from typing import Tuple

from pipeline.find_card import _warp_card_view, CARD_RATIO
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
    rgba, _ = _recrop_to_alpha_bounds(rgba)

    pad = max(crop_padding, 0)
    if pad > 0:
        rgba = cv2.copyMakeBorder(
            rgba, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0)
        )

    return rgba, estimated_radius


def orient_warped_card(warped: np.ndarray) -> np.ndarray:
    """Pick upright orientation — works for Pokémon (title top) and One Piece (name bottom)."""
    flipped = cv2.rotate(warped, cv2.ROTATE_180)
    if _orientation_score(flipped) > _orientation_score(warped):
        return flipped
    return warped


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


def _orientation_score(card: np.ndarray) -> float:
    """Higher score = more likely upright. Handles OP (cost TL, name bottom) and Pokémon (name top)."""
    if card.shape[0] < 40 or card.shape[1] < 20:
        return 0.0

    top_red, bot_red = _red_band_coverage(card)
    op_band = bot_red - top_red
    poke_band = top_red - bot_red

    h, w = card.shape[:2]
    gray = cv2.cvtColor(card, cv2.COLOR_BGR2GRAY)
    lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F))
    mh, mw = max(int(h * 0.12), 8), max(int(w * 0.18), 8)
    tl_detail = float(np.mean(lap[:mh, :mw]))
    br_detail = float(np.mean(lap[-mh:, -mw:]))
    cost_marker = tl_detail - br_detail

    # One Piece: red cost circle in top-left + name banner at bottom when upright.
    if cost_marker > 2.0:
        return cost_marker + op_band * 4.0

    # Pokémon / top-title cards: title strip at top when upright.
    if poke_band > 0.08:
        return poke_band * 2.0

    return op_band * 2.0


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
