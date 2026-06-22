"""Stage: build the card alpha channel and a clean RGBA.

Two strategies:
- Regular (default): a calibrated rounded-rectangle mask over the warped card
  rectangle, preserving the full printed border and the physical corner radius.
- Damaged: GrabCut foreground segmentation seeded from the warped card rect,
  preserving the true torn / crushed outline rather than forcing a rectangle.

Alpha cleanup is intentionally restrained (small median + sub-pixel feather) and
RGB outside the mask is zeroed so transparent pixels carry no colour.
"""

from typing import Tuple

import cv2
import numpy as np

from pipeline.corners import handle_corners

Rect = Tuple[int, int, int, int]


def build_alpha(
    warped: np.ndarray,
    card_rect: Rect,
    corner_radius_param: float,
    damaged: bool,
    median_px: int = 3,
    feather_px: float = 0.8,
) -> Tuple[np.ndarray, float]:
    """Return (RGBA uint8, estimated_corner_radius_px)."""
    h, w = warped.shape[:2]
    x, y, cw, ch = card_rect

    contour = np.array(
        [[[x, y]], [[x + cw - 1, y]], [[x + cw - 1, y + ch - 1]], [[x, y + ch - 1]]],
        dtype=np.int32,
    )
    mask, est_radius = handle_corners(contour, (h, w), corner_radius_param)

    if damaged:
        grab = _grabcut_refine(warped, card_rect)
        if grab is not None:
            # Keep the rounded-rect corners (clean) but adopt the damaged outline
            # along the edges: intersect so we never extend beyond the card rect,
            # and never cut the interior the rounded mask already trusts.
            inner = cv2.erode(
                mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(min(cw, ch) * 0.10) | 1,) * 2)
            )
            mask = np.where(inner > 0, mask, np.minimum(mask, grab)).astype(np.uint8)

    mask = _clean_mask(mask, median_px)
    alpha = _feather(mask, feather_px)

    rgba = cv2.cvtColor(warped, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = alpha
    transparent = alpha == 0
    rgba[transparent, 0:3] = 0
    return rgba, est_radius


def _grabcut_refine(warped: np.ndarray, card_rect: Rect) -> np.ndarray:
    """GrabCut the warped card to recover the true (possibly damaged) outline.

    Runs on a downscaled copy for speed (GrabCut on a full 1260x1760 canvas is
    seconds; ~600px is sub-second) then upsamples the mask.
    """
    h, w = warped.shape[:2]
    long_side = max(h, w)
    sc = 600.0 / long_side if long_side > 600 else 1.0
    small = (
        cv2.resize(warped, (max(1, int(w * sc)), max(1, int(h * sc))), interpolation=cv2.INTER_AREA)
        if sc < 1.0
        else warped.copy()
    )
    sh, sw = small.shape[:2]
    x, y, cw, ch = (int(round(v * sc)) for v in card_rect)

    gc = np.full((sh, sw), cv2.GC_PR_BGD, np.uint8)
    gc[y:y + ch, x:x + cw] = cv2.GC_PR_FGD
    ix, iy = x + int(cw * 0.12), y + int(ch * 0.12)
    iw, ih = int(cw * 0.76), int(ch * 0.76)
    if iw > 0 and ih > 0:
        gc[iy:iy + ih, ix:ix + iw] = cv2.GC_FGD
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(small, gc, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return None
    fg = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k, iterations=1)
    contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    clean = np.zeros((sh, sw), np.uint8)
    cv2.drawContours(clean, [max(contours, key=cv2.contourArea)], -1, 255, -1)
    if sc < 1.0:
        clean = cv2.resize(clean, (w, h), interpolation=cv2.INTER_NEAREST)
    return clean


def _clean_mask(mask: np.ndarray, median_px: int) -> np.ndarray:
    if median_px and median_px >= 3:
        k = int(median_px) | 1
        mask = cv2.medianBlur(mask, k)
    return mask


def _feather(mask: np.ndarray, feather_px: float) -> np.ndarray:
    """Sub-pixel alpha feather from a near-binary mask."""
    _, binary = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
    if feather_px < 0.25:
        # Preserve any anti-aliasing already in the mask.
        return mask
    dist_in = cv2.distanceTransform(binary, cv2.DIST_L2, 3)
    alpha = np.clip(dist_in / feather_px, 0.0, 1.0)
    mask_norm = mask.astype(np.float32) / 255.0
    alpha = np.minimum(alpha, mask_norm)
    alpha[(binary > 0) & (dist_in > feather_px)] = 1.0
    return (alpha * 255).astype(np.uint8)
