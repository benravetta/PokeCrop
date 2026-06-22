"""Stage: rough card localisation.

Produces a padded region of interest (ROI) that is guaranteed to contain the
whole card. This is deliberately coarse — it only narrows the search area for
the boundary/edge stages and never determines the final crop.

Signals (in priority order):
1. An optional rough ROI hint (e.g. from GPT-4o mini), treated as guidance only.
2. Coarse foreground evidence (saturation + colour distance from the border)
   to find the bounding box of the most card-like blob.

When nothing useful is found we fall back to the whole frame, which keeps the
downstream stages working on scans / full-bleed cards that fill the image.
"""

from typing import Optional, Tuple

import cv2
import numpy as np

Box = Tuple[int, int, int, int]  # x, y, w, h


def rough_roi(
    image: np.ndarray,
    roi_hint: Optional[Box] = None,
    pad_frac: float = 0.06,
) -> Box:
    """Return a padded ROI (x, y, w, h) containing the whole card.

    ``roi_hint`` is an optional (x, y, w, h) in image pixels. It is padded and
    clamped but never trusted as a precise boundary.
    """
    h, w = image.shape[:2]
    full: Box = (0, 0, w, h)

    if roi_hint is not None:
        box = _clamp_box(roi_hint, w, h)
        if box is not None and box[2] > w * 0.04 and box[3] > h * 0.04:
            return _pad_box(box, w, h, pad_frac)

    box = _foreground_bbox(image)
    if box is None:
        return full
    return _pad_box(box, w, h, pad_frac)


def _foreground_bbox(image: np.ndarray) -> Optional[Box]:
    """Coarse bounding box of the dominant non-background blob."""
    h, w = image.shape[:2]
    small_scale = 480.0 / max(h, w) if max(h, w) > 480 else 1.0
    small = (
        cv2.resize(image, (int(w * small_scale), int(h * small_scale)), interpolation=cv2.INTER_AREA)
        if small_scale < 1.0
        else image
    )
    sh, sw = small.shape[:2]

    lab = cv2.cvtColor(small, cv2.COLOR_BGR2LAB).astype(np.float32)
    border = np.concatenate(
        [
            lab[:4, :].reshape(-1, 3),
            lab[-4:, :].reshape(-1, 3),
            lab[:, :4].reshape(-1, 3),
            lab[:, -4:].reshape(-1, 3),
        ]
    )
    bg = np.median(border, axis=0)
    dist = np.linalg.norm(lab - bg, axis=2)

    sat = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)[:, :, 1].astype(np.float32)

    fg = ((dist > 28) | (sat > 60)).astype(np.uint8) * 255
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k, iterations=2)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k, iterations=1)

    contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    if cv2.contourArea(c) < (sh * sw) * 0.03:
        return None

    x, y, bw, bh = cv2.boundingRect(c)
    inv = 1.0 / small_scale
    return (int(x * inv), int(y * inv), int(bw * inv), int(bh * inv))


def _pad_box(box: Box, w: int, h: int, pad_frac: float) -> Box:
    x, y, bw, bh = box
    pad = int(max(bw, bh) * pad_frac) + 4
    nx = max(0, x - pad)
    ny = max(0, y - pad)
    nx2 = min(w, x + bw + pad)
    ny2 = min(h, y + bh + pad)
    return (nx, ny, nx2 - nx, ny2 - ny)


def _clamp_box(box: Box, w: int, h: int) -> Optional[Box]:
    try:
        x, y, bw, bh = (float(v) for v in box)
    except (TypeError, ValueError):
        return None
    x = max(0.0, min(x, w - 1))
    y = max(0.0, min(y, h - 1))
    bw = max(1.0, min(bw, w - x))
    bh = max(1.0, min(bh, h - y))
    return (int(x), int(y), int(bw), int(bh))
