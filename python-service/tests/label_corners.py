#!/usr/bin/env python3
"""Click-to-label verified_corners for crop regression fixtures.

Usage:
  python python-service/tests/label_corners.py fixtures/synthetic/syn_dark_bg.png

Clicks four corners (TL, TR, BR, BL) on the working-normalised view.
Prints JSON suitable for manifest `verified_corners` and optionally updates manifest.
"""

from __future__ import annotations

import json
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from pipeline.normalise import normalise_input  # noqa: E402

MANIFEST_PATH = os.path.join(HERE, "manifest.json")
CLICKS: list[tuple[int, int]] = []


def _on_click(event, x, y, _flags, _param):
    if event != cv2.EVENT_LBUTTONDOWN:
        return
    CLICKS.append((x, y))
    cv2.circle(_param, (x, y), 6, (0, 255, 0), -1)
    if len(CLICKS) >= 2:
        cv2.line(_param, CLICKS[-2], CLICKS[-1], (0, 255, 0), 2)
    if len(CLICKS) == 4:
        cv2.line(_param, CLICKS[3], CLICKS[0], (0, 255, 0), 2)
    cv2.imshow("label", _param)


def main():
    if len(sys.argv) < 2:
        print("Usage: label_corners.py <fixture-relative-or-absolute-path> [--write]")
        sys.exit(1)

    rel = sys.argv[1]
    write = "--write" in sys.argv
    path = rel if os.path.isabs(rel) else os.path.join(HERE, rel)
    with open(path, "rb") as f:
        data = f.read()
    working, _, _scale = normalise_input(data, path)
    view = working.copy()
    cv2.namedWindow("label")
    cv2.setMouseCallback("label", _on_click, view)
    print("Click TL, TR, BR, BL. Press any key when done (need 4 clicks).")
    while len(CLICKS) < 4:
        cv2.imshow("label", view)
        if cv2.waitKey(50) & 0xFF == 27:
            break
    cv2.destroyAllWindows()
    if len(CLICKS) != 4:
        print("Need exactly 4 clicks.", file=sys.stderr)
        sys.exit(1)

    corners = [[float(x), float(y)] for x, y in CLICKS]
    print(json.dumps(corners, indent=2))

    if not write:
        return

    fixture_id = os.path.splitext(os.path.basename(path))[0]
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)
    for case in manifest["cases"]:
        if case["id"] == fixture_id or case["file"].endswith(os.path.basename(path)):
            case["verified_corners"] = corners
            break
    else:
        print(f"No manifest case for {fixture_id}", file=sys.stderr)
        sys.exit(1)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"Updated manifest verified_corners for {fixture_id}")


if __name__ == "__main__":
    main()
