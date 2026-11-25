#!/usr/bin/env python3
"""Resumable multi-role edge-tts audio pipeline for N5 (20) + N4 (10) exams."""

import argparse
import asyncio
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

import edge_tts
from dotenv import load_dotenv
from supabase import Client, create_client

CACHE_ROOT = Path("data/generated_listening_audio")
CHECKPOINT_PATH = Path("data/audio_sync_checkpoint.json")
AUDIO_VERSION = "v7"
PAGE_SIZE = 1000

ROLE_PATTERNS: List[Tuple[str, re.Pattern[str]]] = [
    ("NARRATOR", re.compile(r"^(?:Narrator|Prompt|ナレーター|質問|しつもん|問題|もんだい)\s*[:：]\s*(.+)$", re.I)),
    ("TEACHER", re.compile(r"^(?:Teacher|先生|せんせい|教師|きょうし|教授|講師)\s*[:：]\s*(.+)$", re.I)),
    ("STUDENT_2", re.compile(r"^(?:Student\s*2|学生\s*2|がくせい\s*2|女子学生)\s*[:：]\s*(.+)$", re.I)),
    ("STUDENT", re.compile(r"^(?:Student(?:\s*1)?|学生(?:\s*1)?|がくせい(?:\s*1)?|生徒|せいと|留学生|男子学生)\s*[:：]\s*(.+)$", re.I)),
    ("CLERK", re.compile(r"^(?:Clerk|店員|てんいん|受付|うけつけ|案内|あんない|アナウンス)\s*[:：]\s*(.+)$", re.I)),
    ("MAN_2", re.compile(r"^(?:Man\s*2|男の人\s*2|男\s*2|男性\s*2|A)\s*[:：]\s*(.+)$", re.I)),
    ("MAN", re.compile(r"^(?:Man(?:\s*1)?|男の人(?:\s*1)?|おとこのひと|男(?:\s*1)?|おとこ|男性(?:\s*1)?|父|おとうさん|夫|部長|課長|店長|駅員|医者)\s*[:：]\s*(.+)$", re.I)),
    ("WOMAN_2", re.compile(r"^(?:Woman\s*2|女の人\s*2|女\s*2|女性\s*2|B)\s*[:：]\s*(.+)$", re.I)),
    ("WOMAN", re.compile(r"^(?:Woman(?:\s*1)?|女の人(?:\s*1)?|おんなのひと|女(?:\s*1)?|おんな|女性(?:\s*1)?|母|おかあさん|妻)\s*[:：]\s*(.+)$", re.I)),
]
STRAY_PREFIX_RE = re.compile(
    r"^(?:ナレーター|質問|しつもん|問題|もんだい|先生|せんせい|教師|学生|がくせい|生徒|男の人|おとこのひと|女の人|おんなのひと|店員|てんいん|男|女)\s*[:：、，]\s*"
)


def get_supabase() -> Client:
    load_dotenv(".env.local")
    load_dotenv(".env")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def chunked(items: Sequence[Any], size: int) -> List[Sequence[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def fetch_paginated(
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


def strip_html_and_ruby(raw: Any) -> str:
    text = str(raw or "")
    no_rt = re.sub(r"<rt[^>]*>.*?</rt>", "", text, flags=re.I | re.S)
    no_rp = re.sub(r"<rp[^>]*>.*?</rp>", "", no_rt, flags=re.I | re.S)
    return html.unescape(re.sub(r"<[^>]+>", "", no_rp)).strip()


def load_checkpoint() -> Set[str]:
    if not CHECKPOINT_PATH.is_file():
        return set()
    try:
        data = json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
        return set(data.get("synced_paths", []))
    except (OSError, json.JSONDecodeError):
        return set()


def save_checkpoint(synced: Set[str]) -> None:
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_PATH.write_text(
        json.dumps({"version": AUDIO_VERSION, "synced_paths": sorted(synced)}, indent=2),
        encoding="utf-8",
    )


async def build_role_voice_map() -> Dict[str, Tuple[str, str, str]]:
    voices = await edge_tts.list_voices()
    avail = {v["ShortName"] for v in voices if v.get("Locale", "").startswith("ja-JP")}

    def pick(cands: List[str], fb: str) -> str:
        return next((c for c in cands if c in avail), fb)

    role_map = {
        "NARRATOR": (pick(["ja-JP-ShioriNeural", "ja-JP-NanamiNeural"], "ja-JP-NanamiNeural"), "-4%", "-2Hz"),
        "TEACHER": (pick(["ja-JP-NaokiNeural", "ja-JP-KeitaNeural"], "ja-JP-KeitaNeural"), "-5%", "-6Hz"),
        "STUDENT": (pick(["ja-JP-AoiNeural", "ja-JP-MayuNeural"], "ja-JP-NanamiNeural"), "+4%", "+6Hz"),
        "STUDENT_2": (pick(["ja-JP-DaichiNeural", "ja-JP-KeitaNeural"], "ja-JP-KeitaNeural"), "+2%", "+2Hz"),
        "MAN": (pick(["ja-JP-KeitaNeural"], "ja-JP-KeitaNeural"), "+0%", "+0Hz"),
        "MAN_2": (pick(["ja-JP-DaichiNeural", "ja-JP-KeitaNeural"], "ja-JP-KeitaNeural"), "+2%", "-4Hz"),
        "WOMAN": (pick(["ja-JP-NanamiNeural"], "ja-JP-NanamiNeural"), "+0%", "+2Hz"),
        "WOMAN_2": (pick(["ja-JP-MayuNeural", "ja-JP-NanamiNeural"], "ja-JP-NanamiNeural"), "+3%", "+6Hz"),
        "CLERK": (pick(["ja-JP-DaichiNeural", "ja-JP-KeitaNeural"], "ja-JP-KeitaNeural"), "+2%", "+4Hz"),
    }
    print("Active ja-JP Role Voice Map:")
    for r, cfg in role_map.items():
        print(f"  {r:<10} -> {cfg[0]} (rate={cfg[1]}, pitch={cfg[2]})")
    return role_map


def parse_script_lines(transcript_ja: str) -> List[Tuple[str, str]]:
    turns: List[Tuple[str, str]] = []
    current_role = "NARRATOR"
    for raw_line in (transcript_ja or "").splitlines():
        line = strip_html_and_ruby(raw_line)
        if not line:
            continue
        matched_role: Optional[str] = None
        spoken = line
        for role, pat in ROLE_PATTERNS:
            m = pat.match(line)
            if m:
                matched_role, spoken = role, m.group(1).strip()
                break
        if matched_role:
            current_role = matched_role
            spoken = STRAY_PREFIX_RE.sub("", spoken).strip()
            if spoken:
                turns.append((current_role, spoken))
        else:
            spoken = STRAY_PREFIX_RE.sub("", line).strip()
            if not spoken:
                continue
            if turns and turns[-1][0] == current_role:
                turns[-1] = (current_role, f"{turns[-1][1]} {spoken}")
            else:
                turns.append((current_role, spoken))
    return turns


def extract_spoken_turns(q: Dict[str, Any], q_type: str) -> List[Tuple[str, str]]:
    turns: List[Tuple[str, str]] = []
    prompt = strip_html_and_ruby(q.get("prompt_html"))
    has_prompt = bool(prompt and "音声を" not in prompt and "おんせいを" not in prompt)
    if has_prompt:
        turns.append(("NARRATOR", prompt))

    raw_script = str(q.get("transcript_ja") or "")
    script_turns = parse_script_lines(raw_script)
    turns.extend(script_turns)

    if q_type in ("verbal_expressions", "quick_response"):
        already_has_choices = bool(re.search(r"(?m)^[1１][\.\uFF0E\)\s]", raw_script))
        if not already_has_choices:
            last_role = script_turns[-1][0] if script_turns else "WOMAN"
            responder = "MAN" if last_role in ("WOMAN", "WOMAN_2", "STUDENT") else "WOMAN"
            for opt in q.get("options") or []:
                idx = opt.get("index")
                txt = strip_html_and_ruby(opt.get("text"))
                txt = re.sub(r"^[1-4１-４][\.\uFF0E\)\uFF09\s（\(]*", "", txt).rstrip("）)")
                if txt and txt != str(idx):
                    turns.append(("NARRATOR", f"{idx}。"))
                    turns.append((responder, txt))
    elif has_prompt and script_turns:
        turns.append(("NARRATOR", prompt))

    return turns


async def synthesize_turns_mp3(
    turns: List[Tuple[str, str]],
    role_map: Dict[str, Tuple[str, str, str]],
    out_mp3: Path,
) -> bool:
    if not turns:
        return False
    has_ffmpeg = shutil.which("ffmpeg") is not None
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        chunks: List[Path] = []
        for idx, (role, spoken) in enumerate(turns):
            text = re.sub(r"\s+", " ", spoken).strip()
            if not text:
                continue
            voice, rate, pitch = role_map.get(role, role_map["NARRATOR"])
            chunk_path = tmp / f"t_{idx:02d}.mp3"
            for attempt in range(4):
                try:
                    await edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch).save(str(chunk_path))
                    if chunk_path.exists() and chunk_path.stat().st_size > 200:
                        chunks.append(chunk_path)
                        break
                except Exception:
                    await asyncio.sleep(0.8 * (attempt + 1))

        if not chunks:
            return False

        out_mp3.parent.mkdir(parents=True, exist_ok=True)
        if has_ffmpeg and len(chunks) > 1:
            silence = tmp / "silence.mp3"
            subprocess.run(
                ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.55", "-q:a", "9", str(silence)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
            )
            concat_txt = tmp / "concat.txt"
            lines: List[str] = []
            for i, c in enumerate(chunks):
                lines.append(f"file '{c.as_posix()}'")
                if i < len(chunks) - 1 and silence.exists():
                    lines.append(f"file '{silence.as_posix()}'")
            concat_txt.write_text("\n".join(lines), encoding="utf-8")
            subprocess.run(
                ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_txt), "-c", "copy", str(out_mp3)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
            )
            if out_mp3.exists() and out_mp3.stat().st_size > 512:
                return True

        with out_mp3.open("wb") as out_f:
            for c in chunks:
                out_f.write(c.read_bytes())
        return out_mp3.exists() and out_mp3.stat().st_size > 512


def upload_mp3_with_retry(sb: Client, local_mp3: Path, storage_path: str) -> None:
    payload = local_mp3.read_bytes()
    for attempt in range(6):
        try:
            sb.storage.from_("jlpt-media").upload(
                path=storage_path,
                file=payload,
                file_options={"content-type": "audio/mpeg", "upsert": "true"},
            )
            return
        except Exception as exc:
            if attempt == 5:
                raise
            wait_s = 2.0 * (attempt + 1)
            print(f"\n  [RETRY {attempt + 1}/5] Storage upload {storage_path} ({type(exc).__name__}) -> wait {wait_s:.0f}s")
            time.sleep(wait_s)


def batch_upsert_questions(sb: Client, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    for attempt in range(4):
        try:
            sb.table("questions").upsert(rows, on_conflict="id").execute()
            return
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2.0 * (attempt + 1))


def parse_set_range(spec: str) -> Set[int]:
    nums: Set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            nums.update(range(int(lo), int(hi) + 1))
        else:
            nums.add(int(part))
    return nums


async def process_exam(
    sb: Client,
    exam: Dict[str, Any],
    mg_type_by_id: Dict[str, str],
    questions: List[Dict[str, Any]],
    role_map: Dict[str, Tuple[str, str, str]],
    checkpoint: Set[str],
    sem: asyncio.Semaphore,
    force: bool,
) -> Tuple[int, int]:
    code = str(exam["exam_code"])
    lvl = str(exam["level"]).lower()
    padded = f"{int(exam['test_number']):02d}"
    total_q = len(questions)

    async def synth_one(q: Dict[str, Any]) -> Tuple[Dict[str, Any], str, Path, bool]:
        q_no = int(q["question_number"])
        storage_path = f"jlpt/{lvl}/mock{padded}/listening_q{q_no}_{AUDIO_VERSION}.mp3"
        local_mp3 = CACHE_ROOT / storage_path
        if not force and storage_path in checkpoint and q.get("audio_url") == storage_path:
            return q, storage_path, local_mp3, False
        if force or not local_mp3.exists() or local_mp3.stat().st_size < 512:
            turns = extract_spoken_turns(q, mg_type_by_id.get(q["mondai_group_id"], ""))
            async with sem:
                ok = await synthesize_turns_mp3(turns, role_map, local_mp3)
                if not ok:
                    raise RuntimeError(f"TTS failed for {code} Q{q_no}")
        return q, storage_path, local_mp3, True

    print(f"\n=== {code} ({total_q} listening tracks) ===")
    results = await asyncio.gather(*(synth_one(q) for q in sorted(questions, key=lambda r: int(r["question_number"]))))

    synced_now = 0
    skipped = 0
    updated_rows: List[Dict[str, Any]] = []
    for q, storage_path, local_mp3, needs_upload in results:
        if not needs_upload:
            skipped += 1
            continue
        upload_mp3_with_retry(sb, local_mp3, storage_path)
        checkpoint.add(storage_path)
        updated = dict(q)
        updated["audio_url"] = storage_path
        updated_rows.append(updated)
        synced_now += 1
        sys.stdout.write(f"\r  Uploaded {code}: {synced_now}/{total_q - skipped} new ({skipped} cached) -> Q{q['question_number']}")
        sys.stdout.flush()

    if updated_rows:
        batch_upsert_questions(sb, updated_rows)
        save_checkpoint(checkpoint)
        print(f"\n  DB synced: {len(updated_rows)} rows updated in 1 batch for {code}.")
    else:
        print(f"  All {skipped} tracks already synced for {code}.")
    return synced_now, skipped


def print_live_coverage(sb: Client, target_levels: List[str]) -> None:
    exams = (
        sb.table("exams")
        .select("id,exam_code,level,test_number")
        .in_("level", target_levels)
        .order("exam_code")
        .execute()
        .data
        or []
    )
    secs = [
        s
        for s in fetch_paginated(sb, "exam_sections", "exam_id", [e["id"] for e in exams], "id,exam_id,section_code")
        if s["section_code"] == "LISTENING"
    ]
    mgs = fetch_paginated(sb, "mondai_groups", "section_id", [s["id"] for s in secs], "id,section_id")
    qs = fetch_paginated(sb, "questions", "mondai_group_id", [m["id"] for m in mgs], "id,mondai_group_id,audio_url")

    exam_by_id = {e["id"]: e["level"] for e in exams}
    sec_to_lvl = {s["id"]: exam_by_id[s["exam_id"]] for s in secs}
    mg_to_lvl = {m["id"]: sec_to_lvl[m["section_id"]] for m in mgs}

    totals: Dict[str, List[int]] = {lvl: [0, 0] for lvl in target_levels}
    for q in qs:
        lvl = mg_to_lvl[q["mondai_group_id"]]
        totals[lvl][1] += 1
        if q.get("audio_url"):
            totals[lvl][0] += 1

    print("\n=== LIVE AUDIO COVERAGE IN SUPABASE ===")
    for lvl in sorted(totals):
        done, total = totals[lvl]
        print(f"  {lvl}: {done}/{total} listening questions have audio_url")


async def run(args: argparse.Namespace) -> None:
    sb = get_supabase()
    target_levels = ["N5", "N4"] if args.level == "ALL" else [args.level]
    set_filter = None if args.all else parse_set_range(args.sets)

    all_exams = (
        sb.table("exams")
        .select("id,exam_code,level,test_number")
        .in_("level", target_levels)
        .order("exam_code")
        .execute()
        .data
        or []
    )
    exams = [e for e in all_exams if set_filter is None or int(e["test_number"]) in set_filter]
    if not exams:
        print("No matching exams found in Supabase.")
        return

    secs = [
        s
        for s in fetch_paginated(sb, "exam_sections", "exam_id", [e["id"] for e in exams], "id,exam_id,section_code")
        if s["section_code"] == "LISTENING"
    ]
    mgs = fetch_paginated(sb, "mondai_groups", "section_id", [s["id"] for s in secs], "id,section_id,question_type")
    qs = fetch_paginated(sb, "questions", "mondai_group_id", [m["id"] for m in mgs], "*")

    sec_to_exam = {s["id"]: s["exam_id"] for s in secs}
    mg_type_by_id = {m["id"]: str(m["question_type"]) for m in mgs}
    qs_by_exam: Dict[str, List[Dict[str, Any]]] = {}
    for q in qs:
        eid = sec_to_exam[next(m["section_id"] for m in mgs if m["id"] == q["mondai_group_id"])]
        qs_by_exam.setdefault(eid, []).append(q)

    role_map = await build_role_voice_map()
    checkpoint = load_checkpoint()
    sem = asyncio.Semaphore(max(1, args.concurrency))

    total_new, total_skip = 0, 0
    for exam in exams:
        new_c, skip_c = await process_exam(
            sb, exam, mg_type_by_id, qs_by_exam.get(exam["id"], []), role_map, checkpoint, sem, args.force
        )
        total_new += new_c
        total_skip += skip_c

    print(f"\nRUN COMPLETE: {total_new} newly synced | {total_skip} skipped (already synced).")
    print_live_coverage(sb, ["N5", "N4"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Synthesize and sync multi-role JLPT listening audio.")
    parser.add_argument("--level", choices=["N5", "N4", "ALL"], default="ALL")
    parser.add_argument("--sets", default="1-2", help="Comma/range set filter, e.g. '1-2' or '3-10'")
    parser.add_argument("--all", action="store_true", help="Process all sets (ignores --sets)")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--force", action="store_true", help="Force re-synthesis and re-upload")
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
