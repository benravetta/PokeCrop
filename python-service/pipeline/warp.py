"""Stage: one perspective transform onto canonical card dimensions.

The recovered quadrilateral is mapped, with a single high-quality projective
transform on the full-resolution source, onto the correct trading-card aspect
ratio (63x88mm -> 0.7159). A small working margin is left around the card so the
rounded-corner mask and alpha edge have room. Orientation (90 deg multiples) is
resolved separately afterwards.
"""

from dataclasses import dataclass
from typing import Tuple

import cv2
import numpy as np

from utils.geometry import order_corners

# Canonical output card sizes (short x long), ratio ~0.7159.
OUTPUT_SIZES = {
    "standard": (1260, 1760),
    "high": (1890, 2640),
}
DEFAULT_MARGIN = 8


@dataclass
class Warp:
    image: np.ndarray              # BGR canvas (card + margin)
    card_rect: Tuple[int, int, int, int]  # x, y, w, h of the card inside the canvas
    portrait: bool


def warp_card(
    original: np.ndarray,
    quad_full: np.ndarray,
    output_size: str = "standard",
    margin: int = DEFAULT_MARGIN,
) -> Warp:
    """Warp ``quad_full`` (full-res coords) onto a canonical card canvas."""
    q = order_corners(quad_full.astype(np.float32)).astype(np.float32)

    width = (np.linalg.norm(q[1] - q[0]) + np.linalg.norm(q[2] - q[3])) / 2.0
    height = (np.linalg.norm(q[3] - q[0]) + np.linalg.norm(q[2] - q[1])) / 2.0
    portrait = height >= width

    short, long = OUTPUT_SIZES.get(output_size, OUTPUT_SIZES["standard"])
    card_w, card_h = (short, long) if portrait else (long, short)

    m = int(max(0, margin))
    canvas_w = card_w + 2 * m
    canvas_h = card_h + 2 * m

    dst = np.array(
        [
            [m, m],
            [m + card_w - 1, m],
            [m + card_w - 1, m + card_h - 1],
            [m, m + card_h - 1],
        ],
        dtype=np.float32,
    )

    M = cv2.getPerspectiveTransform(q, dst)
    warped = cv2.warpPerspective(
        original,
        M,
        (canvas_w, canvas_h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return Warp(image=warped, card_rect=(m, m, card_w, card_h), portrait=portrait)
