#!/usr/bin/env python3
"""
NihonSync JLPT Mock Test Platform — Idempotent Exam Seeder
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from supabase import Client, create_client

VALID_LEVELS = {"N5", "N4", "N3", "N2", "N1"}
SUPPORTED_LANGS = ("en", "vi", "zh", "ko", "bn", "hi")


def get_supabase_client() -> Client:
    load_dotenv(".env.local")
    load_dotenv(".env")

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not service_key:
        print(
            "ERROR: Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
            file=sys.stderr,
        )
        sys.exit(1)

    return create_client(url, service_key)


def validate_question(q: Dict[str, Any], section_code: str, mondai_num: int) -> None:
    q_num = q.get("question_number")
    if not isinstance(q_num, int) or q_num < 1:
        raise ValueError(f"[{section_code} M{mondai_num}] Invalid question_number: {q_num}")

    if not q.get("prompt_html") or not isinstance(q["prompt_html"], str):
        raise ValueError(f"[Q{q_num}] Missing or invalid prompt_html")

    options = q.get("options")
    if not isinstance(options, list) or len(options) not in (3, 4):
        raise ValueError(f"[Q{q_num}] options must be a list of 3 or 4 items")

    for idx, opt in enumerate(options, start=1):
        if not isinstance(opt, dict) or opt.get("index") != idx or not opt.get("text"):
            raise ValueError(f"[Q{q_num}] Option {idx} must have index={idx} and text")

    correct_opt = q.get("correct_option")
    if not isinstance(correct_opt, int) or not (1 <= correct_opt <= len(options)):
        raise ValueError(f"[Q{q_num}] correct_option ({correct_opt}) out of bounds")

    correct_seq = q.get("correct_sequence")
    if correct_seq is not None:
        if not isinstance(correct_seq, list) or sorted(correct_seq) != [1, 2, 3, 4]:
            raise ValueError(f"[Q{q_num}] correct_sequence must be a permutation of [1, 2, 3, 4]")

    explanation = q.get("explanation")
    if not isinstance(explanation, dict) or "en" not in explanation:
        raise ValueError(f"[Q{q_num}] explanation must be a dict containing at least 'en'")


def validate_exam_payload(payload: Dict[str, Any]) -> None:
    meta = payload.get("exam_metadata")
    if not isinstance(meta, dict):
        raise ValueError("Missing top-level 'exam_metadata' object")

    if meta.get("level") not in VALID_LEVELS:
        raise ValueError(f"Invalid JLPT level: {meta.get('level')}")

    if not meta.get("exam_code"):
        raise ValueError("Missing 'exam_code' in exam_metadata")

    passing = meta.get("passing_criteria") or {}
    if "total_score_required" not in passing or "sectional_minimums" not in passing:
        raise ValueError("Missing passing_criteria.total_score_required or sectional_minimums")

    sections = payload.get("sections")
    if not isinstance(sections, list) or len(sections) == 0:
        raise ValueError("Payload must contain a non-empty 'sections' list")

    for sec in sections:
        sec_code = sec.get("section_code", "UNKNOWN")
        mondai_groups = sec.get("mondai_groups")
        if not isinstance(mondai_groups, list) or len(mondai_groups) == 0:
            raise ValueError(f"Section {sec_code} must contain non-empty 'mondai_groups'")

        for mg in mondai_groups:
            m_num = mg.get("mondai_number")
            questions = mg.get("questions")
            if not isinstance(questions, list) or len(questions) == 0:
                raise ValueError(f"[{sec_code} M{m_num}] must contain non-empty 'questions'")
            for q in questions:
                validate_question(q, sec_code, m_num)


def seed_exam(supabase: Client, payload: Dict[str, Any], publish: bool = False) -> None:
    validate_exam_payload(payload)
    meta = payload["exam_metadata"]
    passing = meta["passing_criteria"]

    exam_row = {
        "exam_code": meta["exam_code"],
        "level": meta["level"],
        "test_number": int(meta["test_number"]),
        "title": meta["title"],
        "is_premium": bool(meta.get("is_premium", int(meta["test_number"]) > 2)),
        "total_time_minutes": int(meta["total_time_minutes"]),
        "total_score_required": int(passing["total_score_required"]),
        "max_total_score": int(passing.get("max_total_score", 180)),
        "sectional_minimums": passing["sectional_minimums"],
        "is_published": publish,
    }

    exam_res = (
        supabase.table("exams")
        .upsert(exam_row, on_conflict="exam_code")
        .execute()
    )
    exam_id = exam_res.data[0]["id"]
    print(f"[OK] Upserted Exam: {meta['exam_code']} (id={exam_id}, published={publish})")

    active_section_numbers: List[int] = []

    for sec in payload["sections"]:
        sec_num = int(sec["section_number"])
        active_section_numbers.append(sec_num)

        sec_row = {
            "exam_id": exam_id,
            "section_number": sec_num,
            "section_code": sec["section_code"],
            "section_title_ja": sec["section_title_ja"],
            "section_title_en": sec["section_title_en"],
            "time_limit_minutes": int(sec["time_limit_minutes"]),
        }

        sec_res = (
            supabase.table("exam_sections")
            .upsert(sec_row, on_conflict="exam_id,section_number")
            .execute()
        )
        section_id = sec_res.data[0]["id"]
        print(f"  [OK] Section {sec_num} ({sec['section_code']}): id={section_id}")

        active_mondai_numbers: List[int] = []

        for mg in sec["mondai_groups"]:
            mondai_num = int(mg["mondai_number"])
            active_mondai_numbers.append(mondai_num)

            mg_row = {
                "section_id": section_id,
                "mondai_number": mondai_num,
                "question_type": mg["question_type"],
                "instruction_ja": mg["instruction_ja"],
                "passage_html": mg.get("passage_html"),
            }

            mg_res = (
                supabase.table("mondai_groups")
                .upsert(mg_row, on_conflict="section_id,mondai_number")
                .execute()
            )
            mondai_group_id = mg_res.data[0]["id"]
            print(f"    [OK] Mondai {mondai_num} ({mg['question_type']}): id={mondai_group_id}")

            active_question_numbers: List[int] = []

            for q in mg["questions"]:
                q_num = int(q["question_number"])
                active_question_numbers.append(q_num)

                raw_exp = q.get("explanation") or {}
                normalized_exp = {
                    lang: raw_exp[lang]
                    for lang in SUPPORTED_LANGS
                    if lang in raw_exp and raw_exp[lang]
                }

                q_row = {
                    "mondai_group_id": mondai_group_id,
                    "question_number": q_num,
                    "prompt_html": q["prompt_html"],
                    "options": q["options"],
                    "correct_option": int(q["correct_option"]),
                    "correct_sequence": q.get("correct_sequence"),
                    "points": int(q.get("points", 1)),
                    "audio_url": q.get("audio_url"),
                    "image_url": q.get("image_url"),
                    "transcript_ja": q.get("transcript_ja"),
                    "explanation": normalized_exp,
                }

                supabase.table("questions").upsert(
                    q_row, on_conflict="mondai_group_id,question_number"
                ).execute()
                print(f"      [OK] Q{q_num} ({len(q['options'])} opts, {q_row['points']} pts)")

            existing_qs = (
                supabase.table("questions")
                .select("id,question_number")
                .eq("mondai_group_id", mondai_group_id)
                .execute()
                .data
            )
            for row in existing_qs:
                if row["question_number"] not in active_question_numbers:
                    supabase.table("questions").delete().eq("id", row["id"]).execute()

        existing_mgs = (
            supabase.table("mondai_groups")
            .select("id,mondai_number")
            .eq("section_id", section_id)
            .execute()
            .data
        )
        for row in existing_mgs:
            if row["mondai_number"] not in active_mondai_numbers:
                supabase.table("mondai_groups").delete().eq("id", row["id"]).execute()

    existing_secs = (
        supabase.table("exam_sections")
        .select("id,section_number")
        .eq("exam_id", exam_id)
        .execute()
        .data
    )
    for row in existing_secs:
        if row["section_number"] not in active_section_numbers:
            supabase.table("exam_sections").delete().eq("id", row["id"]).execute()

    print(f"\nSeeding complete for {meta['exam_code']}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed JLPT mock exam JSON into Supabase.")
    parser.add_argument(
        "--file",
        type=Path,
        default=Path("data/sample_jlpt_questions.json"),
        help="Path to the JLPT mock exam JSON file.",
    )
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Mark the seeded exam as is_published=true.",
    )
    args = parser.parse_args()

    if not args.file.exists():
        print(f"ERROR: JSON file not found at {args.file}", file=sys.stderr)
        sys.exit(1)

    with args.file.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    client = get_supabase_client()
    seed_exam(client, payload, publish=args.publish)


if __name__ == "__main__":
    main()
