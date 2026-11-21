#!/usr/bin/env python3
"""
Adds deterministic monochrome JLPT analog clock insets (with exact hour and
minute hands parsed from Japanese option text) to scripts/generate_jlpt_v10_exact_refs.py
and stamps them onto already-generated v10 time-question sheets in Set 01.
"""

import html
import json
import math
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from PIL import Image, ImageDraw
from supabase import create_client

load_dotenv(dotenv_path=".env.local")
load_dotenv()

KANJI_NUM_MAP: Dict[str, int] = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6,
    "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12,
}


def clean_option_text(raw: str) -> str:
    no_rt = re.sub(r"<rt[^>]*>.*?</rt>", "", raw or "", flags=re.I | re.S)
    return re.sub(r"<[^>]+>", "", html.unescape(no_rt)).strip()


def parse_japanese_clock_time(text: str) -> Optional[Tuple[int, int]]:
    cleaned = clean_option_text(text)

    # 1. Explicit digital HH:MM format
    m_colon = re.search(r"\b(\d{1,2})\s*[:：]\s*(\d{2})\b", cleaned)
    if m_colon:
        return int(m_colon.group(1)), int(m_colon.group(2))

    # 2. Japanese hour + optional minute (e.g. 六時半, 五時, 7時15分)
    m_ja = re.search(
        r"(十二|十一|十|九|八|七|六|五|四|三|二|一|\d{1,2})\s*時"
        r"(?:\s*(半|(?:[二三四五]?十)?[一二三四五六七八九]?\s*分|\d{1,2}\s*分))?",
        cleaned,
    )
    if not m_ja:
        return None

    h_raw = m_ja.group(1)
    hour = int(h_raw) if h_raw.isdigit() else KANJI_NUM_MAP.get(h_raw, 12)
    min_raw = (m_ja.group(2) or "").strip()

    minute = 0
    if min_raw == "半":
        minute = 30
    elif min_raw:
        m_digits = re.search(r"\d+", min_raw)
        if m_digits:
            minute = int(m_digits.group(0))
        else:
            m_clean = min_raw.replace("分", "").strip()
            if "十" in m_clean:
                parts = m_clean.split("十")
                tens = KANJI_NUM_MAP.get(parts[0], 1) if parts[0] else 1
                ones = KANJI_NUM_MAP.get(parts[1], 0) if len(parts) > 1 and parts[1] else 0
                minute = tens * 10 + ones
            else:
                minute = KANJI_NUM_MAP.get(m_clean, 0)

    return hour, minute


def draw_jlpt_clock_badge(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    radius: int,
    hour: int,
    minute: int,
) -> None:
    ink = "#141414"
    # Clean white backing plate with crisp black border
    pad = 6
    draw.rounded_rectangle(
        [cx - radius - pad, cy - radius - pad, cx + radius + pad, cy + radius + pad],
        radius=10,
        fill="#FFFFFF",
        outline=ink,
        width=2,
    )
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill="#FFFFFF",
        outline=ink,
        width=3,
    )

    # 12 dial tick marks
    for tick in range(12):
        angle = math.radians(tick * 30 - 90)
        inner_r = radius - (9 if tick % 3 == 0 else 5)
        outer_r = radius - 2
        x0 = cx + int(round(inner_r * math.cos(angle)))
        y0 = cy + int(round(inner_r * math.sin(angle)))
        x1 = cx + int(round(outer_r * math.cos(angle)))
        y1 = cy + int(round(outer_r * math.sin(angle)))
        draw.line([(x0, y0), (x1, y1)], fill=ink, width=3 if tick % 3 == 0 else 2)

    # Hour hand (shorter, thicker) & Minute hand (longer, crisp)
    h_angle = math.radians(((hour % 12) + minute / 60.0) * 30.0 - 90.0)
    m_angle = math.radians(minute * 6.0 - 90.0)

    hx = cx + int(round(radius * 0.52 * math.cos(h_angle)))
    hy = cy + int(round(radius * 0.52 * math.sin(h_angle)))
    mx = cx + int(round(radius * 0.78 * math.cos(m_angle)))
    my = cy + int(round(radius * 0.78 * math.sin(m_angle)))

    draw.line([(cx, cy), (hx, hy)], fill=ink, width=5)
    draw.line([(cx, cy), (mx, my)], fill=ink, width=3)
    draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=ink)


def inject_clock_support_into_v10() -> None:
    v10_path = Path("scripts/generate_jlpt_v10_exact_refs.py")
    src = v10_path.read_text(encoding="utf-8")
    if "draw_jlpt_clock_badge" in src:
        print("v10 generator already includes draw_jlpt_clock_badge.")
        return

    src = src.replace("import io\n", "import io\nimport math\n", 1)

    helper_code = '''
KANJI_NUM_MAP: Dict[str, int] = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6,
    "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12,
}


def parse_japanese_clock_time(text: str) -> Optional[Tuple[int, int]]:
    cleaned = clean_text(text)
    m_colon = re.search(r"\\b(\\d{1,2})\\s*[:：]\\s*(\\d{2})\\b", cleaned)
    if m_colon:
        return int(m_colon.group(1)), int(m_colon.group(2))
    m_ja = re.search(
        r"(十二|十一|十|九|八|七|六|五|四|三|二|一|\\d{1,2})\\s*時"
        r"(?:\\s*(半|(?:[二三四五]?十)?[一二三四五六七八九]?\\s*分|\\d{1,2}\\s*分))?",
        cleaned,
    )
    if not m_ja:
        return None
    h_raw = m_ja.group(1)
    hour = int(h_raw) if h_raw.isdigit() else KANJI_NUM_MAP.get(h_raw, 12)
    min_raw = (m_ja.group(2) or "").strip()
    minute = 0
    if min_raw == "半":
        minute = 30
    elif min_raw:
        m_digits = re.search(r"\\d+", min_raw)
        if m_digits:
            minute = int(m_digits.group(0))
        else:
            m_clean = min_raw.replace("分", "").strip()
            if "十" in m_clean:
                parts = m_clean.split("十")
                tens = KANJI_NUM_MAP.get(parts[0], 1) if parts[0] else 1
                ones = KANJI_NUM_MAP.get(parts[1], 0) if len(parts) > 1 and parts[1] else 0
                minute = tens * 10 + ones
            else:
                minute = KANJI_NUM_MAP.get(m_clean, 0)
    return hour, minute


def draw_jlpt_clock_badge(
    draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, hour: int, minute: int
) -> None:
    ink = "#141414"
    pad = 6
    draw.rounded_rectangle(
        [cx - radius - pad, cy - radius - pad, cx + radius + pad, cy + radius + pad],
        radius=10,
        fill="#FFFFFF",
        outline=ink,
        width=2,
    )
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill="#FFFFFF",
        outline=ink,
        width=3,
    )
    for tick in range(12):
        angle = math.radians(tick * 30 - 90)
        inner_r = radius - (9 if tick % 3 == 0 else 5)
        outer_r = radius - 2
        draw.line(
            [
                (cx + int(round(inner_r * math.cos(angle))), cy + int(round(inner_r * math.sin(angle)))),
                (cx + int(round(outer_r * math.cos(angle))), cy + int(round(outer_r * math.sin(angle)))),
            ],
            fill=ink,
            width=3 if tick % 3 == 0 else 2,
        )
    h_angle = math.radians(((hour % 12) + minute / 60.0) * 30.0 - 90.0)
    m_angle = math.radians(minute * 6.0 - 90.0)
    draw.line(
        [(cx, cy), (cx + int(round(radius * 0.52 * math.cos(h_angle))), cy + int(round(radius * 0.52 * math.sin(h_angle))))],
        fill=ink,
        width=5,
    )
    draw.line(
        [(cx, cy), (cx + int(round(radius * 0.78 * math.cos(m_angle))), cy + int(round(radius * 0.78 * math.sin(m_angle))))],
        fill=ink,
        width=3,
    )
    draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=ink)
'''

    src = src.replace("def compose_four_block_sheet(", helper_code + "\n\ndef compose_four_block_sheet(", 1)
    src = src.replace(
        "def compose_four_block_sheet(panel_images: List[Image.Image], out_path: Path) -> None:",
        "def compose_four_block_sheet(panel_images: List[Image.Image], options: List[Dict[str, Any]], out_path: Path) -> None:",
        1,
    )
    src = src.replace(
        '        draw.text((x0 + 14, y0 + 8), str(idx + 1), fill="#141414", font=num_font)',
        '        draw.text((x0 + 14, y0 + 8), str(idx + 1), fill="#141414", font=num_font)\n'
        '        if idx < len(options):\n'
        '            tm = parse_japanese_clock_time(options[idx].get("text", ""))\n'
        '            if tm is not None:\n'
        '                draw_jlpt_clock_badge(draw, x1 - 54, y0 + 54, 40, tm[0], tm[1])',
        1,
    )
    src = src.replace(
        "compose_four_block_sheet(panels, local_png)",
        "compose_four_block_sheet(panels, q[\"options\"], local_png)",
        1,
    )
    v10_path.write_text(src, encoding="utf-8")
    print("Patched scripts/generate_jlpt_v10_exact_refs.py with analog clock overlay.")


def stamp_existing_set01_time_sheets() -> None:
    sb = create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    exams = json.loads(Path("data/compiled_n5_6sets.json").read_text(encoding="utf-8"))
    mock1 = next(e for e in exams if e["exam_metadata"]["exam_code"] == "JLPT-N5-MOCK-01")
    listening_sec = next(s for s in mock1["sections"] if s["section_code"] == "LISTENING")

    W, H = 1000, 760
    margin, gap = 12, 14
    box_w = (W - margin * 2 - gap) // 2
    box_h = (H - margin * 2 - gap) // 2

    local_idx = 0
    patched_count = 0
    for mg in listening_sec["mondai_groups"]:
        for q in mg["questions"]:
            local_idx += 1
            if local_idx > 12:
                continue
            opts = q.get("options") or []
            parsed_times = [parse_japanese_clock_time(o.get("text", "")) for o in opts[:4]]
            if not any(parsed_times):
                continue

            storage_path = f"jlpt/n5/mock01/listening_q{local_idx}_sheet_v10.png"
            local_png = Path("data/generated_listening_sheets_v10") / storage_path
            if not local_png.exists():
                continue

            img = Image.open(local_png).convert("RGB")
            draw = ImageDraw.Draw(img)
            for idx, tm in enumerate(parsed_times):
                if tm is None:
                    continue
                col, row = idx % 2, idx // 2
                x0 = margin + col * (box_w + gap)
                y0 = margin + row * (box_h + gap)
                x1 = x0 + box_w
                draw_jlpt_clock_badge(draw, x1 - 54, y0 + 54, 40, tm[0], tm[1])

            img.save(local_png, format="PNG", optimize=True)
            payload = local_png.read_bytes()
            for attempt in range(4):
                try:
                    sb.storage.from_("jlpt-media").upload(
                        path=storage_path,
                        file=payload,
                        file_options={"content-type": "image/png", "upsert": "true"},
                    )
                    break
                except Exception:
                    if attempt == 3:
                        raise
                    time.sleep(1.5 * (attempt + 1))

            patched_count += 1
            print(f"Stamped analog clock badges onto JLPT-N5-MOCK-01 Q{local_idx} -> {storage_path}")

    print(f"DONE: Stamped crisp analog clock badges onto {patched_count} time-related sheets in Mock Test 01.")


if __name__ == "__main__":
    inject_clock_support_into_v10()
    stamp_existing_set01_time_sheets()
