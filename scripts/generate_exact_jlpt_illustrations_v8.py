#!/usr/bin/env python3
"""
Generates question-accurate 2D Japanese educational textbook illustrations
(_sheet_v8.png) matching JLPT listening exam booklets:
- Front-loads concrete physical scene descriptions (tokens 1..20) so every panel
  literally depicts the exact option or conversational scenario.
- Uses Cloudflare FLUX.1-Schnell + SDXL-Lightning first, then general (non-waifu)
  AI Horde models (640x512).
- Rejects split-screen diptychs, cropped heads, dark/NSFW blocks, and speech bubbles.
"""

import argparse
import base64
import html
import io
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont, ImageOps
from supabase import create_client

load_dotenv(dotenv_path=".env.local")
load_dotenv()

CF_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
HORDE_API_KEY = os.environ.get("AI_HORDE_API_KEY", "").strip() or "0000000000"
HORDE_BASE = "https://aihorde.net/api/v2"

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

GENERAL_HORDE_MODELS: List[str] = [
    "FLUX.1-Schnell",
    "AlbedoBase XL (SDXL)",
    "Juggernaut XL",
    "Dreamshaper XL",
]

FONT_CANDIDATES: List[str] = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/system/fonts/Roboto-Regular.ttf",
]

STYLE_SUFFIX = (
    "Japanese language textbook black-and-white ink line drawing, "
    "clean simple black outlines on pure white background, minimal flat light-gray shading, "
    "educational exam illustration, no text, no speech bubbles"
)

NEGATIVE_PROMPT = (
    "anime girl, waifu, kimono, martial arts, split screen, two panels, diptych, "
    "character sheet, turnaround, speech bubble, text, kanji, hiragana, letters, "
    "watermark, logo, color, photorealistic, 3d, dark background, black background, "
    "cropped head, headless, nsfw"
)

JA_VISUAL_HINTS: List[Tuple[str, str]] = [
    ("たまご", "carton of eggs"),
    ("パン", "loaf of bread"),
    ("さとう", "bowl of white sugar with a spoon"),
    ("ぎゅうにゅう", "bottle of milk"),
    ("牛乳", "bottle of milk"),
    ("りんご", "three apples on a plate"),
    ("にく", "plate of grilled steak meat with chopsticks"),
    ("肉", "plate of grilled steak meat with chopsticks"),
    ("さかな", "plate of grilled whole fish with chopsticks"),
    ("魚", "plate of grilled whole fish with chopsticks"),
    ("やさい", "bowl of fresh vegetable salad with chopsticks"),
    ("野菜", "bowl of fresh vegetable salad with chopsticks"),
    ("カレー", "plate of Japanese curry rice with a spoon"),
    ("ラーメン", "bowl of ramen noodles with chopsticks"),
    ("コーヒー", "cup of hot coffee on a saucer"),
    ("おちゃ", "Japanese teacup of green tea"),
    ("お茶", "Japanese teacup of green tea"),
    ("みず", "glass of water"),
    ("水", "glass of water"),
    ("でんしゃ", "commuter train at a station platform"),
    ("電車", "commuter train at a station platform"),
    ("バス", "city bus at a bus stop"),
    ("タクシー", "taxi car on a city street"),
    ("じてんしゃ", "bicycle parked on a street"),
    ("自転車", "bicycle parked on a street"),
    ("あるいて", "person walking on a sidewalk"),
    ("歩いて", "person walking on a sidewalk"),
    ("かさ", "person holding an open umbrella"),
    ("傘", "person holding an open umbrella"),
    ("とけい", "round wall clock"),
    ("時計", "round wall clock"),
    ("じしょ", "thick dictionary book on a desk"),
    ("辞書", "thick dictionary book on a desk"),
    ("えんぴつ", "wooden pencil on a desk"),
    ("鉛筆", "wooden pencil on a desk"),
    ("けしゴム", "rectangular eraser on a desk"),
    ("ノート", "open notebook on a desk"),
    ("かばん", "shoulder bag on a table"),
    ("でんわ", "person talking on a telephone at a desk"),
    ("電話", "person talking on a telephone at a desk"),
    ("コピー", "office worker using a photocopier machine"),
    ("いす", "person arranging chairs around a meeting table"),
    ("そうじ", "person sweeping the floor with a broom"),
    ("さら", "person washing dishes at a kitchen sink"),
    ("りょうり", "person cooking with a frying pan in a kitchen"),
    ("べんきょう", "student studying with an open book at a desk"),
    ("勉強", "student studying with an open book at a desk"),
    ("ねます", "person sleeping in a bed"),
    ("寝ます", "person sleeping in a bed"),
    ("おきます", "person waking up next to an alarm clock"),
    ("起きます", "person waking up next to an alarm clock"),
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def clean_text(raw: str) -> str:
    no_rt = re.sub(r"<rt[^>]*>.*?</rt>", "", raw or "", flags=re.I | re.S)
    return re.sub(r"<[^>]+>", "", html.unescape(no_rt)).strip()


def classify_layout(category: str, question_type: str, local_idx: int) -> Optional[str]:
    combined = f"{category} {question_type}".lower()
    if local_idx <= 12 or any(
        k in combined for k in ("task", "point", "key_points", "課題理解", "ポイント理解")
    ):
        return "four_block"
    if 13 <= local_idx <= 17 or any(k in combined for k in ("verbal", "発話表現")):
        return "single_scene"
    return None


def get_ordered_listening_db_ids(exam_code: str) -> List[str]:
    ex = sb.table("exams").select("id").eq("exam_code", exam_code).maybe_single().execute()
    if not ex.data:
        return []
    sec = (
        sb.table("exam_sections")
        .select("id")
        .eq("exam_id", ex.data["id"])
        .eq("section_code", "LISTENING")
        .maybe_single()
        .execute()
    )
    if not sec.data:
        return []
    mgs = (
        sb.table("mondai_groups")
        .select("id, mondai_number")
        .eq("section_id", sec.data["id"])
        .order("mondai_number")
        .execute()
        .data
        or []
    )
    ids: List[str] = []
    for mg in mgs:
        qs = (
            sb.table("questions")
            .select("id, question_number")
            .eq("mondai_group_id", mg["id"])
            .order("question_number")
            .execute()
            .data
            or []
        )
        for q in qs:
            ids.append(q["id"])
    return ids


def update_question_by_id(q_id: str, fields: Dict[str, Any]) -> None:
    for attempt in range(5):
        try:
            sb.table("questions").update(fields).eq("id", q_id).execute()
            return
        except Exception:
            if attempt == 4:
                raise
            time.sleep(1.5 * (attempt + 1))


def fallback_english_scene(ja_text: str, is_single_scene: bool = False) -> str:
    matched = [eng for ja, eng in JA_VISUAL_HINTS if ja in ja_text]
    time_m = re.search(r"(\d{1,2}|[一二三四五六七八九十]+)\s*時(\s*半)?", ja_text)
    if time_m:
        matched.append(f"round wall clock showing {time_m.group(0)}")
    if is_single_scene:
        detail = ", ".join(matched[:2]) if matched else "everyday classroom or home table"
        return (
            f"two ordinary Japanese people in modern casual clothes conversing near {detail}, "
            "full heads and upper bodies visible"
        )
    if matched:
        return f"single clear object or action showing {' and '.join(matched[:2])} on a white background"
    return "ordinary Japanese person in modern casual clothes performing an everyday task at a desk"


def plan_visual_prompts(
    client: httpx.Client,
    layout: str,
    prompt_ja: str,
    transcript_ja: str,
    options: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if layout == "single_scene":
        sys_msg = (
            "You write ultra-concise 14-word English visual descriptions for Japanese JLPT N5 "
            "listening test illustrations. Describe the exact physical setting and two ordinary "
            "Japanese people in modern everyday clothes (never kimonos, never anime fantasy). "
            "Include exact props (doorway, dining table, classroom desk, shop counter, train). "
            "No speech bubbles, no text. "
            'Return ONLY JSON: {"scene": "14-word concrete English scene", "speaker_side": "left" or "right"}'
        )
        user_msg = f"Situation: {prompt_ja}\nDialogue: {transcript_ja}"
    else:
        sys_msg = (
            "You translate JLPT N5 listening options into 4 ultra-concise 10-to-14-word English "
            "visual descriptions for educational textbook illustrations. Each description must "
            "literally depict the exact physical objects, food, clock time, vehicle, or action "
            "in that option. Never use kimonos, anime tropes, text, or speech bubbles. "
            'Return ONLY JSON: {"panels": ["scene 1", "scene 2", "scene 3", "scene 4"]}'
        )
        opts_str = "\n".join(f"{o['index']}. {clean_text(o.get('text', ''))}" for o in options)
        user_msg = f"Question: {prompt_ja}\nDialogue: {transcript_ja}\nOptions:\n{opts_str}"

    if CF_ACCOUNT_ID and CF_API_TOKEN:
        cf_url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct"
        try:
            resp = client.post(
                cf_url,
                headers={"Authorization": f"Bearer {CF_API_TOKEN}", "Content-Type": "application/json"},
                json={
                    "messages": [
                        {"role": "system", "content": sys_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    "max_tokens": 360,
                    "temperature": 0.15,
                },
                timeout=30.0,
            )
            if resp.status_code == 200:
                raw_out = resp.json().get("result", {}).get("response", "")
                parsed = raw_out if isinstance(raw_out, dict) else None
                if isinstance(raw_out, str):
                    cleaned_json = re.sub(r"```(?:json)?|```", "", raw_out).strip()
                    m = re.search(r"\{.*\}", cleaned_json, re.S)
                    if m:
                        parsed = json.loads(m.group(0))
                if isinstance(parsed, dict):
                    if layout == "single_scene" and isinstance(parsed.get("scene"), str) and len(parsed["scene"].strip()) > 8:
                        return {
                            "scene": parsed["scene"].strip()[:150],
                            "speaker_side": "left" if parsed.get("speaker_side") == "left" else "right",
                        }
                    if layout == "four_block" and isinstance(parsed.get("panels"), list) and len(parsed["panels"]) >= 4:
                        panels_clean = [str(p).strip()[:140] for p in parsed["panels"][:4]]
                        if all(len(p) > 6 for p in panels_clean):
                            return {"panels": panels_clean}
        except Exception:
            pass

    if layout == "single_scene":
        return {
            "scene": fallback_english_scene(f"{prompt_ja} {transcript_ja}", is_single_scene=True),
            "speaker_side": "right",
        }
    return {
        "panels": [
            fallback_english_scene(f"{prompt_ja} {clean_text(o.get('text', ''))}")
            for o in options[:4]
        ]
    }


def auto_zoom_monochrome(img_rgb: Image.Image) -> Image.Image:
    gray = img_rgb.convert("L")
    inv = gray.point(lambda px: 255 if px < 225 else 0)
    bbox = inv.getbbox()
    if not bbox:
        return img_rgb

    w, h = img_rgb.size
    x0, y0, x1, y1 = bbox
    pad_x = max(10, int((x1 - x0) * 0.06))
    pad_top = max(16, int((y1 - y0) * 0.08))
    pad_bot = max(10, int((y1 - y0) * 0.05))

    cx0 = max(0, x0 - pad_x)
    cy0 = max(0, y0 - pad_top)
    cx1 = min(w, x1 + pad_x)
    cy1 = min(h, y1 + pad_bot)

    if (cx1 - cx0) < int(w * 0.45) or (cy1 - cy0) < int(h * 0.45):
        return img_rgb
    return img_rgb.crop((cx0, cy0, cx1, cy1))


def normalize_and_validate_panel(raw_bytes: bytes) -> Tuple[Image.Image, bool, str]:
    gray = Image.open(io.BytesIO(raw_bytes)).convert("L")
    w, h = gray.size
    hist = gray.histogram()
    total_px = max(1, sum(hist))

    # 1. Reject NSFW block or dark background
    dark_ratio = sum(hist[:110]) / total_px
    bright_ratio = sum(hist[205:]) / total_px
    if dark_ratio > 0.28 or bright_ratio < 0.54:
        return gray.convert("RGB"), False, f"dark_or_nsfw ({dark_ratio:.2f})"

    # 2. Reject blank canvas
    ink_ratio = sum(hist[:175]) / total_px
    if ink_ratio < 0.025:
        return gray.convert("RGB"), False, "blank_canvas"

    # 3. Reject top-cropped heads
    top_strip = gray.crop((0, 0, w, max(1, int(h * 0.06))))
    top_hist = top_strip.histogram()
    top_dark = sum(top_hist[:130]) / max(1, sum(top_hist))
    if top_dark > 0.15:
        return gray.convert("RGB"), False, f"top_cropped_head ({top_dark:.2f})"

    # 4. Reject split-panel diptychs (heavy vertical divider line near center)
    mid_x = w // 2
    center_band = gray.crop((mid_x - 6, int(h * 0.05), mid_x + 6, int(h * 0.95)))
    c_hist = center_band.histogram()
    center_dark = sum(c_hist[:100]) / max(1, sum(c_hist))
    if center_dark > 0.42:
        return gray.convert("RGB"), False, f"split_panel_divider ({center_dark:.2f})"

    gray = ImageOps.autocontrast(gray, cutoff=1)

    def map_tone(px: int) -> int:
        if px >= 224:
            return 255
        if px <= 78:
            return 20
        return min(238, max(182, int(182 + (px - 78) * 0.38)))

    cleaned = gray.point(map_tone).convert("RGB")
    return auto_zoom_monochrome(cleaned), True, "ok"


def build_frontloaded_prompt(scene_desc: str) -> str:
    clean_scene = re.sub(r"\s+", " ", str(scene_desc)).strip().rstrip(".")
    return f"{clean_scene}, {STYLE_SUFFIX}"


def generate_panel_cloudflare(
    client: httpx.Client, scene_desc: str, state: Dict[str, bool]
) -> Optional[Image.Image]:
    if not CF_ACCOUNT_ID or not CF_API_TOKEN:
        state["cf_flux_exhausted"] = True
        state["cf_sdxl_exhausted"] = True
        return None

    headers = {"Authorization": f"Bearer {CF_API_TOKEN}", "Content-Type": "application/json"}
    prompt = build_frontloaded_prompt(scene_desc)

    # 1. Try FLUX.1-Schnell (steps=2 for low neuron usage & crisp 2D ink art)
    if not state["cf_flux_exhausted"]:
        flux_url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell"
        for attempt in range(2):
            try:
                time.sleep(0.3)
                resp = client.post(flux_url, headers=headers, json={"prompt": prompt, "steps": 2}, timeout=55.0)
                if resp.status_code == 429:
                    state["cf_flux_exhausted"] = True
                    break
                if resp.status_code < 400:
                    ctype = resp.headers.get("content-type", "")
                    img_bytes = (
                        base64.b64decode(resp.json()["result"]["image"])
                        if "application/json" in ctype
                        else resp.content
                    )
                    img, valid, _ = normalize_and_validate_panel(img_bytes)
                    if valid:
                        return img
            except Exception:
                time.sleep(1.0)

    # 2. Try SDXL-Lightning on Cloudflare
    if not state["cf_sdxl_exhausted"]:
        sdxl_url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/bytedance/stable-diffusion-xl-lightning"
        for attempt in range(2):
            try:
                time.sleep(0.3)
                resp = client.post(
                    sdxl_url,
                    headers=headers,
                    json={
                        "prompt": prompt,
                        "negative_prompt": NEGATIVE_PROMPT,
                        "width": 640,
                        "height": 512,
                    },
                    timeout=55.0,
                )
                if resp.status_code == 429:
                    state["cf_sdxl_exhausted"] = True
                    break
                if resp.status_code < 400:
                    ctype = resp.headers.get("content-type", "")
                    img_bytes = (
                        base64.b64decode(resp.json()["result"]["image"])
                        if "application/json" in ctype
                        else resp.content
                    )
                    img, valid, _ = normalize_and_validate_panel(img_bytes)
                    if valid:
                        return img
            except Exception:
                time.sleep(1.0)

    return None


def generate_panel_aihorde_general(client: httpx.Client, scene_desc: str) -> Image.Image:
    positive = build_frontloaded_prompt(scene_desc)
    payload: Dict[str, Any] = {
        "prompt": f"{positive} ### {NEGATIVE_PROMPT}",
        "models": GENERAL_HORDE_MODELS,
        "params": {
            "sampler_name": "k_euler_a",
            "cfg_scale": 6.5,
            "width": 640,
            "height": 512,
            "steps": 20,
            "n": 1,
        },
        "nsfw": False,
        "censor_nsfw": True,
        "r2": True,
        "shared": False,
    }
    headers = {
        "apikey": HORDE_API_KEY,
        "Client-Agent": "NihonSync-JLPT:4.0:github.com/biki76/nihonsync-jlpt",
        "Content-Type": "application/json",
    }

    best_fallback: Optional[Image.Image] = None
    for attempt in range(8):
        try:
            resp = client.post(f"{HORDE_BASE}/generate/async", headers=headers, json=payload, timeout=35.0)
            if resp.status_code in (400, 429):
                time.sleep(min(12.0 + attempt * 4.0, 35.0))
                continue
            resp.raise_for_status()
            job_id = resp.json()["id"]

            for _ in range(90):
                time.sleep(4.0)
                st_resp = client.get(f"{HORDE_BASE}/generate/status/{job_id}", headers=headers, timeout=25.0)
                if st_resp.status_code == 429:
                    time.sleep(5.0)
                    continue
                if st_resp.status_code == 404:
                    break
                st = st_resp.json()
                if st.get("faulted"):
                    break
                if st.get("done"):
                    gens = st.get("generations") or []
                    if not gens or not gens[0].get("img"):
                        break
                    img_ref = gens[0]["img"]
                    raw_bytes = (
                        client.get(img_ref, timeout=45.0).content
                        if img_ref.startswith("http")
                        else base64.b64decode(img_ref)
                    )
                    img, valid, _ = normalize_and_validate_panel(raw_bytes)
                    if valid:
                        return img
                    best_fallback = img
                    break
        except Exception:
            time.sleep(4.0)

    if best_fallback is not None:
        return best_fallback
    raise RuntimeError("Failed to generate a clean textbook panel after retries.")


def generate_panels_for_question(
    client: httpx.Client,
    scene_descs: List[str],
    label: str,
    state: Dict[str, bool],
) -> List[Image.Image]:
    panels: List[Image.Image] = []
    for idx, desc in enumerate(scene_descs, start=1):
        print(f"    [{label} • Panel {idx}/{len(scene_descs)}] Scene: {desc}")
        img = generate_panel_cloudflare(client, desc, state)
        if img is None:
            img = generate_panel_aihorde_general(client, desc)
        panels.append(img)
    return panels


def draw_speaker_arrow(draw: ImageDraw.ImageDraw, tip_x: int, tip_y: int, from_left: bool) -> None:
    ink = "#141414"
    dx = -70 if from_left else 70
    dy = -54
    start = (tip_x + dx, tip_y + dy)
    end = (tip_x + (-18 if from_left else 18), tip_y - 14)
    draw.line([start, end], fill="#FFFFFF", width=26)
    draw.line([start, end], fill=ink, width=18)
    head = (
        [(tip_x, tip_y), (tip_x - 40, tip_y - 6), (tip_x - 16, tip_y - 38)]
        if from_left
        else [(tip_x, tip_y), (tip_x + 40, tip_y - 6), (tip_x + 16, tip_y - 38)]
    )
    draw.polygon(head, fill=ink)


def compose_four_block_sheet(panel_images: List[Image.Image], out_path: Path) -> None:
    W, H = 1000, 760
    margin, gap = 12, 14
    box_w = (W - margin * 2 - gap) // 2
    box_h = (H - margin * 2 - gap) // 2

    canvas = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(canvas)
    num_font = load_font(38)

    for idx in range(4):
        col, row = idx % 2, idx // 2
        x0 = margin + col * (box_w + gap)
        y0 = margin + row * (box_h + gap)
        x1, y1 = x0 + box_w, y0 + box_h

        panel = ImageOps.fit(panel_images[idx], (box_w - 6, box_h - 6), method=Image.Resampling.LANCZOS)
        canvas.paste(panel, (x0 + 3, y0 + 3))
        draw.rectangle([x0, y0, x1, y1], outline="#141414", width=3)
        draw.rectangle([x0 + 6, y0 + 6, x0 + 44, y0 + 50], fill="#FFFFFF")
        draw.text((x0 + 14, y0 + 8), str(idx + 1), fill="#141414", font=num_font)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def compose_single_scene_sheet(scene_img: Image.Image, speaker_side: str, out_path: Path) -> None:
    W, H = 1000, 680
    margin = 14
    inner_w, inner_h = W - margin * 2, H - margin * 2

    canvas = Image.new("RGB", (W, H), "#FFFFFF")
    fitted = ImageOps.fit(scene_img, (inner_w, inner_h), method=Image.Resampling.LANCZOS)
    canvas.paste(fitted, (margin, margin))

    draw = ImageDraw.Draw(canvas)
    draw.rectangle([margin, margin, W - margin, H - margin], outline="#141414", width=3)

    if speaker_side == "left":
        draw_speaker_arrow(
            draw,
            tip_x=margin + int(inner_w * 0.36),
            tip_y=margin + int(inner_h * 0.22),
            from_left=False,
        )
    else:
        draw_speaker_arrow(
            draw,
            tip_x=margin + int(inner_w * 0.56),
            tip_y=margin + int(inner_h * 0.22),
            from_left=True,
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def upload_storage_with_retry(local_png: Path, storage_path: str) -> None:
    payload = local_png.read_bytes()
    for attempt in range(5):
        try:
            sb.storage.from_("jlpt-media").upload(
                path=storage_path,
                file=payload,
                file_options={"content-type": "image/png", "upsert": "true"},
            )
            return
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2.0 * (attempt + 1))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", type=int, default=0, help="Only process set 1..6 (0 = all sets)")
    parser.add_argument("--force", action="store_true", help="Regenerate even if cached v8 PNG exists")
    args = parser.parse_args()

    compiled_path = Path("data/compiled_n5_6sets.json")
    exams = json.loads(compiled_path.read_text(encoding="utf-8"))
    cache_root = Path("data/generated_listening_sheets_v8")
    state = {"cf_flux_exhausted": False, "cf_sdxl_exhausted": False}

    with httpx.Client(http2=False) as http_client:
        for exam in exams:
            meta = exam["exam_metadata"]
            set_num = int(meta["test_number"])
            if args.set and set_num != args.set:
                continue

            code = meta["exam_code"]
            padded = f"{set_num:02d}"
            db_ids = get_ordered_listening_db_ids(code)
            print(f"\n=== Generating Question-Accurate 2D Textbook Line Art (v8) for {code} ===")

            listening_sec = next(s for s in exam["sections"] if s["section_code"] == "LISTENING")
            local_idx = 0

            for mg in listening_sec["mondai_groups"]:
                q_type = mg.get("question_type", "")
                for q in mg["questions"]:
                    local_idx += 1
                    db_q_id = db_ids[local_idx - 1] if local_idx <= len(db_ids) else None
                    layout = classify_layout(q.get("category", ""), q_type, local_idx)

                    if layout is None:
                        q["image_url"] = None
                        if db_q_id:
                            update_question_by_id(db_q_id, {"image_url": None})
                        continue

                    storage_path = f"jlpt/n5/mock{padded}/listening_q{local_idx}_sheet_v8.png"
                    local_png = cache_root / storage_path

                    if not local_png.exists() or args.force:
                        prompt_ja = clean_text(q.get("prompt_html", ""))
                        transcript_ja = clean_text(q.get("transcript_ja", ""))
                        print(f"\n  [{code} Q{local_idx}] {prompt_ja}")
                        plan = plan_visual_prompts(
                            http_client, layout, prompt_ja, transcript_ja, q["options"]
                        )

                        if layout == "single_scene":
                            side = plan.get("speaker_side", "right")
                            pos_hint = (
                                "speaker on the left, listener on the right"
                                if side == "left"
                                else "listener on the left, speaker on the right"
                            )
                            imgs = generate_panels_for_question(
                                http_client, [f"{plan['scene']}, {pos_hint}"], f"{code} Q{local_idx}", state
                            )
                            compose_single_scene_sheet(imgs[0], side, local_png)
                        else:
                            panels = generate_panels_for_question(
                                http_client, plan["panels"][:4], f"{code} Q{local_idx}", state
                            )
                            compose_four_block_sheet(panels, local_png)

                    upload_storage_with_retry(local_png, storage_path)
                    q["image_url"] = storage_path
                    if db_q_id:
                        update_question_by_id(db_q_id, {"image_url": storage_path})

                    print(f"  Synced {code} Q{local_idx} ({layout}) -> {storage_path}")

            compiled_path.write_text(json.dumps(exams, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\nDONE: Question-accurate 2D JLPT textbook illustrations (_sheet_v8.png) synced!")


if __name__ == "__main__":
    main()
