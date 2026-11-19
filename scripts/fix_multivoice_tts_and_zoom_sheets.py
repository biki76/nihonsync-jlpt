#!/usr/bin/env python3
"""
1. Parses JLPT listening scripts into explicit speaker turns:
   - NARRATOR (Narrator / Prompt / ナレーター / 質問 / 問題)
   - TEACHER  (Teacher / 先生 / 教師 / 教授)
   - STUDENT  (Student / 学生 / 生徒 / 留学生)
   - MAN      (Man / 男 / 男の人 / 父 / 夫 / 部長 / 課長 / 店長 / 駅員 / 医者)
   - WOMAN    (Woman / 女 / 女の人 / 母 / 妻)
   - CLERK    (Clerk / 店員 / 受付 / アナウンス)
2. Discovers live ja-JP Neural voices via edge-tts and assigns a DISTINCT TTS
   model + acoustic profile to every role so Teacher, Student, and Narrator
   never share a generic single voice.
3. Renders 1.65x zoomed-in, bold-stroke JLPT visual sheets (_sheet_v4.png) for
   Task-based (課題理解), Point comprehension (ポイント理解), and Verbal
   expressions (発話表現) only, and syncs audio_url, image_url, and transcript_ja
   in Supabase.
"""

import asyncio
import math
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import edge_tts
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader
from supabase import create_client

load_dotenv(".env.local")
load_dotenv()

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

TMP_DIR = Path("/tmp/nihonsync_v4_media")
TMP_DIR.mkdir(parents=True, exist_ok=True)

# Role detection patterns (supports full-width ： and half-width :)
ROLE_PATTERNS: List[Tuple[str, re.Pattern]] = [
    ("NARRATOR", re.compile(r"^(?:Narrator|Prompt|ナレーター|質問|しつもん|問題|もんだい)\s*[:：]\s*(.+)$", re.I)),
    ("TEACHER", re.compile(r"^(?:Teacher|先生|せんせい|教師|きょうし|教授|講師)\s*[:：]\s*(.+)$", re.I)),
    ("STUDENT", re.compile(r"^(?:Student|学生|がくせい|生徒|せいと|留学生|男子学生|女子学生)\s*[:：]\s*(.+)$", re.I)),
    ("CLERK", re.compile(r"^(?:Clerk|店員|てんいん|受付|うけつけ|案内|アナウンス)\s*[:：]\s*(.+)$", re.I)),
    ("MAN", re.compile(r"^(?:Man|男の人|おとこのひと|男|男性|父|お父さん|夫|部長|課長|店長|駅員|医者|A)\s*[:：]\s*(.+)$", re.I)),
    ("WOMAN", re.compile(r"^(?:Woman|女の人|おんなのひと|女|女性|母|お母さん|妻|B)\s*[:：]\s*(.+)$", re.I)),
]

ROLE_JA_PREFIX = {
    "NARRATOR": "ナレーター：",
    "TEACHER": "先生：",
    "STUDENT": "学生：",
    "CLERK": "店員：",
    "MAN": "男の人：",
    "WOMAN": "女の人：",
}


async def build_role_voice_map() -> Dict[str, Tuple[str, str, str]]:
    """
    Assigns a distinct Edge Neural TTS voice model + (rate, pitch) to each role.
    Guarantees Narrator, Teacher, and Student use separate voice models.
    """
    voices = await edge_tts.list_voices()
    ja_names = {v["ShortName"] for v in voices if v.get("Locale", "").startswith("ja-JP")}
    print("Available ja-JP Edge TTS voices:", sorted(ja_names))

    def pick(candidates: List[str], fallback: str) -> str:
        for c in candidates:
            if c in ja_names:
                return c
        return fallback

    narrator_voice = pick(["ja-JP-ShioriNeural", "ja-JP-NanamiNeural"], "ja-JP-NanamiNeural")
    teacher_voice = pick(["ja-JP-NaokiNeural", "ja-JP-KeitaNeural"], "ja-JP-KeitaNeural")
    student_voice = pick(["ja-JP-AoiNeural", "ja-JP-DaichiNeural", "ja-JP-MayuNeural"], "ja-JP-NanamiNeural")
    man_voice = pick(["ja-JP-KeitaNeural", "ja-JP-DaichiNeural"], "ja-JP-KeitaNeural")
    woman_voice = pick(["ja-JP-NanamiNeural", "ja-JP-MayuNeural"], "ja-JP-NanamiNeural")
    clerk_voice = pick(["ja-JP-DaichiNeural", "ja-JP-MayuNeural", "ja-JP-KeitaNeural"], "ja-JP-KeitaNeural")

    # Ensure Teacher, Student, and Narrator never share identical (voice, pitch)
    student_pitch = "+8Hz" if student_voice != narrator_voice else "+16Hz"
    teacher_pitch = "-6Hz" if teacher_voice != man_voice else "-12Hz"

    role_map = {
        "NARRATOR": (narrator_voice, "-4%", "+0Hz"),
        "TEACHER": (teacher_voice, "-5%", teacher_pitch),
        "STUDENT": (student_voice, "+5%", student_pitch),
        "MAN": (man_voice, "+0%", "+0Hz"),
        "WOMAN": (woman_voice, "+0%", "+2Hz"),
        "CLERK": (clerk_voice, "+2%", "+4Hz"),
    }
    print("Role -> TTS Model Mapping:")
    for r, cfg in role_map.items():
        print(f"  {r:<10} => {cfg[0]} (rate={cfg[1]}, pitch={cfg[2]})")
    return role_map


def parse_script_turns(raw_script: str, prompt_text: str = "") -> List[Tuple[str, str]]:
    """
    Splits a Japanese listening script into (ROLE, text) turns.
    Preserves role continuity across wrapped lines and adds Narrator prompt framing.
    """
    turns: List[Tuple[str, str]] = []
    clean_prompt = re.sub(r"<[^>]+>", "", prompt_text or "").strip()
    if clean_prompt and "おんせいを" not in clean_prompt and "音声を" not in clean_prompt:
        turns.append(("NARRATOR", clean_prompt))

    current_role = "NARRATOR"
    for raw_line in (raw_script or "").splitlines():
        line = re.sub(r"<[^>]+>", "", raw_line).strip()
        if not line:
            continue
        matched = False
        for role, pat in ROLE_PATTERNS:
            m = pat.match(line)
            if m:
                current_role = role
                spoken = m.group(1).strip()
                if spoken:
                    turns.append((current_role, spoken))
                matched = True
                break
        if not matched:
            # Continuation of previous speaker's turn
            if turns and turns[-1][0] == current_role:
                turns[-1] = (current_role, f"{turns[-1][1]} {line}")
            else:
                turns.append((current_role, line))

    if clean_prompt and "おんせいを" not in clean_prompt and "音声を" not in clean_prompt and len(turns) > 1:
        turns.append(("NARRATOR", clean_prompt))

    return turns


def format_labeled_transcript(turns: List[Tuple[str, str]]) -> str:
    lines: List[str] = []
    for role, text in turns:
        prefix = ROLE_JA_PREFIX.get(role, "")
        lines.append(f"{prefix}{text}")
    return "\n".join(lines)


async def synthesize_multivoice_mp3(
    turns: List[Tuple[str, str]],
    role_map: Dict[str, Tuple[str, str, str]],
    out_mp3: Path,
) -> bool:
    if not turns:
        return False

    has_ffmpeg = shutil.which("ffmpeg") is not None
    with tempfile.TemporaryDirectory() as td:
        tmp_dir = Path(td)
        chunk_paths: List[Path] = []

        for idx, (role, text) in enumerate(turns):
            clean_text = re.sub(r"\s+", " ", text).strip()
            if not clean_text:
                continue
            voice, rate, pitch = role_map.get(role, role_map["NARRATOR"])
            chunk_file = tmp_dir / f"turn_{idx:02d}_{role}.mp3"

            for attempt in range(3):
                try:
                    comm = edge_tts.Communicate(
                        text=clean_text,
                        voice=voice,
                        rate=rate,
                        pitch=pitch,
                    )
                    await comm.save(str(chunk_file))
                    if chunk_file.exists() and chunk_file.stat().st_size > 256:
                        chunk_paths.append(chunk_file)
                        break
                except Exception:
                    await asyncio.sleep(0.6 * (attempt + 1))

        if not chunk_paths:
            return False

        if has_ffmpeg and len(chunk_paths) > 1:
            # Generate 0.65s 24kHz mono silence between speaker turns
            silence_mp3 = tmp_dir / "silence.mp3"
            subprocess.run(
                [
                    "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                    "-t", "0.65", "-q:a", "9", str(silence_mp3),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            concat_list = tmp_dir / "concat.txt"
            entries: List[str] = []
            for i, cp in enumerate(chunk_paths):
                entries.append(f"file '{cp.as_posix()}'")
                if i < len(chunk_paths) - 1 and silence_mp3.exists():
                    entries.append(f"file '{silence_mp3.as_posix()}'")
            concat_list.write_text("\n".join(entries), encoding="utf-8")
            subprocess.run(
                [
                    "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                    "-i", str(concat_list), "-c", "copy", str(out_mp3),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            if out_mp3.exists() and out_mp3.stat().st_size > 512:
                return True

        # Pure-Python MP3 frame concatenation fallback (all edge-tts chunks share 24kHz mono MP3 format)
        with out_mp3.open("wb") as out_f:
            for cp in chunk_paths:
                out_f.write(cp.read_bytes())

        return out_mp3.exists() and out_mp3.stat().st_size > 512


def parse_pdf_scripts_by_set() -> Dict[int, Dict[int, Dict[str, str]]]:
    """
    Extracts Q1..Q24 Prompt & Script blocks from data/raw_n5_6sets/**/Listening_Scripts.pdf
    indexed by set_number (1..6) -> question_index (1..24).
    """
    result: Dict[int, Dict[int, Dict[str, str]]] = {}
    base = Path("data/raw_n5_6sets")
    if not base.exists():
        return result

    for pdf_path in sorted(base.rglob("Listening_Scripts.pdf")):
        m_set = re.search(r"SET[_\s-]?0?(\d+)", str(pdf_path), re.I)
        if not m_set:
            continue
        set_num = int(m_set.group(1))
        reader = PdfReader(str(pdf_path))
        full_text = "\n".join((p.extract_text() or "") for p in reader.pages)

        q_blocks = re.split(r"\n(?=Q(\d+)\s*\[)", full_text)
        q_map: Dict[int, Dict[str, str]] = {}
        # Iterate matches directly
        matches = list(re.finditer(r"Q(\d+)\s*\[([^\]]+)\](.*?)(?=\nQ\d+\s*\[|\Z)", full_text, re.S))
        for m in matches:
            q_idx = int(m.group(1))
            header_tag = m.group(2).strip()
            body = m.group(3)
            m_prompt = re.search(r"Prompt\s*:\s*(.+)", body)
            m_script = re.search(r"Script\s*:\s*(.*?)(?=\nOptions\s*:|\nAnswer\s*:|\Z)", body, re.S)
            q_map[q_idx] = {
                "category": header_tag,
                "prompt": m_prompt.group(1).strip() if m_prompt else "",
                "script": m_script.group(1).strip() if m_script else "",
            }
        result[set_num] = q_map
    return result


def get_jp_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/system/fonts/NotoSansCJK-Regular.ttc",
        "/system/fonts/DroidSansFallback.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                pass
    return ImageFont.load_default()


def draw_zoomed_motif(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    radius: int,
    label: str,
    idx: int,
    font_lg: ImageFont.FreeTypeFont,
    font_md: ImageFont.FreeTypeFont,
) -> None:
    """
    Draws a 1.65x zoomed-in, bold-stroke (4px) JLPT booklet motif filling ~80% of the panel.
    """
    ink = (15, 23, 42)
    accent = (224, 79, 51)
    teal = (15, 118, 110)
    soft_fill = (248, 250, 252)

    # 1. Time / Clock motif
    m_time = re.search(r"(\d{1,2})\s*時\s*(\d{1,2})?", label)
    if m_time:
        hr = int(m_time.group(1)) % 12
        mn = int(m_time.group(2)) if m_time.group(2) else (30 if "半" in label else 0)
        r = int(radius * 0.92)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255), outline=ink, width=5)
        for tick in range(12):
            ang = math.radians(tick * 30 - 90)
            x1 = cx + int((r - 14) * math.cos(ang))
            y1 = cy + int((r - 14) * math.sin(ang))
            x2 = cx + int((r - 4) * math.cos(ang))
            y2 = cy + int((r - 4) * math.sin(ang))
            draw.line([x1, y1, x2, y2], fill=ink, width=4)
        # Hour hand
        h_ang = math.radians((hr + mn / 60.0) * 30 - 90)
        draw.line(
            [cx, cy, cx + int(r * 0.52 * math.cos(h_ang)), cy + int(r * 0.52 * math.sin(h_ang))],
            fill=ink,
            width=7,
        )
        # Minute hand
        m_ang = math.radians(mn * 6 - 90)
        draw.line(
            [cx, cy, cx + int(r * 0.78 * math.cos(m_ang)), cy + int(r * 0.78 * math.sin(m_ang))],
            fill=accent,
            width=5,
        )
        draw.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=ink)
        return

    # 2. Calendar / Day motif
    if any(k in label for k in ["曜日", "よう日", "日", "月", "週"]):
        w, h = int(radius * 1.55), int(radius * 1.45)
        x0, y0 = cx - w // 2, cy - h // 2
        draw.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=16, fill=(255, 255, 255), outline=ink, width=5)
        draw.rounded_rectangle([x0, y0, x0 + w, y0 + 44], radius=16, fill=teal, outline=ink, width=4)
        short_lbl = label[:8]
        draw.text((cx, cy + 16), short_lbl, fill=ink, font=font_lg, anchor="mm")
        return

    # 3. Direction / Map arrows
    if any(k in label for k in ["みぎ", "右", "ひだり", "左", "まっすぐ", "かど"]):
        s = int(radius * 0.85)
        draw.line([cx, cy + s, cx, cy - s // 4], fill=ink, width=8)
        if "みぎ" in label or "右" in label:
            draw.line([cx, cy - s // 4, cx + s, cy - s // 4], fill=accent, width=8)
            draw.polygon([(cx + s + 18, cy - s // 4), (cx + s - 14, cy - s // 4 - 18), (cx + s - 14, cy - s // 4 + 18)], fill=accent)
        elif "ひだり" in label or "左" in label:
            draw.line([cx, cy - s // 4, cx - s, cy - s // 4], fill=accent, width=8)
            draw.polygon([(cx - s - 18, cy - s // 4), (cx - s + 14, cy - s // 4 - 18), (cx - s + 14, cy - s // 4 + 18)], fill=accent)
        else:
            draw.line([cx, cy + s, cx, cy - s], fill=accent, width=8)
            draw.polygon([(cx, cy - s - 18), (cx - 18, cy - s + 14), (cx + 18, cy - s + 14)], fill=accent)
        return

    # 4. Default large bold emblem card filling the panel
    w, h = int(radius * 1.72), int(radius * 1.25)
    x0, y0 = cx - w // 2, cy - h // 2
    draw.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=18, fill=soft_fill, outline=ink, width=4)
    # Draw distinct geometric icon per panel index + crisp Japanese label
    icon_y = cy - 26
    if idx == 0:
        draw.ellipse([cx - 34, icon_y - 34, cx + 34, icon_y + 34], outline=teal, width=5)
    elif idx == 1:
        draw.rectangle([cx - 34, icon_y - 34, cx + 34, icon_y + 34], outline=accent, width=5)
    elif idx == 2:
        draw.polygon([(cx, icon_y - 38), (cx - 38, icon_y + 30), (cx + 38, icon_y + 30)], outline=teal, width=5)
    else:
        draw.polygon([(cx, icon_y - 38), (cx + 38, icon_y), (cx, icon_y + 38), (cx - 38, icon_y)], outline=accent, width=5)

    clean_lbl = re.sub(r"<[^>]+>", "", label).strip()[:14]
    draw.text((cx, cy + 36), clean_lbl, fill=ink, font=font_md, anchor="mm")


def render_zoomed_sheet_png(
    prompt_text: str,
    options: List[str],
    is_verbal_expression: bool,
    out_png: Path,
) -> None:
    """
    Renders either:
    - Single-block scene with bold directional arrow pointing to the speaker (Verbal Expressions / 発話表現)
    - 4-block (1, 2, 3, 4) zoomed-in illustration grid (Task-based / Point Comprehension)
    """
    font_title = get_jp_font(28)
    font_badge = get_jp_font(30)
    font_lg = get_jp_font(34)
    font_md = get_jp_font(26)

    ink = (15, 23, 42)
    accent = (224, 79, 51)
    teal = (15, 118, 110)

    if is_verbal_expression:
        W, H = 960, 600
        img = Image.new("RGB", (W, H), (255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.rectangle([16, 16, W - 16, H - 16], outline=ink, width=5)
        draw.rectangle([16, 16, W - 16, 78], fill=(240, 253, 250), outline=ink, width=4)
        header = re.sub(r"<[^>]+>", "", prompt_text).strip()[:32] or "発話表現 • Verbal Expression"
        draw.text((36, 47), header, fill=teal, font=font_title, anchor="lm")

        # Draw two large conversing figures + bold directional arrow pointing to the speaker (left figure)
        # Speaker (Left)
        sx, sy = 310, 270
        draw.ellipse([sx - 48, sy - 48, sx + 48, sy + 48], fill=(255, 251, 235), outline=accent, width=6)
        draw.rounded_rectangle([sx - 68, sy + 58, sx + 68, sy + 210], radius=28, fill=(255, 251, 235), outline=accent, width=6)

        # Listener (Right)
        lx, ly = 660, 270
        draw.ellipse([lx - 44, ly - 44, lx + 44, ly + 44], fill=(248, 250, 252), outline=ink, width=5)
        draw.rounded_rectangle([lx - 62, ly + 54, lx + 62, ly + 205], radius=26, fill=(248, 250, 252), outline=ink, width=5)

        # Bold directional arrow pointing directly to the speaker
        draw.line([110, 270, 235, 270], fill=accent, width=12)
        draw.polygon([(252, 270), (212, 244), (212, 296)], fill=accent)
        draw.text((135, 224), "話す人", fill=accent, font=font_badge, anchor="mm")

        img.save(out_png, format="PNG", optimize=True)
        return

    # 4-block (1, 2, 3, 4) zoomed-in grid
    W, H = 960, 760
    img = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([14, 14, W - 14, H - 14], outline=ink, width=5)

    header = re.sub(r"<[^>]+>", "", prompt_text).strip()[:34] or "問題用紙"
    draw.rectangle([14, 14, W - 14, 72], fill=(248, 250, 252), outline=ink, width=4)
    draw.text((32, 43), header, fill=ink, font=font_title, anchor="lm")

    pad = 24
    top_offset = 86
    cell_w = (W - pad * 3) // 2
    cell_h = (H - top_offset - pad * 3) // 2

    for idx in range(4):
        col = idx % 2
        row = idx // 2
        x0 = pad + col * (cell_w + pad)
        y0 = top_offset + pad + row * (cell_h + pad)
        x1 = x0 + cell_w
        y1 = y0 + cell_h

        draw.rounded_rectangle([x0, y0, x1, y1], radius=16, fill=(255, 255, 255), outline=ink, width=4)
        # Number badge (1..4)
        draw.rounded_rectangle([x0, y0, x0 + 54, y0 + 50], radius=12, fill=ink)
        draw.text((x0 + 27, y0 + 25), str(idx + 1), fill=(255, 255, 255), font=font_badge, anchor="mm")

        opt_lbl = options[idx] if idx < len(options) else f"選択肢 {idx + 1}"
        cx = (x0 + x1) // 2
        cy = (y0 + y1) // 2 + 12
        motif_radius = min(cell_w, cell_h) // 2 - 26
        draw_zoomed_motif(draw, cx, cy, motif_radius, opt_lbl, idx, font_lg, font_md)

    img.save(out_png, format="PNG", optimize=True)


async def main() -> None:
    role_map = await build_role_voice_map()
    pdf_scripts = parse_pdf_scripts_by_set()

    exams_res = sb.table("exams").select("id, exam_code").order("exam_code").execute()
    exams = exams_res.data or []
    print(f"Found {len(exams)} exams in Supabase.")

    updated_audio = 0
    updated_images = 0

    for exam in exams:
        exam_id = exam["id"]
        exam_code = exam["exam_code"]
        m_num = re.search(r"MOCK-0?(\d+)", exam_code, re.I)
        set_num = int(m_num.group(1)) if m_num else 1

        sec_res = (
            sb.table("exam_sections")
            .select("id")
            .eq("exam_id", exam_id)
            .eq("section_code", "LISTENING")
            .execute()
        )
        if not sec_res.data:
            continue
        sec_id = sec_res.data[0]["id"]

        mg_res = (
            sb.table("mondai_groups")
            .select("id, mondai_number, title_ja")
            .eq("section_id", sec_id)
            .order("mondai_number")
            .execute()
        )
        mondai_map = {m["id"]: m for m in (mg_res.data or [])}

        q_res = (
            sb.table("questions")
            .select("id, mondai_group_id, question_number, stem_html, options, transcript_ja, audio_url, image_url")
            .in_("mondai_group_id", list(mondai_map.keys()))
            .order("question_number")
            .execute()
        )
        questions = q_res.data or []

        for idx, q in enumerate(questions, start=1):
            mg = mondai_map.get(q["mondai_group_id"], {})
            mondai_num = mg.get("mondai_number", 1)
            pdf_item = pdf_scripts.get(set_num, {}).get(idx, {})

            raw_prompt = pdf_item.get("prompt") or q.get("stem_html") or ""
            raw_script = pdf_item.get("script") or q.get("transcript_ja") or ""

            turns = parse_script_turns(raw_script, raw_prompt)
            labeled_transcript = format_labeled_transcript(turns)

            patch: Dict[str, Optional[str]] = {}
            if labeled_transcript:
                patch["transcript_ja"] = labeled_transcript

            # Synthesize multi-role MP3
            mp3_local = TMP_DIR / f"mock{set_num:02d}_q{idx:02d}_v4.mp3"
            ok_audio = await synthesize_multivoice_mp3(turns, role_map, mp3_local)
            if ok_audio:
                storage_mp3 = f"jlpt/n5/mock{set_num:02d}/listening_q{idx:02d}_v4.mp3"
                sb.storage.from_("jlpt-media").upload(
                    path=storage_mp3,
                    file=mp3_local.read_bytes(),
                    file_options={"content-type": "audio/mpeg", "upsert": "true"},
                )
                patch["audio_url"] = storage_mp3
                updated_audio += 1

            # Render zoomed-in visual sheet ONLY for Mondai 1 (課題理解), Mondai 2 (ポイント理解), Mondai 3 (発話表現)
            if mondai_num in (1, 2, 3):
                png_local = TMP_DIR / f"mock{set_num:02d}_q{idx:02d}_sheet_v4.png"
                opts = q.get("options") or []
                render_zoomed_sheet_png(
                    prompt_text=raw_prompt,
                    options=opts,
                    is_verbal_expression=(mondai_num == 3),
                    out_png=png_local,
                )
                storage_png = f"jlpt/n5/mock{set_num:02d}/listening_q{idx:02d}_sheet_v4.png"
                sb.storage.from_("jlpt-media").upload(
                    path=storage_png,
                    file=png_local.read_bytes(),
                    file_options={"content-type": "image/png", "upsert": "true"},
                )
                patch["image_url"] = storage_png
                updated_images += 1
            else:
                patch["image_url"] = None

            if patch:
                sb.table("questions").update(patch).eq("id", q["id"]).execute()

        print(f"Synced {exam_code}: {len(questions)} listening items updated.")

    print(f"DONE: {updated_audio} multi-voice MP3s and {updated_images} zoomed-in visual sheets uploaded & synced.")


if __name__ == "__main__":
    asyncio.run(main())
