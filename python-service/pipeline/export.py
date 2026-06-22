"""Stage: trim, pad and encode final outputs.

Produces the transparent PNG plus optional flattened variants (white-background
JPEG / arbitrary solid background) from the same RGBA, so every output is pixel
consistent. PNG uses a fast compression level suited to single-container CPU.
"""

import base64
import io
from typing import Optional, Tuple

import cv2
import numpy as np
from PIL import Image


def trim_and_pad(rgba: np.ndarray, pad: int = 8) -> np.ndarray:
    """Crop to the tight alpha bounds, then add a transparent margin."""
    if rgba.size == 0:
        return rgba
    alpha = rgba[:, :, 3]
    coords = cv2.findNonZero((alpha > 0).astype(np.uint8) * 255)
    if coords is None:
        return rgba
    x, y, w, h = cv2.boundingRect(coords)
    cropped = rgba[y:y + h, x:x + w]
    if pad > 0:
        cropped = cv2.copyMakeBorder(
            cropped, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0)
        )
    return cropped


def encode_png(rgba: np.ndarray, compress_level: int = 3) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, format="PNG", compress_level=int(compress_level))
    return buf.getvalue()


def web_png(rgba: np.ndarray, max_dim: int = 1200, compress_level: int = 3) -> bytes:
    """Web-sized transparent PNG, resized in one pass from the RGBA."""
    h, w = rgba.shape[:2]
    if max(w, h) > max_dim:
        if w >= h:
            nw, nh = max_dim, max(1, int(round(h * max_dim / w)))
        else:
            nh, nw = max_dim, max(1, int(round(w * max_dim / h)))
        rgba = cv2.resize(rgba, (nw, nh), interpolation=cv2.INTER_AREA)
    return encode_png(rgba, compress_level)


def composite_solid(rgba: np.ndarray, color: Tuple[int, int, int] = (255, 255, 255)) -> np.ndarray:
    """Flatten RGBA onto a solid background, returning RGB."""
    alpha = rgba[:, :, 3:4].astype(np.float32) / 255.0
    rgb = rgba[:, :, :3].astype(np.float32)
    bg = np.array(color, dtype=np.float32).reshape(1, 1, 3)
    flat = rgb * alpha + bg * (1.0 - alpha)
    return np.clip(flat, 0, 255).astype(np.uint8)


def encode_jpeg(rgb: np.ndarray, quality: int = 96) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="JPEG", quality=int(quality))
    return buf.getvalue()


def white_jpeg(rgba: np.ndarray, quality: int = 96) -> bytes:
    return encode_jpeg(composite_solid(rgba, (255, 255, 255)), quality)


def to_base64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def parse_background(value) -> Optional[Tuple[int, int, int]]:
    """Parse a background spec: 'white', 'black', or '#rrggbb' -> RGB tuple."""
    if value is None:
        return None
    if isinstance(value, (list, tuple)) and len(value) == 3:
        return tuple(int(np.clip(v, 0, 255)) for v in value)
    s = str(value).strip().lower()
    if s in ("none", "transparent", ""):
        return None
    named = {"white": (255, 255, 255), "black": (0, 0, 0), "grey": (200, 200, 200), "gray": (200, 200, 200)}
    if s in named:
        return named[s]
    if s.startswith("#") and len(s) == 7:
        try:
            return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16))
        except ValueError:
            return None
    return None
