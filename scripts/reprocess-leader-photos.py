# -*- coding: utf-8 -*-
"""One-off: reprocess three leader photos with better matting + height-fill canvas."""

from __future__ import annotations

import importlib.util
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove
from scipy import ndimage

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
OUT_DIR = ROOT / "assets" / "members"
ICON_DIR = Path(r"c:\Users\heiin\Desktop\童軍管理平台\圖示\ICON")

CANVAS_W = 220
CANVAS_H = 400

# Models chosen after comparing u2net_human_seg / isnet-general-use / birefnet-*
JOBS = [
    # (src, out, rembg model)
    ("程淑霞.JPG", "cheng-shuxia.png", "birefnet-portrait"),
    ("許健孝.JPG", "xu-jianxiao.png", "birefnet-portrait"),
    ("梁喆.JPG", "liang-zhe.png", "birefnet-general"),
]


def load_normalize():
    path = SCRIPTS / "normalize-member-exposure.py"
    spec = importlib.util.spec_from_file_location("normalize_member_exposure", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["normalize_member_exposure"] = mod
    spec.loader.exec_module(mod)
    return mod


def load_source(src: Path, max_side: int = 1800) -> Image.Image:
    """Load JPG with EXIF orientation; downscale for rembg (final is 220×400)."""
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    w, h = im.size
    m = max(w, h)
    if m > max_side:
        scale = max_side / m
        im = im.resize(
            (max(1, int(round(w * scale))), max(1, int(round(h * scale)))),
            Image.Resampling.LANCZOS,
        )
    return im


def rembg_cutout(rgb: Image.Image, session) -> Image.Image:
    buf = BytesIO()
    rgb.save(buf, format="PNG")
    cut = remove(buf.getvalue(), session=session)
    return Image.open(BytesIO(cut)).convert("RGBA")


def is_screen_edge(r: np.ndarray, g: np.ndarray, b: np.ndarray, lum: np.ndarray) -> np.ndarray:
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    sat = np.zeros_like(lum, dtype=np.float64)
    np.divide(maxc - minc, maxc, out=sat, where=maxc > 1)
    white_glyph = (lum > 195) & (sat < 0.25)
    blueish = (b > r + 20) & (b > g + 10) & (sat > 0.28) & (lum > 45) & (lum < 200)
    return white_glyph | blueish


def clean_alpha(rgba: Image.Image) -> Image.Image:
    """Light post-process: threshold, morph, edge screen cleanup, keep max component."""
    arr = np.array(rgba).astype(np.float64)
    alpha = arr[:, :, 3].copy()
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    alpha[alpha < 40] = 0

    opaque = alpha >= 40
    struct = ndimage.generate_binary_structure(2, 1)
    # opening only — closing would refill arm-gap holes we want transparent
    opaque = ndimage.binary_opening(opaque, structure=struct, iterations=1)
    alpha = np.where(opaque, alpha, 0.0)

    # Outer-edge screen glyph / blue glow only (do not eat interior person)
    opaque = alpha >= 40
    edge = opaque & (~ndimage.binary_erosion(opaque, structure=struct, iterations=3))
    screen = is_screen_edge(r, g, b, lum)
    protect = (r > 80) & (g > 55) & (b > 40) & ((r - b) < 110) & ((r + g + b) > 200)
    alpha[edge & screen & (~protect)] = 0

    opaque = alpha >= 40
    labeled, nlab = ndimage.label(opaque)
    if nlab > 1:
        counts = np.bincount(labeled.ravel())
        counts[0] = 0
        keep = int(counts.argmax())
        alpha[labeled != keep] = 0

    alpha_img = Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8), mode="L")
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=0.45))
    alpha = np.array(alpha_img).astype(np.float64)
    alpha[alpha < 18] = 0

    out = arr.copy()
    out[:, :, 3] = alpha
    out[alpha < 1, 0:3] = 0
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def fit_to_canvas_height(cutout: Image.Image) -> Image.Image:
    """Height-fill fit: scale by H, center horizontally, crop sides if needed."""
    rgba = cutout.convert("RGBA")
    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)

    tw, th = rgba.size
    if th <= 0 or tw <= 0:
        return Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

    scale = CANVAS_H / th
    new_w = max(1, int(round(tw * scale)))
    new_h = max(1, int(round(th * scale)))
    resized = rgba.resize((new_w, new_h), Image.Resampling.LANCZOS)

    if new_w > CANVAS_W:
        left = (new_w - CANVAS_W) // 2
        resized = resized.crop((left, 0, left + CANVAS_W, new_h))
        new_w = CANVAS_W

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    left = (CANVAS_W - new_w) // 2
    top = 0
    canvas.paste(resized, (left, top), resized)
    return canvas


def process_one(src: Path, out: Path, session, model_name: str) -> dict:
    print(f"\n=== {src.name} -> {out.name} (model={model_name}) ===")
    rgb = load_source(src)
    print(f"  source size={rgb.size}")
    cut = rembg_cutout(rgb, session)
    cleaned = clean_alpha(cut)
    canvas = fit_to_canvas_height(cleaned)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, format="PNG", optimize=True)
    bb = canvas.getbbox()
    fill_h = (bb[3] - bb[1]) if bb else 0
    print(f"  canvas={canvas.size} bbox={bb} fill_h={fill_h}")
    return {"model": model_name, "fill_h": fill_h, "bbox": bb}


def main() -> None:
    normalize_mod = load_normalize()
    sessions: dict[str, object] = {}
    results = {}

    for src_name, out_name, model_name in JOBS:
        if model_name not in sessions:
            print(f"loading session {model_name} ...")
            sessions[model_name] = new_session(model_name)

        src = ICON_DIR / src_name
        if not src.exists():
            print(f"MISSING {src}")
            continue
        out = OUT_DIR / out_name
        meta = process_one(src, out, sessions[model_name], model_name)
        before, after, gain = normalize_mod.normalize_image(out)
        meta["exposure"] = (before, after, gain)
        print(f"  exposure {before:.1f} -> {after:.1f} (gain {gain:.3f})")
        results[out_name] = meta

    print("\n===== SUMMARY =====")
    for name, meta in results.items():
        b, a, g = meta["exposure"]
        print(
            f"{name}: model={meta['model']} fill_h={meta['fill_h']} "
            f"exposure {b:.1f}->{a:.1f} gain={g:.3f}"
        )


if __name__ == "__main__":
    main()
