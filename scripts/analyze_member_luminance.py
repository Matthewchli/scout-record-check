#!/usr/bin/env python3
"""Analyze opaque-pixel luminance of assets/members/*.png (read-only)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MEMBERS = ROOT / "assets" / "members"
OUT = ROOT / "scripts" / "member_luminance_report.json"


def luminance(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.float64)
    g = rgb[..., 1].astype(np.float64)
    b = rgb[..., 2].astype(np.float64)
    return 0.299 * r + 0.587 * g + 0.114 * b


def analyze_file(path: Path) -> dict:
    img = Image.open(path).convert("RGBA")
    arr = np.asarray(img)
    alpha = arr[..., 3]
    opaque = alpha >= 128
    n_opaque = int(opaque.sum())
    if n_opaque == 0:
        return {
            "file": path.name,
            "opaque_pixels": 0,
            "mean": None,
            "median": None,
            "p10": None,
            "p90": None,
        }
    lum = luminance(arr[..., :3][opaque])
    return {
        "file": path.name,
        "opaque_pixels": n_opaque,
        "mean": float(np.mean(lum)),
        "median": float(np.median(lum)),
        "p10": float(np.percentile(lum, 10)),
        "p90": float(np.percentile(lum, 90)),
    }


def main() -> int:
    files = sorted(MEMBERS.glob("*.png"))
    if not files:
        print(f"No PNG files in {MEMBERS}", file=sys.stderr)
        return 1

    rows = [analyze_file(p) for p in files]
    means = np.array([r["mean"] for r in rows if r["mean"] is not None], dtype=np.float64)
    medians = np.array([r["median"] for r in rows if r["median"] is not None], dtype=np.float64)

    overall = {
        "n_files": len(rows),
        "mean_of_means": float(np.mean(means)),
        "std_of_means": float(np.std(means, ddof=0)),
        "median_of_means": float(np.median(means)),
        "mean_of_medians": float(np.mean(medians)),
        "median_of_medians": float(np.median(medians)),
        "min_mean": float(np.min(means)),
        "max_mean": float(np.max(means)),
    }

    # Flag outliers: mean luminance > 1.5 std from overall mean-of-means
    mu = overall["mean_of_means"]
    sigma = overall["std_of_means"]
    # Also absolute heuristics for cutout portraits
    dark_abs = 90.0
    bright_abs = 170.0

    for r in rows:
        if r["mean"] is None:
            r["flag"] = "no_opaque"
            continue
        flags = []
        z = (r["mean"] - mu) / sigma if sigma > 0 else 0.0
        r["z_mean"] = float(z)
        if r["mean"] < mu - 1.5 * sigma or r["mean"] < dark_abs:
            flags.append("too_dark")
        if r["mean"] > mu + 1.5 * sigma or r["mean"] > bright_abs:
            flags.append("too_bright")
        r["flag"] = ",".join(flags) if flags else "ok"

    # Sort by mean ascending for readability
    rows_sorted = sorted(rows, key=lambda x: (x["mean"] is None, x["mean"] if x["mean"] is not None else 0))

    report = {
        "overall": overall,
        "suggested_target_mean": overall["median_of_means"],
        "suggested_target_note": "median of per-file mean luminance (robust to outliers)",
        "flag_rules": {
            "relative": "|mean - overall_mean| > 1.5 * std",
            "absolute_dark": f"mean < {dark_abs}",
            "absolute_bright": f"mean > {bright_abs}",
        },
        "rows": rows_sorted,
    }

    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # Human-readable table to stdout
    print(f"{'file':<24} {'mean':>8} {'median':>8} {'p10':>8} {'p90':>8} {'z':>7} flag")
    print("-" * 80)
    for r in rows_sorted:
        if r["mean"] is None:
            print(f"{r['file']:<24} {'n/a':>8} {'n/a':>8} {'n/a':>8} {'n/a':>8} {'n/a':>7} {r['flag']}")
            continue
        print(
            f"{r['file']:<24} {r['mean']:8.2f} {r['median']:8.2f} "
            f"{r['p10']:8.2f} {r['p90']:8.2f} {r['z_mean']:7.2f} {r['flag']}"
        )
    print("-" * 80)
    print(
        f"n={overall['n_files']}  mean_of_means={overall['mean_of_means']:.2f}  "
        f"std={overall['std_of_means']:.2f}  median_of_means={overall['median_of_means']:.2f}"
    )
    print(f"suggested_target_mean={report['suggested_target_mean']:.2f}")
    print(f"Wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
