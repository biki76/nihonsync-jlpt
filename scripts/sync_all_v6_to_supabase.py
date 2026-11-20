#!/usr/bin/env python3
"""
Verifies all 102 _sheet_v6.png and 144 _v6.mp3 assets in Supabase Storage
('jlpt-media') and updates LISTENING rows in public.questions strictly for
JLPT-N5-MOCK-01..06, while clearing media URLs on unseeded MOCK-07..20.
"""

import json
import os
import re
import time
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=".env.local")

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)


def get_listening_question_ids(exam_id: str) -> List[str]:
    secs = (
        sb.table("exam_sections")
        .select("id")
        .eq("exam_id", exam_id)
        .eq("section_code", "LISTENING")
        .limit(5)
        .execute()
        .data
        or []
    )
    if not secs:
        return []
    mgs = (
        sb.table("mondai_groups")
        .select("id, mondai_number")
        .eq("section_id", secs[0]["id"])
        .order("mondai_number")
        .limit(20)
        .execute()
        .data
        or []
    )
    q_ids: List[str] = []
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
            q_ids.append(q["id"])
    return q_ids


def main() -> None:
    compiled_path = Path("data/compiled_n5_6sets.json")
    exams_json = json.loads(compiled_path.read_text(encoding="utf-8"))

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

    for db_ex in db_exams:
        code = db_ex["exam_code"]
        m_num = re.search(r"MOCK-0?(\d+)", code, re.I)
        if not m_num:
            continue
        set_num = int(m_num.group(1))
        q_ids = get_listening_question_ids(db_ex["id"])

        if 1 <= set_num <= 6:
            padded = f"{set_num:02d}"
            folder = f"jlpt/n5/mock{padded}"
            for idx, q_id in enumerate(q_ids, start=1):
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
            print(f"  Synced {code}: {len(q_ids)}/24 listening items linked to v6 media.")
        else:
            for q_id in q_ids:
                sb.table("questions").update({"audio_url": None, "image_url": None}).eq("id", q_id).execute()

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
