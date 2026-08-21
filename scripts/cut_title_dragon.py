"""Cut the title dragon out of the key art (tight alpha, crop origin metadata)."""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "art-src" / "title-hero.png"
OUT = ROOT / "public" / "art"
SHOTS = ROOT / ".shots"

W, H = 1672, 941


def P(xf: float, yf: float) -> tuple[int, int]:
    return int(round(xf * W)), int(round(yf * H))


# Tail -> neck, fractions from the 20-line grid on the key art.
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
        P(0.555, 0.330),
        P(0.568, 0.225),
        P(0.615, 0.175),
        P(0.675, 0.195),
        P(0.735, 0.235),
        P(0.795, 0.295),
        P(0.838, 0.332),
        P(0.848, 0.348),
        P(0.830, 0.400),
        P(0.760, 0.445),
        P(0.700, 0.485),
        P(0.640, 0.465),
        P(0.600, 0.430),
    ],
    dtype=np.int32,
)

HOLES = [
    (*P(0.88, 0.155), 100),  # moon
    (*P(0.12, 0.70), 34),
    (*P(0.18, 0.62), 36),
    (*P(0.32, 0.58), 28),
    (*P(0.66, 0.60), 22),
    (*P(0.76, 0.62), 40),
    (*P(0.86, 0.62), 48),  # buttons
]


def corridor(shape: tuple[int, ...]) -> np.ndarray:
    h, w = shape[:2]
    mask = np.zeros((h, w), np.uint8)
    top, bot = [], []
    n = len(SPINE)
    for i, (x, y) in enumerate(SPINE):
        t = i / (n - 1)
        back = 28 + 40 * np.sin(np.pi * min(1.0, t * 1.08))
        belly = 18 + 26 * np.sin(np.pi * min(1.0, t * 1.02))
        if t < 0.08:
            back, belly = 16, 14
        if t > 0.88:
            back, belly = 58, 40
        if i == 0:
            d = SPINE[1] - SPINE[0]
        elif i == n - 1:
            d = SPINE[-1] - SPINE[-2]
        else:
            d = SPINE[i + 1] - SPINE[i - 1]
        ang = np.arctan2(d[1], d[0])
        nx, ny = np.cos(ang - np.pi / 2), np.sin(ang - np.pi / 2)
        # normal -PI/2 is "up" when moving right; that's the back (fins)
        top.append((x + nx * back, y + ny * back))
        bot.append((x - nx * belly, y - ny * belly))
    poly = np.array(top + bot[::-1], np.int32)
    cv2.fillPoly(mask, [poly], 255)
    cv2.fillPoly(mask, [HEAD_POLY], 255)
    return mask


def grab(bgr: np.ndarray, corridor_m: np.ndarray) -> np.ndarray:
    h, w = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    teal = (hsv[:, :, 0] >= 28) & (hsv[:, :, 0] <= 100) & (hsv[:, :, 1] >= 28) & (hsv[:, :, 2] >= 40)
    gold = (hsv[:, :, 0] <= 30) & (hsv[:, :, 1] >= 45) & (hsv[:, :, 2] >= 55)
    color = np.zeros((h, w), np.uint8)
    color[teal | gold] = 255
    color = cv2.bitwise_and(color, corridor_m)

    gc = np.full((h, w), cv2.GC_BGD, np.uint8)
    gc[cv2.dilate(corridor_m, np.ones((11, 11), np.uint8)) > 0] = cv2.GC_PR_BGD
    gc[corridor_m > 0] = cv2.GC_PR_FGD
    gc[color > 0] = cv2.GC_FGD
    for x, y in SPINE.astype(int):
        cv2.circle(gc, (int(x), int(y)), 11, int(cv2.GC_FGD), -1)
    cv2.fillPoly(gc, [HEAD_POLY], int(cv2.GC_PR_FGD))
    cv2.circle(gc, P(0.70, 0.33), 36, int(cv2.GC_FGD), -1)
    cv2.circle(gc, P(0.76, 0.34), 28, int(cv2.GC_FGD), -1)
    # hard background
    gc[0:170, 80:880] = cv2.GC_BGD
    gc[0:50, :] = cv2.GC_BGD
    gc[:, 0:4] = cv2.GC_BGD
    gc[860:, :] = cv2.GC_BGD
    for x, y, r in HOLES:
        cv2.circle(gc, (x, y), r, int(cv2.GC_BGD), -1)
    # buttons
    gc[560:720, 1488:w] = cv2.GC_BGD

    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, gc, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    mask = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    mask = cv2.bitwise_and(mask, cv2.dilate(corridor_m, np.ones((9, 9), np.uint8)))
    for x, y, r in HOLES:
        cv2.circle(mask, (x, y), r - 4, 0, -1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8), iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if n > 1:
        idx = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        mask = np.where(labels == idx, 255, 0).astype(np.uint8)
    return clean_leaks(bgr, mask)


def clean_leaks(bgr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    dragonish = (
        ((h >= 22) & (h <= 105) & (s >= 22) & (v >= 36))
        | ((h <= 34) & (s >= 38) & (v >= 48))
        | ((s <= 85) & (v >= 88) & (h <= 48))
    )
    band = np.zeros_like(mask)
    n = len(SPINE)
    for i in range(n - 1):
        t = i / (n - 1)
        thick = int(20 + 40 * np.sin(np.pi * min(1.0, t * 1.05)))
        p0 = tuple(SPINE[i].astype(int))
        p1 = tuple(SPINE[i + 1].astype(int))
        cv2.line(band, p0, p1, 255, max(thick, 12), cv2.LINE_AA)
    cv2.fillPoly(band, [HEAD_POLY], 255)
    band = cv2.dilate(band, np.ones((11, 11), np.uint8))
    drop = (mask > 0) & (band == 0) & (~dragonish)
    mask = mask.copy()
    mask[drop] = 0
    core = np.zeros_like(mask)
    core[(mask > 0) & dragonish] = 255
    # keep a little extra around colored dragon pixels (fins, whiskers)
    core_d = cv2.distanceTransform(cv2.bitwise_not(core), cv2.DIST_L2, 3)
    mask[core_d > 12] = 0
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if n > 1:
        idx = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        mask = np.where(labels == idx, 255, 0).astype(np.uint8)
    return mask


def to_alpha(mask: np.ndarray) -> np.ndarray:
    dist = cv2.distanceTransform(mask, cv2.DIST_L2, 3)
    alpha = np.clip(dist / 1.8, 0, 1)
    inner = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=1)
    alpha[inner > 0] = 1
    return (alpha * 255).astype(np.uint8)


def crop(rgba: np.ndarray, pad: int = 12) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    ys, xs = np.where(rgba[:, :, 3] > 10)
    x0, x1 = max(0, int(xs.min()) - pad), min(rgba.shape[1], int(xs.max()) + pad + 1)
    y0, y1 = max(0, int(ys.min()) - pad), min(rgba.shape[0], int(ys.max()) + pad + 1)
    return rgba[y0:y1, x0:x1], (x0, y0, x1, y1)


def save_bgra(path: Path, bgra: np.ndarray) -> None:
    Image.fromarray(cv2.cvtColor(bgra, cv2.COLOR_BGRA2RGBA)).save(path)


def main() -> None:
    SHOTS.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    bgr = cv2.imread(str(SRC), cv2.IMREAD_COLOR)
    assert bgr is not None
    corr = corridor(bgr.shape)
    mask = grab(bgr, corr)
    rgba = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = to_alpha(mask)
    dragon, box = crop(rgba)
    save_bgra(OUT / "title-dragon.png", dragon)
    save_bgra(SHOTS / "dragon-cutout.png", dragon)

    meta = {
        "srcSize": [int(bgr.shape[1]), int(bgr.shape[0])],
        "crop": [int(v) for v in box],
        "spine": SPINE.tolist(),
        "view": [1920, 1080],
    }
    (OUT / "title-dragon-meta.json").write_text(json.dumps(meta), encoding="utf-8")

    overlay = bgr.copy()
    overlay[mask == 0] = (overlay[mask == 0] * 0.22).astype(np.uint8)
    cv2.polylines(overlay, [HEAD_POLY], True, (0, 200, 255), 2)
    for x, y in SPINE.astype(int):
        cv2.circle(overlay, (int(x), int(y)), 4, (0, 255, 255), -1)
    cv2.imwrite(str(SHOTS / "dragon-mask-debug.jpg"), overlay)
    print("dragon", dragon.shape, "crop", box, "mask px", int(mask.sum() // 255))


if __name__ == "__main__":
    main()
