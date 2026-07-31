# -*- coding: utf-8 -*-
"""One-off: process 蔡卓妍 HEIC -> assets/members/{scoutId}.png and update members.json."""

from __future__ import annotations

import json
import sys
import tempfile
from io import BytesIO
from pathlib import Path

from PIL import Image
from rembg import remove

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    register_heif_opener = None  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "members"
MEMBERS_PATH = ROOT / "data" / "members.json"
SRC = Path(r"c:\Users\heiin\Desktop\童軍管理平台\圖示\ICON\蔡卓妍.HEIC")
TARGET_NAME = "蔡卓妍"
SCOUT_ID = "2025045283"

CANVAS_W = 220
CANVAS_H = 400


def fit_to_canvas(cutout: Image.Image) -> Image.Image:
    rgba = cutout.convert("RGBA")
    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)

    tw, th = rgba.size
    scale = min(CANVAS_W / tw, CANVAS_H / th)
    new_w = max(1, int(round(tw * scale)))
    new_h = max(1, int(round(th * scale)))
    resized = rgba.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    left = (CANVAS_W - new_w) // 2
    top = CANVAS_H - new_h  # bottom-aligned
    canvas.paste(resized, (left, top), resized)
    return canvas


def heic_to_png_bytes(src: Path) -> bytes:
    if register_heif_opener is None:
        raise RuntimeError("pillow_heif is required to read HEIC")
    img = Image.open(src)
    img = img.convert("RGB")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"source missing: {SRC}")

    print(f"loading HEIC: {SRC}")
    raw_png = heic_to_png_bytes(SRC)
    print(f"  converted to PNG bytes: {len(raw_png)}")

    print("removing background with rembg...")
    cut = remove(raw_png)
    img = Image.open(BytesIO(cut))
    canvas = fit_to_canvas(img)

    out = OUT_DIR / f"{SCOUT_ID}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, format="PNG", optimize=True)
    print(f"saved {out} ({canvas.size[0]}x{canvas.size[1]})")

    data = json.loads(MEMBERS_PATH.read_text(encoding="utf-8"))
    members = data["members"] if isinstance(data, dict) else data
    updated = False
    for member in members:
        if member.get("name") == TARGET_NAME and member.get("scoutId") == SCOUT_ID:
            member["photo"] = f"assets/members/{SCOUT_ID}.png"
            updated = True
            break
    if not updated:
        raise SystemExit(f"member not found: {TARGET_NAME} / {SCOUT_ID}")

    MEMBERS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"updated members.json photo for {TARGET_NAME}")


if __name__ == "__main__":
    main()
