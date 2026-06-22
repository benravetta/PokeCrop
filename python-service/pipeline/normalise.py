"""Stage 1: Input normalisation — accept image or PDF, produce a working BGR array."""

import io
import numpy as np
import cv2
from PIL import Image
from typing import Tuple

# Let Pillow decode HEIC/HEIF (the iPhone default "High Efficiency" format).
# Registered once at import; a missing plugin must never crash the service.
try:
    import pillow_heif  # type: ignore

    pillow_heif.register_heif_opener()
except Exception:  # pragma: no cover - optional dependency
    pass

MAX_WORKING_DIM = 2000
MAX_ORIGINAL_DIM = 10000
MAX_PDF_DPI = 600

# Camera raw formats decoded via rawpy/LibRaw. DNG is the one phones produce
# (Apple ProRAW / Android pro modes); the rest come along for free.
RAW_EXTS = {"dng", "cr2", "cr3", "nef", "arw", "raf", "orf", "rw2", "srw", "pef"}


def normalise_input(file_bytes: bytes, filename: str, dpi: int = 300) -> Tuple[np.ndarray, np.ndarray, float]:
    """Normalise input to a BGR numpy array.

    Returns:
        working: possibly downscaled image for detection
        original: full-resolution image for final output
        scale: ratio of original to working dimensions
    """
    dpi = max(72, min(dpi, MAX_PDF_DPI))
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        original = _rasterise_pdf(file_bytes, dpi)
    elif ext in RAW_EXTS:
        original = _decode_raw(file_bytes)
    else:
        original = _decode_image(file_bytes)

    h, w = original.shape[:2]
    if h > MAX_ORIGINAL_DIM or w > MAX_ORIGINAL_DIM:
        shrink = MAX_ORIGINAL_DIM / max(h, w)
        original = cv2.resize(
            original,
            (int(w * shrink), int(h * shrink)),
            interpolation=cv2.INTER_AREA,
        )

    scale = 1.0
    h, w = original.shape[:2]
    max_dim = max(h, w)

    if max_dim > MAX_WORKING_DIM:
        scale = max_dim / MAX_WORKING_DIM
        new_w = int(w / scale)
        new_h = int(h / scale)
        working = cv2.resize(original, (new_w, new_h), interpolation=cv2.INTER_AREA)
    else:
        working = original.copy()

    return working, original, scale


def _rasterise_pdf(file_bytes: bytes, dpi: int) -> np.ndarray:
    """Rasterise page 1 of a PDF at the given DPI."""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        if len(doc) == 0:
            raise ValueError("PDF has no pages")
        page = doc[0]
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        if pix.width > MAX_ORIGINAL_DIM or pix.height > MAX_ORIGINAL_DIM:
            scale = MAX_ORIGINAL_DIM / max(pix.width, pix.height)
            new_zoom = zoom * scale
            mat = fitz.Matrix(new_zoom, new_zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    finally:
        doc.close()


def _decode_raw(file_bytes: bytes) -> np.ndarray:
    """Decode a camera raw (DNG, CR2, NEF, ...) to BGR via rawpy/LibRaw."""
    import rawpy

    with rawpy.imread(io.BytesIO(file_bytes)) as raw:
        rgb = raw.postprocess(
            use_camera_wb=True,
            output_bps=8,
            no_auto_bright=False,
        )
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def _decode_image(file_bytes: bytes) -> np.ndarray:
    """Decode an image from bytes, applying EXIF orientation when present."""
    try:
        pil = Image.open(io.BytesIO(file_bytes))
        from PIL import ImageOps

        pil = ImageOps.exif_transpose(pil)
        if pil.mode not in ("RGB", "RGBA"):
            pil = pil.convert("RGB")
        elif pil.mode == "RGBA":
            pil = pil.convert("RGB")
        rgb = np.array(pil)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        arr = np.frombuffer(file_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is not None:
            return img
        # Last resort: a raw file that arrived without a recognised extension.
        try:
            return _decode_raw(file_bytes)
        except Exception:
            raise ValueError("Could not decode image file")
