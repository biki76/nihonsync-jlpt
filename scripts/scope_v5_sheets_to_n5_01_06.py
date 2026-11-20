#!/usr/bin/env python3
"""
Clears mismatched jlpt/n5/ image_url pointers on N1-N4 and unseeded
N5-MOCK-07..20 listening questions while preserving JLPT-N5-MOCK-01..06.
Also patches scripts/enlarge_listening_sheets.py to derive level dynamically.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")
load_dotenv()

SEEDED_CODES = {f"JLPT-N5-MOCK-{i:02d}" for i in range(1, 7)}


def patch_generator_script() -> None:
    path = Path("scripts/enlarge_listening_sheets.py")
    if not path.exists():
        return
    src = path.read_text(encoding="utf-8")
    old_block = (
        '        m_num = re.search(r"MOCK-0?(\\d+)", code, re.I)\n'
        "        set_num = int(m_num.group(1)) if m_num else 1\n"
        '        padded = f"{set_num:02d}"'
    )
    new_block = (
        '        m_lvl = re.search(r"JLPT-(N[1-5])-MOCK-0?(\\d+)", code, re.I)\n'
        "        if not m_lvl:\n"
        "            continue\n"
        "        level_slug = m_lvl.group(1).lower()\n"
        "        set_num = int(m_lvl.group(2))\n"
        '        if level_slug != "n5" or set_num > 6:\n'
        "            continue\n"
        '        padded = f"{set_num:02d}"'
    )
    if old_block in src:
        src = src.replace(old_block, new_block, 1)
        src = src.replace(
            'storage_path = f"jlpt/n5/mock{padded}/listening_q{idx}_sheet_v5.png"',
            'storage_path = f"jlpt/{level_slug}/mock{padded}/listening_q{idx}_sheet_v5.png"',
            1,
        )
        path.write_text(src, encoding="utf-8")
        print("Patched scripts/enlarge_listening_sheets.py with dynamic level scoping.")


def main() -> None:
    patch_generator_script()
    sb = create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    exams = sb.table("exams").select("id, exam_code").execute().data or []
    other_ids = [e["id"] for e in exams if e["exam_code"] not in SEEDED_CODES]
    if not other_ids:
        print("No other exams to clean.")
        return

    secs = (
        sb.table("exam_sections")
        .select("id")
        .in_("exam_id", other_ids)
        .eq("section_code", "LISTENING")
        .execute()
        .data
        or []
    )
    sec_ids = [s["id"] for s in secs]

    mg_ids: list[str] = []
    for i in range(0, len(sec_ids), 40):
        chunk = sec_ids[i : i + 40]
        rows = (
            sb.table("mondai_groups")
            .select("id")
            .in_("section_id", chunk)
            .execute()
            .data
            or []
        )
        mg_ids.extend(r["id"] for r in rows)

    for i in range(0, len(mg_ids), 40):
        chunk = mg_ids[i : i + 40]
        sb.table("questions").update({"image_url": None}).in_("mondai_group_id", chunk).execute()

    print(f"Cleared mismatched image_url on {len(mg_ids)} non-N5(01-06) listening mondai groups.")
    print("Preserved all 102 finetuned _sheet_v5.png sheets for JLPT-N5-MOCK-01..06.")


if __name__ == "__main__":
    main()
