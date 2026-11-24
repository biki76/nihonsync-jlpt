#!/usr/bin/env python3
"""Preflight check for N5 (20 sets) + N4 (10 sets) schema and PDF layout."""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set, Tuple

TARGET_ROOTS: Tuple[Path, ...] = (
    Path("data/staged_drafts/JLPT_N5_COMPLETE_20_SETS"),
    Path("data/staged_drafts/JLPT_N4_CHUNK1_SETS_01-05"),
    Path("data/staged_drafts/JLPT_N4_CHUNK2_SETS_06-10"),
)


def audit_staged_sets() -> Tuple[Dict[str, List[int]], Dict[str, Set[Tuple[str, str]]]]:
    """Verifies all 30 set manifests and collects unique (section, category) pairs."""
    sets_by_level: Dict[str, List[int]] = defaultdict(list)
    cats_by_level: Dict[str, Set[Tuple[str, str]]] = defaultdict(set)
    missing_assets: List[str] = []

    for root in TARGET_ROOTS:
        if not root.exists():
            missing_assets.append(f"MISSING DIR: {root}")
            continue
        for mf in sorted(root.rglob("SET_METADATA.json")):
            data = json.loads(mf.read_text(encoding="utf-8"))
            lvl = str(data.get("level", "")).upper()
            set_no = int(data.get("set", 0))
            sets_by_level[lvl].append(set_no)
            for req in ("Examination.pdf", "Answer_Key.pdf", "LISTENING_DRAFT.txt"):
                if not (mf.parent / req).is_file():
                    missing_assets.append(f"{lvl}-SET{set_no:02d} missing {req}")
            for q in data.get("questions", []):
                cats_by_level[lvl].add((str(q.get("section", "")), str(q.get("category", ""))))

    print("=== 1. STAGED SETS AUDIT ===")
    for lvl in sorted(sets_by_level):
        nums = sorted(sets_by_level[lvl])
        print(f"  {lvl}: {len(nums)} sets -> {nums}")
    print(f"  Missing required files: {len(missing_assets)}")
    for item in missing_assets[:10]:
        print(f"    ! {item}")

    print("\n=== 2. UNIQUE (SECTION, CATEGORY) PAIRS ===")
    for lvl in sorted(cats_by_level):
        print(f"  [{lvl}]")
        for sec, cat in sorted(cats_by_level[lvl]):
            print(f"    - {sec}: {cat}")
    return sets_by_level, cats_by_level


def inspect_migrations() -> None:
    """Prints CREATE TABLE blocks from supabase/migrations/*.sql."""
    print("\n=== 3. LIVE SUPABASE MIGRATION TABLES ===")
    mig_dir = Path("supabase/migrations")
    if not mig_dir.is_dir():
        print("  supabase/migrations not found")
        return
    pattern = re.compile(r"create table[\s\S]*?;", re.IGNORECASE)
    for sql_file in sorted(mig_dir.glob("*.sql")):
        txt = sql_file.read_text(encoding="utf-8", errors="replace")
        tables = pattern.findall(txt)
        print(f"  File: {sql_file.name} ({len(tables)} CREATE TABLE statements)")
        for block in tables:
            first_line = block.splitlines()[0].strip()
            if any(t in first_line.lower() for t in ("exams", "exam_sections", "mondai_groups", "questions")):
                print(block[:900])
                print("-" * 40)


def inspect_existing_scripts() -> None:
    """Prints key upsert & parser lines from existing working N5 scripts."""
    print("\n=== 4. EXISTING SEEDER & COMPILER SIGNATURES ===")
    for path_str, limit in (
        ("scripts/media_and_seed_n5_6sets.py", 2200),
        ("scripts/compile_n5_6sets.py", 2600),
    ):
        p = Path(path_str)
        if not p.is_file():
            print(f"  {path_str}: not found")
            continue
        txt = p.read_text(encoding="utf-8", errors="replace")
        print(f"\n--- {path_str} ({len(txt)} chars) ---")
        if "media_and_seed" in path_str:
            idx = txt.lower().find("def seed")
            snippet = txt[idx : idx + limit] if idx != -1 else txt[-limit:]
            print(snippet)
        else:
            print(txt[:limit])


def inspect_n4_exam_pdf() -> None:
    """Prints sample text from N4 SET_01/Examination.pdf (Vocab + G&R)."""
    print("\n=== 5. N4 SET_01 Examination.pdf SAMPLE ===")
    pdf = Path("data/staged_drafts/JLPT_N4_CHUNK1_SETS_01-05/JLPT_N4_CHUNK1_SETS_01-05/SET_01/Examination.pdf")
    if not pdf.is_file():
        matches = list(Path("data/staged_drafts/JLPT_N4_CHUNK1_SETS_01-05").rglob("Examination.pdf"))
        pdf = matches[0] if matches else pdf
    if not pdf.is_file():
        print("  N4 Examination.pdf not found")
        return
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(pdf))
        print(f"  Pages: {len(reader.pages)}")
        for page_idx in (0, 1, 4, 6):
            if page_idx < len(reader.pages):
                txt = (reader.pages[page_idx].extract_text() or "").strip()
                print(f"  --- Page {page_idx + 1} ---")
                print(txt[:700])
    except Exception as exc:
        print(f"  PDF read error: {exc}")


def main() -> None:
    audit_staged_sets()
    inspect_migrations()
    inspect_existing_scripts()
    inspect_n4_exam_pdf()


if __name__ == "__main__":
    main()
