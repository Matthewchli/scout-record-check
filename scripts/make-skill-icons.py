"""Generate circular skill icons matching activity-stat badge style (white fill, dark teal)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import math
import numpy as np
from scipy import ndimage

OUT = Path("assets/resources/icons/skills")
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 512
TEAL = (32, 71, 70, 255)
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)
MACLEHOSE_REF = OUT / "maclehose-ref.jpg"
HIKING_SOURCE = OUT / "hiking-source.png"
ROPEWORK_SOURCE = OUT / "ropework-source.png"
CAMP_COOKING_SOURCE = OUT / "camp-cooking-source.png"
BACKPACK_SOURCE = OUT / "backpack-source.png"


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


def draw_backpack_fallback(base):
    """Simple backpack fallback if source image missing."""
    d = ImageDraw.Draw(base)
    s = SIZE
    d.rounded_rectangle(
        [int(s * 0.30), int(s * 0.32), int(s * 0.70), int(s * 0.80)],
        radius=int(s * 0.06),
        fill=TEAL,
    )
    d.rounded_rectangle(
        [int(s * 0.28), int(s * 0.22), int(s * 0.72), int(s * 0.40)],
        radius=int(s * 0.05),
        fill=TEAL,
    )
    d.rectangle(
        [int(s * 0.46), int(s * 0.34), int(s * 0.54), int(s * 0.48)],
        fill=WHITE,
    )
    d.ellipse(
        [int(s * 0.45), int(s * 0.44), int(s * 0.55), int(s * 0.54)],
        fill=WHITE,
    )
    d.ellipse(
        [int(s * 0.47), int(s * 0.46), int(s * 0.53), int(s * 0.52)],
        fill=TEAL,
    )
    d.rounded_rectangle(
        [int(s * 0.36), int(s * 0.54), int(s * 0.64), int(s * 0.74)],
        radius=int(s * 0.03),
        fill=WHITE,
    )
    d.rounded_rectangle(
        [int(s * 0.38), int(s * 0.56), int(s * 0.62), int(s * 0.72)],
        radius=int(s * 0.025),
        fill=TEAL,
    )
    d.rectangle([int(s * 0.34), int(s * 0.18), int(s * 0.40), int(s * 0.28)], fill=TEAL)
    d.rectangle([int(s * 0.60), int(s * 0.18), int(s * 0.66), int(s * 0.28)], fill=TEAL)
    return base


def draw_backpack(base):
    """User backpack motif → TEAL on white badge (white details as cutouts)."""
    if BACKPACK_SOURCE.exists():
        # +50% from previous fill (1.176 → 1.764)
        mask = extract_dark_silhouette_mask(BACKPACK_SOURCE, fill=1.764, threshold=150)
        _paste_teal_mask(base, mask)
        return base
    return draw_backpack_fallback(base)


INTEREST_CAMP_COOKING = Path("assets/specialty/interest/營地烹飪.png")


def _is_warm_motif_pixel(r, g, b, a):
    """Orange / yellow interest-badge motif (tripod, flame, wood)."""
    if a < 40:
        return False
    # skip near-white fleur-de-lis
    if r > 220 and g > 220 and b > 220:
        return False
    # warm: orange legs or yellow flame/logs on dark green ground
    if r >= 150 and g >= 80 and b <= 130 and r >= g - 40:
        return True
    if r >= 180 and g >= 140 and b <= 100:
        return True
    return False


def extract_warm_silhouette_mask(src_path=INTEREST_CAMP_COOKING, out_size=SIZE):
    """
    Open 營地烹飪興趣章 PNG, extract orange/yellow central motif as L mask,
    cropped and fitted into the badge inner area.
    """
    src = Image.open(src_path).convert("RGBA")
    w, h = src.size
    raw = Image.new("L", (w, h), 0)
    sp, mp = src.load(), raw.load()
    for y in range(h):
        for x in range(w):
            if _is_warm_motif_pixel(*sp[x, y]):
                mp[x, y] = 255
    bbox = raw.getbbox()
    if not bbox:
        return Image.new("L", (out_size, out_size), 0)
    cropped = raw.crop(bbox)
    # Fit into ~70% of badge diameter, centered
    pad = int(out_size * 0.16)
    box = out_size - 2 * pad
    cw, ch = cropped.size
    scale = min(box / cw, box / ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    fitted = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("L", (out_size, out_size), 0)
    ox = (out_size - nw) // 2
    oy = (out_size - nh) // 2
    canvas.paste(fitted, (ox, oy))
    # Binarize after resize
    canvas = canvas.point(lambda v: 255 if v >= 128 else 0)
    return canvas


def _paste_teal_mask(base, mask):
    """Stamp TEAL wherever mask is opaque."""
    teal = Image.new("RGBA", base.size, TEAL)
    base.paste(teal, (0, 0), mask)


def extract_camp_cooking_motif_mask(src_path, out_size=SIZE, fill=0.76):
    """
    Extract fish-on-spit + campfire motif from colored badge art (dark blue bg).
    Keeps orange/yellow sticks/flame and white fish/spit as one silhouette mask.
    """
    src = ImageOps.exif_transpose(Image.open(src_path)).convert("RGBA")
    arr = np.array(src)
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    a = arr[:, :, 3]
    # Dark/medium blue badge fill + light-blue anti-alias (no r<120 cap —
    # that left pale blue fringes in the silhouette). White fish stays motif
    # because r≈g≈b so it fails the blue chroma test.
    is_bg = (a < 40) | ((b > r + 8) & (b > g + 2) & (b > 70))
    motif = ~is_bg
    if not motif.any():
        raise ValueError(f"no camp-cooking motif found in {src_path}")

    # Drop outer near-white padding (square crop around the blue badge)
    labeled, nlab = ndimage.label(motif)
    if nlab:
        edge = np.zeros_like(motif)
        edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
        keep = np.zeros_like(motif)
        for lab in range(1, nlab + 1):
            comp = labeled == lab
            if (comp & edge).any():
                pix = arr[comp]
                near_white = (
                    (pix[:, 0] > 240) & (pix[:, 1] > 240) & (pix[:, 2] > 240)
                ).mean()
                if near_white > 0.5:
                    continue
            keep |= comp
        motif = keep
    if not motif.any():
        raise ValueError(f"no camp-cooking motif found in {src_path}")

    ys, xs = np.where(motif)
    pad = max(4, int(0.04 * max(src.size)))
    y0 = max(0, ys.min() - pad)
    y1 = min(src.size[1], ys.max() + 1 + pad)
    x0 = max(0, xs.min() - pad)
    x1 = min(src.size[0], xs.max() + 1 + pad)
    crop = motif[y0:y1, x0:x1]
    # Close small gaps so spit/fish read as continuous
    crop = ndimage.binary_closing(crop, iterations=1)
    crop_im = Image.fromarray((crop.astype(np.uint8) * 255), mode="L")

    target = int(out_size * fill)
    crop_im.thumbnail((target, target), Image.Resampling.LANCZOS)
    crop_im = crop_im.point(lambda v: 255 if v >= 128 else 0)

    canvas = Image.new("L", (out_size, out_size), 0)
    ox = (out_size - crop_im.width) // 2
    oy = (out_size - crop_im.height) // 2
    canvas.paste(crop_im, (ox, oy))
    return canvas


def draw_camp_cooking_fallback(base):
    """Tripod + campfire fallback if source image missing."""
    d = ImageDraw.Draw(base)
    s = SIZE

    lw = max(11, int(s * 0.050))
    apex = (s // 2, int(s * 0.15))
    left = (int(s * 0.12), int(s * 0.74))
    right = (int(s * 0.88), int(s * 0.74))
    rear = (int(s * 0.34), int(s * 0.86))

    d.line([apex, left], fill=TEAL, width=lw)
    d.line([apex, right], fill=TEAL, width=lw)

    kr = int(s * 0.052)
    d.ellipse([apex[0] - kr, apex[1] - kr, apex[0] + kr, apex[1] + kr], fill=TEAL)

    hang_w = max(5, int(s * 0.022))
    hook_y = int(s * 0.26)
    d.line([(apex[0], apex[1] + kr), (apex[0], hook_y)], fill=TEAL, width=hang_w)
    hr = int(s * 0.022)
    d.ellipse(
        [apex[0] - hr, hook_y - hr // 2, apex[0] + hr, hook_y + int(hr * 1.6)],
        fill=TEAL,
    )

    flame = [
        (int(s * 0.50), int(s * 0.32)),
        (int(s * 0.46), int(s * 0.44)),
        (int(s * 0.40), int(s * 0.36)),
        (int(s * 0.38), int(s * 0.50)),
        (int(s * 0.44), int(s * 0.48)),
        (int(s * 0.47), int(s * 0.60)),
        (int(s * 0.50), int(s * 0.52)),
        (int(s * 0.53), int(s * 0.60)),
        (int(s * 0.56), int(s * 0.48)),
        (int(s * 0.62), int(s * 0.50)),
        (int(s * 0.60), int(s * 0.36)),
        (int(s * 0.54), int(s * 0.44)),
    ]
    d.polygon(flame, fill=TEAL)
    d.polygon(
        [
            (int(s * 0.50), int(s * 0.40)),
            (int(s * 0.46), int(s * 0.54)),
            (int(s * 0.50), int(s * 0.50)),
            (int(s * 0.54), int(s * 0.54)),
        ],
        fill=WHITE,
    )

    log_h = max(4, int(s * 0.014))
    y1, y2 = int(s * 0.65), int(s * 0.71)
    d.rounded_rectangle(
        [int(s * 0.24), y1, int(s * 0.76), y1 + log_h],
        radius=log_h // 2,
        fill=TEAL,
    )
    d.rounded_rectangle(
        [int(s * 0.30), y2, int(s * 0.70), y2 + log_h],
        radius=log_h // 2,
        fill=TEAL,
    )

    d.line([apex, rear], fill=TEAL, width=max(9, int(lw * 0.82)))
    d.ellipse([apex[0] - kr, apex[1] - kr, apex[0] + kr, apex[1] + kr], fill=TEAL)
    return base


def draw_camp_cooking(base):
    """User fish-on-spit campfire → TEAL on white badge; else tripod fallback."""
    if CAMP_COOKING_SOURCE.exists():
        mask = extract_camp_cooking_motif_mask(CAMP_COOKING_SOURCE)
        _paste_teal_mask(base, mask)
        return base
    return draw_camp_cooking_fallback(base)


def _round_cap(d, x, y, r, fill=TEAL):
    d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def draw_ropework_fallback(base):
    """Hand-drawn reef knot fallback if source image missing."""
    d = ImageDraw.Draw(base)
    s = SIZE
    w = max(15, int(s * 0.072))
    half = w // 2

    left = [int(s * 0.10), int(s * 0.24), int(s * 0.55), int(s * 0.76)]
    right = [int(s * 0.45), int(s * 0.24), int(s * 0.90), int(s * 0.76)]
    d.ellipse(left, outline=TEAL, width=w)
    d.ellipse(right, outline=TEAL, width=w)
    d.ellipse([int(s * 0.40), int(s * 0.36), int(s * 0.60), int(s * 0.64)], fill=WHITE)

    x0, x1 = int(s * 0.34), int(s * 0.66)
    y_top, y_bot = int(s * 0.39), int(s * 0.52)
    strand = max(12, int(s * 0.055))
    d.rounded_rectangle([x0, y_top, x1, y_top + strand], radius=strand // 2, fill=TEAL)
    d.rounded_rectangle([x0, y_bot, x1, y_bot + strand], radius=strand // 2, fill=TEAL)
    d.rectangle([x0, y_top, x0 + strand, y_bot + strand], fill=TEAL)
    d.rectangle([x1 - strand, y_top, x1, y_bot + strand], fill=TEAL)
    d.rectangle([x0 + strand, y_top + strand, x1 - strand, y_bot], fill=WHITE)
    d.rectangle(
        [int(s * 0.45), y_top + int(strand * 0.22), int(s * 0.55), y_top + int(strand * 0.78)],
        fill=WHITE,
    )
    d.rectangle(
        [int(s * 0.45), y_bot + int(strand * 0.22), int(s * 0.55), y_bot + int(strand * 0.78)],
        fill=WHITE,
    )

    ey = int(s * 0.50)
    d.line([(int(s * 0.14), ey), (int(s * 0.04), ey)], fill=TEAL, width=w)
    d.line([(int(s * 0.86), ey), (int(s * 0.96), ey)], fill=TEAL, width=w)
    _round_cap(d, int(s * 0.04), ey, half)
    _round_cap(d, int(s * 0.96), ey, half)
    _round_cap(d, int(s * 0.14), ey, half)
    _round_cap(d, int(s * 0.86), ey, half)
    return base


def draw_ropework(base):
    """User knot line art → TEAL on white badge; else hand-drawn fallback."""
    if ROPEWORK_SOURCE.exists():
        # Figure-8 / textured rope art: keep white braid highlights as cutouts
        mask = extract_dark_silhouette_mask(
            ROPEWORK_SOURCE, fill=0.82, threshold=150, dilate=1
        )
        _paste_teal_mask(base, mask)
        return base
    return draw_ropework_fallback(base)


def draw_campcraft(base):
    """A-frame tent (campcraft) — matches camping stat silhouette language."""
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


def draw_map_reading(base):
    """Compass: outer ring, ticks, diamond needle pointing NE, pivot, N mark."""
    d = ImageDraw.Draw(base)
    s = SIZE
    cx = cy = s // 2
    outer = int(s * 0.35)
    ring_w = max(7, int(s * 0.030))
    d.ellipse(
        [cx - outer, cy - outer, cx + outer, cy + outer],
        outline=TEAL,
        width=ring_w,
    )
    tick_outer = outer - int(s * 0.012)
    tick_inner = int(s * 0.255)
    for angle in (0, 90, 180, 270):
        rad = math.radians(angle - 90)
        x0 = cx + int(math.cos(rad) * tick_inner)
        y0 = cy + int(math.sin(rad) * tick_inner)
        x1 = cx + int(math.cos(rad) * tick_outer)
        y1 = cy + int(math.sin(rad) * tick_outer)
        d.line([(x0, y0), (x1, y1)], fill=TEAL, width=max(5, int(s * 0.024)))
    for angle in (45, 135, 225, 315):
        rad = math.radians(angle - 90)
        x0 = cx + int(math.cos(rad) * int(s * 0.285))
        y0 = cy + int(math.sin(rad) * int(s * 0.285))
        x1 = cx + int(math.cos(rad) * tick_outer)
        y1 = cy + int(math.sin(rad) * tick_outer)
        d.line([(x0, y0), (x1, y1)], fill=TEAL, width=max(3, int(s * 0.014)))

    # Needle rotated 45° → points northeast (solid tip = NE, white tip = SW)
    heading = math.radians(45 - 90)  # NE in screen coords
    ux, uy = math.cos(heading), math.sin(heading)
    px, py = -uy, ux  # perpendicular
    tip_len = s * 0.25
    half_w = s * 0.085
    hub = s * 0.035

    def pt(along, across):
        return (
            int(cx + ux * along + px * across),
            int(cy + uy * along + py * across),
        )

    # NE half — solid teal
    d.polygon(
        [pt(tip_len, 0), pt(0, -half_w), pt(-hub, 0), pt(0, half_w)],
        fill=TEAL,
    )
    # SW half — teal fill then white inset
    d.polygon(
        [pt(-tip_len, 0), pt(0, -half_w), pt(hub, 0), pt(0, half_w)],
        fill=TEAL,
    )
    d.polygon(
        [
            pt(-tip_len + s * 0.02, 0),
            pt(-s * 0.015, -half_w * 0.68),
            pt(-s * 0.015, 0),
            pt(-s * 0.015, half_w * 0.68),
        ],
        fill=WHITE,
    )
    pr = int(s * 0.038)
    d.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=WHITE)
    d.ellipse(
        [cx - int(pr * 0.5), cy - int(pr * 0.5), cx + int(pr * 0.5), cy + int(pr * 0.5)],
        fill=TEAL,
    )
    # N triangle stays at true north on the dial
    d.polygon(
        [
            (cx, cy - int(s * 0.405)),
            (cx - int(s * 0.036), cy - int(s * 0.335)),
            (cx + int(s * 0.036), cy - int(s * 0.335)),
        ],
        fill=TEAL,
    )
    return base


def extract_maclehose_silhouette_mask(src_path=MACLEHOSE_REF, out_size=SIZE, threshold=188):
    """
    Extract the white MacLehose Trail hiker silhouette from the rock photo,
    crop to person bbox (+padding), fit into ~70% of badge, return L mask.

    Note: the Wikimedia ref paints the figure in white on darker rock, so we
    keep bright pixels (not dark) and retain the largest connected component.
    """
    src = ImageOps.exif_transpose(Image.open(src_path)).convert("RGB")
    # Focus on the stone face; skip surrounding grass / pole
    w, h = src.size
    src = src.crop((int(w * 0.18), int(h * 0.12), int(w * 0.78), int(h * 0.78)))
    src = src.filter(ImageFilter.GaussianBlur(1.2))
    arr = np.asarray(src, dtype=np.float32)
    gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    binary = gray >= threshold
    binary = ndimage.binary_opening(binary, structure=np.ones((3, 3)), iterations=2)
    binary = ndimage.binary_closing(binary, structure=np.ones((5, 5)), iterations=3)
    binary = ndimage.binary_fill_holes(binary)
    labeled, nlab = ndimage.label(binary)
    if nlab == 0:
        return Image.new("L", (out_size, out_size), 0)
    counts = ndimage.sum(binary, labeled, index=range(1, nlab + 1))
    best = int(np.argmax(counts)) + 1
    person = labeled == best
    # Strip thin grass spikes / paint flecks, then solidify
    person = ndimage.binary_opening(person, structure=np.ones((5, 5)), iterations=2)
    person = ndimage.binary_closing(person, structure=np.ones((7, 7)), iterations=2)
    person = ndimage.binary_fill_holes(person)
    labeled2, n2 = ndimage.label(person)
    if n2 > 1:
        counts2 = ndimage.sum(person, labeled2, index=range(1, n2 + 1))
        person = labeled2 == (int(np.argmax(counts2)) + 1)
        person = ndimage.binary_fill_holes(person)
    ys, xs = np.where(person)
    if len(xs) == 0:
        return Image.new("L", (out_size, out_size), 0)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    pad = int(0.04 * max(x1 - x0, y1 - y0))
    ph, pw = person.shape
    y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
    y1, x1 = min(ph - 1, y1 + pad), min(pw - 1, x1 + pad)
    region = person[y0 : y1 + 1, x0 : x1 + 1]
    # Soft fringe via signed distance, then hard mask after resize
    dist_in = ndimage.distance_transform_edt(region)
    dist_out = ndimage.distance_transform_edt(~region)
    soft = np.clip((dist_in - dist_out + 2) / 4.0, 0, 1)
    soft_img = Image.fromarray((soft * 255).astype(np.uint8), mode="L")
    content_pad = int(out_size * 0.15)
    box = out_size - 2 * content_pad
    cw, ch = soft_img.size
    scale = min(box / cw, box / ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    fitted = soft_img.resize((nw, nh), Image.Resampling.LANCZOS)
    fitted = fitted.filter(ImageFilter.GaussianBlur(0.6))
    canvas = Image.new("L", (out_size, out_size), 0)
    canvas.paste(fitted, ((out_size - nw) // 2, (out_size - nh) // 2))
    mask_arr = np.array(canvas) >= 110
    mask_arr = ndimage.binary_fill_holes(mask_arr)
    mask_arr = ndimage.binary_opening(mask_arr, structure=np.ones((2, 2)), iterations=1)
    mask_arr = ndimage.binary_closing(mask_arr, structure=np.ones((3, 3)), iterations=1)
    mask_arr = ndimage.binary_fill_holes(mask_arr)
    return Image.fromarray((mask_arr.astype(np.uint8)) * 255, mode="L")


def draw_hiking_fallback(base):
    """Hand-drawn MacLehose pose: face left, pack, raised leg on rock, hands on knee."""
    d = ImageDraw.Draw(base)
    s = SIZE
    # rocky mound under raised foot
    d.polygon(
        [
            (int(s * 0.18), int(s * 0.88)),
            (int(s * 0.28), int(s * 0.72)),
            (int(s * 0.42), int(s * 0.68)),
            (int(s * 0.52), int(s * 0.74)),
            (int(s * 0.58), int(s * 0.88)),
            (int(s * 0.22), int(s * 0.90)),
        ],
        fill=TEAL,
    )
    # standing (rear) leg
    d.polygon(
        [
            (int(s * 0.52), int(s * 0.48)),
            (int(s * 0.60), int(s * 0.48)),
            (int(s * 0.66), int(s * 0.82)),
            (int(s * 0.72), int(s * 0.84)),
            (int(s * 0.58), int(s * 0.86)),
            (int(s * 0.54), int(s * 0.70)),
        ],
        fill=TEAL,
    )
    # raised (front) leg onto rock
    d.polygon(
        [
            (int(s * 0.42), int(s * 0.42)),
            (int(s * 0.52), int(s * 0.40)),
            (int(s * 0.40), int(s * 0.58)),
            (int(s * 0.36), int(s * 0.68)),
            (int(s * 0.28), int(s * 0.70)),
            (int(s * 0.26), int(s * 0.64)),
            (int(s * 0.34), int(s * 0.56)),
        ],
        fill=TEAL,
    )
    # torso leaning forward
    d.polygon(
        [
            (int(s * 0.40), int(s * 0.22)),
            (int(s * 0.54), int(s * 0.20)),
            (int(s * 0.58), int(s * 0.48)),
            (int(s * 0.44), int(s * 0.50)),
        ],
        fill=TEAL,
    )
    # backpack
    d.ellipse(
        [int(s * 0.52), int(s * 0.22), int(s * 0.72), int(s * 0.48)],
        fill=TEAL,
    )
    # head
    hr = int(s * 0.055)
    hx, hy = int(s * 0.38), int(s * 0.18)
    d.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=TEAL)
    # arms / hands on raised knee
    lw = max(10, int(s * 0.040))
    d.line(
        [(int(s * 0.44), int(s * 0.30)), (int(s * 0.34), int(s * 0.52))],
        fill=TEAL,
        width=lw,
    )
    d.line(
        [(int(s * 0.48), int(s * 0.32)), (int(s * 0.36), int(s * 0.54))],
        fill=TEAL,
        width=max(8, int(lw * 0.85)),
    )
    er = int(s * 0.028)
    d.ellipse(
        [int(s * 0.32) - er, int(s * 0.52) - er, int(s * 0.32) + er, int(s * 0.52) + er],
        fill=TEAL,
    )
    d.ellipse(
        [int(s * 0.36) - er, int(s * 0.54) - er, int(s * 0.36) + er, int(s * 0.54) + er],
        fill=TEAL,
    )
    return base


def extract_dark_silhouette_mask(
    src_path, out_size=SIZE, fill=0.72, threshold=140, dilate=0
):
    """
    Extract dark silhouette from a B/W source (white bg), fit into badge.
    Light cutouts inside the motif stay unmasked so the white badge shows through.
    Optional dilate thickens thin line-art before fitting.
    """
    src = ImageOps.exif_transpose(Image.open(src_path)).convert("RGBA")
    arr = np.array(src)
    rgb = arr[:, :, :3].astype(np.int16)
    alpha = arr[:, :, 3]
    lum = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]).astype(
        np.float32
    )
    dark = (lum < threshold) & (alpha > 32)
    if not dark.any():
        raise ValueError(f"no dark silhouette found in {src_path}")

    if dilate > 0:
        dark = ndimage.binary_dilation(dark, iterations=int(dilate))

    ys, xs = np.where(dark)
    pad = max(4, int(0.04 * max(src.size)))
    y0 = max(0, ys.min() - pad)
    y1 = min(src.size[1], ys.max() + 1 + pad)
    x0 = max(0, xs.min() - pad)
    x1 = min(src.size[0], xs.max() + 1 + pad)
    crop = dark[y0:y1, x0:x1]
    crop_im = Image.fromarray((crop.astype(np.uint8) * 255), mode="L")

    target = int(out_size * fill)
    crop_im.thumbnail((target, target), Image.Resampling.LANCZOS)
    # harden after resize
    crop_im = crop_im.point(lambda v: 255 if v >= 128 else 0)

    canvas = Image.new("L", (out_size, out_size), 0)
    ox = (out_size - crop_im.width) // 2
    oy = (out_size - crop_im.height) // 2
    canvas.paste(crop_im, (ox, oy))
    return canvas


def draw_hiking(base):
    """User hiking motif → TEAL on white badge; else MacLehose ref; else hand-drawn."""
    if HIKING_SOURCE.exists():
        # 20% larger than default fill (0.72 → 0.864)
        mask = extract_dark_silhouette_mask(HIKING_SOURCE, fill=0.864)
        _paste_teal_mask(base, mask)
        return base
    if MACLEHOSE_REF.exists():
        mask = extract_maclehose_silhouette_mask(MACLEHOSE_REF)
        _paste_teal_mask(base, mask)
        return base
    return draw_hiking_fallback(base)


def draw_incident(base):
    """First-aid kit with medical cross."""
    d = ImageDraw.Draw(base)
    s = SIZE
    d.rounded_rectangle(
        [int(s * 0.26), int(s * 0.30), int(s * 0.74), int(s * 0.78)],
        radius=int(s * 0.05),
        fill=TEAL,
    )
    # handle / latch
    d.rounded_rectangle(
        [int(s * 0.42), int(s * 0.24), int(s * 0.58), int(s * 0.34)],
        radius=int(s * 0.02),
        fill=TEAL,
    )
    # cross
    d.rectangle(
        [int(s * 0.45), int(s * 0.40), int(s * 0.55), int(s * 0.68)],
        fill=WHITE,
    )
    d.rectangle(
        [int(s * 0.36), int(s * 0.48), int(s * 0.64), int(s * 0.58)],
        fill=WHITE,
    )
    # latch dot
    d.ellipse(
        [int(s * 0.47), int(s * 0.26), int(s * 0.53), int(s * 0.32)],
        fill=WHITE,
    )
    return base


def draw_weather(base):
    """Single leaf silhouette — 天氣認識及保護環境."""
    d = ImageDraw.Draw(base)
    s = SIZE
    # pointed tip up, rounded base with stem
    leaf = [
        (int(s * 0.50), int(s * 0.16)),  # tip
        (int(s * 0.68), int(s * 0.32)),
        (int(s * 0.76), int(s * 0.50)),
        (int(s * 0.72), int(s * 0.66)),
        (int(s * 0.58), int(s * 0.76)),
        (int(s * 0.50), int(s * 0.78)),  # base center
        (int(s * 0.42), int(s * 0.76)),
        (int(s * 0.28), int(s * 0.66)),
        (int(s * 0.24), int(s * 0.50)),
        (int(s * 0.32), int(s * 0.32)),
    ]
    d.polygon(leaf, fill=TEAL)
    # stem
    d.line(
        [(int(s * 0.50), int(s * 0.78)), (int(s * 0.50), int(s * 0.88))],
        fill=TEAL,
        width=max(5, int(s * 0.028)),
    )
    # midrib
    d.line(
        [(int(s * 0.50), int(s * 0.22)), (int(s * 0.50), int(s * 0.76))],
        fill=WHITE,
        width=max(3, int(s * 0.016)),
    )
    # side veins
    vw = max(2, int(s * 0.012))
    for y, dx in [(0.34, 0.12), (0.46, 0.16), (0.58, 0.14), (0.68, 0.10)]:
        cy = int(s * y)
        d.line([(int(s * 0.50), cy), (int(s * (0.50 - dx)), int(s * (y + 0.06)))], fill=WHITE, width=vw)
        d.line([(int(s * 0.50), cy), (int(s * (0.50 + dx)), int(s * (y + 0.06)))], fill=WHITE, width=vw)
    return base


def save(name, drawer):
    badge = make_badge_base()
    drawer(badge)
    badge = apply_circle_mask(badge)
    path = OUT / name
    badge.save(path)
    print("saved", path)


def main():
    for name, drawer in [
        ("backpack.png", draw_backpack),
        ("camp-cooking.png", draw_camp_cooking),
        ("ropework.png", draw_ropework),
        ("campcraft.png", draw_campcraft),
        ("map-reading.png", draw_map_reading),
        ("hiking.png", draw_hiking),
        ("incident.png", draw_incident),
        ("weather-environment.png", draw_weather),
    ]:
        save(name, drawer)
    print("done")


if __name__ == "__main__":
    main()
