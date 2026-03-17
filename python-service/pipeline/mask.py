"""Stage 6: Mask + alpha output — produce the final transparent PNG.

Key improvements:
- Distance-transform alpha feathering for smooth 2-3px edge transitions
  instead of a crude Gaussian blur.
- Pre-multiplied alpha compositing: transparent pixels have zeroed RGB
  to prevent colour fringing in downstream compositing.
- Proper upscaling of the mask preserves anti-aliased edges.
"""

import cv2
import numpy as np
from PIL import Image
import io
import base64


def create_alpha_output(
    original: np.ndarray,
    mask: np.ndarray,
    scale: float,
    crop_padding: int = 0,
) -> tuple:
    """Apply the mask to the original image and produce a transparent PNG.

    Returns:
        result_png_bytes: PNG file bytes
        bbox: (x, y, w, h) of the card in the original image
    """
    h_orig, w_orig = original.shape[:2]

    # ── Upscale mask to original resolution ──
    if scale > 1.0 or mask.shape[:2] != (h_orig, w_orig):
        # Use INTER_CUBIC for smooth upscaling that preserves the anti-aliased
        # edges from the 8x-supersampled rounded-rect mask.
        full_mask = cv2.resize(mask, (w_orig, h_orig), interpolation=cv2.INTER_CUBIC)
        full_mask = np.clip(full_mask, 0, 255).astype(np.uint8)
    else:
        full_mask = mask.copy()

    # ── Distance-transform alpha feathering ──
    # Create a smooth alpha channel with a 2-3px feather at the edges.
    # The mask from corners.py already has some AA from supersampling;
    # this adds a gentle additional feather for clean compositing.
    alpha = _feather_mask(full_mask, feather_px=2)

    # ── Composite ──
    rgba = cv2.cvtColor(original, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = alpha

    # Zero out RGB in fully transparent regions to prevent colour fringing
    transparent = alpha == 0
    rgba[transparent, 0] = 0
    rgba[transparent, 1] = 0
    rgba[transparent, 2] = 0

    # ── Crop to bounding box ──
    binary = (alpha > 0).astype(np.uint8) * 255
    coords = cv2.findNonZero(binary)
    if coords is None:
        empty = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        buf = io.BytesIO()
        empty.save(buf, format="PNG")
        return buf.getvalue(), (0, 0, 0, 0)

    x, y, bw, bh = cv2.boundingRect(coords)

    pad = max(crop_padding, 0)
    x1 = max(x - pad, 0)
    y1 = max(y - pad, 0)
    x2 = min(x + bw + pad, w_orig)
    y2 = min(y + bh + pad, h_orig)

    cropped = rgba[y1:y2, x1:x2]

    pil_img = Image.fromarray(cropped, "RGBA")
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG", optimize=True)

    return buf.getvalue(), (int(x1), int(y1), int(x2 - x1), int(y2 - y1))


def _feather_mask(mask: np.ndarray, feather_px: int = 2) -> np.ndarray:
    """Create a feathered alpha channel from a binary/near-binary mask.

    Uses distance transform to create a smooth gradient at the mask boundary.
    Interior pixels stay at 255, exterior at 0, and the boundary transitions
    smoothly over `feather_px` pixels.
    """
    # Threshold to get a clean binary mask for the distance transform
    _, binary = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

    if feather_px < 1:
        return binary

    # Distance from each pixel to the nearest background pixel
    dist_inside = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
    # Distance from each pixel to the nearest foreground pixel
    dist_outside = cv2.distanceTransform(255 - binary, cv2.DIST_L2, 5)

    # Alpha ramp: fully opaque when dist_inside > feather_px,
    # fully transparent when dist_outside > feather_px,
    # linear blend in between.
    alpha = np.zeros_like(mask, dtype=np.float64)
    inside = dist_inside > 0
    alpha[inside] = np.clip(dist_inside[inside] / feather_px, 0, 1)

    # Also blend the mask's own AA values: if the original mask had soft edges
    # (from supersampling), preserve that information.
    mask_norm = mask.astype(np.float64) / 255.0
    alpha = np.minimum(alpha, mask_norm)

    # Where the original mask is > 127 and dist_inside > feather_px, force full opacity
    alpha[(binary > 0) & (dist_inside > feather_px)] = 1.0

    return (alpha * 255).astype(np.uint8)


def create_overlay(
    image: np.ndarray,
    refined_contour: np.ndarray,
    candidates: list,
    selected_idx: int,
) -> bytes:
    """Draw detection overlay showing all candidates and the final extraction boundary."""
    overlay = image.copy()

    for i, cnt in enumerate(candidates):
        if i == selected_idx:
            continue
        cv2.drawContours(overlay, [cnt], -1, (180, 180, 180), 1)

    # Draw the original selected candidate in dim green
    if 0 <= selected_idx < len(candidates):
        cv2.drawContours(overlay, [candidates[selected_idx]], -1, (0, 140, 60), 1)

    # Draw the refined/final extraction boundary in bright green
    cv2.drawContours(overlay, [refined_contour], -1, (0, 220, 100), 2)

    # Draw the fitted rectangle from the refined contour
    rect = cv2.minAreaRect(refined_contour)
    box = cv2.boxPoints(rect).astype(np.int32)
    cv2.drawContours(overlay, [box], -1, (0, 180, 255), 2)

    for pt in box:
        cv2.circle(overlay, tuple(pt), 5, (0, 140, 255), -1)

    pil_img = Image.fromarray(cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def create_web_size(png_bytes: bytes, max_dim: int = 1200) -> bytes:
    """Create a web-sized version of the result."""
    img = Image.open(io.BytesIO(png_bytes))
    w, h = img.size

    if max(w, h) <= max_dim:
        return png_bytes

    if w > h:
        new_w = max_dim
        new_h = int(h * max_dim / w)
    else:
        new_h = max_dim
        new_w = int(w * max_dim / h)

    resized = img.resize((new_w, new_h), Image.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def to_base64(png_bytes: bytes) -> str:
    return base64.b64encode(png_bytes).decode("ascii")
