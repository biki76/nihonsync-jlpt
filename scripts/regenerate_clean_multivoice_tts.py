#!/usr/bin/env python3
"""
Synthesizes multi-role Japanese JLPT listening audio (_v6.mp3) with dedicated
neural voices per speaker role (zero spoken role prefixes), caches MP3s locally,
and uploads to Supabase Storage ('jlpt-media') with automatic 520/5xx retries.
"""

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
from typing import Dict, List, Tuple

import edge_tts
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")
load_dotenv()

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

ROLE_PATTERNS: List[Tuple[str, re.Pattern]] = [
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
    r"^(?:ナレーター|質問|しつもん|問題|もんだい|先生|せんせい|教師|学生|がくせい|生徒|男の人|おとこのひと|女の人|おんなのひと|店員|てんいん)\s*[:：、，]\s*"
)


def strip_html_and_ruby(raw: str) -> str:
    no_rt = re.sub(r"<rt[^>]*>.*?</rt>", "", raw or "", flags=re.I | re.S)
    no_rp = re.sub(r"<rp[^>]*>.*?</rp>", "", no_rt, flags=re.I | re.S)
    return html.unescape(re.sub(r"<[^>]+>", "", no_rp)).strip()


async def get_role_voice_map() -> Dict[str, Tuple[str, str, str]]:
    voices = await edge_tts.list_voices()
    avail = {v["ShortName"] for v in voices if v.get("Locale", "").startswith("ja-JP")}

    def pick(cands: List[str], fb: str) -> str:
        return next((c for c in cands if c in avail), fb)

    return {
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


def extract_spoken_turns(transcript_ja: str, prompt_html: str) -> List[Tuple[str, str]]:
    turns: List[Tuple[str, str]] = []
    clean_prompt = strip_html_and_ruby(prompt_html)
    has_prompt = bool(clean_prompt and "おんせいを" not in clean_prompt and "音声を" not in clean_prompt)
    if has_prompt:
        turns.append(("NARRATOR", clean_prompt))

    current_role = "NARRATOR"
    for raw_line in (transcript_ja or "").splitlines():
        line = strip_html_and_ruby(raw_line)
        if not line:
            continue
        matched_role, spoken = None, line
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
            if turns and turns[-1][0] == current_role and not (has_prompt and len(turns) == 1):
                turns[-1] = (current_role, f"{turns[-1][1]} {spoken}")
            else:
                turns.append((current_role, spoken))

    if has_prompt and len(turns) > 1:
        turns.append(("NARRATOR", clean_prompt))
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
                    await asyncio.sleep(0.6 * (attempt + 1))

        if not chunks:
            return False

        out_mp3.parent.mkdir(parents=True, exist_ok=True)
        if has_ffmpeg and len(chunks) > 1:
            silence = tmp / "silence.mp3"
            subprocess.run(
                ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.60", "-q:a", "9", str(silence)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
            )
            concat_txt = tmp / "concat.txt"
            lines = []
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


def upload_and_sync_with_retry(
    local_mp3: Path, storage_mp3: str, mg_id: str | None, q_no: int
) -> None:
    payload = local_mp3.read_bytes()
    for attempt in range(6):
        try:
            sb.storage.from_("jlpt-media").upload(
                path=storage_mp3,
                file=payload,
                file_options={"content-type": "audio/mpeg", "upsert": "true"},
            )
            break
        except Exception as exc:
            if attempt == 5:
                raise
            wait_s = 2.5 * (attempt + 1)
            print(f"\n  [RETRY] Storage hiccup on {storage_mp3} ({type(exc).__name__}) — waiting {wait_s:.0f}s...")
            time.sleep(wait_s)

    if mg_id:
        for attempt in range(4):
            try:
                sb.table("questions").update({"audio_url": storage_mp3}).eq(
                    "mondai_group_id", mg_id
                ).eq("question_number", q_no).execute()
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2.0 * (attempt + 1))


async def main() -> None:
    role_map = await get_role_voice_map()
    compiled_path = Path("data/compiled_n5_6sets.json")
    exams = json.loads(compiled_path.read_text(encoding="utf-8"))
    cache_root = Path("data/generated_listening_audio")
    total_synced = 0

    for exam in exams:
        meta = exam["exam_metadata"]
        code = meta["exam_code"]
        padded = f"{int(meta['test_number']):02d}"
        print(f"\n=== Syncing Clean Multi-Role TTS Audio for {code} ===")

        mg_id_by_num: Dict[int, str] = {}
        ex_row = sb.table("exams").select("id").eq("exam_code", code).maybe_single().execute()
        if ex_row.data:
            sec_row = (
                sb.table("exam_sections")
                .select("id")
                .eq("exam_id", ex_row.data["id"])
                .eq("section_code", "LISTENING")
                .maybe_single()
                .execute()
            )
            if sec_row.data:
                for r in (
                    sb.table("mondai_groups")
                    .select("id, mondai_number")
                    .eq("section_id", sec_row.data["id"])
                    .execute()
                    .data
                    or []
                ):
                    mg_id_by_num[int(r["mondai_number"])] = r["id"]

        listening_sec = next(s for s in exam["sections"] if s["section_code"] == "LISTENING")
        for mg in listening_sec["mondai_groups"]:
            mg_id = mg_id_by_num.get(int(mg["mondai_number"]))
            for q in mg["questions"]:
                q_no = int(q["question_number"])
                storage_mp3 = f"jlpt/n5/mock{padded}/listening_q{q_no}_v6.mp3"
                local_mp3 = cache_root / storage_mp3

                if not local_mp3.exists() or local_mp3.stat().st_size < 512:
                    turns = extract_spoken_turns(q.get("transcript_ja", ""), q.get("prompt_html", ""))
                    ok = await synthesize_turns_mp3(turns, role_map, local_mp3)
                    if not ok:
                        continue

                upload_and_sync_with_retry(local_mp3, storage_mp3, mg_id, q_no)
                q["audio_url"] = storage_mp3
                total_synced += 1
                sys.stdout.write(f"\r  Synced {code} Q{q_no}/24 -> {storage_mp3}")
                sys.stdout.flush()
        print()
        compiled_path.write_text(json.dumps(exams, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nDONE: All {total_synced} multi-role listening audio tracks synced!")


if __name__ == "__main__":
    asyncio.run(main())
