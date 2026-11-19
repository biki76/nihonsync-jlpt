#!/usr/bin/env python3
"""
Renders authentic JLPT Listening Visual Sheets matching official booklet layouts:
1. Task-based comprehension (課題理解) & Point comprehension (ポイント理解):
   -> Four large numbered boxes (1, 2, 3, 4) in a 960x760 grid, each filled
      with a large, distinct line-art illustration (action, object, clock,
      calendar, map/direction, clothing, transport, or sequence).
2. Verbal expressions (発話表現):
   -> Single large scene illustration (960x620) depicting the situation and
      characters, with a bold arrow pointing directly to the person who is
      about to speak (no option boxes inside the sheet).
3. Quick response (即時応答) & all other listening types:
   -> Audio-only (image_url = None).
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


def classify_visual_layout(category: str, question_type: str) -> str | None:
    """
    Returns:
      - 'four_block' for Task-based comprehension (課題理解) & Point comprehension (ポイント理解)
      - 'single_scene' for Verbal expressions (発話表現)
      - None for Quick response (即時応答) and all other listening items
    """
    combined = f"{category} {question_type}".strip().lower()
    if any(
        k in combined
        for k in (
            "task-based comprehension",
            "task_based_comprehension",
            "課題理解",
            "comprehension of key points",
            "point comprehension",
            "point_comprehension",
            "comprehension_of_key_points",
            "ポイント理解",
        )
    ):
        return "four_block"
    if any(
        k in combined
        for k in ("verbal expressions", "verbal_expressions", "発話表現")
    ):
        return "single_scene"
    return None


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
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill="#FFFFFF", outline=ink, width=4)
    for tick in range(12):
        ang = math.radians(tick * 30 - 90)
        inner = r - (14 if tick % 3 == 0 else 7)
        x0 = cx + int(inner * math.cos(ang))
        y0 = cy + int(inner * math.sin(ang))
        x1 = cx + int((r - 3) * math.cos(ang))
        y1 = cy + int((r - 3) * math.sin(ang))
        draw.line([x0, y0, x1, y1], fill=ink, width=3 if tick % 3 == 0 else 2)

    f_num = load_font(16)
    draw.text((cx - 9, cy - r + 13), "12", fill=ink, font=f_num)
    draw.text((cx + r - 23, cy - 9), "3", fill=ink, font=f_num)
    draw.text((cx - 5, cy + r - 28), "6", fill=ink, font=f_num)
    draw.text((cx - r + 14, cy - 9), "9", fill=ink, font=f_num)

    h_ang = math.radians(((hour % 12) + minute / 60.0) * 30 - 90)
    m_ang = math.radians(minute * 6 - 90)
    draw.line(
        [cx, cy, cx + int(r * 0.50 * math.cos(h_ang)), cy + int(r * 0.50 * math.sin(h_ang))],
        fill=ink,
        width=7,
    )
    draw.line(
        [cx, cy, cx + int(r * 0.78 * math.cos(m_ang)), cy + int(r * 0.78 * math.sin(m_ang))],
        fill=ink,
        width=4,
    )
    draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=ink)

    draw.rounded_rectangle(
        [cx - 42, cy + r + 8, cx + 42, cy + r + 36],
        radius=8,
        fill="#F4F4F5",
        outline=ink,
        width=2,
    )
    draw.text((cx - 25, cy + r + 11), label, fill=ink, font=load_font(20))


def draw_calendar_icon(
    draw: ImageDraw.ImageDraw, cx: int, cy: int, day_kanji: str, sub_tag: str
) -> None:
    ink = "#18181B"
    w, h = 148, 144
    x0, y0 = cx - w // 2, cy - h // 2
    draw.rounded_rectangle([x0, y0 + 14, x0 + w, y0 + h], radius=12, fill="#FFFFFF", outline=ink, width=4)
    draw.rectangle([x0, y0 + 14, x0 + w, y0 + 48], fill=ink)
    draw.rectangle([x0 + 30, y0, x0 + 44, y0 + 24], fill="#FFFFFF", outline=ink, width=3)
    draw.rectangle([x0 + w - 44, y0, x0 + w - 30, y0 + 24], fill="#FFFFFF", outline=ink, width=3)
    draw.text((cx - 26, y0 + 52), day_kanji, fill=ink, font=load_font(52))
    if sub_tag:
        draw.text((cx - 32, y0 + 110), sub_tag, fill="#52525B", font=load_font(18))


def draw_people_icon(draw: ImageDraw.ImageDraw, cx: int, cy: int, count: int) -> None:
    ink = "#18181B"
    n = max(1, min(6, count))
    spacing = 42 if n <= 4 else 33
    start_x = cx - ((n - 1) * spacing) // 2
    for i in range(n):
        px = start_x + i * spacing
        draw.ellipse([px - 13, cy - 48, px + 13, cy - 22], fill="#FFFFFF", outline=ink, width=3)
        draw.pieslice(
            [px - 20, cy - 16, px + 20, cy + 44],
            start=180,
            end=360,
            fill="#E4E4E7",
            outline=ink,
            width=3,
        )


def draw_map_direction_icon(draw: ImageDraw.ImageDraw, text: str, cx: int, cy: int) -> bool:
    if not any(k in text for k in ("まっすぐ", "まがり", "右", "左", "みぎ", "ひだり", "かど", "コーナー")):
        return False
    ink = "#18181B"
    # Draw street grid
    draw.rectangle([cx - 85, cy - 70, cx + 85, cy + 70], fill="#FAFAFA", outline=ink, width=2)
    # Vertical road
    draw.rectangle([cx - 18, cy - 70, cx + 18, cy + 70], fill="#E4E4E7", outline=ink, width=2)
    # Cross streets (1st and 2nd corner)
    draw.rectangle([cx - 85, cy + 12, cx + 85, cy + 36], fill="#E4E4E7", outline=ink, width=2)
    draw.rectangle([cx - 85, cy - 44, cx + 85, cy - 20], fill="#E4E4E7", outline=ink, width=2)

    is_second = "ふたつ" in text or "2つ" in text or "二" in text
    turn_y = cy - 32 if is_second else cy + 24
    go_right = "右" in text or "みぎ" in text

    # Route arrow
    draw.line([cx, cy + 64, cx, turn_y], fill=ink, width=6)
    if go_right:
        draw.line([cx, turn_y, cx + 62, turn_y], fill=ink, width=6)
        draw.polygon([(cx + 74, turn_y), (cx + 54, turn_y - 12), (cx + 54, turn_y + 12)], fill=ink)
    else:
        draw.line([cx, turn_y, cx - 62, turn_y], fill=ink, width=6)
        draw.polygon([(cx - 74, turn_y), (cx - 54, turn_y - 12), (cx - 54, turn_y + 12)], fill=ink)
    return True


def draw_single_motif(draw: ImageDraw.ImageDraw, text: str, cx: int, cy: int) -> None:
    ink = "#18181B"
    f_lg = load_font(20)

    # 1. Clock time
    clk = parse_clock_time(text)
    if clk:
        draw_clock_icon(draw, cx, cy - 14, 72, clk[0], clk[1], clk[2])
        return

    # 2. Map & directions
    if draw_map_direction_icon(draw, text, cx, cy):
        return

    # 3. Day of week / Date / AM-PM
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

    # 4. People count
    m_ppl = re.search(r"(一|二|三|四|五|六|\d)\s*人", text)
    if m_ppl:
        raw_n = m_ppl.group(1)
        cnt = int(raw_n) if raw_n.isdigit() else KANJI_NUMS.get(raw_n, 2)
        draw_people_icon(draw, cx, cy - 10, cnt)
        draw.text((cx - 22, cy + 40), f"{cnt}人", fill=ink, font=f_lg)
        return

    # 5. Shirt / Clothing with Color & Size
    if any(k in text for k in ("シャツ", "コート", "セーター", "ふく", "服", "サイズ")):
        fill_col = "#FFFFFF"
        if "黒" in text or "くろ" in text:
            fill_col = "#27272A"
        elif "青" in text or "あお" in text:
            fill_col = "#D4D4D8"
        elif "赤" in text or "あか" in text:
            fill_col = "#E4E4E7"
        pts = [
            (cx - 42, cy - 58), (cx - 16, cy - 58), (cx, cy - 42), (cx + 16, cy - 58),
            (cx + 42, cy - 58), (cx + 78, cy - 22), (cx + 58, cy + 4), (cx + 38, cy - 14),
            (cx + 38, cy + 64), (cx - 38, cy + 64), (cx - 38, cy - 14), (cx - 58, cy + 4),
            (cx - 78, cy - 22),
        ]
        draw.polygon(pts, fill=fill_col, outline=ink)
        size_m = re.search(r"\b(S|M|L|LL)\b", text)
        if size_m:
            txt_col = "#FFFFFF" if fill_col == "#27272A" else ink
            draw.text((cx - 14, cy - 12), size_m.group(1), fill=txt_col, font=load_font(38))
        return

    # 6. Stationery & Paper Goods
    if "ボールペン" in text or "ペン" in text:
        draw.polygon([(cx - 56, cy + 44), (cx + 38, cy - 50), (cx + 54, cy - 34), (cx - 40, cy + 60)], fill="#FFFFFF", outline=ink)
        draw.polygon([(cx - 56, cy + 44), (cx - 70, cy + 66), (cx - 40, cy + 60)], fill=ink)
        draw.line([cx + 22, cy - 48, cx - 6, cy - 20], fill=ink, width=4)
        return
    if "えんぴつ" in text or "鉛筆" in text:
        draw.polygon([(cx - 54, cy + 38), (cx + 38, cy - 54), (cx + 52, cy - 40), (cx - 40, cy + 52)], fill="#E4E4E7", outline=ink)
        draw.polygon([(cx - 54, cy + 38), (cx - 68, cy + 62), (cx - 40, cy + 52)], fill="#FFFFFF", outline=ink)
        draw.polygon([(cx - 62, cy + 52), (cx - 68, cy + 62), (cx - 54, cy + 57)], fill=ink)
        return
    if "けしゴム" in text:
        draw.rounded_rectangle([cx - 60, cy - 34, cx + 60, cy + 34], radius=8, fill="#FFFFFF", outline=ink, width=4)
        draw.rectangle([cx - 24, cy - 34, cx + 52, cy + 34], fill="#E4E4E7", outline=ink, width=4)
        return
    if any(k in text for k in ("じしょ", "辞書", "本", "ほん", "ノート")):
        draw.rectangle([cx - 52, cy - 60, cx + 52, cy + 60], fill="#FFFFFF", outline=ink, width=4)
        draw.line([cx - 32, cy - 60, cx - 32, cy + 60], fill=ink, width=4)
        draw.rectangle([cx - 16, cy - 34, cx + 36, cy - 12], fill="#F4F4F5", outline=ink, width=2)
        return
    if "しんぶん" in text or "新聞" in text:
        draw.rectangle([cx - 60, cy - 52, cx + 60, cy + 52], fill="#FFFFFF", outline=ink, width=4)
        draw.line([cx, cy - 44, cx, cy + 44], fill=ink, width=4)
        for ry in (-30, -10, 10, 30):
            draw.line([cx - 46, cy + ry, cx - 14, cy + ry], fill=ink, width=4)
            draw.line([cx + 14, cy + ry, cx + 46, cy + ry], fill=ink, width=4)
        return
    if any(k in text for k in ("かみ", "紙", "はがき", "手紙", "切手")):
        draw.rectangle([cx - 58, cy - 44, cx + 44, cy + 36], fill="#FFFFFF", outline=ink, width=4)
        draw.rectangle([cx - 38, cy - 24, cx + 60, cy + 52], fill="#FAFAFA", outline=ink, width=4)
        draw.rectangle([cx + 24, cy - 10, cx + 46, cy + 12], fill="#E4E4E7", outline=ink, width=2)
        return

    # 7. Recycling / Household Actions
    if "びん" in text:
        draw.rectangle([cx - 15, cy - 66, cx + 15, cy - 36], fill="#FFFFFF", outline=ink, width=4)
        draw.rounded_rectangle([cx - 34, cy - 36, cx + 34, cy + 64], radius=14, fill="#FFFFFF", outline=ink, width=4)
        draw.line([cx - 34, cy + 12, cx + 34, cy + 12], fill=ink, width=3)
        return
    if "ごみ" in text:
        draw.polygon([(cx - 44, cy - 34), (cx + 44, cy - 34), (cx + 34, cy + 58), (cx - 34, cy + 58)], fill="#F4F4F5", outline=ink)
        draw.line([cx - 52, cy - 42, cx + 52, cy - 42], fill=ink, width=5)
        return
    if "いす" in text:
        draw.rectangle([cx - 36, cy - 62, cx + 36, cy - 8], fill="#FFFFFF", outline=ink, width=4)
        draw.rectangle([cx - 42, cy - 8, cx + 42, cy + 8], fill="#E4E4E7", outline=ink, width=4)
        draw.line([cx - 34, cy + 8, cx - 34, cy + 64], fill=ink, width=5)
        draw.line([cx + 34, cy + 8, cx + 34, cy + 64], fill=ink, width=5)
        return
    if "そうじ" in text:
        draw.line([cx + 28, cy - 62, cx - 16, cy + 28], fill=ink, width=5)
        draw.polygon([(cx - 44, cy + 28), (cx + 8, cy + 28), (cx + 22, cy + 62), (cx - 56, cy + 62)], fill="#E4E4E7", outline=ink)
        return
    if "おさら" in text:
        for oy in (-22, 0, 22):
            draw.ellipse([cx - 58, cy + oy - 11, cx + 58, cy + oy + 11], fill="#FFFFFF", outline=ink, width=4)
        return
    if "窓" in text or "まど" in text:
        draw.rectangle([cx - 54, cy - 54, cx + 54, cy + 54], fill="#FFFFFF", outline=ink, width=4)
        draw.line([cx, cy - 54, cx, cy + 54], fill=ink, width=4)
        draw.line([cx - 54, cy, cx + 54, cy], fill=ink, width=4)
        return
    if "ホワイトボード" in text or "黒板" in text or "つくえ" in text or "机" in text:
        draw.rectangle([cx - 64, cy - 46, cx + 64, cy + 28], fill="#FFFFFF", outline=ink, width=4)
        draw.line([cx - 44, cy + 28, cx - 52, cy + 62], fill=ink, width=4)
        draw.line([cx + 44, cy + 28, cx + 52, cy + 62], fill=ink, width=4)
        return

    # 8. Food & Drinks
    if "ぎゅうにゅう" in text or "牛乳" in text:
        draw.polygon([(cx - 36, cy - 34), (cx, cy - 62), (cx + 36, cy - 34)], fill="#E4E4E7", outline=ink)
        draw.rectangle([cx - 36, cy - 34, cx + 36, cy + 58], fill="#FFFFFF", outline=ink, width=4)
        draw.text((cx - 20, cy - 4), "牛乳", fill=ink, font=f_lg)
        return
    if "たまご" in text or "卵" in text:
        for ex in (-32, 32):
            draw.ellipse([cx + ex - 24, cy - 36, cx + ex + 24, cy + 38], fill="#FFFFFF", outline=ink, width=4)
        return
    if "パン" in text:
        draw.rounded_rectangle([cx - 58, cy - 30, cx + 58, cy + 44], radius=24, fill="#FFFFFF", outline=ink, width=4)
        draw.line([cx - 22, cy - 24, cx - 14, cy - 6], fill=ink, width=4)
        draw.line([cx + 10, cy - 24, cx + 18, cy - 6], fill=ink, width=4)
        return
    if "さとう" in text:
        draw.rounded_rectangle([cx - 38, cy - 30, cx + 38, cy + 52], radius=14, fill="#FFFFFF", outline=ink, width=4)
        draw.rectangle([cx - 30, cy - 46, cx + 30, cy - 30], fill="#E4E4E7", outline=ink, width=4)
        draw.text((cx - 20, cy + 4), "砂糖", fill=ink, font=f_lg)
        return
    if any(k in text for k in ("コーヒー", "お茶", "紅茶", "のみもの", "ジュース")):
        draw.rectangle([cx - 36, cy - 26, cx + 30, cy + 42], fill="#FFFFFF", outline=ink, width=4)
        draw.arc([cx + 16, cy - 14, cx + 52, cy + 24], start=270, end=90, fill=ink, width=4)
        draw.line([cx - 48, cy + 48, cx + 44, cy + 48], fill=ink, width=4)
        return
    if "にく" in text or "肉" in text:
        draw.rounded_rectangle([cx - 58, cy - 30, cx + 58, cy + 36], radius=18, fill="#E4E4E7", outline=ink, width=4)
        draw.ellipse([cx + 14, cy - 14, cx + 36, cy + 8], fill="#FFFFFF", outline=ink, width=4)
        return
    if "さかな" in text or "魚" in text:
        draw.ellipse([cx - 58, cy - 30, cx + 30, cy + 30], fill="#FFFFFF", outline=ink, width=4)
        draw.polygon([(cx + 26, cy), (cx + 62, cy - 30), (cx + 62, cy + 30)], fill="#E4E4E7", outline=ink)
        draw.ellipse([cx - 38, cy - 11, cx - 28, cy - 1], fill=ink)
        return
    if "やさい" in text or "野菜" in text:
        draw.polygon([(cx - 44, cy + 38), (cx + 28, cy - 30), (cx + 44, cy - 14)], fill="#E4E4E7", outline=ink)
        draw.line([cx + 36, cy - 22, cx + 58, cy - 46], fill=ink, width=4)
        return

    # 9. Transport & Vehicles
    if "電車" in text or "でんしゃ" in text:
        draw.rounded_rectangle([cx - 44, cy - 58, cx + 44, cy + 48], radius=14, fill="#FFFFFF", outline=ink, width=4)
        draw.rectangle([cx - 30, cy - 38, cx + 30, cy - 6], fill="#E4E4E7", outline=ink, width=3)
        draw.ellipse([cx - 30, cy + 16, cx - 16, cy + 30], fill=ink)
        draw.ellipse([cx + 16, cy + 16, cx + 30, cy + 30], fill=ink)
        draw.line([cx - 52, cy + 58, cx + 52, cy + 58], fill=ink, width=4)
        return
    if "バス" in text:
        draw.rounded_rectangle([cx - 64, cy - 38, cx + 64, cy + 36], radius=12, fill="#FFFFFF", outline=ink, width=4)
        draw.rectangle([cx - 50, cy - 24, cx + 50, cy + 6], fill="#E4E4E7", outline=ink, width=3)
        draw.ellipse([cx - 44, cy + 22, cx - 20, cy + 46], fill=ink)
        draw.ellipse([cx + 20, cy + 22, cx + 44, cy + 46], fill=ink)
        return
    if "自転車" in text or "じてんしゃ" in text:
        draw.ellipse([cx - 64, cy - 6, cx - 16, cy + 42], fill="#FFFFFF", outline=ink, width=4)
        draw.ellipse([cx + 16, cy - 6, cx + 64, cy + 42], fill="#FFFFFF", outline=ink, width=4)
        draw.line([cx - 38, cy + 16, cx - 6, cy - 22, cx + 30, cy - 22, cx + 38, cy + 16], fill=ink, width=4)
        draw.line([cx - 6, cy - 22, cx + 6, cy + 16, cx - 38, cy + 16], fill=ink, width=4)
        return
    if "あるいて" in text or "歩" in text:
        draw.ellipse([cx - 14, cy - 60, cx + 14, cy - 32], fill="#FFFFFF", outline=ink, width=4)
        draw.line([cx, cy - 32, cx, cy + 12], fill=ink, width=5)
        draw.line([cx, cy - 22, cx - 28, cy + 6], fill=ink, width=4)
        draw.line([cx, cy - 22, cx + 28, cy + 6], fill=ink, width=4)
        draw.line([cx, cy + 12, cx - 28, cy + 56], fill=ink, width=5)
        draw.line([cx, cy + 12, cx + 28, cy + 56], fill=ink, width=5)
        return

    # 10. Places & Buildings
    if "こうえん" in text or "公園" in text:
        draw.ellipse([cx - 58, cy - 60, cx + 6, cy + 2], fill="#E4E4E7", outline=ink, width=4)
        draw.rectangle([cx - 32, cy + 2, cx - 18, cy + 52], fill=ink)
        draw.rectangle([cx + 8, cy + 14, cx + 66, cy + 30], fill="#FFFFFF", outline=ink, width=4)
        draw.line([cx + 16, cy + 30, cx + 16, cy + 52], fill=ink, width=4)
        draw.line([cx + 58, cy + 30, cx + 58, cy + 52], fill=ink, width=4)
        return
    if any(k in text for k in ("カフェ", "レストラン", "しょくどう", "スーパー", "店", "えき", "駅", "図書館", "学校", "いえ", "うち")):
        draw.polygon([(cx - 64, cy - 16), (cx, cy - 60), (cx + 64, cy - 16)], fill="#E4E4E7", outline=ink)
        draw.rectangle([cx - 52, cy - 16, cx + 52, cy + 52], fill="#FFFFFF", outline=ink, width=4)
        draw.rectangle([cx - 16, cy + 8, cx + 16, cy + 52], fill="#F4F4F5", outline=ink, width=4)
        return

    # 11. Default visual action card
    draw.rounded_rectangle([cx - 56, cy - 42, cx + 56, cy + 42], radius=16, fill="#F4F4F5", outline=ink, width=4)
    draw.line([cx - 32, cy - 14, cx + 32, cy - 14], fill=ink, width=4)
    draw.line([cx - 32, cy + 14, cx + 20, cy + 14], fill=ink, width=4)


def draw_four_block_cell(
    draw: ImageDraw.ImageDraw, option_text: str, box: tuple[int, int, int, int]
) -> None:
    x0, y0, x1, y1 = box
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2

    parts = re.split(r"(?:と[\s\u3000]+|に[\s\u3000]+)", option_text.strip())
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) >= 2:
        q_w = (x1 - x0) // 4
        draw_single_motif(draw, parts[0], x0 + q_w, cy)
        draw.text((cx - 10, cy - 18), "+", fill="#52525B", font=load_font(32))
        draw_single_motif(draw, parts[1], x1 - q_w, cy)
    else:
        draw_single_motif(draw, option_text, cx, cy)


def draw_speaker_arrow(draw: ImageDraw.ImageDraw, tip_x: int, tip_y: int) -> None:
    """
    Draws a high-contrast JLPT test-booklet arrow pointing directly at the
    person who is about to speak in Verbal Expressions (発話表現).
    """
    ink = "#18181B"
    # Diagonal bold arrow from upper-left pointing down-right to the speaker
    shaft_start = (tip_x - 78, tip_y - 68)
    shaft_end = (tip_x - 22, tip_y - 18)
    draw.line([shaft_start, shaft_end], fill="#FFFFFF", width=14)
    draw.line([shaft_start, shaft_end], fill=ink, width=8)
    head_pts = [
        (tip_x, tip_y),
        (tip_x - 34, tip_y - 8),
        (tip_x - 14, tip_y - 32),
    ]
    draw.polygon(head_pts, fill=ink, outline="#FFFFFF")


def draw_verbal_expression_scene(
    draw: ImageDraw.ImageDraw,
    prompt_text: str,
    transcript_ja: str,
    box: tuple[int, int, int, int],
) -> None:
    """
    Renders a single large JLPT Verbal Expression (発話表現) scene illustration
    with background context and an arrow pointing to the person who is about
    to speak.
    """
    x0, y0, x1, y1 = box
    ink = "#18181B"
    ctx = f"{strip_html(prompt_text)} {transcript_ja}"

    # Ground / Floor line
    floor_y = y1 - 36
    draw.line([x0 + 24, floor_y, x1 - 24, floor_y], fill=ink, width=3)

    # Context-aware background props on the right/center of the room
    prop_cx = x0 + int((x1 - x0) * 0.72)
    prop_cy = floor_y - 95

    if any(k in ctx for k in ("ごはん", "食べ", "レストラン", "しょくどう", "コーヒー", "お茶")):
        # Dining table with bowls/cups
        draw.rectangle([prop_cx - 85, floor_y - 66, prop_cx + 85, floor_y - 54], fill="#E4E4E7", outline=ink, width=3)
        draw.line([prop_cx - 65, floor_y - 54, prop_cx - 65, floor_y], fill=ink, width=4)
        draw.line([prop_cx + 65, floor_y - 54, prop_cx + 65, floor_y], fill=ink, width=4)
        draw.pieslice([prop_cx - 50, floor_y - 86, prop_cx - 10, floor_y - 50], start=0, end=180, fill="#FFFFFF", outline=ink, width=3)
        draw.pieslice([prop_cx + 10, floor_y - 86, prop_cx + 50, floor_y - 50], start=0, end=180, fill="#FFFFFF", outline=ink, width=3)
    elif any(k in ctx for k in ("かいしゃ", "会社", "しごと", "仕事", "先に")):
        # Office desk with monitor & wall clock
        draw_clock_icon(draw, prop_cx + 45, y0 + 78, 34, 6, 0, "18:00")
        draw.rectangle([prop_cx - 80, floor_y - 64, prop_cx + 80, floor_y - 52], fill="#E4E4E7", outline=ink, width=3)
        draw.line([prop_cx - 60, floor_y - 52, prop_cx - 60, floor_y], fill=ink, width=4)
        draw.line([prop_cx + 60, floor_y - 52, prop_cx + 60, floor_y], fill=ink, width=4)
        draw.rectangle([prop_cx - 34, floor_y - 106, prop_cx + 26, floor_y - 68], fill="#FFFFFF", outline=ink, width=3)
        draw.line([prop_cx - 4, floor_y - 68, prop_cx - 4, floor_y - 64], fill=ink, width=4)
    elif any(k in ctx for k in ("先生", "きょうしつ", "教室", "学校", "黒板")):
        # Classroom blackboard & podium
        draw.rectangle([prop_cx - 95, y0 + 38, prop_cx + 95, y0 + 148], fill="#FFFFFF", outline=ink, width=4)
        draw.line([prop_cx - 65, y0 + 72, prop_cx + 65, y0 + 72], fill=ink, width=3)
        draw.line([prop_cx - 65, y0 + 106, prop_cx + 35, y0 + 106], fill=ink, width=3)
    elif any(k in ctx for k in ("かぜ", "びょうき", "病院", "ねつ", "おだいじ")):
        # Bed / Futon for sick friend
        draw.rounded_rectangle([prop_cx - 90, floor_y - 44, prop_cx + 90, floor_y], radius=12, fill="#E4E4E7", outline=ink, width=3)
        draw.ellipse([prop_cx - 72, floor_y - 62, prop_cx - 34, floor_y - 36], fill="#FFFFFF", outline=ink, width=3)
    elif any(k in ctx for k in ("ペン", "えんぴつ", "じしょ", "本", "かさ", "かりたい")):
        # Table with item to borrow in the center
        draw.rectangle([prop_cx - 75, floor_y - 58, prop_cx + 75, floor_y - 46], fill="#E4E4E7", outline=ink, width=3)
        draw.line([prop_cx - 55, floor_y - 46, prop_cx - 55, floor_y], fill=ink, width=4)
        draw.line([prop_cx + 55, floor_y - 46, prop_cx + 55, floor_y], fill=ink, width=4)
        draw.line([prop_cx - 24, floor_y - 66, prop_cx + 24, floor_y - 78], fill=ink, width=5)
    else:
        # Doorway / Entrance frame
        draw.rectangle([prop_cx - 56, y0 + 46, prop_cx + 56, floor_y], fill="#FAFAFA", outline=ink, width=4)
        draw.ellipse([prop_cx + 34, floor_y - 96, prop_cx + 44, floor_y - 86], fill=ink)

    # Speaker (Left character — pointed to by the arrow)
    sx = x0 + int((x1 - x0) * 0.27)
    sy = floor_y - 140
    # Head & hair
    draw.ellipse([sx - 28, sy - 28, sx + 28, sy + 28], fill="#FFFFFF", outline=ink, width=4)
    draw.arc([sx - 28, sy - 30, sx + 28, sy + 12], start=180, end=360, fill=ink, width=6)
    # Eyes & open mouth cue
    draw.ellipse([sx - 11, sy - 6, sx - 5, sy], fill=ink)
    draw.ellipse([sx + 5, sy - 6, sx + 11, sy], fill=ink)
    draw.ellipse([sx - 4, sy + 8, sx + 5, sy + 16], fill=ink)
    # Torso & arms
    draw.rounded_rectangle([sx - 36, sy + 32, sx + 36, floor_y], radius=16, fill="#FFFFFF", outline=ink, width=4)
    draw.line([sx + 34, sy + 54, sx + 72, sy + 78], fill=ink, width=4)

    # Listener (Right character)
    lx = x0 + int((x1 - x0) * 0.48)
    ly = floor_y - 144
    draw.ellipse([lx - 28, ly - 28, lx + 28, ly + 28], fill="#FFFFFF", outline=ink, width=4)
    draw.ellipse([lx - 11, ly - 6, lx - 5, ly], fill=ink)
    draw.ellipse([lx + 5, ly - 6, lx + 11, ly], fill=ink)
    draw.arc([lx - 9, ly + 4, lx + 9, ly + 16], start=0, end=180, fill=ink, width=3)
    draw.rounded_rectangle([lx - 38, ly + 32, lx + 38, floor_y], radius=16, fill="#E4E4E7", outline=ink, width=4)

    # Bold directional arrow pointing directly to the person who is about to speak
    draw_speaker_arrow(draw, sx - 24, sy - 24)


def render_listening_worksheet_png(
    layout_style: str,
    question_number: int,
    prompt_text: str,
    transcript_ja: str,
    options: list[dict],
    out_path: Path,
) -> Path:
    """
    Renders authentic Japanese JLPT Listening Visual Sheets:
      - 'four_block' (960x760): 4 separate numbered boxes (1, 2, 3, 4) filled
        with large, clear illustrations for Task-based & Point comprehension.
      - 'single_scene' (960x620): Single large scene box with an arrow pointing
        to the person who is about to speak for Verbal expressions (発話表現).
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    is_single = layout_style == "single_scene"
    width = 960
    height = 620 if is_single else 760
    ink = "#18181B"

    img = Image.new("RGB", (width, height), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    font_badge = load_font(22)
    font_prompt = load_font(22)
    font_num = load_font(30)

    # Outer exam sheet border + authentic 問題用紙 header
    draw.rectangle([16, 16, width - 16, height - 16], outline=ink, width=3)
    draw.rectangle([16, 16, width - 16, 76], fill="#F4F4F5", outline=ink, width=3)
    draw.rounded_rectangle([30, 26, 146, 66], radius=8, fill=ink)
    draw.text((44, 33), "問題用紙", fill="#FFFFFF", font=font_badge)

    clean_prompt = strip_html(prompt_text)
    header_prompt = f"問 {question_number}　{clean_prompt}"
    if len(header_prompt) > 34:
        header_prompt = header_prompt[:33] + "…"
    draw.text((164, 34), header_prompt, fill=ink, font=font_prompt)

    margin_x = 30
    top_y = 94

    if is_single:
        # Single block: One large scene illustration with arrow pointing to speaker
        scene_box = (margin_x, top_y, width - margin_x, height - 30)
        draw.rounded_rectangle(
            list(scene_box), radius=12, fill="#FFFFFF", outline=ink, width=3
        )
        draw_verbal_expression_scene(draw, prompt_text, transcript_ja, scene_box)
    else:
        # Four blocks (1, 2, 3, 4): Large 2x2 boxes filled with distinct illustrations
        gap = 20
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

            draw.rounded_rectangle([x0, y0, x1, y1], radius=12, fill="#FFFFFF", outline=ink, width=3)

            # Option number badge (1, 2, 3, 4) in top-left corner
            draw.ellipse([x0 + 16, y0 + 16, x0 + 62, y0 + 62], fill=ink)
            draw.text((x0 + 30, y0 + 22), str(opt["index"]), fill="#FFFFFF", font=font_num)

            # Full-box visual illustration for this choice
            draw_four_block_cell(
                draw,
                strip_html(str(opt.get("text", ""))),
                (x0 + 68, y0 + 18, x1 - 22, y1 - 18),
            )

    img.save(out_path, format="PNG", optimize=True)
    return out_path


def upload_storage_bytes(supabase, data: bytes, storage_path: str, content_type: str) -> None:
    clean_path = storage_path.lstrip("/")
    supabase.storage.from_("jlpt-media").upload(
        path=clean_path,
        file=data,
        file_options={"content-type": content_type, "upsert": "true"},
    )


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
    media_cache = Path("/tmp/nihonsync_media_build_v3")

    for exam in exams:
        meta = exam["exam_metadata"]
        code = meta["exam_code"]
        set_num = int(meta["test_number"])
        padded = f"{set_num:02d}"
        print(f"\n=== Updating Visual Sheets for {code} ===")

        exam_row = (
            supabase.table("exams")
            .select("id")
            .eq("exam_code", code)
            .maybe_single()
            .execute()
        )
        exam_id = exam_row.data["id"] if exam_row.data else None

        listen_sec_id = None
        if exam_id:
            sec_row = (
                supabase.table("exam_sections")
                .select("id")
                .eq("exam_id", exam_id)
                .eq("section_code", "LISTENING")
                .maybe_single()
                .execute()
            )
            listen_sec_id = sec_row.data["id"] if sec_row.data else None

        mg_id_by_num: dict[int, str] = {}
        if listen_sec_id:
            mg_rows = (
                supabase.table("mondai_groups")
                .select("id, mondai_number")
                .eq("section_id", listen_sec_id)
                .execute()
            )
            for r in mg_rows.data or []:
                mg_id_by_num[int(r["mondai_number"])] = r["id"]

        listening_sec = next(
            s for s in exam["sections"] if s["section_code"] == "LISTENING"
        )
        four_blk_cnt = 0
        single_cnt = 0
        audio_only_cnt = 0

        for mg in listening_sec["mondai_groups"]:
            m_num = int(mg["mondai_number"])
            q_type = mg.get("question_type", "")
            mg_id = mg_id_by_num.get(m_num)

            for q in mg["questions"]:
                q_no = int(q["question_number"])
                cat = q.get("category", "")
                layout_style = classify_visual_layout(cat, q_type)

                if layout_style in ("four_block", "single_scene"):
                    new_img_path = f"jlpt/n5/mock{padded}/listening_q{q_no}_sheet_v3.png"
                    local_png = media_cache / new_img_path
                    render_listening_worksheet_png(
                        layout_style=layout_style,
                        question_number=q_no,
                        prompt_text=q.get("prompt_html", ""),
                        transcript_ja=q.get("transcript_ja") or "",
                        options=q["options"],
                        out_path=local_png,
                    )
                    upload_storage_bytes(
                        supabase, local_png.read_bytes(), new_img_path, "image/png"
                    )
                    q["image_url"] = new_img_path
                    if layout_style == "four_block":
                        four_blk_cnt += 1
                    else:
                        single_cnt += 1
                else:
                    q["image_url"] = None
                    audio_only_cnt += 1

                if mg_id:
                    supabase.table("questions").update(
                        {"image_url": q["image_url"]}
                    ).eq("mondai_group_id", mg_id).eq(
                        "question_number", q_no
                    ).execute()

                sys.stdout.write(
                    f"\r  Synced: {four_blk_cnt} 4-block | {single_cnt} single-scene (arrow) | {audio_only_cnt} audio-only (Q{q_no}/24)"
                )
                sys.stdout.flush()
        print()

    compiled_path.write_text(
        json.dumps(exams, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        "\nDONE: All 6 JLPT N5 sets updated with authentic 4-block and single-scene speaker-arrow visual sheets!"
    )


if __name__ == "__main__":
    asyncio.run(process_and_seed())
