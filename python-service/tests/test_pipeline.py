"""Regression tests for the staged crop pipeline.

Runs each manifest fixture through the full pipeline and asserts general
quality invariants (card found, confidence, aspect accuracy, portrait
orientation, processing time, clean alpha). Also covers degenerate inputs
(blank image -> no card / needs manual).
"""

import json
import os

import cv2
import numpy as np
import pytest

from pipeline.normalise import normalise_input
from pipeline.crop import run_crop, CropOptions
from tests.metrics import compute_metrics, CARD_RATIO

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "manifest.json")) as f:
    MANIFEST = json.load(f)

CASES = MANIFEST["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_fixture_crop_quality(case):
    path = os.path.join(HERE, case["file"])
    if not os.path.exists(path):
        pytest.skip(f"fixture missing: {case['file']}")

    exp = case["expect"]
    m = compute_metrics(path, case.get("verified_corners"))

    assert m.found == exp["card_found"], f"{case['id']}: error={m.error}"
    if not m.found:
        return

    assert m.confidence >= exp["min_confidence"], (
        f"{case['id']}: confidence {m.confidence} < {exp['min_confidence']}"
    )
    assert m.aspect_error <= exp["aspect_tolerance"], (
        f"{case['id']}: aspect {m.aspect:.3f} (err {m.aspect_error:.3f}) "
        f"exceeds tol {exp['aspect_tolerance']}"
    )
    assert m.portrait == exp["portrait"], f"{case['id']}: portrait={m.portrait}"
    assert m.processing_ms <= exp["max_processing_ms"], (
        f"{case['id']}: {m.processing_ms}ms > {exp['max_processing_ms']}ms"
    )
    # Alpha edge should be a thin ring, not a fat halo.
    assert m.alpha_halo_px <= 6.0, f"{case['id']}: alpha halo {m.alpha_halo_px:.2f}px"
    # Very little neutral background should survive at the border.
    assert m.background_frac <= 0.05, (
        f"{case['id']}: background retained {m.background_frac:.3f}"
    )

    if m.mean_corner_error is not None:
        assert m.mean_corner_error <= 12.0, (
            f"{case['id']}: mean corner error {m.mean_corner_error:.1f}px"
        )


def test_blank_image_reports_no_card():
    """A uniform blank image must not hallucinate a confident crop."""
    blank = np.full((900, 700, 3), 245, np.uint8)
    ok, buf = cv2.imencode(".png", blank)
    assert ok
    working, original, scale = normalise_input(buf.tobytes(), "blank.png")
    res = run_crop(working, original, scale, CropOptions())
    # Either no card, or flagged for manual adjustment — never a confident crop.
    assert res.error is not None or res.needs_manual or res.confidence < 0.6


def test_manual_corners_rerun_pipeline():
    """Manual corners must produce a confident, portrait crop via the same path."""
    path = os.path.join(HERE, "fixtures", "rowlet_wood_angle.png")
    if not os.path.exists(path):
        pytest.skip("rowlet fixture missing")
    with open(path, "rb") as f:
        data = f.read()
    working, original, scale = normalise_input(data, path)
    h, w = working.shape[:2]
    corners = np.array(
        [[w * 0.08, h * 0.16], [w * 0.85, h * 0.13], [w * 0.86, h * 0.9], [w * 0.07, h * 0.88]],
        dtype=np.float32,
    )
    res = run_crop(working, original, scale, CropOptions(manual_corners=corners))
    assert res.error is None
    assert res.rgba is not None
    assert res.needs_manual is False
    assert res.confidence == 1.0
