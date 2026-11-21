#!/usr/bin/env python3
"""
v10 JLPT N5 Listening Textbook Illustration Generator (_sheet_v10.png):
- Maps every option (1..4) and single-scene scenario (Q13..Q17) directly to its
  exact Japanese question reference without injecting classroom whiteboards.
- Uses Cloudflare FLUX.1-Schnell + SDXL-Lightning first, then general (non-waifu)
  AI Horde models (640x512).
- Enforces quality validation against dark/NSFW blocks, cropped heads, split
  diptychs, and floating pseudo-kanji scribbles.
"""

import argparse
import base64
import html
import io
import json
import os
import re
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
    "Japanese language examination textbook black-and-white ink line drawing, "
    "clean confident black outlines on pure flat white background, minimal flat light-gray shading, "
    "ordinary Japanese people in modern everyday clothing, clear full heads and anatomically "
    "accurate hands, silent educational exam illustration, zero speech bubbles, zero text"
)

NEGATIVE_PROMPT = (
    "whiteboard, blackboard, chalkboard, floating kanji, pseudo-text, speech bubble, "
    "speech balloon, thought bubble, captions, subtitles, multiple clocks, overlapping clock, "
    "faceless, blank face, missing face, disembodied legs, anime girl, waifu, kimono, "
    "split screen, diptych, character sheet, watermark, logo, color, photorealistic, 3d, "
    "dark background, black background, cropped head, headless, nsfw"
)

EXACT_N5_SCENES: Dict[Tuple[int, int], Dict[str, Any]] = {
    (1, 1): {
        "panels": [
            "close-up tabletop view of a ballpoint pen and a thick dictionary book side by side on a clean desk",
            "close-up tabletop view of a ballpoint pen and a rectangular eraser side by side on a clean desk",
            "close-up tabletop view of a wooden pencil and a thick dictionary book side by side on a clean desk",
            "close-up tabletop view of a wooden pencil and a rectangular eraser side by side on a clean desk",
        ]
    },
    (1, 2): {
        "panels": [
            "man and woman meeting at a train station ticket gate beneath one round analog clock showing 6:30",
            "man and woman meeting at a train station ticket gate beneath one round analog clock showing 5:00",
            "man and woman meeting at a train station ticket gate beneath one round analog clock showing 6:00",
            "man and woman meeting at a train station ticket gate beneath one round analog clock showing 5:30",
        ]
    },
    (1, 5): {
        "panels": [
            "four friends standing together at a restaurant entrance beneath one round wall clock showing 7:00",
            "four friends standing together at a restaurant entrance beneath one round wall clock showing 5:30",
            "four friends standing together at a restaurant entrance beneath one round wall clock showing 6:00",
            "five friends standing together at a restaurant entrance beneath one round wall clock showing 5:30",
        ]
    },
    (1, 6): {
        "panels": [
            "neat stack of waste paper tied with string placed at a neighborhood garbage collection spot",
            "empty glass bottles inside a recycling crate placed at a neighborhood garbage collection spot",
            "tied plastic bag of kitchen food waste placed at a neighborhood garbage collection spot",
            "folded stack of newspapers tied with string placed at a neighborhood garbage collection spot",
        ]
    },
    (1, 7): {
        "panels": [
            "man standing on a train station platform looking at a stopped commuter train",
            "man waking up late in bed looking shocked at a bedside alarm clock",
            "man standing at a street intersection looking confused at a paper map",
            "man waiting impatiently beside a bus stop sign looking down an empty road",
        ]
    },
    (1, 8): {
        "panels": [
            "close-up dining table view of a man eating grilled steak meat on a plate with chopsticks and rice bowl",
            "close-up dining table view of a man eating a large bowl of fresh vegetable salad with chopsticks and rice bowl",
            "close-up dining table view of a man eating cooked grilled fish on a plate with chopsticks and rice bowl",
            "close-up dining table view of a man eating sliced bread and toast on a plate with a cup of coffee",
        ]
    },
    (1, 9): {
        "panels": [
            "four family members gathered together in a cozy home living room",
            "six family members gathered together in a cozy home living room",
            "three family members gathered together in a cozy home living room",
            "five family members gathered together in a cozy home living room",
        ]
    },
    (1, 10): {
        "panels": [
            "man and woman talking in an office beneath one wall calendar showing Friday and one round clock showing 7:00",
            "man and woman talking in an office beneath one wall calendar showing Thursday and one round clock showing 7:00",
            "man and woman talking in an office beneath one wall calendar showing Friday and one round clock showing 8:00",
            "man and woman talking in an office beneath one wall calendar showing Thursday and one round clock showing 8:00",
        ]
    },
    (1, 11): {
        "panels": [
            "clothing store display of a pure white collared shirt on a hanger with a large L size tag",
            "clothing store display of a shaded dark-gray collared shirt on a hanger with a large L size tag",
            "clothing store display of a shaded dark-gray collared shirt on a hanger with a medium M size tag",
            "clothing store display of a pure white collared shirt on a hanger with a medium M size tag",
        ]
    },
    (1, 12): {
        "panels": [
            "mother father and child walking together with rolling travel suitcases at a train station",
            "mother walking with her elementary school child carrying a school backpack toward a school gate",
            "woman resting sick in bed with a cooling towel on her forehead and medicine on a nightstand",
            "mother sitting beside her sick child in bed checking the child's forehead with a thermometer",
        ]
    },
    (1, 13): {
        "scene": (
            "home entrance doorway genkan, host in casual home clothes standing inside on left, "
            "guest wearing jacket and carrying bag bowing goodbye at open front door on right"
        ),
        "speaker_side": "right",
        "speaker_posture": "standing",
    },
    (1, 14): {
        "scene": (
            "modern office room, coworker seated at desk on left typing on laptop computer, "
            "departing coworker on right wearing suit jacket holding briefcase near exit door"
        ),
        "speaker_side": "right",
        "speaker_posture": "standing",
    },
    (1, 16): {
        "scene": (
            "cozy living room, sick friend on left wearing surgical mask and sweater seated by table "
            "with tissue box and mug, visiting friend on right standing with bag ready to leave"
        ),
        "speaker_side": "right",
        "speaker_posture": "standing",
    },
    (1, 17): {
        "scene": (
            "two university students seated across a desk, left student with notebook and a pen "
            "clearly visible on the table, right student reaching politely toward the pen"
        ),
        "speaker_side": "right",
        "speaker_posture": "seated",
    },
}


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


def plan_visual_prompts(
    client: httpx.Client,
    set_num: int,
    local_idx: int,
    layout: str,
    prompt_ja: str,
    transcript_ja: str,
    options: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if (set_num, local_idx) in EXACT_N5_SCENES:
        return EXACT_N5_SCENES[(set_num, local_idx)]

    opts_str = "\n".join(f"{o['index']}. {clean_text(o.get('text', ''))}" for o in options)

    if layout == "single_scene":
        sys_msg = (
            "You write exact 16-word English visual scenes for official Japanese JLPT N5 listening "
            "illustrations. Read the situation and options carefully, then describe the exact "
            "everyday setting (home doorway, living room, restaurant, shop, train station, or office) "
            "and two distinct ordinary Japanese people with full facial features at the exact moment "
            "the speaker is about to speak. NEVER include whiteboards unless the prompt explicitly "
            "mentions a teacher/classroom. Never include speech bubbles or text. "
            'Return ONLY JSON: {"scene": "...", "speaker_side": "left" or "right", '
            '"speaker_posture": "seated" or "standing"}'
        )
        user_msg = f"Situation: {prompt_ja}\nDialogue: {transcript_ja}\nOptions:\n{opts_str}"
    else:
        sys_msg = (
            "You translate JLPT N5 listening questions and ALL 4 options into 4 exact 14-to-18-word "
            "English visual descriptions for educational textbook illustrations. "
            "Rules:\n"
            "1. Match the EXACT setting of the question (e.g., family home living room for living-together "
            "questions, dining table close-ups for food questions, clothing store hangers with M/L tags "
            "for shirt size/color questions, station/family travel scenes for absence reasons). "
            "NEVER add a whiteboard unless the question is about a classroom.\n"
            "2. If options specify BOTH a day of the week and a clock time, show ONE wall calendar "
            "and ONE round clock in the upper wall above the people.\n"
            "3. If options specify a count of people (e.g. 3, 4, 5, 6 people), draw that EXACT count "
            "of distinct people clearly visible.\n"
            "4. Zero floating text, zero speech bubbles.\n"
            'Return ONLY JSON: {"panels": ["scene 1", "scene 2", "scene 3", "scene 4"]}'
        )
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
                    "max_tokens": 420,
                    "temperature": 0.1,
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
                            "scene": parsed["scene"].strip()[:175],
                            "speaker_side": "left" if parsed.get("speaker_side") == "left" else "right",
                            "speaker_posture": "seated" if parsed.get("speaker_posture") == "seated" else "standing",
                        }
                    if layout == "four_block" and isinstance(parsed.get("panels"), list) and len(parsed["panels"]) >= 4:
                        panels_clean = [str(p).strip()[:165] for p in parsed["panels"][:4]]
                        if all(len(p) > 6 for p in panels_clean):
                            return {"panels": panels_clean}
        except Exception:
            pass

    if layout == "single_scene":
        return {
            "scene": f"two ordinary Japanese people in an everyday setting, {prompt_ja}",
            "speaker_side": "right",
            "speaker_posture": "standing",
        }
    return {
        "panels": [
            f"clear Japanese textbook illustration depicting {clean_text(o.get('text', ''))}"
            for o in options[:4]
        ]
    }


def has_floating_text_or_bubble(gray: Image.Image) -> bool:
    w, h = gray.size
    y_top = int(h * 0.06)
    y_bot = int(h * 0.36)
    cols, rows = 8, 4
    cell_w = max(1, w // cols)
    cell_h = max(1, (y_bot - y_top) // rows)

    isolated_speck_cells = 0
    for r in range(rows):
        for c in range(cols):
            x0 = c * cell_w
            y0 = y_top + r * cell_h
            x1 = min(w, x0 + cell_w)
            y1 = min(y_bot, y0 + cell_h)
            cell = gray.crop((x0, y0, x1, y1))
            hist = cell.histogram()
            ink = sum(hist[:135]) / max(1, sum(hist))
            if 0.03 <= ink <= 0.24:
                border_top = cell.crop((0, 0, x1 - x0, 2)).histogram()
                border_bot = cell.crop((0, max(0, y1 - y0 - 2), x1 - x0, y1 - y0)).histogram()
                b_ink = (sum(border_top[:135]) + sum(border_bot[:135])) / max(
                    1, sum(border_top) + sum(border_bot)
                )
                if b_ink < 0.02:
                    isolated_speck_cells += 1

    return isolated_speck_cells >= 2


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

    dark_ratio = sum(hist[:110]) / total_px
    bright_ratio = sum(hist[205:]) / total_px
    if dark_ratio > 0.28 or bright_ratio < 0.54:
        return gray.convert("RGB"), False, f"dark_or_nsfw ({dark_ratio:.2f})"

    ink_ratio = sum(hist[:175]) / total_px
    if ink_ratio < 0.025:
        return gray.convert("RGB"), False, "blank_canvas"

    top_strip = gray.crop((0, 0, w, max(1, int(h * 0.06))))
    top_hist = top_strip.histogram()
    top_dark = sum(top_hist[:130]) / max(1, sum(top_hist))
    if top_dark > 0.15:
        return gray.convert("RGB"), False, f"top_cropped_head ({top_dark:.2f})"

    mid_x = w // 2
    center_band = gray.crop((mid_x - 6, int(h * 0.05), mid_x + 6, int(h * 0.95)))
    c_hist = center_band.histogram()
    center_dark = sum(c_hist[:100]) / max(1, sum(c_hist))
    if center_dark > 0.42:
        return gray.convert("RGB"), False, f"split_panel_divider ({center_dark:.2f})"

    if has_floating_text_or_bubble(gray):
        return gray.convert("RGB"), False, "floating_text_or_bubble"

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

    if not state["cf_flux_exhausted"]:
        flux_url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell"
        for _ in range(2):
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

    if not state["cf_sdxl_exhausted"]:
        sdxl_url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/bytedance/stable-diffusion-xl-lightning"
        for _ in range(2):
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
        "Client-Agent": "NihonSync-JLPT:6.1:github.com/biki76/nihonsync-jlpt",
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
    dx = -72 if from_left else 72
    dy = -56
    start = (tip_x + dx, tip_y + dy)
    end = (tip_x + (-18 if from_left else 18), tip_y - 14)
    draw.line([start, end], fill="#FFFFFF", width=28)
    draw.line([start, end], fill=ink, width=18)
    head = (
        [(tip_x, tip_y), (tip_x - 42, tip_y - 6), (tip_x - 16, tip_y - 40)]
        if from_left
        else [(tip_x, tip_y), (tip_x + 42, tip_y - 6), (tip_x + 16, tip_y - 40)]
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


def compose_single_scene_sheet(
    scene_img: Image.Image,
    speaker_side: str,
    speaker_posture: str,
    out_path: Path,
) -> None:
    W, H = 1000, 680
    margin = 14
    inner_w, inner_h = W - margin * 2, H - margin * 2

    canvas = Image.new("RGB", (W, H), "#FFFFFF")
    fitted = ImageOps.fit(scene_img, (inner_w, inner_h), method=Image.Resampling.LANCZOS)
    canvas.paste(fitted, (margin, margin))

    draw = ImageDraw.Draw(canvas)
    draw.rectangle([margin, margin, W - margin, H - margin], outline="#141414", width=3)

    is_seated = speaker_posture == "seated"
    if speaker_side == "left":
        tip_x = margin + int(inner_w * (0.31 if is_seated else 0.34))
        tip_y = margin + int(inner_h * (0.42 if is_seated else 0.25))
        draw_speaker_arrow(draw, tip_x=tip_x, tip_y=tip_y, from_left=False)
    else:
        tip_x = margin + int(inner_w * (0.69 if is_seated else 0.66))
        tip_y = margin + int(inner_h * (0.42 if is_seated else 0.25))
        draw_speaker_arrow(draw, tip_x=tip_x, tip_y=tip_y, from_left=True)

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
    parser.add_argument(
        "--questions",
        type=str,
        default="",
        help="Comma-separated listening question numbers to regenerate",
    )
    parser.add_argument("--force", action="store_true", help="Regenerate even if cached v10 PNG exists")
    args = parser.parse_args()

    q_filter = {int(x.strip()) for x in args.questions.split(",") if x.strip().isdigit()}

    compiled_path = Path("data/compiled_n5_6sets.json")
    exams = json.loads(compiled_path.read_text(encoding="utf-8"))
    cache_root = Path("data/generated_listening_sheets_v10")
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
            print(f"\n=== Generating v10 Question-Exact Textbook Illustrations for {code} ===")

            listening_sec = next(s for s in exam["sections"] if s["section_code"] == "LISTENING")
            local_idx = 0

            for mg in listening_sec["mondai_groups"]:
                q_type = mg.get("question_type", "")
                for q in mg["questions"]:
                    local_idx += 1
                    if q_filter and local_idx not in q_filter:
                        continue

                    db_q_id = db_ids[local_idx - 1] if local_idx <= len(db_ids) else None
                    layout = classify_layout(q.get("category", ""), q_type, local_idx)

                    if layout is None:
                        q["image_url"] = None
                        if db_q_id:
                            update_question_by_id(db_q_id, {"image_url": None})
                        continue

                    storage_path = f"jlpt/n5/mock{padded}/listening_q{local_idx}_sheet_v10.png"
                    local_png = cache_root / storage_path

                    if not local_png.exists() or args.force:
                        prompt_ja = clean_text(q.get("prompt_html", ""))
                        transcript_ja = clean_text(q.get("transcript_ja", ""))
                        print(f"\n  [{code} Q{local_idx}] {prompt_ja}")
                        plan = plan_visual_prompts(
                            http_client, set_num, local_idx, layout, prompt_ja, transcript_ja, q["options"]
                        )

                        if layout == "single_scene":
                            side = plan.get("speaker_side", "right")
                            posture = plan.get("speaker_posture", "standing")
                            imgs = generate_panels_for_question(
                                http_client, [plan["scene"]], f"{code} Q{local_idx}", state
                            )
                            compose_single_scene_sheet(imgs[0], side, posture, local_png)
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

    print("\nDONE: v10 question-exact JLPT textbook illustrations synced to Supabase!")


if __name__ == "__main__":
    main()
