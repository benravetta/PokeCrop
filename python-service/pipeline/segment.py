"""Stage: learned card foreground segmentation.

Uses a U2Net-family model (via ``rembg`` + ``onnxruntime``) to isolate the
physical card from its background. This is far more robust than classical
GrabCut / colour heuristics on the cases that keep failing: textured wood or
bamboo desks, busy playmats, and backgrounds whose brightness nearly matches the
card border.

The model and onnxruntime are treated as *optional*. Every failure path returns
``None`` so the caller can fall back to the classical boundary estimator, and a
single load failure is remembered so we don't retry on every request. The
session is created once and cached behind a lock.
"""

import os
import threading
from typing import Optional

import cv2
import numpy as np

# u2netp is the tiny U2Net variant (~4.7MB, low RAM, fast on CPU). Override with
# CARD_SEG_MODEL=isnet-general-use (or u2net) if higher quality is needed.
_MODEL_NAME = os.environ.get("CARD_SEG_MODEL", "u2netp")
# Long side the model runs on. The net is resized to 320px internally anyway, so
# a 1024px working copy is plenty and keeps inference cheap.
_SEG_LONG_SIDE = 1024

_session = None
_session_lock = threading.Lock()
_session_failed = False


def _get_session():
    """Return the cached rembg session, creating it once. None if unavailable."""
    global _session, _session_failed
    if _session is not None or _session_failed:
        return _session
    with _session_lock:
        if _session is not None or _session_failed:
            return _session
        try:
            from rembg import new_session

            _session = new_session(_MODEL_NAME)
        except Exception:
            _session_failed = True
            _session = None
    return _session


def warmup() -> bool:
    """Eagerly create the session (call at startup). Returns True on success."""
    return _get_session() is not None


def card_mask(image_bgr: np.ndarray, min_area_frac: float = 0.05) -> Optional[np.ndarray]:
    """Segment the card; return a full-size 0/255 mask or None.

    None is returned when the model is unavailable, inference fails, or the
    result is implausible (no foreground, or a blob smaller than
    ``min_area_frac`` of the frame), letting the caller fall back to classical
    segmentation.
    """
    session = _get_session()
    if session is None:
        return None
    try:
        from rembg import remove
    except Exception:
        return None

    h, w = image_bgr.shape[:2]
    if h < 20 or w < 20:
        return None

    long_side = max(h, w)
    scale = _SEG_LONG_SIDE / long_side if long_side > _SEG_LONG_SIDE else 1.0
    sw, sh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    small = (
        cv2.resize(image_bgr, (sw, sh), interpolation=cv2.INTER_AREA)
        if scale < 1.0
        else image_bgr
    )

    rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
    try:
        out = remove(rgb, session=session, only_mask=True, post_process_mask=True)
    except Exception:
        return None

    mask_small = np.asarray(out)
    if mask_small.ndim == 3:
        mask_small = mask_small[:, :, 0]
    mask_small = mask_small.astype(np.uint8)
    if mask_small.shape[:2] != (sh, sw):
        mask_small = cv2.resize(mask_small, (sw, sh), interpolation=cv2.INTER_NEAREST)

    # Otsu cleanly binarises the net's soft probability edges.
    if int(mask_small.max()) == 0:
        return None
    _, binm = cv2.threshold(mask_small, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Keep the single largest connected component (the card).
    num, labels, stats, _ = cv2.connectedComponentsWithStats(binm, connectivity=8)
    if num <= 1:
        return None
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    blob = np.where(labels == largest, 255, 0).astype(np.uint8)

    # Fill internal holes so glare or matching-colour artwork stays inside.
    contours, _ = cv2.findContours(blob, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    blob = np.zeros_like(blob)
    cv2.drawContours(blob, [c], -1, 255, -1)

    if scale < 1.0:
        blob = cv2.resize(blob, (w, h), interpolation=cv2.INTER_NEAREST)

    if np.count_nonzero(blob) < (h * w) * min_area_frac:
        return None
    return blob
