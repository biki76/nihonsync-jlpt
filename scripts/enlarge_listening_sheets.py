#!/usr/bin/env python3
"""
Regenerates JLPT Listening Visual Sheets (_sheet_v4.png) with 1.6x larger
illustrations filling ~80% of each panel for immediate mobile legibility
without needing zoom or fullscreen buttons:
- Mondai 1 (課題理解) & Mondai 2 (ポイント理解): 960x820 4-block grid (1, 2, 3, 4)
- Mondai 3 (発話表現): 960x640 single-block scene with bold speaker arrow
- Mondai 4 (即時応答): audio-only (image_url = None)
"""

import html
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
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill="#FFFFFF", outline=ink, width=5)
    for tick in range(12):
        ang = math.radians(tick * 30 - 90)
        inner = r - (18 if tick % 3 == 0 else 9)
        x0 = cx + int(inner * math.cos(ang))
        y0 = cy + int(inner * math.sin(ang))
        x1 = cx + int((r - 4) * math.cos(ang))
        y1 = cy + int((r - 4) * math.sin(ang))
        draw.line([x0, y0, x1, y1], fill=ink, width=4 if tick % 3 == 0 else 2)

    f_num = load_font(22)
    draw.text((cx - 12, cy - r + 16), "12", fill=ink, font=f_num)
    draw.text((cx + r - 30, cy - 12), "3", fill=ink, font=f_num)
    draw.text((cx - 7, cy + r - 36), "6", fill=ink, font=f_num)
    draw.text((cx - r + 18, cy - 12), "9", fill=ink, font=f_num)

    h_ang = math.radians(((hour % 12) + minute / 60.0) * 30 - 90)
    m_ang = math.radians(minute * 6 - 90)
    draw.line(
        [cx, cy, cx + int(r * 0.52 * math.cos(h_ang)), cy + int(r * 0.52 * math.sin(h_ang))],
        fill=ink,
        width=9,
    )
    draw.line(
        [cx, cy, cx + int(r * 0.80 * math.cos(m_ang)), cy + int(r * 0.80 * math.sin(m_ang))],
        fill=ink,
        width=5,
    )
    draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=ink)

    draw.rounded_rectangle(
        [cx - 54, cy + r + 10, cx + 54, cy + r + 46],
        radius=10,
        fill="#F4F4F5",
        outline=ink,
        width=3,
    )
    draw.text((cx - 32, cy + r + 14), label, fill=ink, font=load_font(26))


def draw_single_motif(
    draw: ImageDraw.ImageDraw, text: str, cx: int, cy: int, scale: float = 1.0
) -> None:
    ink = "#18181B"
    s = scale

    # 1. Clock time
    clk = parse_clock_time(text)
    if clk:
        draw_clock_icon(draw, cx, cy - int(18 * s), int(102 * s), clk[0], clk[1], clk[2])
        return

    # 2. Map & directions
    if any(k in text for k in ("まっすぐ", "まがり", "右", "左", "みぎ", "ひだり", "かど", "コーナー")):
        hw, hh = int(125 * s), int(105 * s)
        rw = int(26 * s)
        draw.rectangle([cx - hw, cy - hh, cx + hw, cy + hh], fill="#FAFAFA", outline=ink, width=3)
        draw.rectangle([cx - rw, cy - hh, cx + rw, cy + hh], fill="#E4E4E7", outline=ink, width=3)
        draw.rectangle([cx - hw, cy + int(18 * s), cx + hw, cy + int(52 * s)], fill="#E4E4E7", outline=ink, width=3)
        draw.rectangle([cx - hw, cy - int(66 * s), cx + hw, cy - int(32 * s)], fill="#E4E4E7", outline=ink, width=3)
        is_second = "ふたつ" in text or "2つ" in text or "二" in text
        turn_y = cy - int(49 * s) if is_second else cy + int(35 * s)
        go_right = "右" in text or "みぎ" in text
        draw.line([cx, cy + hh - 8, cx, turn_y], fill=ink, width=8)
        if go_right:
            draw.line([cx, turn_y, cx + int(92 * s), turn_y], fill=ink, width=8)
            draw.polygon([(cx + int(110 * s), turn_y), (cx + int(80 * s), turn_y - 16), (cx + int(80 * s), turn_y + 16)], fill=ink)
        else:
            draw.line([cx, turn_y, cx - int(92 * s), turn_y], fill=ink, width=8)
            draw.polygon([(cx - int(110 * s), turn_y), (cx - int(80 * s), turn_y - 16), (cx - int(80 * s), turn_y + 16)], fill=ink)
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
            w, h = int(205 * s), int(198 * s)
            x0, y0 = cx - w // 2, cy - h // 2
            draw.rounded_rectangle([x0, y0 + 18, x0 + w, y0 + h], radius=16, fill="#FFFFFF", outline=ink, width=5)
            draw.rectangle([x0, y0 + 18, x0 + w, y0 + 64], fill=ink)
            draw.rectangle([x0 + 40, y0, x0 + 58, y0 + 32], fill="#FFFFFF", outline=ink, width=4)
            draw.rectangle([x0 + w - 58, y0, x0 + w - 40, y0 + 32], fill="#FFFFFF", outline=ink, width=4)
            draw.text((cx - int(36 * s), y0 + int(70 * s)), d_kanji, fill=ink, font=load_font(int(72 * s)))
            draw.text((cx - int(44 * s), y0 + int(152 * s)), sub, fill="#52525B", font=load_font(int(24 * s)))
            return

    # 4. People count
    m_ppl = re.search(r"(一|二|三|四|五|六|\d)\s*人", text)
    if m_ppl:
        raw_n = m_ppl.group(1)
        cnt = max(1, min(6, int(raw_n) if raw_n.isdigit() else KANJI_NUMS.get(raw_n, 2)))
        spacing = int((56 if cnt <= 4 else 44) * s)
        start_x = cx - ((cnt - 1) * spacing) // 2
        for i in range(cnt):
            px = start_x + i * spacing
            draw.ellipse([px - int(18 * s), cy - int(66 * s), px + int(18 * s), cy - int(30 * s)], fill="#FFFFFF", outline=ink, width=4)
            draw.pieslice([px - int(28 * s), cy - int(22 * s), px + int(28 * s), cy + int(62 * s)], start=180, end=360, fill="#E4E4E7", outline=ink, width=4)
        draw.text((cx - int(28 * s), cy + int(56 * s)), f"{cnt}人", fill=ink, font=load_font(int(28 * s)))
        return

    # 5. Shirt / Clothing
    if any(k in text for k in ("シャツ", "コート", "セーター", "ふく", "服", "サイズ")):
        fill_col = "#27272A" if ("黒" in text or "くろ" in text) else ("#D4D4D8" if ("青" in text or "あお" in text) else "#FFFFFF")
        pts = [
            (cx - int(60 * s), cy - int(82 * s)), (cx - int(22 * s), cy - int(82 * s)), (cx, cy - int(60 * s)),
            (cx + int(22 * s), cy - int(82 * s)), (cx + int(60 * s), cy - int(82 * s)), (cx + int(112 * s), cy - int(32 * s)),
            (cx + int(84 * s), cy + int(6 * s)), (cx + int(54 * s), cy - int(20 * s)), (cx + int(54 * s), cy + int(92 * s)),
            (cx - int(54 * s), cy + int(92 * s)), (cx - int(54 * s), cy - int(20 * s)), (cx - int(84 * s), cy + int(6 * s)),
            (cx - int(112 * s), cy - int(32 * s)),
        ]
        draw.polygon(pts, fill=fill_col, outline=ink)
        size_m = re.search(r"\b(S|M|L|LL)\b", text)
        if size_m:
            txt_col = "#FFFFFF" if fill_col == "#27272A" else ink
            draw.text((cx - int(20 * s), cy - int(18 * s)), size_m.group(1), fill=txt_col, font=load_font(int(54 * s)))
        return

    # 6. Stationery & Paper Goods
    if "ボールペン" in text or "ペン" in text:
        draw.polygon([(cx - int(78 * s), cy + int(62 * s)), (cx + int(54 * s), cy - int(70 * s)), (cx + int(76 * s), cy - int(48 * s)), (cx - int(56 * s), cy + int(84 * s))], fill="#FFFFFF", outline=ink)
        draw.polygon([(cx - int(78 * s), cy + int(62 * s)), (cx - int(98 * s), cy + int(94 * s)), (cx - int(56 * s), cy + int(84 * s))], fill=ink)
        draw.line([cx + int(32 * s), cy - int(68 * s), cx - int(8 * s), cy - int(28 * s)], fill=ink, width=5)
        return
    if "えんぴつ" in text or "鉛筆" in text:
        draw.polygon([(cx - int(76 * s), cy + int(54 * s)), (cx + int(54 * s), cy - int(76 * s)), (cx + int(74 * s), cy - int(56 * s)), (cx - int(56 * s), cy + int(74 * s))], fill="#E4E4E7", outline=ink)
        draw.polygon([(cx - int(76 * s), cy + int(54 * s)), (cx - int(96 * s), cy + int(88 * s)), (cx - int(56 * s), cy + int(74 * s))], fill="#FFFFFF", outline=ink)
        draw.polygon([(cx - int(88 * s), cy + int(74 * s)), (cx - int(96 * s), cy + int(88 * s)), (cx - int(76 * s), cy + int(81 * s))], fill=ink)
        return
    if "けしゴム" in text:
        draw.rounded_rectangle([cx - int(86 * s), cy - int(48 * s), cx + int(86 * s), cy + int(48 * s)], radius=12, fill="#FFFFFF", outline=ink, width=5)
        draw.rectangle([cx - int(34 * s), cy - int(48 * s), cx + int(74 * s), cy + int(48 * s)], fill="#E4E4E7", outline=ink, width=5)
        return
    if any(k in text for k in ("じしょ", "辞書", "本", "ほん", "ノート")):
        draw.rectangle([cx - int(74 * s), cy - int(86 * s), cx + int(74 * s), cy + int(86 * s)], fill="#FFFFFF", outline=ink, width=5)
        draw.line([cx - int(46 * s), cy - int(86 * s), cx - int(46 * s), cy + int(86 * s)], fill=ink, width=5)
        draw.rectangle([cx - int(22 * s), cy - int(48 * s), cx + int(52 * s), cy - int(16 * s)], fill="#F4F4F5", outline=ink, width=3)
        return
    if "しんぶん" in text or "新聞" in text:
        draw.rectangle([cx - int(86 * s), cy - int(74 * s), cx + int(86 * s), cy + int(74 * s)], fill="#FFFFFF", outline=ink, width=5)
        draw.line([cx, cy - int(62 * s), cx, cy + int(62 * s)], fill=ink, width=5)
        for ry in (-42, -14, 14, 42):
            draw.line([cx - int(66 * s), cy + int(ry * s), cx - int(20 * s), cy + int(ry * s)], fill=ink, width=5)
            draw.line([cx + int(20 * s), cy + int(ry * s), cx + int(66 * s), cy + int(ry * s)], fill=ink, width=5)
        return

    # 7. Food, Drinks & Household
    if "ぎゅうにゅう" in text or "牛乳" in text:
        draw.polygon([(cx - int(52 * s), cy - int(48 * s)), (cx, cy - int(88 * s)), (cx + int(52 * s), cy - int(48 * s))], fill="#E4E4E7", outline=ink)
        draw.rectangle([cx - int(52 * s), cy - int(48 * s), cx + int(52 * s), cy + int(84 * s)], fill="#FFFFFF", outline=ink, width=5)
        draw.text((cx - int(28 * s), cy - int(6 * s)), "牛乳", fill=ink, font=load_font(int(28 * s)))
        return
    if "たまご" in text or "卵" in text:
        for ex in (-46, 46):
            draw.ellipse([cx + int((ex - 34) * s), cy - int(52 * s), cx + int((ex + 34) * s), cy + int(54 * s)], fill="#FFFFFF", outline=ink, width=5)
        return
    if "パン" in text:
        draw.rounded_rectangle([cx - int(84 * s), cy - int(42 * s), cx + int(84 * s), cy + int(64 * s)], radius=32, fill="#FFFFFF", outline=ink, width=5)
        draw.line([cx - int(32 * s), cy - int(34 * s), cx - int(20 * s), cy - int(8 * s)], fill=ink, width=5)
        draw.line([cx + int(14 * s), cy - int(34 * s), cx + int(26 * s), cy - int(8 * s)], fill=ink, width=5)
        return
    if any(k in text for k in ("コーヒー", "お茶", "紅茶", "のみもの", "ジュース")):
        draw.rectangle([cx - int(52 * s), cy - int(38 * s), cx + int(44 * s), cy + int(60 * s)], fill="#FFFFFF", outline=ink, width=5)
        draw.arc([cx + int(22 * s), cy - int(20 * s), cx + int(74 * s), cy + int(34 * s)], start=270, end=90, fill=ink, width=5)
        draw.line([cx - int(68 * s), cy + int(68 * s), cx + int(62 * s), cy + int(68 * s)], fill=ink, width=5)
        return

    # 8. Transport & Buildings
    if "電車" in text or "でんしゃ" in text:
        draw.rounded_rectangle([cx - int(64 * s), cy - int(84 * s), cx + int(64 * s), cy + int(68 * s)], radius=18, fill="#FFFFFF", outline=ink, width=5)
        draw.rectangle([cx - int(44 * s), cy - int(54 * s), cx + int(44 * s), cy - int(8 * s)], fill="#E4E4E7", outline=ink, width=4)
        draw.ellipse([cx - int(44 * s), cy + int(22 * s), cx - int(22 * s), cy + int(44 * s)], fill=ink)
        draw.ellipse([cx + int(22 * s), cy + int(22 * s), cx + int(44 * s), cy + int(44 * s)], fill=ink)
        draw.line([cx - int(76 * s), cy + int(84 * s), cx + int(76 * s), cy + int(84 * s)], fill=ink, width=5)
        return
    if "バス" in text:
        draw.rounded_rectangle([cx - int(92 * s), cy - int(54 * s), cx + int(92 * s), cy + int(52 * s)], radius=16, fill="#FFFFFF", outline=ink, width=5)
        draw.rectangle([cx - int(72 * s), cy - int(34 * s), cx + int(72 * s), cy + int(8 * s)], fill="#E4E4E7", outline=ink, width=4)
        draw.ellipse([cx - int(64 * s), cy + int(32 * s), cx - int(28 * s), cy + int(68 * s)], fill=ink)
        draw.ellipse([cx + int(28 * s), cy + int(32 * s), cx + int(64 * s), cy + int(68 * s)], fill=ink)
        return
    if any(k in text for k in ("カフェ", "レストラン", "しょくどう", "スーパー", "店", "えき", "駅", "図書館", "学校", "いえ", "うち")):
        draw.polygon([(cx - int(92 * s), cy - int(22 * s)), (cx, cy - int(86 * s)), (cx + int(92 * s), cy - int(22 * s))], fill="#E4E4E7", outline=ink)
        draw.rectangle([cx - int(74 * s), cy - int(22 * s), cx + int(74 * s), cy + int(74 * s)], fill="#FFFFFF", outline=ink, width=5)
        draw.rectangle([cx - int(22 * s), cy + int(12 * s), cx + int(22 * s), cy + int(74 * s)], fill="#F4F4F5", outline=ink, width=5)
        return

    # 9. Large clear Japanese emblem card for any remaining noun/action
    clean_lbl = re.sub(r"\s+", " ", strip_html(text))[:10]
    w, h = int(210 * s), int(148 * s)
    draw.rounded_rectangle([cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2], radius=18, fill="#F4F4F5", outline=ink, width=5)
    draw.text((cx, cy), clean_lbl, fill=ink, font=load_font(int(30 * s)), anchor="mm")


def draw_four_block_cell(draw: ImageDraw.ImageDraw, option_text: str, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2
    parts = [p.strip() for p in re.split(r"(?:と[\s\u3000]+|に[\s\u3000]+)", option_text.strip()) if p.strip()]
    if len(parts) >= 2:
        q_w = (x1 - x0) // 4
        draw_single_motif(draw, parts[0], x0 + q_w, cy, scale=0.78)
        draw.text((cx, cy), "+", fill="#52525B", font=load_font(38), anchor="mm")
        draw_single_motif(draw, parts[1], x1 - q_w, cy, scale=0.78)
    else:
        draw_single_motif(draw, option_text, cx, cy, scale=1.0)


def render_sheet_png(
    is_single_scene: bool,
    question_number: int,
    prompt_text: str,
    options: list[str],
    out_path: Path,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    width = 960
    height = 640 if is_single_scene else 820
    ink = "#18181B"

    img = Image.new("RGB", (width, height), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    draw.rectangle([10, 10, width - 10, height - 10], outline=ink, width=4)
    draw.rectangle([10, 10, width - 10, 64], fill="#F4F4F5", outline=ink, width=4)
    draw.rounded_rectangle([22, 18, 134, 56], radius=8, fill=ink)
    draw.text((78, 37), "問題用紙", fill="#FFFFFF", font=load_font(22), anchor="mm")

    clean_prompt = strip_html(prompt_text)
    header_prompt = f"問 {question_number}　{clean_prompt}"[:34]
    draw.text((150, 37), header_prompt, fill=ink, font=load_font(23), anchor="lm")

    if is_single_scene:
        # Verbal expressions (発話表現): Single large scene + bold arrow pointing to speaker
        x0, y0, x1, y1 = 18, 76, width - 18, height - 18
        draw.rounded_rectangle([x0, y0, x1, y1], radius=14, fill="#FFFFFF", outline=ink, width=4)
        floor_y = y1 - 36
        draw.line([x0 + 24, floor_y, x1 - 24, floor_y], fill=ink, width=4)

        # Speaker (Left)
        sx, sy = x0 + 250, floor_y - 165
        draw.ellipse([sx - 36, sy - 36, sx + 36, sy + 36], fill="#FFFFFF", outline=ink, width=5)
        draw.rounded_rectangle([sx - 46, sy + 42, sx + 46, floor_y], radius=18, fill="#FFFFFF", outline=ink, width=5)

        # Listener (Right)
        lx, ly = x0 + 470, floor_y - 168
        draw.ellipse([lx - 36, ly - 36, lx + 36, ly + 36], fill="#FFFFFF", outline=ink, width=5)
        draw.rounded_rectangle([lx - 48, ly + 42, lx + 48, floor_y], radius=18, fill="#E4E4E7", outline=ink, width=5)

        # Context prop on far right
        draw_single_motif(draw, clean_prompt, x0 + 735, floor_y - 135, scale=0.82)

        # Bold directional arrow pointing directly to the speaker
        tip_x, tip_y = sx - 32, sy - 28
        draw.line([(tip_x - 95, tip_y - 80), (tip_x - 24, tip_y - 20)], fill=ink, width=10)
        draw.polygon([(tip_x, tip_y), (tip_x - 42, tip_y - 10), (tip_x - 18, tip_y - 40)], fill=ink)
    else:
        # Task-based (課題理解) & Point comprehension (ポイント理解): Large 4-block grid (1, 2, 3, 4)
        margin_x = 16
        top_y = 76
        gap = 14
        card_w = (width - margin_x * 2 - gap) // 2
        card_h = (height - top_y - 16 - gap) // 2

        for idx in range(min(4, len(options))):
            col = idx % 2
            row = idx // 2
            x0 = margin_x + col * (card_w + gap)
            y0 = top_y + row * (card_h + gap)
            x1 = x0 + card_w
            y1 = y0 + card_h

            draw.rounded_rectangle([x0, y0, x1, y1], radius=14, fill="#FFFFFF", outline=ink, width=4)
            draw.ellipse([x0 + 12, y0 + 12, x0 + 56, y0 + 56], fill=ink)
            draw.text((x0 + 34, y0 + 34), str(idx + 1), fill="#FFFFFF", font=load_font(28), anchor="mm")

            draw_four_block_cell(draw, strip_html(options[idx]), (x0 + 44, y0 + 16, x1 - 16, y1 - 16))

    img.save(out_path, format="PNG", optimize=True)


def main() -> None:
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    tmp_dir = Path("/tmp/nihonsync_zoomed_v4")
    tmp_dir.mkdir(parents=True, exist_ok=True)

    exams = sb.table("exams").select("id, exam_code").order("exam_code").execute().data or []
    total_sheets = 0

    for exam in exams:
        code = exam["exam_code"]
        m_num = re.search(r"MOCK-0?(\d+)", code, re.I)
        set_num = int(m_num.group(1)) if m_num else 1
        padded = f"{set_num:02d}"

        sec_rows = sb.table("exam_sections").select("id").eq("exam_id", exam["id"]).eq("section_code", "LISTENING").execute().data or []
        if not sec_rows:
            continue

        mg_rows = sb.table("mondai_groups").select("id, mondai_number").eq("section_id", sec_rows[0]["id"]).order("mondai_number").execute().data or []
        mg_num_by_id = {m["id"]: int(m["mondai_number"]) for m in mg_rows}

        q_rows = (
            sb.table("questions")
            .select("id, mondai_group_id, question_number, stem_html, options")
            .in_("mondai_group_id", list(mg_num_by_id.keys()))
            .order("question_number")
            .execute()
            .data
            or []
        )

        for idx, q in enumerate(q_rows, start=1):
            m_num_val = mg_num_by_id.get(q["mondai_group_id"], 1)
            if m_num_val in (1, 2, 3):
                storage_path = f"jlpt/n5/mock{padded}/listening_q{idx}_sheet_v4.png"
                local_png = tmp_dir / f"mock{padded}_q{idx}_sheet_v4.png"
                render_sheet_png(
                    is_single_scene=(m_num_val == 3),
                    question_number=idx,
                    prompt_text=q.get("stem_html") or "",
                    options=q.get("options") or [],
                    out_path=local_png,
                )
                sb.storage.from_("jlpt-media").upload(
                    path=storage_path,
                    file=local_png.read_bytes(),
                    file_options={"content-type": "image/png", "upsert": "true"},
                )
                sb.table("questions").update({"image_url": storage_path}).eq("id", q["id"]).execute()
                total_sheets += 1
            else:
                sb.table("questions").update({"image_url": None}).eq("id", q["id"]).execute()

            sys.stdout.write(f"\rSynced {code}: {total_sheets} enlarged visual sheets uploaded...")
            sys.stdout.flush()
        print()

    print(f"DONE: {total_sheets} oversized visual sheets live in Supabase Storage!")


if __name__ == "__main__":
    main()
