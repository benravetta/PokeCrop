"""Manual crop helpers — parse user corners and rebuild the edit frame."""

import cv2
import numpy as np
from typing import Optional, Tuple

from utils.geometry import order_corners


def parse_manual_corners(raw, width: int, height: int) -> Optional[np.ndarray]:
    """Parse four [x, y] points in edit-image pixel space."""
    if not isinstance(raw, list) or len(raw) != 4:
        return None

    points = []
    for pt in raw:
        if not isinstance(pt, (list, tuple)) or len(pt) != 2:
            return None
        try:
            x = float(pt[0])
            y = float(pt[1])
        except (TypeError, ValueError):
            return None
        x = float(np.clip(x, 0, max(width - 1, 0)))
        y = float(np.clip(y, 0, max(height - 1, 0)))
        points.append([x, y])

    ordered = order_corners(np.array(points, dtype=np.float32))
    return ordered.reshape(-1, 1, 2).astype(np.float32)


def rotate_working_image(image: np.ndarray, angle: float) -> np.ndarray:
    """Rotate the working image by the same angle used during auto straighten."""
    if abs(angle) <= 0.3:
        return image

    h, w = image.shape[:2]
    centre = (w / 2, h / 2)
    M = cv2.getRotationMatrix2D(centre, angle, 1.0)
    cos_a = abs(M[0, 0])
    sin_a = abs(M[0, 1])
    new_w = int(h * sin_a + w * cos_a)
    new_h = int(h * cos_a + w * sin_a)
    M[0, 2] += (new_w - w) / 2
    M[1, 2] += (new_h - h) / 2
    return cv2.warpAffine(image, M, (new_w, new_h), borderValue=(255, 255, 255))


def build_edit_frame(
    working: np.ndarray,
    rotation_angle: float,
    rotate_correction: bool,
) -> np.ndarray:
    """Return the image the UI should use for crop handles."""
    if rotate_correction and abs(rotation_angle) > 0.3:
        return rotate_working_image(working, rotation_angle)
    return working


def resolve_extraction_contour(
    working: np.ndarray,
    manual_corners: Optional[np.ndarray],
    rotation_angle: float,
    rotate_correction: bool,
) -> Tuple[np.ndarray, np.ndarray, float]:
    """Resolve processed image + contour for extract_warped_card."""
    if manual_corners is not None:
        processed = build_edit_frame(working, rotation_angle, rotate_correction)
        h, w = processed.shape[:2]
        contour = parse_manual_corners(
            manual_corners.reshape(4, 2).tolist(),
            w,
            h,
        )
        if contour is None:
            contour = manual_corners
        return processed, contour, rotation_angle

    from pipeline.find_card import straighten_card

    raise RuntimeError("resolve_extraction_contour requires manual corners or caller uses straighten_card")
