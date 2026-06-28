"""Metrics helpers for the crop regression harness."""

import time
from dataclasses import dataclass
from typing import List, Optional

import cv2
import numpy as np

from pipeline.normalise import normalise_input
from pipeline.crop import run_crop, CropOptions

CARD_RATIO = 63.0 / 88.0


@dataclass
class CropMetrics:
    found: bool
    error: Optional[str]
    confidence: float
    needs_manual: bool
    needs_review: bool
    detection_path: str
    scan_mode: bool
    aspect: float
    aspect_error: float
    portrait: bool
    processing_ms: int
    alpha_halo_px: float
    background_frac: float
    sharpness: float
    mean_corner_error: Optional[float]
    max_corner_error: Optional[float]
    corners: List[List[float]]


def run_pipeline(path: str, opts: Optional[CropOptions] = None):
    with open(path, "rb") as f:
        data = f.read()
    working, original, scale = normalise_input(data, path)
    t = time.time()
    res = run_crop(working, original, scale, opts or CropOptions())
    ms = int((time.time() - t) * 1000)
    return res, ms


def compute_metrics(path: str, verified_corners=None, opts=None) -> CropMetrics:
    res, ms = run_pipeline(path, opts)
    if res.error and res.rgba is None:
        return CropMetrics(
            found=False,
            error=res.error,
            confidence=0.0,
            needs_manual=True,
            needs_review=False,
            detection_path="",
            scan_mode=False,
            aspect=0.0,
            aspect_error=1.0,
            portrait=False,
            processing_ms=ms,
            alpha_halo_px=0.0,
            background_frac=0.0,
            sharpness=0.0,
            mean_corner_error=None,
            max_corner_error=None,
            corners=[],
        )

    rgba = res.rgba
    h, w = rgba.shape[:2]
    aspect = min(w, h) / max(w, h) if max(w, h) > 0 else 0.0

    mean_err = max_err = None
    compare = res.working_corners or res.crop_corners
    if verified_corners is not None and compare:
        gt = np.array(verified_corners, dtype=np.float64)
        det = np.array(compare, dtype=np.float64)
        if gt.shape == det.shape:
            d = np.linalg.norm(gt - det, axis=1)
            mean_err = float(np.mean(d))
            max_err = float(np.max(d))

    return CropMetrics(
        found=True,
        error=None,
        confidence=res.confidence,
        needs_manual=res.needs_manual,
        needs_review=res.needs_review,
        detection_path=res.detection_path,
        scan_mode=res.scan_mode,
        aspect=aspect,
        aspect_error=abs(aspect - CARD_RATIO),
        portrait=h >= w,
        processing_ms=ms,
        alpha_halo_px=_alpha_halo(rgba),
        background_frac=_background_frac(rgba),
        sharpness=_sharpness(rgba),
        mean_corner_error=mean_err,
        max_corner_error=max_err,
        corners=res.crop_corners,
    )


def _alpha_halo(rgba: np.ndarray) -> float:
    alpha = rgba[:, :, 3]
    semi = np.count_nonzero((alpha > 10) & (alpha < 245))
    opaque = np.count_nonzero(alpha > 245)
    if opaque == 0:
        return 0.0
    coords = cv2.findNonZero((alpha > 128).astype(np.uint8))
    if coords is None:
        return 0.0
    _, _, bw, bh = cv2.boundingRect(coords)
    perim = max(1.0, 2.0 * (bw + bh))
    return float(semi) / perim


def _background_frac(rgba: np.ndarray) -> float:
    alpha = rgba[:, :, 3]
    opaque = alpha > 200
    n = int(np.count_nonzero(opaque))
    if n == 0:
        return 0.0
    rgb = rgba[:, :, :3].astype(np.int16)
    spread = np.max(rgb, axis=2) - np.min(rgb, axis=2)
    gray = rgb.mean(axis=2)
    border = np.zeros_like(opaque)
    b = max(2, int(min(rgba.shape[:2]) * 0.02))
    border[:b, :] = border[-b:, :] = border[:, :b] = border[:, -b:] = True
    neutral_bg = opaque & border & (spread < 18) & (gray > 205)
    return float(np.count_nonzero(neutral_bg)) / n


def _sharpness(rgba: np.ndarray) -> float:
    gray = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())
