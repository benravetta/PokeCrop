"""Stage: upright orientation of a rectified card.

The perspective transform removes tilt but leaves a 90/180/270-degree ambiguity.
We resolve it with one strategy: read the card text with Tesseract across the
four rotations and keep the most-readable one; when OCR is unavailable or
unsure, fall back to a card-type-agnostic layout heuristic (rules/flavour/fine
print cluster at the bottom, with light Pokemon / One Piece cues).

EXIF orientation is handled earlier in normalise.py; manual 90-degree overrides
are applied by the caller after this stage.
"""

from typing import Tuple

import cv2
import numpy as np

try:
    import pytesseract
    from pytesseract import Output as _TESS_OUTPUT
except Exception:  # pragma: no cover
    pytesseract = None
    _TESS_OUTPUT = None

CARD_RATIO = 63.0 / 88.0


def _rotate(img: np.ndarray, deg: int) -> np.ndarray:
    if deg == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    if deg == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    if deg == 270:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img


def orient_upright(warped: np.ndarray, margin: int = 0) -> Tuple[np.ndarray, int]:
    """Rotate ``warped`` to an upright portrait card.

    The warp already produced the card at its true aspect ratio, so we never
    pick a rotation that changes a portrait card into landscape (the previous
    failure mode). We only choose among the rotations that keep the result
    portrait, then resolve upright vs upside-down with OCR readability backed by
    a card-layout heuristic. Returns (image, clockwise_degrees_applied).
    """
    h, w = warped.shape[:2]
    base_portrait = h >= w
    candidate_degs = (0, 180) if base_portrait else (90, 270)

    best_deg = candidate_degs[0]
    best_score = -1e18
    best_img = warped
    for deg in candidate_degs:
        img = _rotate(warped, deg)
        ocr_score, words = _ocr_text_score(_ocr_gray(img))
        heuristic = _orientation_score(img)
        score = ocr_score * 3.0 + heuristic + (10.0 if words >= 2 else 0.0)
        if score > best_score:
            best_score, best_deg, best_img = score, deg, img
    return best_img, best_deg


def _ocr_gray(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    scale = 900.0 / float(max(h, w)) if max(h, w) > 900 else 1.0
    if scale < 1.0:
        img = cv2.resize(img, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def _ocr_text_score(gray: np.ndarray) -> Tuple[float, int]:
    if pytesseract is None:
        return 0.0, 0
    try:
        data = pytesseract.image_to_data(gray, config="--psm 11", output_type=_TESS_OUTPUT.DICT)
    except Exception:
        return 0.0, 0
    score = 0.0
    words = 0
    for conf_s, text in zip(data.get("conf", []), data.get("text", [])):
        if len((text or "").strip()) < 2:
            continue
        try:
            conf = float(conf_s)
        except (TypeError, ValueError):
            continue
        if conf >= 50.0:
            score += conf
            words += 1
    return score, words


def _red_band_coverage(img: np.ndarray) -> Tuple[float, float]:
    h = img.shape[0]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m1 = cv2.inRange(hsv, (0, 80, 50), (12, 255, 255))
    m2 = cv2.inRange(hsv, (168, 80, 50), (180, 255, 255))
    red = cv2.bitwise_or(m1, m2)

    def band_cov(y0: int, y1: int) -> float:
        region = red[y0:y1]
        if region.size == 0:
            return 0.0
        row_fill = np.mean(region > 0, axis=1)
        return float(np.max(row_fill)) if len(row_fill) else 0.0

    top = band_cov(0, max(int(h * 0.22), 1))
    bottom = band_cov(int(h * 0.78), h)
    return top, bottom


def _cost_marker(card: np.ndarray) -> float:
    h, w = card.shape[:2]
    gray = cv2.cvtColor(card, cv2.COLOR_BGR2GRAY)
    lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F))
    mh, mw = max(int(h * 0.12), 8), max(int(w * 0.18), 8)
    tl_detail = float(np.mean(lap[:mh, :mw]))
    br_detail = float(np.mean(lap[-mh:, -mw:]))
    return tl_detail - br_detail


def _orientation_score(card: np.ndarray) -> float:
    if card.shape[0] < 40 or card.shape[1] < 20:
        return 0.0
    base = _upright_score(card)
    top_red, bot_red = _red_band_coverage(card)
    cost_marker = _cost_marker(card)
    bonus = 0.0
    if cost_marker > 2.0:
        bonus += cost_marker + (bot_red - top_red) * 6.0
    elif (top_red - bot_red) > 0.10:
        bonus += (top_red - bot_red) * 8.0
    return base + bonus


def _upright_score(card_crop: np.ndarray) -> float:
    if card_crop.shape[0] < 40 or card_crop.shape[1] < 20:
        return 0.0
    target_h = 1000
    target_w = max(1, int(round(target_h * CARD_RATIO)))
    crop = cv2.resize(card_crop, (target_w, target_h), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (21, 5)))
    edges = cv2.Canny(gray, 60, 160)
    vert = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3))
    horiz = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3))
    h = gray.shape[0]
    top = slice(0, int(h * 0.18))
    mid_top = slice(int(h * 0.08), int(h * 0.22))
    bottom = slice(int(h * 0.68), int(h * 0.98))
    top_detail = float(np.mean(blackhat[top])) * 0.55 + float(np.mean(edges[top])) * 0.30 + float(np.mean(vert[top])) * 0.15
    bottom_detail = float(np.mean(blackhat[bottom])) * 0.55 + float(np.mean(edges[bottom])) * 0.30 + float(np.mean(vert[bottom])) * 0.15
    detail_score = bottom_detail - top_detail
    top_text = float(np.mean(horiz[mid_top]))
    bottom_text = float(np.mean(horiz[bottom]))
    text_score = (bottom_text - top_text) / max(top_text, 1.0)
    return detail_score * 0.65 + text_score * 0.35
