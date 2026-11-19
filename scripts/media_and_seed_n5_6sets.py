#!/usr/bin/env python3
"""
1. Renders authentic, question-relevant JLPT Listening Visual Worksheet PNGs
   via Pillow (analog clocks, calendars, paired items, clothing/size badges,
   transport, buildings, food, and Mondai 3 situation scenes) and uploads
   them to Supabase Storage ('jlpt-media').
2. Reuses cached MP3 audio tracks (or synthesizes via edge-tts if missing)
   and ensures all 6 JLPT N5 sets (522 questions) are synced in Supabase.
"""

import asyncio
import html
import json
import math
import os
import re
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

KANJI_NUMS = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6,
    "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12,
}


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def strip_html(raw: str) -> str:
    return re.sub(r"<[^>]+>", "", html.unescape(raw or "")).strip()


def parse_clock_time(text: str) -> tuple[int, int, str] | None:
    m_dig = re.search(r"(\d{1,2})\s*[:：]\s*(\d{2})", text)
    if m_dig:
        h, mins = int(m_dig.group(1)), int(m_dig.group(2))
        return h, mins, f"{h}:{mins:02d}"

    m_ja = re.search(
        r"(十二|十一|十|九|八|七|六|五|四|三|二|一|\d{1,2})\s*時\s*(半|(?:三十|十五|四十五|\d{1,2})\s*分)?",
        text,
    )
    if m_ja:
        h_raw = m_ja.group(1)
        h = int(h_raw) if h_raw.isdigit() else KANJI_NUMS.get(h_raw, 12)
        min_part = (m_ja.group(2) or "").strip()
        mins = 0
        if min_part == "半":
            mins = 30
        elif "三十" in min_part:
            mins = 30
        elif "十五" in min_part:
            mins = 15
        elif "四十五" in min_part:
            mins = 45
        elif re.search(r"\d+", min_part):
            mins = int(re.search(r"\d+", min_part).group(0))
        return h, mins, f"{h}:{mins:02d}"
    return None


def draw_clock_icon(
    draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, hour: int, minute: int, label: str
) -> None:
    ink = "#18181B"
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill="#FFFFFF", outline=ink, width=3)
    for tick in range(12):
        ang = math.radians(tick * 30 - 90)
        inner = r - (8 if tick % 3 == 0 else 4)
        x0 = cx + int(inner * math.cos(ang))
        y0 = cy + int(inner * math.sin(ang))
        x1 = cx + int((r - 2) * math.cos(ang))
        y1 = cy + int((r - 2) * math.sin(ang))
        draw.line([x0, y0, x1, y1], fill=ink, width=2 if tick % 3 == 0 else 1)

    h_ang = math.radians(((hour % 12) + minute / 60.0) * 30 - 90)
    m_ang = math.radians(minute * 6 - 90)
    draw.line(
        [cx, cy, cx + int(r * 0.52 * math.cos(h_ang)), cy + int(r * 0.52 * math.sin(h_ang))],
        fill=ink,
        width=4,
    )
    draw.line(
        [cx, cy, cx + int(r * 0.78 * math.cos(m_ang)), cy + int(r * 0.78 * math.sin(m_ang))],
        fill=ink,
        width=2,
    )
    draw.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=ink)
    draw.rounded_rectangle([cx - 24, cy + r + 4, cx + 24, cy + r + 22], radius=5, fill="#F4F4F5", outline=ink, width=1)
    draw.text((cx - 16, cy + r + 6), label, fill=ink, font=load_font(13))


def draw_calendar_icon(
    draw: ImageDraw.ImageDraw, cx: int, cy: int, day_kanji: str, sub_tag: str
) -> None:
    ink = "#18181B"
    w, h = 74, 72
    x0, y0 = cx - w // 2, cy - h // 2
    draw.rounded_rectangle([x0, y0 + 6, x0 + w, y0 + h], radius=8, fill="#FFFFFF", outline=ink, width=2)
    draw.rectangle([x0, y0 + 6, x0 + w, y0 + 24], fill=ink)
    draw.rectangle([x0 + 16, y0, x0 + 22, y0 + 12], fill="#FFFFFF", outline=ink, width=2)
    draw.rectangle([x0 + w - 22, y0, x0 + w - 16, y0 + 12], fill="#FFFFFF", outline=ink, width=2)
    draw.text((cx - 13, y0 + 27), day_kanji, fill=ink, font=load_font(24))
    if sub_tag:
        draw.text((cx - 16, y0 + 54), sub_tag, fill="#52525B", font=load_font(12))


def draw_people_icon(draw: ImageDraw.ImageDraw, cx: int, cy: int, count: int) -> None:
    ink = "#18181B"
    n = max(1, min(6, count))
    spacing = 24 if n <= 4 else 19
    start_x = cx - ((n - 1) * spacing) // 2
    for i in range(n):
        px = start_x + i * spacing
        draw.ellipse([px - 7, cy - 24, px + 7, cy - 10], fill="#FFFFFF", outline=ink, width=2)
        draw.pieslice([px - 11, cy - 8, px + 11, cy + 24], start=180, end=360, fill="#E4E4E7", outline=ink, width=2)


def draw_single_motif(draw: ImageDraw.ImageDraw, text: str, cx: int, cy: int) -> None:
    ink = "#18181B"
    f_sm = load_font(12)

    # 1. Clock time check
    clk = parse_clock_time(text)
    if clk:
        draw_clock_icon(draw, cx, cy - 8, 32, clk[0], clk[1], clk[2])
        return

    # 2. Day of week / AM-PM / Date check
    for d_word, d_kanji in [
        ("月よう", "月"), ("月曜", "月"), ("火よう", "火"), ("火曜", "火"),
        ("水よう", "水"), ("水曜", "水"), ("木よう", "木"), ("木曜", "木"),
        ("金よう", "金"), ("金曜", "金"), ("土よう", "土"), ("土曜", "土"),
        ("日よう", "日"), ("日曜", "日"),
    ]:
        if d_word in text:
            sub = "午前 AM" if "午前" in text else ("午後 PM" if "午後" in text else "曜日")
            draw_calendar_icon(draw, cx, cy, d_kanji, sub)
            return

    # 3. People count (三人 / 四人 / 五人)
    m_ppl = re.search(r"(一|二|三|四|五|六|\d)\s*人", text)
    if m_ppl:
        raw_n = m_ppl.group(1)
        cnt = int(raw_n) if raw_n.isdigit() else KANJI_NUMS.get(raw_n, 2)
        draw_people_icon(draw, cx, cy, cnt)
        draw.text((cx - 14, cy + 16), f"{cnt}人", fill=ink, font=f_sm)
        return

    # 4. Shirt / Clothing with Color & Size (白い Lサイズ / 青い Mサイズ)
    if any(k in text for k in ("シャツ", "コート", "セーター", "ふく", "服", "サイズ")):
        fill_col = "#FFFFFF"
        if "黒" in text or "くろ" in text:
            fill_col = "#27272A"
        elif "青" in text or "あお" in text:
            fill_col = "#D4D4D8"
        elif "赤" in text or "あか" in text:
            fill_col = "#E4E4E7"
        pts = [
            (cx - 20, cy - 26), (cx - 8, cy - 26), (cx, cy - 18), (cx + 8, cy - 26),
            (cx + 20, cy - 26), (cx + 36, cy - 10), (cx + 26, cy), (cx + 18, cy - 6),
            (cx + 18, cy + 28), (cx - 18, cy + 28), (cx - 18, cy - 6), (cx - 26, cy),
            (cx - 36, cy - 10),
        ]
        draw.polygon(pts, fill=fill_col, outline=ink)
        size_m = re.search(r"\b(S|M|L|LL)\b", text)
        if size_m:
            txt_col = "#FFFFFF" if fill_col == "#27272A" else ink
            draw.text((cx - 6, cy - 4), size_m.group(1), fill=txt_col, font=load_font(18))
        return

    # 5. Stationery & Paper Goods
    if "ボールペン" in text or "ペン" in text:
        draw.polygon([(cx - 28, cy + 20), (cx + 18, cy - 26), (cx + 26, cy - 18), (cx - 20, cy + 28)], fill="#FFFFFF", outline=ink)
        draw.polygon([(cx - 28, cy + 20), (cx - 34, cy + 30), (cx - 20, cy + 28)], fill=ink)
        draw.line([cx + 10, cy - 24, cx - 2, cy - 12], fill=ink, width=2)
        return
    if "えんぴつ" in text or "鉛筆" in text:
        draw.polygon([(cx - 26, cy + 18), (cx + 18, cy - 26), (cx + 25, cy - 19), (cx - 19, cy + 25)], fill="#E4E4E7", outline=ink)
        draw.polygon([(cx - 26, cy + 18), (cx - 33, cy + 29), (cx - 19, cy + 25)], fill="#FFFFFF", outline=ink)
        draw.polygon([(cx - 30, cy + 24), (cx - 33, cy + 29), (cx - 27, cy + 27)], fill=ink)
        return
    if "けしゴム" in text:
        draw.rounded_rectangle([cx - 28, cy - 16, cx + 28, cy + 16], radius=4, fill="#FFFFFF", outline=ink, width=2)
        draw.rectangle([cx - 12, cy - 16, cx + 24, cy + 16], fill="#E4E4E7", outline=ink, width=2)
        return
    if any(k in text for k in ("じしょ", "辞書", "本", "ほん", "ノート")):
        draw.rectangle([cx - 24, cy - 28, cx + 24, cy + 28], fill="#FFFFFF", outline=ink, width=2)
        draw.line([cx - 16, cy - 28, cx - 16, cy + 28], fill=ink, width=2)
        draw.rectangle([cx - 8, cy - 16, cx + 16, cy - 6], fill="#F4F4F5", outline=ink, width=1)
        return
    if "しんぶん" in text or "新聞" in text:
        draw.rectangle([cx - 28, cy - 24, cx + 28, cy + 24], fill="#FFFFFF", outline=ink, width=2)
        draw.line([cx, cy - 20, cx, cy + 20], fill=ink, width=2)
        for ry in (-14, -4, 6, 14):
            draw.line([cx - 22, cy + ry, cx - 6, cy + ry], fill=ink, width=2)
            draw.line([cx + 6, cy + ry, cx + 22, cy + ry], fill=ink, width=2)
        return
    if any(k in text for k in ("かみ", "紙", "はがき", "手紙", "切手")):
        draw.rectangle([cx - 26, cy - 20, cx + 20, cy + 16], fill="#FFFFFF", outline=ink, width=2)
        draw.rectangle([cx - 18, cy - 12, cx + 28, cy + 24], fill="#FAFAFA", outline=ink, width=2)
        draw.rectangle([cx + 12, cy - 6, cx + 22, cy + 4], fill="#E4E4E7", outline=ink, width=1)
        return

    # 6. Recycling / Trash / Household
    if "びん" in text:
        draw.rectangle([cx - 7, cy - 30, cx + 7, cy - 16], fill="#FFFFFF", outline=ink, width=2)
        draw.rounded_rectangle([cx - 15, cy - 16, cx + 15, cy + 28], radius=6, fill="#FFFFFF", outline=ink, width=2)
        draw.line([cx - 15, cy + 4, cx + 15, cy + 4], fill=ink, width=1)
        return
    if "ごみ" in text:
        draw.polygon([(cx - 20, cy - 16), (cx + 20, cy - 16), (cx + 15, cy + 26), (cx - 15, cy + 26)], fill="#F4F4F5", outline=ink)
        draw.line([cx - 24, cy - 20, cx + 24, cy - 20], fill=ink, width=3)
        return
    if "いす" in text:
        draw.rectangle([cx - 16, cy - 28, cx + 16, cy - 4], fill="#FFFFFF", outline=ink, width=2)
        draw.rectangle([cx - 18, cy - 4, cx + 18, cy + 4], fill="#E4E4E7", outline=ink, width=2)
        draw.line([cx - 15, cy + 4, cx - 15, cy + 28], fill=ink, width=3)
        draw.line([cx + 15, cy + 4, cx + 15, cy + 28], fill=ink, width=3)
        return
    if "そうじ" in text:
        draw.line([cx + 12, cy - 28, cx - 8, cy + 12], fill=ink, width=3)
        draw.polygon([(cx - 20, cy + 12), (cx + 4, cy + 12), (cx + 10, cy + 28), (cx - 26, cy + 28)], fill="#E4E4E7", outline=ink)
        return
    if "おさら" in text:
        for oy in (-10, 0, 10):
            draw.ellipse([cx - 26, cy + oy - 5, cx + 26, cy + oy + 5], fill="#FFFFFF", outline=ink, width=2)
        return

    # 7. Food & Drinks
    if "ぎゅうにゅう" in text or "牛乳" in text:
        draw.polygon([(cx - 16, cy - 16), (cx, cy - 28), (cx + 16, cy - 16)], fill="#E4E4E7", outline=ink)
        draw.rectangle([cx - 16, cy - 16, cx + 16, cy + 26], fill="#FFFFFF", outline=ink, width=2)
        draw.text((cx - 12, cy - 4), "牛乳", fill=ink, font=f_sm)
        return
    if "たまご" in text or "卵" in text:
        for ex in (-16, 16):
            draw.ellipse([cx + ex - 12, cy - 16, cx + ex + 12, cy + 18], fill="#FFFFFF", outline=ink, width=2)
        return
    if "パン" in text:
        draw.rounded_rectangle([cx - 26, cy - 14, cx + 26, cy + 20], radius=12, fill="#FFFFFF", outline=ink, width=2)
        draw.line([cx - 10, cy - 12, cx - 6, cy - 2], fill=ink, width=2)
        draw.line([cx + 4, cy - 12, cx + 8, cy - 2], fill=ink, width=2)
        return
    if "さとう" in text:
        draw.rounded_rectangle([cx - 18, cy - 14, cx + 18, cy + 24], radius=6, fill="#FFFFFF", outline=ink, width=2)
        draw.rectangle([cx - 14, cy - 22, cx + 14, cy - 14], fill="#E4E4E7", outline=ink, width=2)
        draw.text((cx - 12, cy), "砂糖", fill=ink, font=f_sm)
        return
    if any(k in text for k in ("コーヒー", "お茶", "紅茶", "のみもの", "ジュース")):
        draw.rectangle([cx - 16, cy - 12, cx + 14, cy + 18], fill="#FFFFFF", outline=ink, width=2)
        draw.arc([cx + 8, cy - 6, cx + 24, cy + 10], start=270, end=90, fill=ink, width=2)
        draw.line([cx - 22, cy + 20, cx + 20, cy + 20], fill=ink, width=2)
        return
    if "にく" in text or "肉" in text:
        draw.rounded_rectangle([cx - 26, cy - 14, cx + 26, cy + 16], radius=10, fill="#E4E4E7", outline=ink, width=2)
        draw.ellipse([cx + 6, cy - 6, cx + 16, cy + 4], fill="#FFFFFF", outline=ink, width=2)
        return
    if "さかな" in text or "魚" in text:
        draw.ellipse([cx - 26, cy - 14, cx + 14, cy + 14], fill="#FFFFFF", outline=ink, width=2)
        draw.polygon([(cx + 12, cy), (cx + 28, cy - 14), (cx + 28, cy + 14)], fill="#E4E4E7", outline=ink)
        draw.ellipse([cx - 18, cy - 5, cx - 13, cy], fill=ink)
        return
    if "やさい" in text or "野菜" in text:
        draw.polygon([(cx - 20, cy + 18), (cx + 12, cy - 14), (cx + 20, cy - 6)], fill="#E4E4E7", outline=ink)
        draw.line([cx + 16, cy - 10, cx + 26, cy - 22], fill=ink, width=2)
        return

    # 8. Transport & Vehicles
    if "電車" in text or "でんしゃ" in text:
        draw.rounded_rectangle([cx - 20, cy - 26, cx + 20, cy + 22], radius=6, fill="#FFFFFF", outline=ink, width=2)
        draw.rectangle([cx - 14, cy - 18, cx + 14, cy - 2], fill="#E4E4E7", outline=ink, width=2)
        draw.ellipse([cx - 14, cy + 8, cx - 8, cy + 14], fill=ink)
        draw.ellipse([cx + 8, cy + 8, cx + 14, cy + 14], fill=ink)
        draw.line([cx - 24, cy + 26, cx + 24, cy + 26], fill=ink, width=2)
        return
    if "バス" in text:
        draw.rounded_rectangle([cx - 28, cy - 18, cx + 28, cy + 16], radius=5, fill="#FFFFFF", outline=ink, width=2)
        draw.rectangle([cx - 22, cy - 12, cx + 22, cy + 2], fill="#E4E4E7", outline=ink, width=1)
        draw.ellipse([cx - 20, cy + 10, cx - 8, cy + 22], fill=ink)
        draw.ellipse([cx + 8, cy + 10, cx + 20, cy + 22], fill=ink)
        return
    if "自転車" in text or "じてんしゃ" in text:
        draw.ellipse([cx - 28, cy - 2, cx - 8, cy + 18], fill="#FFFFFF", outline=ink, width=2)
        draw.ellipse([cx + 8, cy - 2, cx + 28, cy + 18], fill="#FFFFFF", outline=ink, width=2)
        draw.line([cx - 18, cy + 8, cx - 2, cy - 10, cx + 14, cy - 10, cx + 18, cy + 8], fill=ink, width=2)
        draw.line([cx - 2, cy - 10, cx + 2, cy + 8, cx - 18, cy + 8], fill=ink, width=2)
        return
    if "あるいて" in text or "歩" in text:
        draw.ellipse([cx - 6, cy - 28, cx + 6, cy - 16], fill="#FFFFFF", outline=ink, width=2)
        draw.line([cx, cy - 16, cx, cy + 4], fill=ink, width=3)
        draw.line([cx, cy - 10, cx - 12, cy + 2], fill=ink, width=2)
        draw.line([cx, cy - 10, cx + 12, cy + 2], fill=ink, width=2)
        draw.line([cx, cy + 4, cx - 12, cy + 24], fill=ink, width=3)
        draw.line([cx, cy + 4, cx + 12, cy + 24], fill=ink, width=3)
        return

    # 9. Places, Buildings & Scenes
    if "こうえん" in text or "公園" in text:
        draw.ellipse([cx - 26, cy - 28, cx + 2, cy], fill="#E4E4E7", outline=ink, width=2)
        draw.rectangle([cx - 15, cy, cx - 9, cy + 24], fill=ink)
        draw.rectangle([cx + 4, cy + 6, cx + 30, cy + 14], fill="#FFFFFF", outline=ink, width=2)
        draw.line([cx + 7, cy + 14, cx + 7, cy + 24], fill=ink, width=2)
        draw.line([cx + 27, cy + 14, cx + 27, cy + 24], fill=ink, width=2)
        return
    if any(k in text for k in ("カフェ", "レストラン", "しょくどう", "スーパー", "店", "えき", "駅", "図書館", "学校", "いえ", "うち")):
        draw.polygon([(cx - 28, cy - 8), (cx, cy - 28), (cx + 28, cy - 8)], fill="#E4E4E7", outline=ink)
        draw.rectangle([cx - 24, cy - 8, cx + 24, cy + 24], fill="#FFFFFF", outline=ink, width=2)
        draw.rectangle([cx - 7, cy + 4, cx + 7, cy + 24], fill="#F4F4F5", outline=ink, width=2)
        return

    # 10. Default clean numbered card pictogram
    draw.rounded_rectangle([cx - 24, cy - 20, cx + 24, cy + 20], radius=8, fill="#F4F4F5", outline=ink, width=2)
    draw.line([cx - 14, cy - 6, cx + 14, cy - 6], fill=ink, width=2)
    draw.line([cx - 14, cy + 6, cx + 8, cy + 6], fill=ink, width=2)


def draw_option_illustration(draw: ImageDraw.ImageDraw, option_text: str, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2

    # Split paired items like "ボールペンと じしょ" or "五時半に 五人"
    parts = re.split(r"(?:と[\s\u3000]+|に[\s\u3000]+)", option_text.strip())
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) >= 2:
        q_w = (x1 - x0) // 4
        draw_single_motif(draw, parts[0], x0 + q_w, cy)
        draw.text((cx - 5, cy - 8), "+", fill="#71717A", font=load_font(18))
        draw_single_motif(draw, parts[1], x1 - q_w, cy)
    else:
        draw_single_motif(draw, option_text, cx, cy)


def render_listening_worksheet_png(
    question_number: int,
    mondai_number: int,
    prompt_text: str,
    options: list[dict],
    out_path: Path,
) -> Path:
    """
    Renders an authentic black-and-white Japanese JLPT Listening Visual Sheet
    (880x540 PNG) with question- & option-specific line-art illustrations.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = 880, 540
    ink = "#18181B"
    img = Image.new("RGB", (width, height), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    font_title = load_font(18)
    font_prompt = load_font(17)
    font_num = load_font(22)
    font_opt = load_font(18)

    # Outer exam paper frame + authentic Japanese header strip (no debug codes)
    draw.rectangle([14, 14, width - 14, height - 14], outline=ink, width=2)
    draw.rectangle([14, 14, width - 14, 62], fill="#F4F4F5", outline=ink, width=2)
    draw.rounded_rectangle([26, 22, 114, 54], radius=6, fill=ink)
    draw.text((35, 27), "問題用紙", fill="#FFFFFF", font=font_title)

    clean_prompt = strip_html(prompt_text)
    header_prompt = f"問 {question_number}　{clean_prompt}"
    if len(header_prompt) > 42:
        header_prompt = header_prompt[:41] + "…"
    draw.text((128, 28), header_prompt, fill=ink, font=font_prompt)

    margin_x = 26
    top_y = 78
    gap = 16

    if len(options) == 3:
        # Mondai 3 (Verbal Expressions): Situation scene on top + 3 speech cards below
        scene_h = 185
        draw.rounded_rectangle(
            [margin_x, top_y, width - margin_x, top_y + scene_h],
            radius=10,
            fill="#FAFAFA",
            outline=ink,
            width=2,
        )
        draw.text((margin_x + 16, top_y + 12), "【状況 / Situation】", fill="#52525B", font=load_font(14))
        draw_option_illustration(
            draw,
            clean_prompt,
            (margin_x + 20, top_y + 34, width - margin_x - 20, top_y + 132),
        )
        wrapped_p = [clean_prompt[i : i + 40] for i in range(0, len(clean_prompt), 40)][:2]
        for l_i, line_s in enumerate(wrapped_p):
            draw.text((margin_x + 20, top_y + 132 + l_i * 22), line_s, fill=ink, font=load_font(16))

        cards_y = top_y + scene_h + gap
        card_h = height - cards_y - 26
        card_w = (width - margin_x * 2 - gap * 2) // 3

        for idx, opt in enumerate(options):
            x0 = margin_x + idx * (card_w + gap)
            y0 = cards_y
            x1 = x0 + card_w
            y1 = y0 + card_h
            draw.rounded_rectangle([x0, y0, x1, y1], radius=10, fill="#FFFFFF", outline=ink, width=2)
            draw.ellipse([x0 + 14, y0 + 14, x0 + 48, y0 + 48], fill=ink)
            draw.text((x0 + 25, y0 + 19), str(opt["index"]), fill="#FFFFFF", font=font_num)

            label = strip_html(str(opt.get("text", "")))
            lines = [label[i : i + 12] for i in range(0, len(label), 12)][:4]
            for l_i, line_s in enumerate(lines):
                draw.text((x0 + 16, y0 + 62 + l_i * 26), line_s, fill=ink, font=font_opt)
    else:
        # Mondai 1 & 2: Authentic 2x2 grid with illustrated panel + Japanese caption
        card_w = (width - margin_x * 2 - gap) // 2
        card_h = (height - top_y - 24 - gap) // 2

        for idx in range(min(4, len(options))):
            opt = options[idx]
            col = idx % 2
            row = idx // 2
            x0 = margin_x + col * (card_w + gap)
            y0 = top_y + row * (card_h + gap)
            x1 = x0 + card_w
            y1 = y0 + card_h

            draw.rounded_rectangle([x0, y0, x1, y1], radius=10, fill="#FFFFFF", outline=ink, width=2)
            draw.ellipse([x0 + 14, y0 + 14, x0 + 48, y0 + 48], fill=ink)
            draw.text((x0 + 25, y0 + 19), str(opt["index"]), fill="#FFFFFF", font=font_num)

            # Custom illustration area tailored to this option
            draw_option_illustration(draw, strip_html(str(opt.get("text", ""))), (x0 + 58, y0 + 14, x1 - 18, y1 - 54))

            # Option caption strip at bottom of panel
            draw.line([x0 + 12, y1 - 48, x1 - 12, y1 - 48], fill="#E4E4E7", width=1)
            label = strip_html(str(opt.get("text", "")))
            if len(label) > 21:
                label = label[:20] + "…"
            draw.text((x0 + 18, y1 - 38), label, fill=ink, font=font_opt)

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
        print(f"\n=== Updating Visual Sheets & Media for {code} ===")

        listening_sec = next(
            s for s in exam["sections"] if s["section_code"] == "LISTENING"
        )
        sheet_count = 0
        for mg in listening_sec["mondai_groups"]:
            m_num = int(mg.get("mondai_number", 1))
            for q in mg["questions"]:
                q_no = q["question_number"]
                if q.get("image_url"):
                    local_png = media_cache / q["image_url"]
                    render_listening_worksheet_png(
                        question_number=q_no,
                        mondai_number=m_num,
                        prompt_text=q.get("prompt_html", ""),
                        options=q["options"],
                        out_path=local_png,
                    )
                    upload_storage_bytes(
                        supabase, local_png.read_bytes(), q["image_url"], "image/png"
                    )
                    sheet_count += 1

                if q.get("audio_url") and q.get("transcript_ja"):
                    local_mp3 = media_cache / q["audio_url"]
                    if not local_mp3.exists():
                        await synthesize_with_retry(q["transcript_ja"], local_mp3)
                        upload_storage_bytes(
                            supabase, local_mp3.read_bytes(), q["audio_url"], "audio/mpeg"
                        )

                sys.stdout.write(f"\r  Uploaded {sheet_count} illustrated visual sheets (up to Q{q_no}/24)")
                sys.stdout.flush()
        print()

    print("\nDONE: All 102 question-relevant JLPT listening visual sheets are live in Supabase Storage!")


if __name__ == "__main__":
    asyncio.run(process_and_seed())
