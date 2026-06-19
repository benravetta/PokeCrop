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

from utils.geometry import order_corners


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
    cropped = _remove_edge_connected_white_background(cropped)

    # Re-crop after cleanup so removed white spill does not leave empty margins.
    cropped, trim = _recrop_to_alpha_bounds(cropped)
    x1 += trim[0]
    y1 += trim[1]
    x2 -= trim[2]
    y2 -= trim[3]

    pil_img = Image.fromarray(cropped, "RGBA")
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG", optimize=True)

    return buf.getvalue(), (int(x1), int(y1), int(x2 - x1), int(y2 - y1))


def _remove_edge_connected_white_background(cropped: np.ndarray) -> np.ndarray:
    """Remove near-white regions connected to the crop edge.

    This targets scan background that leaked into the mask. Because we only
    remove white components touching the crop border, actual card interior is
    preserved unless the contour is catastrophically wrong.
    """
    if cropped.size == 0:
        return cropped

    rgba = cropped.copy()
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]

    opaque = alpha > 20
    if np.count_nonzero(opaque) == 0:
        return rgba

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    value = hsv[:, :, 2].astype(np.int16)
    sat = hsv[:, :, 1].astype(np.int16)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.int16)
    rgb_i = rgb.astype(np.int16)
    channel_spread = np.max(rgb_i, axis=2) - np.min(rgb_i, axis=2)

    # Broad "scan background" classifier:
    # - fairly bright
    # - low saturation / near-neutral
    # - only remove regions touching the crop edge
    background_candidate = (
        opaque
        & (
            ((gray >= 176) & (sat <= 92) & (channel_spread <= 58))
            | ((value >= 190) & (sat <= 78) & (channel_spread <= 48))
            | ((gray >= 205) & (channel_spread <= 70))
        )
    )

    if np.count_nonzero(background_candidate) == 0:
        return rgba

    candidate_u8 = background_candidate.astype(np.uint8) * 255
    candidate_u8 = cv2.morphologyEx(
        candidate_u8,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        iterations=1,
    )

    num_labels, labels = cv2.connectedComponents(candidate_u8, connectivity=4)
    if num_labels <= 1:
        return rgba

    border_labels = set(np.unique(labels[0, :]).tolist())
    border_labels.update(np.unique(labels[-1, :]).tolist())
    border_labels.update(np.unique(labels[:, 0]).tolist())
    border_labels.update(np.unique(labels[:, -1]).tolist())
    border_labels.discard(0)
    if not border_labels:
        return rgba

    removable = np.isin(labels, list(border_labels))
    if np.count_nonzero(removable) == 0:
        return rgba

    removable = cv2.dilate(
        removable.astype(np.uint8),
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        iterations=1,
    ) > 0

    rgba[removable, 3] = 0
    rgba[removable, 0] = 0
    rgba[removable, 1] = 0
    rgba[removable, 2] = 0
    return rgba


def _recrop_to_alpha_bounds(cropped: np.ndarray) -> tuple:
    """Crop an RGBA image down to the tight bounds of its alpha."""
    if cropped.size == 0:
        return cropped, (0, 0, 0, 0)

    alpha = cropped[:, :, 3]
    coords = cv2.findNonZero((alpha > 0).astype(np.uint8) * 255)
    if coords is None:
        return cropped, (0, 0, 0, 0)

    x, y, w, h = cv2.boundingRect(coords)
    x2 = x + w
    y2 = y + h
    return cropped[y:y2, x:x2], (x, y, cropped.shape[1] - x2, cropped.shape[0] - y2)


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
    corner_radius_px: float = 0.0,
) -> bytes:
    """Draw detection overlay showing all candidates and the final extraction boundary."""
    overlay = image.copy()

    for i, cnt in enumerate(candidates):
        if i == selected_idx:
            continue
        cv2.drawContours(overlay, [cnt], -1, (180, 180, 180), 1)

    if 0 <= selected_idx < len(candidates):
        cv2.drawContours(overlay, [candidates[selected_idx]], -1, (0, 140, 60), 1)

    corners = order_corners(refined_contour.reshape(4, 2).astype(np.float32))
    if corner_radius_px > 1.5:
        _draw_rounded_quad_outline(overlay, corners, corner_radius_px, (0, 220, 100), 2)
    else:
        cv2.drawContours(
            overlay,
            [corners.astype(np.int32).reshape(-1, 1, 2)],
            -1,
            (0, 220, 100),
            2,
        )

    for pt in corners:
        cv2.circle(overlay, tuple(np.round(pt).astype(int)), 5, (0, 220, 100), -1)

    pil_img = Image.fromarray(cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def _draw_rounded_quad_outline(
    image: np.ndarray,
    corners: np.ndarray,
    radius: float,
    color: tuple,
    thickness: int,
) -> None:
    """Draw a rounded quadrilateral following the physical card corner radius."""
    tl, tr, br, bl = corners.astype(np.float64)
    short = min(
        np.linalg.norm(tr - tl),
        np.linalg.norm(br - tr),
        np.linalg.norm(bl - br),
        np.linalg.norm(tl - bl),
    )
    r = float(np.clip(radius, 0.0, short * 0.12))
    if r < 1.5:
        cv2.polylines(
            image,
            [corners.astype(np.int32).reshape(-1, 1, 2)],
            True,
            color,
            thickness,
        )
        return

    arc_pts = 12
    pts = []

    def corner_arc(p_prev: np.ndarray, p_corner: np.ndarray, p_next: np.ndarray) -> None:
        v1 = p_prev - p_corner
        v2 = p_next - p_corner
        l1 = np.linalg.norm(v1)
        l2 = np.linalg.norm(v2)
        if l1 < 1 or l2 < 1:
            pts.append(p_corner)
            return
        u1 = v1 / l1
        u2 = v2 / l2
        inset = min(r, l1 * 0.45, l2 * 0.45)
        p1 = p_corner + u1 * inset
        p2 = p_corner + u2 * inset
        bis = u1 + u2
        bn = np.linalg.norm(bis)
        if bn < 1e-3:
            pts.extend([p1, p2])
            return
        bis = bis / bn
        cos_half = np.clip(np.dot(u1, bis), 0.05, 1.0)
        centre = p_corner + bis * (inset / cos_half)
        a1 = np.arctan2(p1[1] - centre[1], p1[0] - centre[0])
        a2 = np.arctan2(p2[1] - centre[1], p2[0] - centre[0])
        if a2 < a1:
            a2 += 2 * np.pi
        for a in np.linspace(a1, a2, arc_pts):
            pts.append([centre[0] + inset * np.cos(a), centre[1] + inset * np.sin(a)])

    corner_arc(bl, tl, tr)
    corner_arc(tl, tr, br)
    corner_arc(tr, br, bl)
    corner_arc(br, bl, tl)

    poly = np.array(pts, dtype=np.int32).reshape(-1, 1, 2)
    cv2.polylines(image, [poly], True, color, thickness, cv2.LINE_AA)


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
