"""Manual crop helper — parse user-supplied corners in edit-image space."""

import numpy as np
from typing import Optional

from utils.geometry import order_corners


def parse_manual_corners(raw, width: int, height: int) -> Optional[np.ndarray]:
    """Parse four [x, y] points in edit-image pixel space, clamped to bounds."""
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
