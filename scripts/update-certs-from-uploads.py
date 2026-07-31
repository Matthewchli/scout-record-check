# -*- coding: utf-8 -*-
"""Copy uploaded certificate images and update specialty badge cert fields."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
MEMBERS = ROOT / "data" / "members.json"
CERT_DIR = ROOT / "assets" / "certificates"
ASSETS = Path(
    r"C:\Users\heiin\.cursor\projects\c-Users-heiin-Desktop-Cursor-Scout-Record-Check\assets"
)

# (source filename fragment, scoutId, badgeName, certNo, copyTitle, isPrimary)
# Fire badges have two images with same cert number.
UPLOADS = [
    # 盧樂欣 2026000246
    (
        "STE.S.FY2627.087-3703828f",
        "2026000246",
        "運動章",
        "STE/S/FY2627/087",
        "專科徽章證書",
        True,
    ),
    (
        "STE.S.FY2627.017-ff7c5776",
        "2026000246",
        "手藝章",
        "STE/S/FY2627/017",
        "專科徽章證書",
        True,
    ),
    (
        "SFTC.NTR.2026.045.14-315b795b",
        "2026000246",
        "消防章",
        "SFTC/NTR/2026/045/14",
        "專科徽章證書",
        True,
    ),
    (
        "2__SFTC.NTR.2026.045.14-eeb7e09f",
        "2026000246",
        "消防章",
        "SFTC/NTR/2026/045/14",
        "訓練證書",
        False,
    ),
    (
        "d72a746e-b5b9-4714-8e22-6241464603dc",  # 單車章 no number
        "2026000246",
        "單車章",
        "",
        "專科徽章證書",
        True,
    ),
    (
        "STE.S.FY2627.115-e487dc16",
        "2026000246",
        "攝影章",
        "STE/S/FY2627/115",
        "專科徽章證書",
        True,
    ),
    # 黃芯瑤 2025021599
    (
        "STE.S.FY2526.023-d5e41780",
        "2025021599",
        "攝影章",
        "STE/S/FY2526/023",
        "專科徽章證書",
        True,
    ),
    (
        "STE.S.FY2627.010-3b032648",
        "2025021599",
        "手藝章",
        "STE/S/FY2627/010",
        "專科徽章證書",
        True,
    ),
    (
        "SFTC.NTR.2026.045.23-a92937f6",
        "2025021599",
        "消防章",
        "SFTC/NTR/2026/045/23",
        "專科徽章證書",
        True,
    ),
    (
        "2__SFTC.NTR.2026.045.23-0227467a",
        "2025021599",
        "消防章",
        "SFTC/NTR/2026/045/23",
        "訓練證書",
        False,
    ),
    (
        "NTER.26-27.MARKSMAN.1.06-dc9d15a1",
        "2025021599",
        "射擊章",
        "NTER/26-27/S/MARKSMAN/1/06",
        "專科徽章證書",
        True,
    ),
]

# Excel certificate numbers (also set even without image)
EXCEL_CERTS = {
    ("2026000246", "單車章"): "",
    ("2026000246", "消防章"): "SFTC/NTR/2026/045/14",
    ("2026000246", "手藝章"): "STE/S/FY2627/017",
    ("2026000246", "攝影章"): "STE/S/FY2627/115",
    ("2026000246", "運動章"): "STE/S/FY2627/087",
    ("2025021599", "攝影章"): "STE/S/FY2526/023",
    ("2025021599", "單車章"): "",
    ("2025021599", "消防章"): "SFTC/NTR/2026/045/23",
    ("2025021599", "射擊章"): "NTER/26-27/S/MARKSMAN/1/06",
    ("2025021599", "手藝章"): "STE/S/FY2627/010",
    # 觀察章 / 語言章 excel blank — leave unset
}


def find_source(fragment: str) -> Path | None:
    matches = list(ASSETS.glob(f"*{fragment}*"))
    if not matches:
        # try looser
        matches = [p for p in ASSETS.glob("*") if fragment.replace("____________", "") in p.name]
    return matches[0] if matches else None


def dest_name(scout_id: str, badge: str, cert: str, title: str) -> str:
    cert_part = cert.replace("/", "-") if cert else "nocert"
    suffix = "training" if "訓練" in title else "badge"
    if not cert and "訓練" not in title:
        suffix = "badge"
    return f"{scout_id}_{badge}_{cert_part}_{suffix}.jpeg"


def find_badge(member: dict, badge_name: str):
    for b in member.get("specialtyBadges") or []:
        if b.get("name") == badge_name:
            return b
    return None


def main() -> None:
    CERT_DIR.mkdir(parents=True, exist_ok=True)
    data = json.loads(MEMBERS.read_text(encoding="utf-8"))
    by_id = {m["scoutId"]: m for m in data["members"]}

    # Map scoutId -> badge -> list of {url, title, primary}
    attached: dict[str, dict[str, list]] = {}
    missing_src = []

    for fragment, scout_id, badge, cert, title, primary in UPLOADS:
        src = find_source(fragment)
        if src is None:
            missing_src.append(fragment)
            print(f"MISSING source: {fragment}")
            continue
        dest = CERT_DIR / dest_name(scout_id, badge, cert, title)
        shutil.copy2(src, dest)
        rel = f"assets/certificates/{dest.name}"
        attached.setdefault(scout_id, {}).setdefault(badge, []).append(
            {"url": rel, "title": title, "primary": primary, "cert": cert}
        )
        print(f"copied {src.name} -> {dest.name}")

    diffs = []
    updated = []

    for scout_id, badges in attached.items():
        member = by_id.get(scout_id)
        if not member:
            diffs.append(f"找不到成員 scoutId={scout_id}")
            continue
        for badge_name, copies in badges.items():
            b = find_badge(member, badge_name)
            if not b:
                diffs.append(
                    f"{member['name']} 系統尚無「{badge_name}」，無法掛證書"
                )
                continue

            # certificate number
            cert_no = next((c["cert"] for c in copies if c["cert"]), "")
            excel_no = EXCEL_CERTS.get((scout_id, badge_name))
            if excel_no is not None and excel_no != "" and cert_no and excel_no != cert_no:
                diffs.append(
                    f"{member['name']} {badge_name}: Excel 編號 {excel_no} ≠ 證書圖 {cert_no}"
                )
            use_no = cert_no or excel_no or ""
            old_no = b.get("certificateNumber") or b.get("certNo") or ""
            if use_no:
                if old_no and old_no != use_no:
                    diffs.append(
                        f"{member['name']} {badge_name}: 原編號 {old_no} → {use_no}"
                    )
                b["certificateNumber"] = use_no
                updated.append(f"{member['name']} {badge_name} 編號={use_no}")

            # copies
            primary = next((c for c in copies if c["primary"]), copies[0])
            others = [c for c in copies if c is not primary]
            old_copy = b.get("certificateCopy") or ""
            b["certificateCopy"] = primary["url"]
            b["certificateCopyTitle"] = primary["title"]
            if others:
                b["certificateCopies"] = [
                    {"url": c["url"], "title": c["title"]} for c in copies
                ]
            else:
                b.pop("certificateCopies", None)
            if old_copy and old_copy != primary["url"]:
                diffs.append(
                    f"{member['name']} {badge_name}: 證書副本已更新"
                )
            updated.append(
                f"{member['name']} {badge_name} 副本×{len(copies)}"
            )

    # Excel-only numbers without images
    for (scout_id, badge_name), cert in EXCEL_CERTS.items():
        if not cert:
            continue
        member = by_id.get(scout_id)
        if not member:
            continue
        b = find_badge(member, badge_name)
        if not b:
            continue
        if not b.get("certificateNumber") and not b.get("certNo"):
            b["certificateNumber"] = cert
            updated.append(f"{member['name']} {badge_name} 僅設編號={cert}")

    # Known structural diffs vs Excel
    diffs.append(
        "【差異】Excel 有「積極公民／社區應急先鋒章」（盧樂欣 CER/N/013/043、黃芯瑤 CER/N/013/052），系統 specialtyBadges 目前沒有此章，未新增。"
    )
    diffs.append(
        "【差異】黃芯瑤「手藝章」：Excel／系統考核日為 2026-07-16，上傳證書日期為 2026-07-05；已掛證書與編號，日期維持系統原值。"
    )
    diffs.append(
        "【差異】黃芯瑤「射擊章」證書日期寫 30/6, 4,5/7/2026，系統為 2026-07-05；已掛證書，日期維持系統原值。"
    )
    diffs.append(
        "【差異】盧樂欣／黃芯瑤「單車章」Excel 證書編號空白；盧樂欣有證書副本（無編號），黃芯瑤未提供單車證書圖。"
    )
    diffs.append(
        "【差異】黃芯瑤「觀察章」「語言章」Excel 證書編號空白，亦未提供證書圖。"
    )

    MEMBERS.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("\n=== UPDATED ===")
    for line in updated:
        print(line)
    print("\n=== DIFFS / NOTES ===")
    for line in diffs:
        print(line)
    if missing_src:
        print("\n=== MISSING SOURCES ===")
        for m in missing_src:
            print(m)


if __name__ == "__main__":
    main()
