"""Colour analysis helpers for card detection."""

import cv2
import numpy as np
from typing import Tuple, Optional


def dominant_colour(image: np.ndarray, mask: Optional[np.ndarray] = None, k: int = 3) -> np.ndarray:
    """Find the dominant colour in a region using k-means."""
    if mask is not None:
        pixels = image[mask > 0]
    else:
        pixels = image.reshape(-1, 3)

    if pixels.ndim == 1:
        pixels = pixels.reshape(-1, 3)

    if len(pixels) < k:
        return np.array([128, 128, 128], dtype=np.uint8)

    pixels = pixels.astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    try:
        _, labels, centres = cv2.kmeans(pixels, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
        counts = np.bincount(labels.flatten())
        return centres[np.argmax(counts)].astype(np.uint8)
    except cv2.error:
        return np.mean(pixels, axis=0).astype(np.uint8)


def colour_distance_lab(c1: np.ndarray, c2: np.ndarray) -> float:
    """Compute perceptual colour distance in LAB space."""
    c1_lab = cv2.cvtColor(c1.reshape(1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2LAB).flatten().astype(np.float64)
    c2_lab = cv2.cvtColor(c2.reshape(1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2LAB).flatten().astype(np.float64)
    return float(np.linalg.norm(c1_lab - c2_lab))


def region_variance(image: np.ndarray, mask: Optional[np.ndarray] = None) -> float:
    """Compute colour variance in a region (proxy for 'has printed content')."""
    if mask is not None:
        pixels = image[mask > 0]
    else:
        pixels = image.reshape(-1, 3)

    if pixels.ndim == 1:
        pixels = pixels.reshape(-1, 3)

    if len(pixels) < 10:
        return 0.0

    return float(np.mean(np.var(pixels.astype(np.float64), axis=0)))


def detect_background_colour(image: np.ndarray, border_fraction: float = 0.05) -> np.ndarray:
    """Detect the background colour by sampling the image borders."""
    h, w = image.shape[:2]
    bw = max(int(w * border_fraction), 5)
    bh = max(int(h * border_fraction), 5)

    strips = np.concatenate([
        image[:bh, :].reshape(-1, 3),
        image[-bh:, :].reshape(-1, 3),
        image[:, :bw].reshape(-1, 3),
        image[:, -bw:].reshape(-1, 3),
    ])

    return dominant_colour(strips, k=3)
