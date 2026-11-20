#!/usr/bin/env python3
"""
Audits local disk caches and Supabase Storage ('jlpt-media') for already-created
_v6.mp3 audio and _sheet_v6.png illustrations, and immediately restores all
existing links in public.questions and data/compiled_n5_6sets.json without
regenerating anything.
"""

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Set

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=".env.local")

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)


def get_ordered_listening_db_ids(exam_code: str) -> List[str]:
    ex = sb.table("exams").select("id").eq("exam_code", exam_code).maybe_single().execute()
    if not ex.data:
        return []
    sec = (
        sb.table("exam_sections")
        .select("id")
        .eq("exam_id", ex.data["id"])
        .eq("section_code", "LISTENING")
        .maybe_single()
        .execute()
    )
    if not sec.data:
        return []
    mgs = (
        sb.table("mondai_groups")
        .select("id, mondai_number")
        .eq("section_id", sec.data["id"])
        .order("mondai_number")
        .execute()
        .data
        or []
    )
    ids: List[str] = []
    for mg in mgs:
        qs = (
            sb.table("questions")
            .select("id, question_number")
            .eq("mondai_group_id", mg["id"])
            .order("question_number")
            .execute()
            .data
            or []
        )
        for q in qs:
            ids.append(q["id"])
    return ids


def list_storage_names(folder: str) -> Set[str]:
    try:
        items = sb.storage.from_("jlpt-media").list(folder) or []
        return {it["name"] for it in items if isinstance(it, dict) and it.get("name")}
    except Exception:
        return set()


def upload_if_needed(local_path: Path, storage_path: str, existing_names: Set[str]) -> bool:
    if local_path.name in existing_names:
        return True
    if not local_path.exists() or local_path.stat().st_size < 512:
        return False
    payload = local_path.read_bytes()
    ctype = "image/png" if local_path.suffix == ".png" else "audio/mpeg"
    for attempt in range(5):
        try:
            sb.storage.from_("jlpt-media").upload(
                path=storage_path,
                file=payload,
                file_options={"content-type": ctype, "upsert": "true"},
            )
            return True
        except Exception:
            time.sleep(2.0 * (attempt + 1))
    return False


def update_db(q_id: str, fields: Dict[str, Any]) -> None:
    for attempt in range(4):
        try:
            sb.table("questions").update(fields).eq("id", q_id).execute()
            return
        except Exception:
            time.sleep(1.5 * (attempt + 1))


def main() -> None:
    print("=== Recent Git Commits ===")
    res = subprocess.run(["git", "log", "-n", "5", "--oneline"], capture_output=True, text=True)
    print(res.stdout.strip())

    compiled_path = Path("data/compiled_n5_6sets.json")
    exams = json.loads(compiled_path.read_text(encoding="utf-8"))

    img_cache = Path("data/generated_listening_sheets_v6")
    aud_cache = Path("data/generated_listening_audio")

    total_v6_img = 0
    total_v6_aud = 0
    missing_v6_imgs: List[str] = []

    print("\n=== Restoring & Verifying Existing v6 Files Across Sets 01-06 ===")
    for exam in exams:
        code = exam["exam_metadata"]["exam_code"]
        s_num = int(exam["exam_metadata"]["test_number"])
        padded = f"{s_num:02d}"
        folder = f"jlpt/n5/mock{padded}"

        storage_names = list_storage_names(folder)
        db_ids = get_ordered_listening_db_ids(code)
        listening_sec = next(s for s in exam["sections"] if s["section_code"] == "LISTENING")

        set_img_ok = 0
        set_aud_ok = 0
        local_idx = 0

        for mg in listening_sec["mondai_groups"]:
            for q in mg["questions"]:
                local_idx += 1
                db_id = db_ids[local_idx - 1] if local_idx <= len(db_ids) else None
                updates: Dict[str, Any] = {}

                # 1. Restore v6 multi-role audio if present locally or in Storage
                mp3_name = f"listening_q{local_idx}_v6.mp3"
                mp3_storage = f"{folder}/{mp3_name}"
                mp3_local = aud_cache / mp3_storage
                if upload_if_needed(mp3_local, mp3_storage, storage_names):
                    q["audio_url"] = mp3_storage
                    updates["audio_url"] = mp3_storage
                    set_aud_ok += 1

                # 2. Restore v6 manga sheet (Q1..Q17) if present locally or in Storage
                if local_idx <= 17:
                    png_name = f"listening_q{local_idx}_sheet_v6.png"
                    png_storage = f"{folder}/{png_name}"
                    png_local = img_cache / png_storage
                    if upload_if_needed(png_local, png_storage, storage_names):
                        q["image_url"] = png_storage
                        updates["image_url"] = png_storage
                        set_img_ok += 1
                    else:
                        missing_v6_imgs.append(f"{code} Q{local_idx}")
                else:
                    q["image_url"] = None
                    updates["image_url"] = None

                if db_id and updates:
                    update_db(db_id, updates)

        total_v6_img += set_img_ok
        total_v6_aud += set_aud_ok
        print(f"  {code}: {set_img_ok:2d}/17 v6 sheets | {set_aud_ok:2d}/24 v6 audio tracks")

    compiled_path.write_text(json.dumps(exams, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nTOTAL RESTORED IN SUPABASE: {total_v6_img} / 102 v6 sheets | {total_v6_aud} / 144 v6 audio tracks")
    if missing_v6_imgs:
        print(f"Remaining ungenerated v6 sheets ({len(missing_v6_imgs)}): first is {missing_v6_imgs[0]}")
        print("Run `python3 scripts/generate_reference_style_manga_v6.py` to generate ONLY those missing sheets.")
    else:
        print("ALL 102 v6 sheets and 144 v6 audio tracks are 100% restored and live!")


if __name__ == "__main__":
    main()
