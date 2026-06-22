"""Stage: physical card boundary estimation.

Builds a binary mask of the *physical* card (including rounded corners and any
damage), separated from table / playmat / sleeve background. The mask is the
input to the edge-fitting stage; it is not used directly as the alpha channel.

We avoid relying on a single signal. The primary signal is GrabCut foreground
segmentation (robust for a card resting on a contrasting surface). When the card
fills the frame (a scan or full-bleed alternate art) GrabCut would clip the
card's own border, so we detect that case and fall back to a colour/edge
foreground that defaults to the whole region.
"""

from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

from pipeline import segment


@dataclass
class Boundary:
    mask: np.ndarray          # uint8 0/255, full working-image size
    fills_frame: bool         # card occupies essentially the whole image
    damaged: bool             # irregular outline (torn / crushed corners)
    area_frac: float          # mask area / image area
    from_segment: bool = False  # mask came from the learned segmentation model


def card_boundary(image: np.ndarray, roi) -> Optional[Boundary]:
    """Estimate the physical card mask within ``roi`` (x, y, w, h)."""
    h, w = image.shape[:2]

    # Primary signal: a learned foreground segmentation. It cleanly isolates the
    # card from any background (textured desks, busy playmats, low contrast)
    # where GrabCut/colour heuristics fail. Used only when it returns a single
    # card-sized blob that does not fill the frame; full-bleed scans (where
    # salient segmentation can clip the border) defer to the classical path.
    seg = _segment_boundary(image)
    if seg is not None:
        return seg

    rx, ry, rw, rh = roi
    rx2, ry2 = rx + rw, ry + rh

    roi_img = image[ry:ry2, rx:rx2]
    if roi_img.size == 0 or rw < 20 or rh < 20:
        return None

    # A near-uniform region has no card (blank scan, solid background). Bail out
    # early: it also keeps GrabCut away from a degenerate, singular colour model
    # (which can spin for a very long time on a flat image).
    if float(cv2.cvtColor(roi_img, cv2.COLOR_BGR2GRAY).std()) < 7.0:
        return None

    roi_fills_frame = rw >= w * 0.92 and rh >= h * 0.92

    mask_roi = _grabcut_mask(roi_img)
    used_grabcut = mask_roi is not None

    if mask_roi is not None:
        # GrabCut clipped the card if its foreground hugs the ROI border on all
        # sides — that means the card fills the ROI (scan / full-bleed).
        if _touches_all_sides(mask_roi):
            mask_roi = None

    if mask_roi is None:
        mask_roi = _colour_edge_mask(roi_img)
        used_grabcut = False

    if mask_roi is None:
        # Nothing separable — treat the entire ROI as the card.
        mask_roi = np.full((rh, rw), 255, np.uint8)

    contours, _ = cv2.findContours(mask_roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    area = float(cv2.contourArea(c))
    if area < (rw * rh) * 0.05:
        return None

    clean = np.zeros((rh, rw), np.uint8)
    cv2.drawContours(clean, [c], -1, 255, -1)

    full = np.zeros((h, w), np.uint8)
    full[ry:ry2, rx:rx2] = clean

    area_frac = float(np.count_nonzero(full)) / float(h * w)
    fills_frame = roi_fills_frame or area_frac > 0.90 or (not used_grabcut and area_frac > 0.7)
    # Only treat as "damaged" when we have a genuinely irregular, isolated card
    # outline — never for full-frame scans (their contour solidity is noisy).
    damaged = (not fills_frame) and area_frac < 0.85 and _is_damaged(c)

    return Boundary(mask=full, fills_frame=fills_frame, damaged=damaged, area_frac=area_frac)


def _segment_boundary(image: np.ndarray) -> Optional[Boundary]:
    """Build a Boundary from the learned segmentation mask, or None to fall back."""
    try:
        mask = segment.card_mask(image)
    except Exception:
        mask = None
    if mask is None:
        return None

    h, w = image.shape[:2]
    area_frac = float(np.count_nonzero(mask)) / float(h * w)
    # A mask that fills the frame or hugs all four borders is most likely a scan
    # or full-bleed card; salient segmentation can clip such a card's own border,
    # so defer to the classical whole-region behaviour.
    if area_frac > 0.92 or _touches_all_sides(mask):
        return None

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    if cv2.contourArea(c) < (h * w) * 0.05:
        return None

    damaged = area_frac < 0.85 and _is_damaged(c)
    return Boundary(
        mask=mask, fills_frame=False, damaged=damaged, area_frac=area_frac, from_segment=True
    )


def _grabcut_mask(roi_img: np.ndarray) -> Optional[np.ndarray]:
    """GrabCut foreground, run on a downscaled copy for speed."""
    h, w = roi_img.shape[:2]
    long_side = max(h, w)
    scale = 480.0 / long_side if long_side > 480 else 1.0
    small = (
        cv2.resize(roi_img, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
        if scale < 1.0
        else roi_img.copy()
    )
    sh, sw = small.shape[:2]
    if sh < 40 or sw < 40:
        return None

    # GrabCut's GMM is singular on a near-uniform image and can run pathologically
    # long; skip it and let the colour/edge fallback handle such cases.
    if float(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).std()) < 7.0:
        return None

    inset = int(min(sh, sw) * 0.06)
    rect = (inset, inset, sw - 2 * inset, sh - 2 * inset)
    if rect[2] <= 10 or rect[3] <= 10:
        return None

    mask = np.zeros((sh, sw), np.uint8)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(small, mask, rect, bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
    except cv2.error:
        return None

    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k, iterations=3)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k, iterations=2)

    if np.count_nonzero(fg) < (sh * sw) * 0.04:
        return None

    if scale < 1.0:
        fg = cv2.resize(fg, (w, h), interpolation=cv2.INTER_NEAREST)
    return fg


def _colour_edge_mask(roi_img: np.ndarray) -> Optional[np.ndarray]:
    """Foreground via colour distance from the border + saturation + edges.

    Defaults toward including the whole region, which is the correct behaviour
    for a card that fills the frame.
    """
    h, w = roi_img.shape[:2]
    lab = cv2.cvtColor(roi_img, cv2.COLOR_BGR2LAB).astype(np.float32)
    ring = max(int(min(h, w) * 0.03), 3)
    border = np.concatenate(
        [
            lab[:ring, :].reshape(-1, 3),
            lab[-ring:, :].reshape(-1, 3),
            lab[:, :ring].reshape(-1, 3),
            lab[:, -ring:].reshape(-1, 3),
        ]
    )
    bg = np.median(border, axis=0)
    dist = np.linalg.norm(lab - bg, axis=2)
    sat = cv2.cvtColor(roi_img, cv2.COLOR_BGR2HSV)[:, :, 1].astype(np.float32)

    fg = ((dist > 24) | (sat > 55)).astype(np.uint8) * 255
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k, iterations=3)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k, iterations=1)

    # Fill holes so interior artwork that matches the border colour is retained.
    contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    filled = np.zeros((h, w), np.uint8)
    cv2.drawContours(filled, [max(contours, key=cv2.contourArea)], -1, 255, -1)
    return filled


def _touches_all_sides(mask: np.ndarray, frac: float = 0.02) -> bool:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return False
    c = max(contours, key=cv2.contourArea)
    x, y, bw, bh = cv2.boundingRect(c)
    h, w = mask.shape[:2]
    edge = max(2, int(min(h, w) * frac))
    return x <= edge and y <= edge and x + bw >= w - edge and y + bh >= h - edge


def _is_damaged(contour: np.ndarray) -> bool:
    """Irregular outline → solidity well below a clean rounded rectangle."""
    area = cv2.contourArea(contour)
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    if hull_area <= 0:
        return False
    solidity = area / hull_area
    return solidity < 0.90
