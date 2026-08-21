"""AI-cut the title dragon with rembg, keeping original RGB pixels."""
from __future__ import annotations

import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "art-src" / "title-hero.png"
OUT = ROOT / "public" / "art" / "title-dragon.webp"
SHOTS = ROOT / ".shots"
MODELS = ROOT / ".models"

W, H = 1672, 941


def P(xf: float, yf: float) -> tuple[int, int]:
    return int(round(xf * W)), int(round(yf * H))


# Generous dragon corridor so rembg only sees the subject.
SPINE = np.array(
    [
        P(0.008, 0.882),
        P(0.032, 0.858),
        P(0.095, 0.790),
        P(0.170, 0.762),
        P(0.250, 0.742),
        P(0.330, 0.712),
        P(0.410, 0.652),
        P(0.490, 0.575),
        P(0.555, 0.488),
        P(0.605, 0.428),
        P(0.648, 0.398),
    ],
    dtype=np.float64,
)

HEAD_POLY = np.array(
    [
        P(0.545, 0.340),
        P(0.555, 0.210),
        P(0.610, 0.155),
        P(0.680, 0.175),
        P(0.750, 0.220),
        P(0.810, 0.280),
        P(0.850, 0.330),
        P(0.845, 0.410),
        P(0.790, 0.470),
        P(0.710, 0.510),
        P(0.640, 0.490),
        P(0.585, 0.440),
    ],
    dtype=np.int32,
)


def subject_mask(shape: tuple[int, ...]) -> np.ndarray:
    h, w = shape[:2]
    mask = np.zeros((h, w), np.uint8)
    n = len(SPINE)
    for i in range(n - 1):
        t = i / (n - 1)
        thick = int(56 + 70 * np.sin(np.pi * min(1.0, t * 1.05)))
        p0 = tuple(int(v) for v in SPINE[i])
        p1 = tuple(int(v) for v in SPINE[i + 1])
        cv2.line(mask, p0, p1, 255, max(thick, 28), cv2.LINE_AA)
    cv2.fillPoly(mask, [HEAD_POLY], 255)
    mask = cv2.dilate(mask, np.ones((31, 31), np.uint8))
    return mask


def crop_rgba(rgba: np.ndarray, pad: int = 16) -> tuple[np.ndarray, list[int]]:
    ys, xs = np.where(rgba[:, :, 3] > 12)
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(rgba.shape[1], int(xs.max()) + pad + 1)
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(rgba.shape[0], int(ys.max()) + pad + 1)
    return rgba[y0:y1, x0:x1], [x0, y0, x1, y1]


def main() -> None:
    SHOTS.mkdir(exist_ok=True)
    MODELS.mkdir(exist_ok=True)
    os.environ.setdefault("U2NET_HOME", str(MODELS))

    bgr = cv2.imread(str(SRC), cv2.IMREAD_COLOR)
    assert bgr is not None, SRC
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    mask = subject_mask(bgr.shape)
    Image.fromarray(mask).save(SHOTS / "dragon-rembg-hint.jpg")

    print("loading rembg session isnet-general-use ...", flush=True)
    session = new_session("isnet-general-use")
    print("running rembg on original ...", flush=True)
    cut = remove(
        Image.fromarray(rgb),
        session=session,
        post_process_mask=True,
    )
    alpha = np.array(cut.split()[-1])
    # Drop obvious non-dragon: moon, UI buttons, far bamboo
    cv2.circle(alpha, P(0.88, 0.155), 108, 0, -1)
    cv2.rectangle(alpha, (1480, 540), (W, 740), 0, -1)
    # Keep the largest blob (the dragon)
    binm = (alpha > 40).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(binm, 8)
    if n > 1:
        idx = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        alpha[labels != idx] = 0
    # Soften, then clip to a generous dragon corridor so lanterns far away die
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    corridor = cv2.dilate(mask, np.ones((21, 21), np.uint8))
    alpha[corridor == 0] = 0

    rgba = np.dstack([rgb, alpha])

    dragon, box = crop_rgba(rgba)
    Image.fromarray(dragon).save(OUT, "WEBP", quality=85, method=6)
    Image.fromarray(dragon).save(SHOTS / "dragon-cutout.png")

    overlay = bgr.copy()
    overlay[alpha < 16] = (overlay[alpha < 16] * 0.18).astype(np.uint8)
    cv2.imwrite(str(SHOTS / "dragon-mask-debug.jpg"), overlay)

    meta = {
        "srcSize": [int(bgr.shape[1]), int(bgr.shape[0])],
        "crop": box,
        "view": [1920, 1080],
        "model": "isnet-general-use",
    }
    import json
    (ROOT / "public" / "art" / "title-dragon-meta.json").write_text(
        json.dumps(meta), encoding="utf-8"
    )
    print("saved", OUT, "shape", dragon.shape, "crop", box, "alpha px", int((alpha > 16).sum()))


if __name__ == "__main__":
    main()
