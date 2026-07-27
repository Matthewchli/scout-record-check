"""Generate matching circular stat badge icons (white fill, dark silhouettes)."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

OUT = Path("assets/resources/icons/stats")
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 512
TEAL = (32, 71, 70, 255)  # dark teal for silhouettes / accents
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)


def make_badge_base(size=SIZE):
    im = Image.new("RGBA", (size, size), TRANSPARENT)
    d = ImageDraw.Draw(im)
    pad = 2
    d.ellipse([pad, pad, size - 1 - pad, size - 1 - pad], fill=WHITE)
    ring_inset = int(size * 0.045)
    ring_w = max(2, int(size * 0.018))
    for i in range(ring_w):
        inset = ring_inset + i
        d.ellipse([inset, inset, size - 1 - inset, size - 1 - inset], outline=TEAL)
    return im


def apply_circle_mask(im):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).ellipse([1, 1, im.size[0] - 2, im.size[1] - 2], fill=255)
    out = im.copy()
    out.putalpha(mask)
    return out


def _silhouette_overlay(dark_mask):
    overlay = Image.new("RGBA", (SIZE, SIZE), TRANSPARENT)
    oarr = np.array(overlay)
    oarr[dark_mask, 0] = TEAL[0]
    oarr[dark_mask, 1] = TEAL[1]
    oarr[dark_mask, 2] = TEAL[2]
    oarr[dark_mask, 3] = 255
    return Image.fromarray(oarr, "RGBA")


def crop_volunteer_circle():
    src = Image.open(OUT / "volunteer-source.png").convert("RGBA")
    left, top, right = 123, 28, 826
    w = right - left
    bottom = top + w
    crop = src.crop((left, top, right, bottom))
    crop = crop.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    arr = np.array(crop)
    rgb = arr[:, :, :3].astype(np.int16)
    dist_white = (
        np.abs(rgb[:, :, 0] - 255)
        + np.abs(rgb[:, :, 1] - 255)
        + np.abs(rgb[:, :, 2] - 255)
    )
    tr, tg, tb = 32, 71, 70
    dist_teal = (
        np.abs(rgb[:, :, 0] - tr)
        + np.abs(rgb[:, :, 1] - tg)
        + np.abs(rgb[:, :, 2] - tb)
    )
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    cx = cy = (SIZE - 1) / 2.0
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    inner_r = SIZE * 0.44
    lum = rgb[:, :, 0].astype(np.int32) + rgb[:, :, 1] + rgb[:, :, 2]
    sil = (
        ((dist_teal > 48) & (dist_white > 80)) | (lum < 120)
    ) & (arr[:, :, 3] > 128) & (r < inner_r)
    base = make_badge_base()
    return apply_circle_mask(Image.alpha_composite(base, _silhouette_overlay(sil)))


def make_service_from_existing():
    """Fallback: extract hand silhouettes from existing service.png onto white badge."""
    existing = OUT / "service.png"
    if not existing.exists():
        raise SystemExit("missing volunteer-source.png and service.png")
    im = Image.open(existing).convert("RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.int16)
    dist_white = (
        np.abs(rgb[:, :, 0] - 255)
        + np.abs(rgb[:, :, 1] - 255)
        + np.abs(rgb[:, :, 2] - 255)
    )
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    cx = cy = (SIZE - 1) / 2.0
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    inner_r = SIZE * 0.44
    dark = (dist_white > 80) & (arr[:, :, 3] > 128) & (r < inner_r)
    base = make_badge_base()
    return apply_circle_mask(Image.alpha_composite(base, _silhouette_overlay(dark)))


def draw_attendance(base):
    """Clipboard with checkmark — dark teal silhouette on white."""
    d = ImageDraw.Draw(base)
    s = SIZE
    bx0, by0, bx1, by1 = int(s * 0.30), int(s * 0.26), int(s * 0.70), int(s * 0.78)
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=int(s * 0.04), fill=TEAL)
    cx0, cy0, cx1, cy1 = int(s * 0.40), int(s * 0.18), int(s * 0.60), int(s * 0.32)
    d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=int(s * 0.03), fill=WHITE)
    d.rounded_rectangle(
        [cx0 + int(s * 0.02), cy0 + int(s * 0.03), cx1 - int(s * 0.02), cy1 - int(s * 0.02)],
        radius=int(s * 0.02),
        fill=TEAL,
    )
    d.ellipse([int(s * 0.46), int(s * 0.20), int(s * 0.54), int(s * 0.28)], fill=WHITE)
    pts = [
        (int(s * 0.38), int(s * 0.52)),
        (int(s * 0.46), int(s * 0.62)),
        (int(s * 0.64), int(s * 0.40)),
        (int(s * 0.60), int(s * 0.36)),
        (int(s * 0.46), int(s * 0.54)),
        (int(s * 0.42), int(s * 0.48)),
    ]
    d.polygon(pts, fill=WHITE)
    return base


def draw_camping(base):
    """A-frame tent silhouette with small door opening."""
    d = ImageDraw.Draw(base)
    s = SIZE
    peak = (s // 2, int(s * 0.20))
    bl = (int(s * 0.16), int(s * 0.80))
    br = (int(s * 0.84), int(s * 0.80))
    d.polygon([peak, bl, br], fill=TEAL)
    door = [
        (s // 2, int(s * 0.52)),
        (int(s * 0.42), int(s * 0.80)),
        (int(s * 0.58), int(s * 0.80)),
    ]
    d.polygon(door, fill=WHITE)
    d.rectangle(
        [int(s * 0.12), int(s * 0.80), int(s * 0.88), int(s * 0.84)],
        fill=TEAL,
    )
    return base


def draw_outdoor(base):
    """Mountain peaks + sun silhouette."""
    d = ImageDraw.Draw(base)
    s = SIZE
    sun_r = int(s * 0.08)
    sun_c = (int(s * 0.68), int(s * 0.32))
    d.ellipse(
        [sun_c[0] - sun_r, sun_c[1] - sun_r, sun_c[0] + sun_r, sun_c[1] + sun_r],
        fill=TEAL,
    )
    d.polygon(
        [
            (int(s * 0.12), int(s * 0.78)),
            (int(s * 0.36), int(s * 0.42)),
            (int(s * 0.58), int(s * 0.78)),
        ],
        fill=TEAL,
    )
    d.polygon(
        [
            (int(s * 0.32), int(s * 0.78)),
            (int(s * 0.58), int(s * 0.34)),
            (int(s * 0.88), int(s * 0.78)),
        ],
        fill=TEAL,
    )
    d.polygon(
        [
            (int(s * 0.36), int(s * 0.42)),
            (int(s * 0.30), int(s * 0.52)),
            (int(s * 0.42), int(s * 0.52)),
        ],
        fill=WHITE,
    )
    d.polygon(
        [
            (int(s * 0.58), int(s * 0.34)),
            (int(s * 0.52), int(s * 0.46)),
            (int(s * 0.66), int(s * 0.46)),
        ],
        fill=WHITE,
    )
    return base


def main():
    source = OUT / "volunteer-source.png"
    if source.exists():
        volunteer = crop_volunteer_circle()
        volunteer.save(OUT / "service.png")
        print("saved service.png", volunteer.size)
    else:
        service = make_service_from_existing()
        service.save(OUT / "service.png")
        print("saved service.png (from existing, recolored)", service.size)

    for name, drawer in [
        ("attendance.png", draw_attendance),
        ("camping.png", draw_camping),
        ("outdoor.png", draw_outdoor),
    ]:
        badge = make_badge_base()
        drawer(badge)
        badge = apply_circle_mask(badge)
        badge.save(OUT / name)
        print("saved", name)

    print("done")


if __name__ == "__main__":
    main()
