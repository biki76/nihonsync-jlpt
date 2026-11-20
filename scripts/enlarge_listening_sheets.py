#!/usr/bin/env python3
"""
Finetunes JLPT Listening Visual Sheets (_sheet_v5.png) to match traditional
monochrome black-and-white Japanese listening-test textbook line art:
- Mondai 1 (課題理解) & Mondai 2 (ポイント理解): 4 numbered blocks (1, 2, 3, 4)
  with clean black ink outlines, flat white background, and light-gray shading.
- Mondai 3 (発話表現): Single scene illustration with a bold arrow pointing
  to the person about to speak, everyday setting props, and zero text/bubbles.
- Mondai 4 (即時応答) & other non-visual items: image_url = None.
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

INK = "#141414"
WHITE = "#FFFFFF"
GRAY_LIGHT = "#E6E6E6"
GRAY_MID = "#CFCFCF"

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/system/fonts/Roboto-Bold.ttf",
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


def strip_html(raw: str | dict | None) -> str:
    if isinstance(raw, dict):
        raw = str(raw.get("text") or raw.get("label") or "")
    return re.sub(r"<[^>]+>", "", html.unescape(str(raw or ""))).strip()


def parse_clock_time(text: str) -> tuple[int, int] | None:
    m_dig = re.search(r"(\d{1,2})\s*[:：]\s*(\d{2})", text)
    if m_dig:
        return int(m_dig.group(1)), int(m_dig.group(2))

    m_ja = re.search(
        r"(十二|十一|十|九|八|七|六|五|四|三|二|一|\d{1,2})\s*時\s*(半|(?:三十|十五|四十五|\d{1,2})\s*分)?",
        text,
    )
    if m_ja:
        h_raw = m_ja.group(1)
        hour = int(h_raw) if h_raw.isdigit() else KANJI_NUMS.get(h_raw, 12)
        min_part = (m_ja.group(2) or "").strip()
        minute = 0
        if min_part == "半" or "三十" in min_part:
            minute = 30
        elif "十五" in min_part:
            minute = 15
        elif "四十五" in min_part:
            minute = 45
        elif re.search(r"\d+", min_part):
            minute = int(re.search(r"\d+", min_part).group(0))
        return hour, minute
    return None


def draw_person_figure(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    scale: float = 1.0,
    shade_coat: bool = False,
    facing_right: bool = True,
) -> None:
    """
    Draws an ordinary Japanese person with natural proportions, everyday hair,
    minimal clear facial expression, and light-gray shading.
    """
    s = scale
    head_r = int(28 * s)
    head_y = cy - int(58 * s)

    # Hair cap (clean black ink + subtle shade)
    draw.pieslice(
        [cx - head_r - int(2 * s), head_y - head_r - int(3 * s), cx + head_r + int(2 * s), head_y + int(4 * s)],
        start=180,
        end=360,
        fill=INK,
        outline=INK,
    )
    # Head
    draw.ellipse(
        [cx - head_r, head_y - head_r, cx + head_r, head_y + head_r],
        fill=WHITE,
        outline=INK,
        width=max(2, int(3 * s)),
    )
    # Re-draw hair top/bangs cleanly over forehead
    draw.pieslice(
        [cx - head_r, head_y - head_r, cx + head_r, head_y - int(4 * s)],
        start=180,
        end=360,
        fill=INK,
        outline=INK,
    )

    # Minimal facial expression (eyes + simple mouth)
    eye_dx = int(9 * s)
    eye_y = head_y + int(2 * s)
    eye_r = max(2, int(2.6 * s))
    draw.ellipse([cx - eye_dx - eye_r, eye_y - eye_r, cx - eye_dx + eye_r, eye_y + eye_r], fill=INK)
    draw.ellipse([cx + eye_dx - eye_r, eye_y - eye_r, cx + eye_dx + eye_r, eye_y + eye_r], fill=INK)
    mouth_w = int(7 * s)
    mouth_y = head_y + int(13 * s)
    if facing_right:
        draw.arc([cx - mouth_w, mouth_y - int(3 * s), cx + mouth_w, mouth_y + int(5 * s)], start=0, end=180, fill=INK, width=max(2, int(2.5 * s)))
    else:
        draw.line([cx - mouth_w, mouth_y + int(2 * s), cx + mouth_w, mouth_y + int(2 * s)], fill=INK, width=max(2, int(2.5 * s)))

    # Torso / everyday clothing
    coat_fill = GRAY_LIGHT if shade_coat else WHITE
    torso_top = head_y + head_r + int(4 * s)
    torso_bot = cy + int(46 * s)
    torso_hw = int(34 * s)
    draw.polygon(
        [
            (cx - torso_hw, torso_top),
            (cx + torso_hw, torso_top),
            (cx + int(40 * s), torso_bot),
            (cx - int(40 * s), torso_bot),
        ],
        fill=coat_fill,
        outline=INK,
    )
    draw.line(
        [(cx - torso_hw, torso_top), (cx + torso_hw, torso_top), (cx + int(40 * s), torso_bot), (cx - int(40 * s), torso_bot), (cx - torso_hw, torso_top)],
        fill=INK,
        width=max(2, int(3 * s)),
    )


def draw_clock_motif(draw: ImageDraw.ImageDraw, cx: int, cy: int, hour: int, minute: int, scale: float) -> None:
    r = int(68 * scale)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE, outline=INK, width=4)
    for tick in range(12):
        ang = math.radians(tick * 30 - 90)
        inner = r - (int(12 * scale) if tick % 3 == 0 else int(6 * scale))
        x0 = cx + int(inner * math.cos(ang))
        y0 = cy + int(inner * math.sin(ang))
        x1 = cx + int((r - 3) * math.cos(ang))
        y1 = cy + int((r - 3) * math.sin(ang))
        draw.line([x0, y0, x1, y1], fill=INK, width=3 if tick % 3 == 0 else 2)

    h_ang = math.radians(((hour % 12) + minute / 60.0) * 30 - 90)
    m_ang = math.radians(minute * 6 - 90)
    draw.line([cx, cy, cx + int(r * 0.50 * math.cos(h_ang)), cy + int(r * 0.50 * math.sin(h_ang))], fill=INK, width=6)
    draw.line([cx, cy, cx + int(r * 0.78 * math.cos(m_ang)), cy + int(r * 0.78 * math.sin(m_ang))], fill=INK, width=3)
    draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=INK)


def draw_single_motif(draw: ImageDraw.ImageDraw, text: str, cx: int, cy: int, scale: float = 1.0) -> None:
    s = scale
    clk = parse_clock_time(text)
    if clk:
        draw_clock_motif(draw, cx, cy, clk[0], clk[1], s)
        return

    # People / group scene
    m_ppl = re.search(r"(一|二|三|四|五|六|\d)\s*人", text)
    if m_ppl:
        raw_n = m_ppl.group(1)
        cnt = max(1, min(5, int(raw_n) if raw_n.isdigit() else KANJI_NUMS.get(raw_n, 2)))
        spacing = int(68 * s)
        start_x = cx - ((cnt - 1) * spacing) // 2
        for i in range(cnt):
            draw_person_figure(draw, start_x + i * spacing, cy + int(18 * s), scale=0.78 * s, shade_coat=(i % 2 == 1))
        return

    # Map / turning directions
    if any(k in text for k in ("まっすぐ", "まがり", "右", "左", "みぎ", "ひだり", "かど")):
        hw, hh = int(84 * s), int(68 * s)
        rw = int(18 * s)
        draw.rectangle([cx - hw, cy - hh, cx + hw, cy + hh], fill=WHITE, outline=INK, width=3)
        draw.rectangle([cx - rw, cy - hh, cx + rw, cy + hh], fill=GRAY_LIGHT, outline=INK, width=2)
        draw.rectangle([cx - hw, cy + int(12 * s), cx + hw, cy + int(34 * s)], fill=GRAY_LIGHT, outline=INK, width=2)
        draw.rectangle([cx - hw, cy - int(44 * s), cx + hw, cy - int(22 * s)], fill=GRAY_LIGHT, outline=INK, width=2)
        turn_y = cy - int(33 * s) if ("ふたつ" in text or "2つ" in text or "二" in text) else cy + int(23 * s)
        go_right = "右" in text or "みぎ" in text
        draw.line([cx, cy + hh - 6, cx, turn_y], fill=INK, width=5)
        if go_right:
            draw.line([cx, turn_y, cx + int(62 * s), turn_y], fill=INK, width=5)
            draw.polygon([(cx + int(74 * s), turn_y), (cx + int(54 * s), turn_y - int(11 * s)), (cx + int(54 * s), turn_y + int(11 * s))], fill=INK)
        else:
            draw.line([cx, turn_y, cx - int(62 * s), turn_y], fill=INK, width=5)
            draw.polygon([(cx - int(74 * s), turn_y), (cx - int(54 * s), turn_y - int(11 * s)), (cx - int(54 * s), turn_y + int(11 * s))], fill=INK)
        return

    # Clothing / shirt / bag / book / desk / food / vehicle / building line art
    if any(k in text for k in ("シャツ", "コート", "セーター", "ふく", "服")):
        shade = GRAY_MID if ("黒" in text or "くろ" in text) else (GRAY_LIGHT if ("青" in text or "あお" in text) else WHITE)
        pts = [
            (cx - int(36 * s), cy - int(52 * s)), (cx - int(14 * s), cy - int(52 * s)), (cx, cy - int(38 * s)),
            (cx + int(14 * s), cy - int(52 * s)), (cx + int(36 * s), cy - int(52 * s)), (cx + int(68 * s), cy - int(20 * s)),
            (cx + int(50 * s), cy + int(4 * s)), (cx + int(34 * s), cy - int(12 * s)), (cx + int(34 * s), cy + int(56 * s)),
            (cx - int(34 * s), cy + int(56 * s)), (cx - int(34 * s), cy - int(12 * s)), (cx - int(50 * s), cy + int(4 * s)),
            (cx - int(68 * s), cy - int(20 * s)),
        ]
        draw.polygon(pts, fill=shade, outline=INK)
        draw.line(pts + [pts[0]], fill=INK, width=3)
        return

    if any(k in text for k in ("じしょ", "辞書", "本", "ほん", "ノート")):
        draw.rectangle([cx - int(54 * s), cy - int(42 * s), cx, cy + int(42 * s)], fill=WHITE, outline=INK, width=3)
        draw.rectangle([cx, cy - int(42 * s), cx + int(54 * s), cy + int(42 * s)], fill=GRAY_LIGHT, outline=INK, width=3)
        return

    if any(k in text for k in ("ペン", "えんぴつ", "鉛筆")):
        draw.polygon([(cx - int(56 * s), cy + int(36 * s)), (cx + int(42 * s), cy - int(46 * s)), (cx + int(56 * s), cy - int(32 * s)), (cx - int(42 * s), cy + int(50 * s))], fill=GRAY_LIGHT, outline=INK)
        draw.line([(cx - int(56 * s), cy + int(36 * s)), (cx + int(42 * s), cy - int(46 * s)), (cx + int(56 * s), cy - int(32 * s)), (cx - int(42 * s), cy + int(50 * s)), (cx - int(56 * s), cy + int(36 * s))], fill=INK, width=3)
        return

    if any(k in text for k in ("パン", "たまご", "卵", "牛乳", "ぎゅうにゅう", "コーヒー", "お茶", "にく", "肉", "さかな", "魚")):
        draw.ellipse([cx - int(64 * s), cy - int(34 * s), cx + int(64 * s), cy + int(38 * s)], fill=WHITE, outline=INK, width=3)
        draw.ellipse([cx - int(44 * s), cy - int(20 * s), cx + int(44 * s), cy + int(22 * s)], fill=GRAY_LIGHT, outline=INK, width=2)
        return

    if any(k in text for k in ("電車", "でんしゃ", "バス", "車", "くるま")):
        draw.rounded_rectangle([cx - int(68 * s), cy - int(36 * s), cx + int(68 * s), cy + int(32 * s)], radius=12, fill=WHITE, outline=INK, width=3)
        draw.rectangle([cx - int(50 * s), cy - int(24 * s), cx + int(50 * s), cy + int(4 * s)], fill=GRAY_LIGHT, outline=INK, width=2)
        draw.ellipse([cx - int(46 * s), cy + int(20 * s), cx - int(22 * s), cy + int(44 * s)], fill=INK)
        draw.ellipse([cx + int(22 * s), cy + int(20 * s), cx + int(46 * s), cy + int(44 * s)], fill=INK)
        return

    # Fallback everyday scene character + desk/table
    draw_person_figure(draw, cx, cy + int(16 * s), scale=0.8 * s, shade_coat=True)
    draw.line([cx - int(62 * s), cy + int(46 * s), cx + int(62 * s), cy + int(46 * s)], fill=INK, width=3)


def draw_four_block_cell(draw: ImageDraw.ImageDraw, option_text: str, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2 + int(10)
    parts = [p.strip() for p in re.split(r"(?:と[\s\u3000]+|に[\s\u3000]+)", option_text.strip()) if p.strip()]
    if len(parts) >= 2:
        q_w = (x1 - x0) // 4
        draw_single_motif(draw, parts[0], x0 + q_w, cy, scale=0.72)
        draw_single_motif(draw, parts[1], x1 - q_w, cy, scale=0.72)
    else:
        draw_single_motif(draw, option_text, cx, cy, scale=0.95)


def render_sheet_png(
    is_single_scene: bool,
    prompt_text: str,
    options: list[str],
    out_path: Path,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    width = 960
    height = 640 if is_single_scene else 820
    img = Image.new("RGB", (width, height), WHITE)
    draw = ImageDraw.Draw(img)
    font_num = load_font(30)

    if is_single_scene:
        # Single-scene Verbal Expressions (発話表現) matching reference layout
        x0, y0, x1, y1 = 16, 16, width - 16, height - 16
        draw.rectangle([x0, y0, x1, y1], fill=WHITE, outline=INK, width=3)
        desk_y = y1 - 110
        draw.line([x0 + 24, desk_y, x1 - 24, desk_y], fill=INK, width=3)

        # Two characters in conversation (speaker on left, listener on right)
        sx, sy = x0 + 260, desk_y - 10
        lx, ly = x0 + 640, desk_y - 10
        draw_person_figure(draw, sx, sy, scale=1.35, shade_coat=True, facing_right=True)
        draw_person_figure(draw, lx, ly, scale=1.35, shade_coat=False, facing_right=False)

        # Everyday prop between them
        clean_prompt = strip_html(prompt_text)
        draw_single_motif(draw, clean_prompt, (sx + lx) // 2, desk_y - 45, scale=0.75)

        # Bold directional arrow pointing to the person who is about to speak
        tip_x, tip_y = sx + 55, sy - 108
        draw.line([(tip_x - 76, tip_y - 60), (tip_x - 18, tip_y - 14)], fill=INK, width=10)
        draw.polygon([(tip_x, tip_y), (tip_x - 38, tip_y - 8), (tip_x - 16, tip_y - 34)], fill=INK)
    else:
        # Four-block grid (1, 2, 3, 4) matching traditional textbook layout
        margin_x = 16
        margin_y = 16
        gap = 16
        card_w = (width - margin_x * 2 - gap) // 2
        card_h = (height - margin_y * 2 - gap) // 2

        for idx in range(min(4, len(options))):
            col = idx % 2
            row = idx // 2
            x0 = margin_x + col * (card_w + gap)
            y0 = margin_y + row * (card_h + gap)
            x1 = x0 + card_w
            y1 = y0 + card_h

            draw.rectangle([x0, y0, x1, y1], fill=WHITE, outline=INK, width=3)
            draw.text((x0 + 14, y0 + 10), str(idx + 1), fill=INK, font=font_num)
            draw_four_block_cell(draw, strip_html(options[idx]), (x0 + 20, y0 + 18, x1 - 16, y1 - 16))

    img.save(out_path, format="PNG", optimize=True)


def main() -> None:
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    tmp_dir = Path("/tmp/nihonsync_finetuned_v5")
    tmp_dir.mkdir(parents=True, exist_ok=True)

    exams = sb.table("exams").select("id, exam_code").order("exam_code").execute().data or []
    total_sheets = 0

    for exam in exams:
        code = exam["exam_code"]
        m_lvl = re.search(r"JLPT-(N[1-5])-MOCK-0?(\d+)", code, re.I)
        if not m_lvl:
            continue
        level_slug = m_lvl.group(1).lower()
        set_num = int(m_lvl.group(2))
        if level_slug != "n5" or set_num > 6:
            continue
        padded = f"{set_num:02d}"

        sec_rows = sb.table("exam_sections").select("id").eq("exam_id", exam["id"]).eq("section_code", "LISTENING").execute().data or []
        if not sec_rows:
            continue

        mg_rows = sb.table("mondai_groups").select("id, mondai_number").eq("section_id", sec_rows[0]["id"]).order("mondai_number").execute().data or []
        mg_num_by_id = {m["id"]: int(m["mondai_number"]) for m in mg_rows}

        q_rows = (
            sb.table("questions")
            .select("id, mondai_group_id, question_number, prompt_html, options")
            .in_("mondai_group_id", list(mg_num_by_id.keys()))
            .order("question_number")
            .execute()
            .data
            or []
        )

        for idx, q in enumerate(q_rows, start=1):
            m_num_val = mg_num_by_id.get(q["mondai_group_id"], 1)
            if m_num_val in (1, 2, 3):
                storage_path = f"jlpt/{level_slug}/mock{padded}/listening_q{idx}_sheet_v5.png"
                local_png = tmp_dir / f"mock{padded}_q{idx}_sheet_v5.png"
                render_sheet_png(
                    is_single_scene=(m_num_val == 3),
                    prompt_text=q.get("prompt_html") or "",
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

            sys.stdout.write(f"\rSynced {code}: {total_sheets} finetuned visual sheets uploaded...")
            sys.stdout.flush()
        print()

    print(f"DONE: {total_sheets} finetuned monochrome textbook visual sheets live in Supabase Storage!")


if __name__ == "__main__":
    main()
