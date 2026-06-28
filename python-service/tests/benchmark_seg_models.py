#!/usr/bin/env python3
"""Compare segmentation models on the crop fixture set.

Usage:
  CARD_SEG_MODEL=u2netp python tests/benchmark_seg_models.py
  CARD_SEG_MODEL=isnet-general-use python tests/benchmark_seg_models.py

Runs each manifest case twice (once per model) and prints corner error + latency.
"""

from __future__ import annotations

import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from tests.metrics import compute_metrics  # noqa: E402

MODELS = ["u2netp", "isnet-general-use"]


def run_model(model: str, cases: list) -> list[dict]:
    os.environ["CARD_SEG_MODEL"] = model
    # Force reload of segment module cache if any
    import importlib
    import pipeline.segment as seg

    importlib.reload(seg)

    rows: list[dict] = []
    for case in cases:
        path = os.path.join(HERE, case["file"])
        if not os.path.exists(path):
            continue
        t0 = time.time()
        m = compute_metrics(path, case.get("verified_corners"))
        elapsed = int((time.time() - t0) * 1000)
        rows.append(
            {
                "id": case["id"],
                "category": case.get("category", ""),
                "confidence": m.confidence,
                "corner_err": m.mean_corner_error,
                "ms": elapsed,
                "path": m.detection_path,
                "found": m.found,
            }
        )
    return rows


def main():
    with open(os.path.join(HERE, "manifest.json"), encoding="utf-8") as f:
        cases = json.load(f)["cases"]

    print("model,id,category,found,confidence,corner_err_ms,latency_ms,detection_path")
    for model in MODELS:
        rows = run_model(model, cases)
        for r in rows:
            err = r["corner_err"]
            err_s = f"{err:.1f}" if err is not None else ""
            print(
                f"{model},{r['id']},{r['category']},{r['found']},"
                f"{r['confidence']:.3f},{err_s},{r['ms']},{r['path']}"
            )


if __name__ == "__main__":
    main()
