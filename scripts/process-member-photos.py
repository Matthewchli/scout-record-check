# -*- coding: utf-8 -*-
"""Remove backgrounds from ICON photos and fit to demo avatar canvas (220x400 PNG)."""

from __future__ import annotations

import json
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image
from rembg import remove

# Avoid Windows console UnicodeEncodeError on Chinese names
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ICON_DIR = Path(r"c:\Users\heiin\Desktop\童軍管理平台\ICON")
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "members"
MEMBERS_PATH = ROOT / "data" / "members.json"

CANVAS_W = 220
CANVAS_H = 400

DEMO_FILENAMES = {
    "盧羿衡": "lu-yiheng.png",
    "吳溢潼": "wu-yitong.png",
    "吳承軒": "wu-chengxuan.png",
}


def pick_icon_files(directory: Path) -> dict[str, Path]:
    by_name: dict[str, tuple[Path, int]] = {}
    for path in directory.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        size = path.stat().st_size
        prev = by_name.get(path.stem)
        if prev is None or size > prev[1]:
            by_name[path.stem] = (path, size)
    return {name: item[0] for name, item in by_name.items()}


def out_filename(member: dict) -> str:
    name = member["name"]
    if name in DEMO_FILENAMES:
        return DEMO_FILENAMES[name]
    return f"{member['scoutId']}.png"


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


def process_one(src: Path, out: Path) -> None:
    print(f"processing {src.name} -> {out.name}")
    with src.open("rb") as f:
        raw = f.read()
    cut = remove(raw)
    img = Image.open(BytesIO(cut))
    canvas = fit_to_canvas(img)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, format="PNG", optimize=True)
    print(f"  done {canvas.size[0]}x{canvas.size[1]}")


def main() -> None:
    icons = pick_icon_files(ICON_DIR)
    data = json.loads(MEMBERS_PATH.read_text(encoding="utf-8"))
    members = data["members"] if isinstance(data, dict) else data

    updated = 0
    missing: list[str] = []
    processed: list[str] = []

    for member in members:
        name = member["name"]
        src = icons.pop(name, None)
        if src is None:
            if name not in DEMO_FILENAMES:
                missing.append(name)
            continue

        filename = out_filename(member)
        out = OUT_DIR / filename
        if out.exists():
            print(f"reuse existing {filename}")
        else:
            process_one(src, out)

        member["photo"] = f"assets/members/{filename}"
        updated += 1
        processed.append(f"{name} -> {filename}")

    MEMBERS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"\nupdated {updated}")
    for line in processed:
        print(" ", line)
    if icons:
        print("\nunmatched ICON files:")
        for name in sorted(icons):
            print(" ", name)
    if missing:
        print("\nmembers without ICON:")
        for name in missing:
            print(" ", name)


if __name__ == "__main__":
    main()
