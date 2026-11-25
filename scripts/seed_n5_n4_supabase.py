#!/usr/bin/env python3
"""Batched, idempotent Supabase uploader for compiled N5 (20) + N4 (10) exams."""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Sequence, Set, Tuple

from dotenv import load_dotenv
from supabase import Client, create_client

DEFAULT_INPUT = Path("data/compiled_n5_n4_30sets.json")
BATCH_SIZE = 150
PAGE_SIZE = 1000
CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def chunked(rows: Sequence[Any], size: int = BATCH_SIZE) -> List[Sequence[Any]]:
    return [rows[i : i + size] for i in range(0, len(rows), size)]


def sanitize_pg_value(value: Any) -> Tuple[Any, int]:
    """Recursively strips PostgreSQL-invalid NUL and control characters."""
    if isinstance(value, str):
        return CONTROL_CHAR_RE.subn("", value)
    if isinstance(value, list):
        total = 0
        out_list: List[Any] = []
        for item in value:
            cleaned, cnt = sanitize_pg_value(item)
            out_list.append(cleaned)
            total += cnt
        return out_list, total
    if isinstance(value, dict):
        total = 0
        out_dict: Dict[str, Any] = {}
        for key, val in value.items():
            cleaned, cnt = sanitize_pg_value(val)
            out_dict[key] = cleaned
            total += cnt
        return out_dict, total
    return value, 0


def get_client() -> Client:
    load_dotenv(".env.local")
    load_dotenv(".env")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def has_column(sb: Client, table: str, col: str) -> bool:
    try:
        sb.table(table).select(col).limit(1).execute()
        return True
    except Exception:
        return False


def batch_upsert(
    sb: Client, table: str, rows: List[Dict[str, Any]], conflict: str
) -> List[Dict[str, Any]]:
    returned: List[Dict[str, Any]] = []
    for batch in chunked(rows, BATCH_SIZE):
        for attempt in range(1, 5):
            try:
                res = sb.table(table).upsert(list(batch), on_conflict=conflict).execute()
                returned.extend(res.data or [])
                break
            except Exception as exc:
                msg = str(exc)
                transient = any(t in msg for t in ("520", "502", "503", "504", "timeout", "Connection"))
                if not transient or attempt == 4:
                    raise
                time.sleep(attempt * 2)
    return returned


def batch_delete_ids(sb: Client, table: str, ids: List[str]) -> int:
    deleted = 0
    for batch in chunked(ids, BATCH_SIZE):
        sb.table(table).delete().in_("id", list(batch)).execute()
        deleted += len(batch)
    return deleted


def fetch_children_paginated(
    sb: Client, table: str, parent_col: str, parent_ids: List[str], cols: str
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for batch in chunked(parent_ids, 25):
        offset = 0
        while True:
            res = (
                sb.table(table)
                .select(cols)
                .in_(parent_col, list(batch))
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
            )
            page = res.data or []
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
    return rows


def build_section_rows(
    exams: List[Dict[str, Any]],
    exam_id_by_code: Dict[str, str],
    include_max_score: bool,
    include_scoring_cat: bool,
) -> Tuple[List[Dict[str, Any]], Set[Tuple[str, int]]]:
    rows: List[Dict[str, Any]] = []
    active: Set[Tuple[str, int]] = set()
    for e in exams:
        eid = exam_id_by_code[e["exam_metadata"]["exam_code"]]
        for sec in e["sections"]:
            active.add((eid, int(sec["section_number"])))
            row: Dict[str, Any] = {
                "exam_id": eid,
                "section_number": sec["section_number"],
                "section_code": sec["section_code"],
                "section_title_ja": sec["section_title_ja"],
                "section_title_en": sec["section_title_en"],
                "time_limit_minutes": sec["time_limit_minutes"],
            }
            if include_max_score:
                row["max_score"] = 60
            if include_scoring_cat:
                row["scoring_category"] = (
                    "listening"
                    if sec["section_code"] == "LISTENING"
                    else "language_knowledge_and_reading"
                )
            rows.append(row)
    return rows, active


def build_mondai_rows(
    exams: List[Dict[str, Any]],
    exam_id_by_code: Dict[str, str],
    sec_id_by_key: Dict[Tuple[str, int], str],
) -> Tuple[List[Dict[str, Any]], Set[Tuple[str, int]]]:
    rows: List[Dict[str, Any]] = []
    active: Set[Tuple[str, int]] = set()
    for e in exams:
        eid = exam_id_by_code[e["exam_metadata"]["exam_code"]]
        for sec in e["sections"]:
            sid = sec_id_by_key[(eid, int(sec["section_number"]))]
            for mg in sec["mondai_groups"]:
                active.add((sid, int(mg["mondai_number"])))
                rows.append(
                    {
                        "section_id": sid,
                        "mondai_number": mg["mondai_number"],
                        "question_type": mg["question_type"],
                        "instruction_ja": mg["instruction_ja"],
                        "passage_html": mg["passage_html"],
                    }
                )
    return rows, active


def build_question_rows(
    exams: List[Dict[str, Any]],
    exam_id_by_code: Dict[str, str],
    sec_id_by_key: Dict[Tuple[str, int], str],
    mg_id_by_key: Dict[Tuple[str, int], str],
) -> Tuple[List[Dict[str, Any]], Set[Tuple[str, int]]]:
    rows: List[Dict[str, Any]] = []
    active: Set[Tuple[str, int]] = set()
    for e in exams:
        eid = exam_id_by_code[e["exam_metadata"]["exam_code"]]
        for sec in e["sections"]:
            sid = sec_id_by_key[(eid, int(sec["section_number"]))]
            for mg in sec["mondai_groups"]:
                mg_id = mg_id_by_key[(sid, int(mg["mondai_number"]))]
                for q in mg["questions"]:
                    active.add((mg_id, int(q["question_number"])))
                    rows.append({"mondai_group_id": mg_id, **q})
    return rows, active


def prune_stale_children(
    sb: Client,
    exam_ids: List[str],
    sec_ids: List[str],
    mg_ids: List[str],
    active_secs: Set[Tuple[str, int]],
    active_mgs: Set[Tuple[str, int]],
    active_qs: Set[Tuple[str, int]],
) -> Tuple[int, int, int]:
    cur_qs = fetch_children_paginated(sb, "questions", "mondai_group_id", mg_ids, "id,mondai_group_id,question_number")
    stale_q = [r["id"] for r in cur_qs if (r["mondai_group_id"], int(r["question_number"])) not in active_qs]

    cur_mgs = fetch_children_paginated(sb, "mondai_groups", "section_id", sec_ids, "id,section_id,mondai_number")
    stale_mg = [r["id"] for r in cur_mgs if (r["section_id"], int(r["mondai_number"])) not in active_mgs]

    cur_secs = fetch_children_paginated(sb, "exam_sections", "exam_id", exam_ids, "id,exam_id,section_number")
    stale_sec = [r["id"] for r in cur_secs if (r["exam_id"], int(r["section_number"])) not in active_secs]

    return (
        batch_delete_ids(sb, "questions", stale_q),
        batch_delete_ids(sb, "mondai_groups", stale_mg),
        batch_delete_ids(sb, "exam_sections", stale_sec),
    )


def seed_all(sb: Client, exams: List[Dict[str, Any]]) -> None:
    include_max_score = has_column(sb, "exam_sections", "max_score")
    include_scoring_cat = has_column(sb, "exam_sections", "scoring_category")

    exam_rows = [e["exam_metadata"] for e in exams]
    upserted_exams = batch_upsert(sb, "exams", exam_rows, "level,test_number")
    exam_id_by_code = {r["exam_code"]: r["id"] for r in upserted_exams}
    print(f"[1/5] Upserted {len(exam_id_by_code)} exams (UUIDs preserved).")

    sec_rows, active_secs = build_section_rows(exams, exam_id_by_code, include_max_score, include_scoring_cat)
    upserted_secs = batch_upsert(sb, "exam_sections", sec_rows, "exam_id,section_number")
    sec_id_by_key = {(r["exam_id"], int(r["section_number"])): r["id"] for r in upserted_secs}
    print(f"[2/5] Upserted {len(sec_id_by_key)} exam_sections (max_score={include_max_score}, scoring_category={include_scoring_cat}).")

    mg_rows, active_mgs = build_mondai_rows(exams, exam_id_by_code, sec_id_by_key)
    upserted_mgs = batch_upsert(sb, "mondai_groups", mg_rows, "section_id,mondai_number")
    mg_id_by_key = {(r["section_id"], int(r["mondai_number"])): r["id"] for r in upserted_mgs}
    print(f"[3/5] Upserted {len(mg_id_by_key)} mondai_groups.")

    q_rows, active_qs = build_question_rows(exams, exam_id_by_code, sec_id_by_key, mg_id_by_key)
    upserted_qs = batch_upsert(sb, "questions", q_rows, "mondai_group_id,question_number")
    print(f"[4/5] Upserted {len(upserted_qs)} questions.")

    dq, dm, ds = prune_stale_children(
        sb,
        list(exam_id_by_code.values()),
        list(sec_id_by_key.values()),
        list(mg_id_by_key.values()),
        active_secs,
        active_mgs,
        active_qs,
    )
    print(f"[5/5] Pruned stale legacy rows: {dq} questions, {dm} mondai_groups, {ds} sections.")


def verify_live_counts(sb: Client, codes: List[str]) -> None:
    exams = sb.table("exams").select("id,exam_code,level,is_premium,is_published").in_("exam_code", codes).execute().data or []
    secs = fetch_children_paginated(sb, "exam_sections", "exam_id", [e["id"] for e in exams], "id,exam_id")
    mgs = fetch_children_paginated(sb, "mondai_groups", "section_id", [s["id"] for s in secs], "id,section_id")
    qs = fetch_children_paginated(sb, "questions", "mondai_group_id", [m["id"] for m in mgs], "id,mondai_group_id")

    sec_to_exam = {s["id"]: s["exam_id"] for s in secs}
    mg_to_exam = {m["id"]: sec_to_exam[m["section_id"]] for m in mgs}
    per_exam: Dict[str, int] = {}
    for q in qs:
        eid = mg_to_exam[q["mondai_group_id"]]
        per_exam[eid] = per_exam.get(eid, 0) + 1

    print("\n=== LIVE SUPABASE VERIFICATION ===")
    summary: Dict[str, List[int]] = {}
    for e in sorted(exams, key=lambda x: x["exam_code"]):
        summary.setdefault(e["level"], []).append(per_exam.get(e["id"], 0))
    for lvl, cnts in sorted(summary.items()):
        print(f"  {lvl}: {len(cnts)} published exams | {sum(cnts)} live questions (per-exam min={min(cnts)}, max={max(cnts)})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch-seed N5/N4 mock exams into Supabase.")
    parser.add_argument("--file", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.file.is_file():
        print(f"ERROR: Compiled file not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    raw_exams: List[Dict[str, Any]] = json.loads(args.file.read_text(encoding="utf-8"))
    exams, scrubbed = sanitize_pg_value(raw_exams)
    if scrubbed > 0:
        args.file.write_text(json.dumps(exams, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"SANITIZED: Removed {scrubbed} PostgreSQL-invalid NUL/control character(s) from {args.file}.")

    total_q = sum(len(mg["questions"]) for e in exams for s in e["sections"] for mg in s["mondai_groups"])
    print(f"LOADED: {len(exams)} exams | {total_q} questions from {args.file}")
    if args.dry_run:
        print("DRY RUN PASSED: Payload sanitized and ready for Supabase upload.")
        return

    sb = get_client()
    seed_all(sb, exams)
    verify_live_counts(sb, [e["exam_metadata"]["exam_code"] for e in exams])


if __name__ == "__main__":
    main()
