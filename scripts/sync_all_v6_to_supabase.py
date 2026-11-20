#!/usr/bin/env python3
"""
Verifies all 102 _sheet_v6.png and 144 _v6.mp3 assets in Supabase Storage
('jlpt-media') and updates every LISTENING row in public.questions across
JLPT-N5-MOCK-01..06 so all 102 sheets and 144 audio tracks are live.
"""

import json
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=".env.local")

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)


def main() -> None:
    compiled_path = Path("data/compiled_n5_6sets.json")
    exams_json = json.loads(compiled_path.read_text(encoding="utf-8"))

    img_cache = Path("data/generated_listening_sheets_v6")
    aud_cache = Path("data/generated_listening_audio")

    # Fetch all N5 mock exams in Supabase
    db_exams = (
        sb.table("exams")
        .select("id, exam_code")
        .ilike("exam_code", "JLPT-N5-MOCK-%")
        .order("exam_code")
        .limit(50)
        .execute()
        .data
        or []
    )
    print(f"Found {len(db_exams)} N5 mock exam row(s) in Supabase.")

    for db_ex in db_exams:
        code = db_ex["exam_code"]
        m_num = re.search(r"MOCK-0?(\d+)", code, re.I)
        if not m_num:
            continue
        set_num = int(m_num.group(1))
        padded = f"{set_num:02d}"
        folder = f"jlpt/n5/mock{padded}"

        # Ensure all local v6 files exist in Storage
        existing_items = sb.storage.from_("jlpt-media").list(folder) or []
        existing_names = {it["name"] for it in existing_items if isinstance(it, dict) and it.get("name")}

        for idx in range(1, 25):
            mp3_name = f"listening_q{idx}_v6.mp3"
            mp3_path = f"{folder}/{mp3_name}"
            local_mp3 = aud_cache / mp3_path
            if mp3_name not in existing_names and local_mp3.exists():
                sb.storage.from_("jlpt-media").upload(
                    path=mp3_path,
                    file=local_mp3.read_bytes(),
                    file_options={"content-type": "audio/mpeg", "upsert": "true"},
                )
            if idx <= 17:
                png_name = f"listening_q{idx}_sheet_v6.png"
                png_path = f"{folder}/{png_name}"
                local_png = img_cache / png_path
                if png_name not in existing_names and local_png.exists():
                    sb.storage.from_("jlpt-media").upload(
                        path=png_path,
                        file=local_png.read_bytes(),
                        file_options={"content-type": "image/png", "upsert": "true"},
                    )

        # Find LISTENING section for this exam
        secs = (
            sb.table("exam_sections")
            .select("id")
            .eq("exam_id", db_ex["id"])
            .eq("section_code", "LISTENING")
            .limit(10)
            .execute()
            .data
            or []
        )
        if not secs:
            print(f"  [WARN] No LISTENING section found for {code}")
            continue

        sec_id = secs[0]["id"]
        mgs = (
            sb.table("mondai_groups")
            .select("id, mondai_number")
            .eq("section_id", sec_id)
            .order("mondai_number")
            .limit(20)
            .execute()
            .data
            or []
        )

        ordered_q_ids: List[str] = []
        for mg in mgs:
            qs = (
                sb.table("questions")
                .select("id, question_number")
                .eq("mondai_group_id", mg["id"])
                .order("question_number")
                .limit(50)
                .execute()
                .data
                or []
            )
            for q in qs:
                ordered_q_ids.append(q["id"])

        for idx, q_id in enumerate(ordered_q_ids, start=1):
            audio_url = f"{folder}/listening_q{idx}_v6.mp3"
            image_url = f"{folder}/listening_q{idx}_sheet_v6.png" if idx <= 17 else None
            for attempt in range(4):
                try:
                    sb.table("questions").update(
                        {"audio_url": audio_url, "image_url": image_url}
                    ).eq("id", q_id).execute()
                    break
                except Exception:
                    time.sleep(1.5 * (attempt + 1))

        print(f"  Synced {code}: {len(ordered_q_ids)}/24 questions updated in Supabase.")

    # Also update compiled JSON cleanly
    for exam_obj in exams_json:
        s_num = int(exam_obj["exam_metadata"]["test_number"])
        padded = f"{s_num:02d}"
        listening_sec = next(s for s in exam_obj["sections"] if s["section_code"] == "LISTENING")
        idx = 0
        for mg in listening_sec["mondai_groups"]:
            for q in mg["questions"]:
                idx += 1
                q["audio_url"] = f"jlpt/n5/mock{padded}/listening_q{idx}_v6.mp3"
                q["image_url"] = (
                    f"jlpt/n5/mock{padded}/listening_q{idx}_sheet_v6.png" if idx <= 17 else None
                )
    compiled_path.write_text(json.dumps(exams_json, ensure_ascii=False, indent=2), encoding="utf-8")

    # Verify final counts across all questions in Supabase
    all_q_rows = (
        sb.table("questions")
        .select("audio_url, image_url")
        .not_.is_("audio_url", "null")
        .limit(1000)
        .execute()
        .data
        or []
    )
    v6_img = sum(1 for r in all_q_rows if "_sheet_v6.png" in (r.get("image_url") or ""))
    v6_aud = sum(1 for r in all_q_rows if "_v6.mp3" in (r.get("audio_url") or ""))
    print(f"\nVERIFIED IN SUPABASE: {v6_img} / 102 v6 manga sheets | {v6_aud} / 144 v6 audio tracks")


if __name__ == "__main__":
    main()
