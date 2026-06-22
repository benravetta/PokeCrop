"""Stage: restrained, honest image enhancement.

Produces the polished "clean" listing look without inventing or hiding card
content. Operates only on card (opaque) pixels:
- restrained grey-world white balance (limited per-channel gain),
- broad illumination correction on luminance in log space (vignette / uneven
  room light), at a conservative strength,
- luminance-only unsharp mask.

Glare is only measured (for flagging) and never reconstructed. The grading-safe
path deliberately skips beautification that could mask condition evidence.
"""

from typing import Tuple

import cv2
import numpy as np


def enhance_clean(
    rgba: np.ndarray,
    wb_strength: float = 0.6,
    light_strength: float = 0.32,
    sharpen_sigma: float = 1.0,
    sharpen_amount: float = 0.3,
) -> np.ndarray:
    """Return a beautified RGBA (white balance + lighting + sharpen)."""
    if rgba.size == 0:
        return rgba
    alpha = rgba[:, :, 3]
    opaque = alpha > 16
    if np.count_nonzero(opaque) < 64:
        return rgba

    rgb = rgba[:, :, :3].astype(np.float32)
    rgb = _white_balance(rgb, opaque, wb_strength)
    rgb = _correct_illumination(rgb, opaque, light_strength)
    rgb = _unsharp_luminance(rgb, sharpen_sigma, sharpen_amount)

    out = rgba.copy()
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[alpha == 0, 0:3] = 0
    return out


def glare_fraction(rgba: np.ndarray) -> float:
    """Fraction of opaque card pixels that are near-clipped white (glare)."""
    if rgba.size == 0:
        return 0.0
    alpha = rgba[:, :, 3]
    opaque = alpha > 16
    n = int(np.count_nonzero(opaque))
    if n == 0:
        return 0.0
    rgb = rgba[:, :, :3]
    clipped = opaque & np.all(rgb >= 250, axis=2)
    return float(round(np.count_nonzero(clipped) / n, 4))


def _white_balance(rgb: np.ndarray, opaque: np.ndarray, strength: float) -> np.ndarray:
    """Restrained grey-world: pull channel means together, with clamped gains."""
    means = np.array([rgb[:, :, c][opaque].mean() for c in range(3)], dtype=np.float32)
    grey = float(means.mean())
    if grey <= 1.0:
        return rgb
    gains = grey / np.clip(means, 1.0, None)
    gains = np.clip(gains, 0.85, 1.18)  # never recolour aggressively
    gains = 1.0 + (gains - 1.0) * float(np.clip(strength, 0.0, 1.0))
    return rgb * gains.reshape(1, 1, 3)


def _correct_illumination(rgb: np.ndarray, opaque: np.ndarray, strength: float) -> np.ndarray:
    """Flatten broad lighting on the L channel in log space (conservative)."""
    if strength <= 0:
        return rgb
    lab = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    L = lab[:, :, 0]
    logL = np.log1p(L)
    sigma = max(L.shape) * 0.10
    illum = cv2.GaussianBlur(logL, (0, 0), sigma)
    median_illum = float(np.median(illum[opaque])) if np.count_nonzero(opaque) else float(np.median(illum))
    corrected = logL - strength * (illum - median_illum)
    newL = np.expm1(corrected)
    lab[:, :, 0] = np.clip(newL, 0, 255)
    out = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
    return out


def _unsharp_luminance(rgb: np.ndarray, sigma: float, amount: float) -> np.ndarray:
    """Luminance-only unsharp mask (no colour-channel ringing)."""
    if amount <= 0:
        return rgb
    ycc = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2YCrCb).astype(np.float32)
    y = ycc[:, :, 0]
    blur = cv2.GaussianBlur(y, (0, 0), sigma)
    ycc[:, :, 0] = np.clip(y + amount * (y - blur), 0, 255)
    return cv2.cvtColor(ycc.astype(np.uint8), cv2.COLOR_YCrCb2RGB).astype(np.float32)
