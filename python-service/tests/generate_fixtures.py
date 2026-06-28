#!/usr/bin/env python3
"""Generate synthetic crop regression fixtures with known card quads.

Run from repo root:
  python python-service/tests/generate_fixtures.py

Writes PNGs under tests/fixtures/synthetic/ and updates manifest entries.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in __import__("sys").path:
    __import__("sys").path.insert(0, ROOT)
FIXTURES = os.path.join(HERE, "fixtures", "synthetic")
MANIFEST_PATH = os.path.join(HERE, "manifest.json")

CARD_RATIO = 63.0 / 88.0


@dataclass
class SynthCase:
    id: str
    category: str
    description: str
    expect_card_found: bool
    min_confidence: float
    aspect_tolerance: float
    max_ms: int = 8000
    max_background: float = 0.05
    max_corner_error: Optional[float] = 12.0


def _card_face(w: int, h: int) -> np.ndarray:
    face = np.zeros((h, w, 3), np.uint8)
    cv2.rectangle(face, (0, 0), (w - 1, h - 1), (40, 60, 180), -1)
    cv2.rectangle(face, (int(w * 0.08), int(h * 0.12)), (int(w * 0.92), int(h * 0.55)), (220, 210, 200), -1)
    cv2.putText(
        face,
        "GEM",
        (int(w * 0.2), int(h * 0.45)),
        cv2.FONT_HERSHEY_SIMPLEX,
        2.4,
        (30, 30, 30),
        4,
        cv2.LINE_AA,
    )
    cv2.rectangle(face, (int(w * 0.08), int(h * 0.78)), (int(w * 0.5), int(h * 0.92)), (20, 20, 20), 2)
    return face


def _place_card(
    canvas: np.ndarray,
    cx: float,
    cy: float,
    long_side: float,
    angle_deg: float,
) -> Tuple[np.ndarray, np.ndarray]:
    """Return canvas with card pasted; corners TL,TR,BR,BL in image px."""
    long_side = float(long_side)
    short_side = long_side * CARD_RATIO
    face = _card_face(int(short_side), int(long_side))
    M = cv2.getRotationMatrix2D((short_side / 2, long_side / 2), angle_deg, 1.0)
    rot = cv2.warpAffine(
        face,
        M,
        (int(short_side), int(long_side)),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0),
    )
    h, w = rot.shape[:2]
    x0 = int(round(cx - w / 2))
    y0 = int(round(cy - h / 2))
    ch, cw = canvas.shape[:2]
    x1, y1 = max(0, x0), max(0, y0)
    x2, y2 = min(cw, x0 + w), min(ch, y0 + h)
    sx1, sy1 = x1 - x0, y1 - y0
    sx2, sy2 = sx1 + (x2 - x1), sy1 + (y2 - y1)
    if x2 > x1 and y2 > y1:
        canvas[y1:y2, x1:x2] = rot[sy1:sy2, sx1:sx2]

    corners = np.array(
        [[0, 0], [w, 0], [w, h], [0, h]],
        dtype=np.float32,
    )
    ones = np.ones((4, 1), dtype=np.float32)
    hom = np.vstack([M, [0, 0, 1]])
    pts = (hom @ np.hstack([corners, ones]).T).T
    pts[:, 0] += x0
    pts[:, 1] += y0
    return canvas, pts.astype(np.float64)


def _bbox(corners: np.ndarray) -> tuple[int, int, int, int]:
    pts = np.round(corners).astype(np.int32).reshape(-1, 2)
    return cv2.boundingRect(pts)


def _working_corners(original_corners: np.ndarray, path: str) -> List[List[float]]:
    from pipeline.normalise import normalise_input

    with open(path, "rb") as f:
        data = f.read()
    working, _, scale = normalise_input(data, path)
    wc = original_corners / float(scale)
    return wc.tolist()


def _write(case: SynthCase, img: np.ndarray, corners: Optional[np.ndarray]) -> dict:
    os.makedirs(FIXTURES, exist_ok=True)
    rel = f"fixtures/synthetic/{case.id}.png"
    path = os.path.join(HERE, rel)
    cv2.imwrite(path, img)
    entry = {
        "id": case.id,
        "file": rel,
        "category": case.category,
        "description": case.description,
        "expect": {
            "card_found": case.expect_card_found,
            "min_confidence": case.min_confidence,
            "aspect_tolerance": case.aspect_tolerance,
            "max_processing_ms": case.max_ms,
            "max_background_frac": case.max_background,
        },
        "verified_corners": _working_corners(corners, path) if corners is not None else None,
    }
    if case.max_corner_error is not None:
        entry["expect"]["max_corner_error_px"] = case.max_corner_error
    return entry


def build_cases() -> List[dict]:
    W, H = 1200, 1600
    entries: List[dict] = []

    def bg(color):
        c = np.full((H, W, 3), color, np.uint8)
        return c

    specs: List[Tuple[SynthCase, np.ndarray, Optional[np.ndarray], float, float, float, float]] = [
        (SynthCase("syn_dark_bg", "dark", "Card on dark background", True, 0.55, 0.08), bg(25), None, 0.5, 0.5, 900, -8),
        (SynthCase("syn_white_bg", "light", "Card on white background", True, 0.55, 0.08), bg(245), None, 0.5, 0.52, 880, 6),
        (SynthCase("syn_playmat", "playmat", "Card on noisy playmat", True, 0.5, 0.1), None, None, 0.48, 0.5, 860, 4),
        (SynthCase("syn_glare", "glare", "Card with glare stripe", True, 0.45, 0.12), bg(40), None, 0.5, 0.5, 900, 0),
        (SynthCase("syn_shadow", "shadow", "Card with hard shadow", True, 0.5, 0.1), bg(180), None, 0.52, 0.5, 870, -5),
        (SynthCase("syn_clipped", "clipped", "Card partially off-frame", True, 0.35, 0.15), bg(30), None, 0.08, 0.5, 920, 12),
        (SynthCase("syn_blur", "blurry", "Motion-blurred card photo", True, 0.35, 0.12), bg(50), None, 0.5, 0.5, 900, 0),
        (SynthCase("syn_multi", "multi", "Two cards in frame", True, 0.3, 0.2), bg(35), None, 0.5, 0.5, 820, 0),
        (SynthCase("syn_no_card", "no_card", "Empty desk — no card", False, 0.0, 1.0), bg(60), None, 0.5, 0.5, 0, 0),
        (SynthCase("syn_scan", "scan", "Full-bleed scan fills frame", True, 0.45, 0.12), None, None, 0.5, 0.5, 980, 0),
        (SynthCase("syn_sleeve", "sleeve", "Card with sleeve border", True, 0.45, 0.12), bg(45), None, 0.5, 0.5, 860, 0),
        (SynthCase("syn_back", "back", "Card back layout", True, 0.5, 0.1), bg(55), None, 0.5, 0.48, 880, 0),
        (SynthCase("syn_damaged", "damaged", "Card with torn corner", True, 0.4, 0.12), bg(48), None, 0.5, 0.5, 870, -10),
        (SynthCase("syn_wood_angle", "wood", "Angled card on wood tone", True, 0.55, 0.08), None, None, 0.46, 0.54, 850, 14),
    ]

    for case, base, _, cx, cy, long_side, angle in specs:
        if case.id == "syn_playmat":
            rng = np.random.default_rng(42)
            base = rng.integers(30, 90, (H, W, 3), dtype=np.uint8)
            noise = rng.integers(-25, 25, (H, W, 3), dtype=np.int16)
            base = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        elif case.id == "syn_wood_angle":
            base = np.full((H, W, 3), (90, 70, 45), np.uint8)
            rng = np.random.default_rng(7)
            grain = rng.integers(-20, 20, (H, W), dtype=np.int16)
            for c in range(3):
                base[:, :, c] = np.clip(base[:, :, c].astype(np.int16) + grain, 0, 255).astype(np.uint8)
        elif case.id == "syn_scan":
            long_side = min(W, H) * 0.96
            short_side = long_side * CARD_RATIO
            face = _card_face(int(short_side), int(long_side))
            base = np.full((H, W, 3), 20, np.uint8)
            x0 = int((W - short_side) / 2)
            y0 = int((H - long_side) / 2)
            base[y0 : y0 + face.shape[0], x0 : x0 + face.shape[1]] = face
            corners = np.array(
                [[x0, y0], [x0 + face.shape[1], y0], [x0 + face.shape[1], y0 + face.shape[0]], [x0, y0 + face.shape[0]]],
                dtype=np.float64,
            )
            entries.append(_write(case, base, corners))
            continue
        elif base is None:
            base = bg(40)

        img = base.copy()
        if case.id == "syn_glare":
            img, corners = _place_card(img, cx * W, cy * H, long_side, angle)
            cv2.rectangle(img, (int(W * 0.25), 0), (int(W * 0.45), H), (255, 255, 255), -1)
        elif case.id == "syn_shadow":
            img, corners = _place_card(img, cx * W, cy * H, long_side, angle)
            overlay = img.copy()
            cv2.rectangle(overlay, (int(W * 0.55), int(H * 0.35)), (W, H), (0, 0, 0), -1)
            img = cv2.addWeighted(img, 0.75, overlay, 0.25, 0)
        elif case.id == "syn_clipped":
            img, corners = _place_card(img, cx * W, cy * H, long_side, angle)
        elif case.id == "syn_blur":
            img, corners = _place_card(img, cx * W, cy * H, long_side, angle)
            img = cv2.GaussianBlur(img, (0, 0), 6)
        elif case.id == "syn_multi":
            img, _ = _place_card(img, 0.35 * W, 0.48 * H, 760, -6)
            img, corners = _place_card(img, 0.62 * W, 0.52 * H, 820, 8)
        elif case.id == "syn_no_card":
            corners = None
        elif case.id == "syn_sleeve":
            img, corners = _place_card(img, cx * W, cy * H, long_side, angle)
            x, y, bw, bh = _bbox(corners)
            pad = int(min(bw, bh) * 0.04)
            cv2.rectangle(img, (x - pad, y - pad), (x + bw + pad, y + bh + pad), (200, 200, 210), 8)
        elif case.id == "syn_back":
            img, corners = _place_card(img, cx * W, cy * H, long_side, angle)
            x, y, bw, bh = _bbox(corners)
            cv2.rectangle(img, (x, y), (x + bw, y + bh), (180, 170, 160), -1)
            cv2.putText(img, "BACK", (x + bw // 4, y + bh // 2), cv2.FONT_HERSHEY_SIMPLEX, 2, (40, 40, 40), 3)
        elif case.id == "syn_damaged":
            img, corners = _place_card(img, cx * W, cy * H, long_side, angle)
            pts = np.round(corners).astype(np.int32).reshape(-1, 1, 2)
            cv2.fillConvexPoly(img, pts[[0, 1, 2]], (30, 30, 30))
        else:
            img, corners = _place_card(img, cx * W, cy * H, long_side, angle)

        entries.append(_write(case, img, corners if case.expect_card_found else None))

    return entries


def main():
    synthetic = build_cases()
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)

    # Keep existing real-photo cases; replace synthetic block.
    keep = [c for c in manifest["cases"] if not c["id"].startswith("syn_")]
    manifest["cases"] = keep + synthetic
    manifest["gaps"] = [
        "Synthetic fixtures cover many categories; add more real photos over time.",
        "Real-photo verified_corners still sparse — label with tests/label_corners.py.",
    ]
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"Wrote {len(synthetic)} synthetic fixtures; manifest now has {len(manifest['cases'])} cases.")


if __name__ == "__main__":
    main()
