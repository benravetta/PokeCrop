import os
import sys

import pytest

# Make the python-service root importable (pipeline.*, utils.*) when pytest is
# invoked from anywhere.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


@pytest.fixture(scope="session", autouse=True)
def _warmup_segmentation():
    """Load the segmentation model once so fixture timings exclude cold start."""
    import numpy as np

    try:
        from pipeline import segment

        img = np.zeros((128, 128, 3), np.uint8)
        segment.card_mask(img)
    except Exception:
        pass
