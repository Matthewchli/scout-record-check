# -*- coding: utf-8 -*-
"""Normalize exposure of member avatar PNGs (opaque pixels only; keep alpha)."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
MEMBERS_DIR = ROOT / "assets" / "members"

# Target mean luminance of opaque pixels (median of previous means ≈ 115.5)
TARGET_MEAN = 115.5
ALPHA_MIN = 128
# Soft floor/ceiling on gain so we don't crush or blow images
GAIN_MIN = 0.72
GAIN_MAX = 1.45
# Mild midtone gamma after gain (1.0 = none); slightly lift shadows for dark uniforms
GAMMA = 0.96


def luminance(rgb: np.ndarray) -> np.ndarray:
    return (
        0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    ).astype(np.float64)


def soft_clip_pixels(pixels: np.ndarray) -> np.ndarray:
    """Scale down (N,3) pixels that exceed 255 while preserving hue."""
    mx = pixels.max(axis=1)
    over = mx > 255
    if over.any():
        scale = np.ones_like(mx)
        scale[over] = 255.0 / mx[over]
        pixels = pixels * scale[:, None]
    return np.clip(pixels, 0, 255)


def normalize_image(path: Path) -> tuple[float, float, float]:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im).astype(np.float64)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    mask = alpha >= ALPHA_MIN
    if not mask.any():
        print(f"skip (no opaque): {path.name}")
        return 0.0, 0.0, 1.0

    before = float(luminance(rgb)[mask].mean())
    gain = TARGET_MEAN / max(before, 1.0)
    gain = float(np.clip(gain, GAIN_MIN, GAIN_MAX))

    out = rgb.copy()
    pixels = soft_clip_pixels(out[mask] * gain)

    # Mild gamma on opaque pixels toward midtones
    if abs(GAMMA - 1.0) > 1e-6:
        norm = np.power(np.clip(pixels / 255.0, 0, 1), GAMMA) * 255.0
        pixels = soft_clip_pixels(norm)

    out[mask] = pixels
    after = float(luminance(out)[mask].mean())
    arr[:, :, :3] = out
    Image.fromarray(arr.astype(np.uint8), "RGBA").save(path, format="PNG", optimize=True)
    return before, after, gain


def main() -> None:
    paths = sorted(MEMBERS_DIR.glob("*.png"))
    if not paths:
        print("no member PNGs found")
        return

    rows = []
    for path in paths:
        before, after, gain = normalize_image(path)
        rows.append((path.name, before, after, gain))
        print(f"{path.name}: {before:.1f} -> {after:.1f} (gain {gain:.3f})")

    means_after = [r[2] for r in rows if r[1] > 0]
    print(
        f"\ndone {len(rows)} files; "
        f"after mean={np.mean(means_after):.1f} "
        f"std={np.std(means_after):.1f} "
        f"target={TARGET_MEAN}"
    )


if __name__ == "__main__":
    main()
