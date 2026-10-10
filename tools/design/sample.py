#!/usr/bin/env python3
"""Measure Raycast screenshots into tools/design/raycast.json.

This reads local reference screenshots under tools/reports/*-ray.png and samples:
- role colours (surfaces by most common colour in a region, text/icon roles by brightest pixel);
- a few component sizes from contiguous same-colour regions near fixed seed points.

Note: translucent surfaces (especially `raised`) depend on wallpaper and compositor blending.
The sampled value is a reading from the captured screenshots and is validated like any candidate
palette in Task 4.
"""

from __future__ import annotations

import json
from collections import Counter, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
REPORTS = ROOT / "tools" / "reports"
OUT = ROOT / "tools" / "design" / "raycast.json"


Mode = Literal["most_common", "brightest", "vivid"]


@dataclass(frozen=True)
class SampleSpec:
    role: str
    screen: str
    box: tuple[int, int, int, int]
    mode: Mode


@dataclass(frozen=True)
class SizeSpec:
    name: str
    screen: str
    seed: tuple[int, int]
    scope: tuple[int, int, int, int]


ROLE_SPECS: tuple[SampleSpec, ...] = (
    SampleSpec("window", "1-list-ray.png", (1500, 500, 1600, 560), "most_common"),
    SampleSpec("header", "1-list-ray.png", (900, 30, 1000, 60), "most_common"),
    SampleSpec("selection", "1-list-ray.png", (1250, 205, 1350, 255), "most_common"),
    SampleSpec("raised", "1-list-ray.png", (520, 1165, 535, 1215), "most_common"),
    SampleSpec("divider", "7-bookmark-split-ray.png", (760, 400, 770, 600), "brightest"),
    SampleSpec("text", "1-list-ray.png", (150, 210, 235, 250), "brightest"),
    SampleSpec("textMuted", "1-list-ray.png", (265, 210, 780, 250), "brightest"),
    SampleSpec("textFaint", "1-list-ray.png", (150, 75, 700, 120), "brightest"),
    # Accents from known type/tag regions.
    SampleSpec("green", "1-list-ray.png", (68, 205, 115, 255), "vivid"),
    SampleSpec("purple", "7-bookmark-split-ray.png", (1740, 875, 1900, 905), "vivid"),
    SampleSpec("blue", "2-list-split-ray.png", (1790, 810, 1910, 850), "vivid"),
    SampleSpec("red", "5-actions-ray.png", (1450, 680, 1660, 760), "vivid"),
    SampleSpec("magenta", "5-actions-ray.png", (1460, 760, 1720, 840), "vivid"),
    SampleSpec("orange", "6-filter-ray.png", (1240, 690, 1500, 760), "vivid"),
    SampleSpec("yellow", "6-filter-ray.png", (1240, 760, 1500, 835), "vivid"),
)

SIZE_SPECS: tuple[SizeSpec, ...] = (
    SizeSpec("window", "1-list-ray.png", (1040, 560), (0, 0, 2000, 1250)),
    SizeSpec("selected_row", "1-list-ray.png", (1290, 228), (1000, 165, 1990, 300)),
    SizeSpec("tag_pill", "1-list-ray.png", (647, 249), (560, 220, 760, 285)),
    SizeSpec("footer_pill", "1-list-ray.png", (527, 1189), (460, 1150, 620, 1235)),
    SizeSpec("keycap", "5-actions-ray.png", (1668, 1198), (1640, 1170, 1735, 1235)),
)


def to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"


def luminance(rgb: tuple[int, int, int]) -> float:
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def saturation(rgb: tuple[int, int, int]) -> float:
    cmax = max(rgb)
    cmin = min(rgb)
    if cmax == 0:
        return 0.0
    return (cmax - cmin) / cmax


def open_rgb(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB")


def scale_rect(img: Image.Image, rect: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    kx = img.width / 2000.0
    ky = img.height / 1250.0
    x1, y1, x2, y2 = rect
    return (
        max(0, min(img.width - 1, round(x1 * kx))),
        max(0, min(img.height - 1, round(y1 * ky))),
        max(1, min(img.width, round(x2 * kx))),
        max(1, min(img.height, round(y2 * ky))),
    )


def scale_point(img: Image.Image, pt: tuple[int, int]) -> tuple[int, int]:
    kx = img.width / 2000.0
    ky = img.height / 1250.0
    x, y = pt
    return (
        max(0, min(img.width - 1, round(x * kx))),
        max(0, min(img.height - 1, round(y * ky))),
    )


def sample_role(img: Image.Image, rect: tuple[int, int, int, int], mode: Mode) -> tuple[int, int, int]:
    x1, y1, x2, y2 = rect
    crop = img.crop((x1, y1, x2, y2))
    pixels = list(crop.getdata())
    if not pixels:
        raise ValueError(f"empty crop: {(x1, y1, x2, y2)}")
    if mode == "most_common":
        return Counter(pixels).most_common(1)[0][0]
    if mode == "vivid":
        return max(pixels, key=lambda p: saturation(p) * (luminance(p) + 1))
    return max(pixels, key=luminance)


def close_enough(a: tuple[int, int, int], b: tuple[int, int, int], tol: int) -> bool:
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol and abs(a[2] - b[2]) <= tol


def contiguous_bbox(img: Image.Image, seed: tuple[int, int], scope: tuple[int, int, int, int], tol: int = 6) -> tuple[int, int, int, int]:
    px = img.load()
    sx, sy = seed
    sx1, sy1, sx2, sy2 = scope
    target = px[sx, sy]

    q: deque[tuple[int, int]] = deque([(sx, sy)])
    seen: set[tuple[int, int]] = {(sx, sy)}
    min_x = max_x = sx
    min_y = max_y = sy

    while q:
        x, y = q.popleft()
        min_x = min(min_x, x)
        max_x = max(max_x, x)
        min_y = min(min_y, y)
        max_y = max(max_y, y)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < sx1 or ny < sy1 or nx >= sx2 or ny >= sy2:
                continue
            if (nx, ny) in seen:
                continue
            if close_enough(px[nx, ny], target, tol):
                seen.add((nx, ny))
                q.append((nx, ny))

    return (min_x, min_y, max_x + 1, max_y + 1)


def points_bbox(box: tuple[int, int, int, int]) -> dict[str, float]:
    x1, y1, x2, y2 = box
    w = (x2 - x1) / 2.0
    h = (y2 - y1) / 2.0
    return {"w": round(w, 2), "h": round(h, 2), "radius_estimate": round(min(w, h) / 2.0, 2)}


def require_reports() -> None:
    missing = sorted({s.screen for s in ROLE_SPECS + SIZE_SPECS if not (REPORTS / s.screen).exists()})
    if missing:
        missing_list = "\n".join(f"- tools/reports/{name}" for name in missing)
        raise FileNotFoundError(
            "Missing Raycast reference screenshots:\n"
            f"{missing_list}\n"
            "Capture/copy them into tools/reports before running this script."
        )


def main() -> None:
    require_reports()
    images: dict[str, Image.Image] = {}

    def img(screen: str) -> Image.Image:
        if screen not in images:
            images[screen] = open_rgb(REPORTS / screen)
        return images[screen]

    roles: dict[str, dict[str, object]] = {}
    for spec in ROLE_SPECS:
        picture = img(spec.screen)
        rect = scale_rect(picture, spec.box)
        color = sample_role(picture, rect, spec.mode)
        roles[spec.role] = {"hex": to_hex(color), "screen": spec.screen, "box": list(spec.box)}

    sizes: dict[str, dict[str, float]] = {}
    for spec in SIZE_SPECS:
        picture = img(spec.screen)
        seed = scale_point(picture, spec.seed)
        scope = scale_rect(picture, spec.scope)
        box = contiguous_bbox(picture, seed, scope)
        sizes[spec.name] = points_bbox(box)

    payload = {"roles": roles, "sizes": sizes}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
