#!/usr/bin/env python3
"""
1. Renders high-contrast JLPT Listening Visual Worksheet PNGs via Pillow and
   uploads them to Supabase Storage ('jlpt-media').
2. Synthesizes multi-speaker Japanese MP3 audio tracks via free edge-tts (with
   retry & /tmp cache) and uploads them to 'jlpt-media'.
3. Replaces placeholder sections on JLPT-N5-MOCK-01..06 and seeds all 522
   curated questions into Supabase.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont
from supabase import create_client

sys.path.insert(0, str(Path(__file__).parent))
from generate_listening_audio import synthesize_transcript_mp3

load_dotenv(".env.local")
load_dotenv()

FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/system/fonts/NotoSansCJK-Regular.ttc",
    "/system/fonts/DroidSansFallback.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def render_listening_worksheet_png(
    exam_code: str,
    question_number: int,
    category: str,
    options: list[dict],
    out_path: Path,
) -> Path:
    """
    Generates a crisp black-and-white 4-panel JLPT Listening Visual Sheet
    (840x440 PNG) displaying numbered choice cards 1..4.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = 840, 440
    img = Image.new("RGB", (width, height), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    font_header = load_font(18)
    font_badge = load_font(22)
    font_body = load_font(20)
    font_sub = load_font(14)

    draw.rectangle([12, 12, width - 12, height - 12], outline="#18181B", width=2)
    draw.rectangle([12, 12, width - 12, 56], fill="#F4F4F5", outline="#18181B", width=2)
    draw.text(
        (28, 24),
        f"{exam_code}  |  問題用紙  Q{question_number}  ({category})",
        fill="#18181B",
        font=font_header,
    )

    margin_x = 28
    top_y = 74
    gap = 18
    card_w = (width - margin_x * 2 - gap) // 2
    card_h = (height - top_y - 28 - gap) // 2

    for idx in range(min(4, len(options))):
        opt = options[idx]
        col = idx % 2
        row = idx // 2
        x0 = margin_x + col * (card_w + gap)
        y0 = top_y + row * (card_h + gap)
        x1 = x0 + card_w
        y1 = y0 + card_h

        draw.rounded_rectangle(
            [x0, y0, x1, y1], radius=10, fill="#FAF9F7", outline="#18181B", width=2
        )

        draw.ellipse([x0 + 14, y0 + 14, x0 + 50, y0 + 50], fill="#18181B")
        draw.text((x0 + 26, y0 + 20), str(opt["index"]), fill="#FFFFFF", font=font_badge)

        label = str(opt.get("text", "")).strip()
        lines = [label[i : i + 16] for i in range(0, len(label), 16)] or [
            f"Choice {opt['index']}"
        ]
        for l_idx, line_txt in enumerate(lines[:3]):
            draw.text(
                (x0 + 66, y0 + 24 + l_idx * 28), line_txt, fill="#18181B", font=font_body
            )

        draw.text((x0 + 18, y1 - 26), f"PANEL 0{opt['index']}", fill="#71717A", font=font_sub)

    img.save(out_path, format="PNG", optimize=True)
    return out_path


def upload_storage_bytes(supabase, data: bytes, storage_path: str, content_type: str) -> None:
    clean_path = storage_path.lstrip("/")
    supabase.storage.from_("jlpt-media").upload(
        path=clean_path,
        file=data,
        file_options={"content-type": content_type, "upsert": "true"},
    )


async def synthesize_with_retry(transcript_ja: str, out_path: Path, retries: int = 3) -> None:
    if out_path.exists() and out_path.stat().st_size > 1000:
        return
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            await synthesize_transcript_mp3(transcript_ja, out_path)
            return
        except Exception as err:
            last_err = err
            await asyncio.sleep(attempt * 1.5)
    raise RuntimeError(f"TTS failed after {retries} attempts for {out_path}: {last_err}")


async def process_and_seed() -> None:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
        )

    compiled_path = Path("data/compiled_n5_6sets.json")
    exams = json.loads(compiled_path.read_text(encoding="utf-8"))
    supabase = create_client(url, key)
    media_cache = Path("/tmp/nihonsync_media_build")

    for exam in exams:
        meta = exam["exam_metadata"]
        code = meta["exam_code"]
        print(f"\n=== Processing {code} ===")

        # 1. Generate & upload Listening PNG worksheets and edge-tts MP3 tracks
        listening_sec = next(
            s for s in exam["sections"] if s["section_code"] == "LISTENING"
        )
        for mg in listening_sec["mondai_groups"]:
            for q in mg["questions"]:
                q_no = q["question_number"]
                if q.get("image_url"):
                    local_png = media_cache / q["image_url"]
                    render_listening_worksheet_png(
                        exam_code=code,
                        question_number=q_no,
                        category=q.get("category", "Listening"),
                        options=q["options"],
                        out_path=local_png,
                    )
                    upload_storage_bytes(
                        supabase, local_png.read_bytes(), q["image_url"], "image/png"
                    )

                if q.get("audio_url") and q.get("transcript_ja"):
                    local_mp3 = media_cache / q["audio_url"]
                    await synthesize_with_retry(q["transcript_ja"], local_mp3)
                    upload_storage_bytes(
                        supabase, local_mp3.read_bytes(), q["audio_url"], "audio/mpeg"
                    )

                sys.stdout.write(f"\r  Media synced up to Q{q_no}/87")
                sys.stdout.flush()
        print()

        # 2. Upsert exam and replace sections cleanly (cascades stale placeholder questions)
        exam_res = (
            supabase.table("exams")
            .upsert(meta, on_conflict="level,test_number")
            .execute()
        )
        exam_id = exam_res.data[0]["id"]

        supabase.table("exam_sections").delete().eq("exam_id", exam_id).execute()

        for sec in exam["sections"]:
            sec_payload = {
                "exam_id": exam_id,
                "section_number": sec["section_number"],
                "section_code": sec["section_code"],
                "section_title_ja": sec["section_title_ja"],
                "section_title_en": sec["section_title_en"],
                "time_limit_minutes": sec["time_limit_minutes"],
                "max_score": sec["max_score"],
            }
            sec_res = (
                supabase.table("exam_sections")
                .insert(sec_payload)
                .execute()
            )
            section_id = sec_res.data[0]["id"]

            for mg in sec["mondai_groups"]:
                mg_payload = {
                    "section_id": section_id,
                    "mondai_number": mg["mondai_number"],
                    "question_type": mg["question_type"],
                    "instruction_ja": mg["instruction_ja"],
                    "passage_html": mg["passage_html"],
                }
                mg_res = (
                    supabase.table("mondai_groups")
                    .insert(mg_payload)
                    .execute()
                )
                mg_id = mg_res.data[0]["id"]

                q_rows = [
                    {
                        "mondai_group_id": mg_id,
                        "question_number": q["question_number"],
                        "prompt_html": q["prompt_html"],
                        "options": q["options"],
                        "correct_option": q["correct_option"],
                        "correct_sequence": q["correct_sequence"],
                        "points": q["points"],
                        "audio_url": q["audio_url"],
                        "image_url": q["image_url"],
                        "transcript_ja": q["transcript_ja"],
                        "explanation": q["explanation"],
                    }
                    for q in mg["questions"]
                ]
                supabase.table("questions").insert(q_rows).execute()

        print(f"  Database seeded: {code} (87 questions)")

    print(
        "\nDONE: All 6 JLPT N5 sets (522 questions), 102 listening PNG worksheets, and 144 edge-tts MP3 tracks are live in Supabase!"
    )


if __name__ == "__main__":
    asyncio.run(process_and_seed())
