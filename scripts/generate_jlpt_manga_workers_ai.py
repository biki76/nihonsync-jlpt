#!/usr/bin/env python3
"""
Generates context-accurate, hand-drawn monochrome Japanese JLPT textbook
illustrations using Cloudflare Workers AI (Llama 3.1 + FLUX.1 Schnell) and
composites them into official 4-panel (1-4) and single-scene speaker-arrow
JLPT sheets, uploading to Supabase Storage ('jlpt-media') and updating DB.
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
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont, ImageOps
from supabase import create_client

load_dotenv(".env.local")
load_dotenv()

CF_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

LLM_MODEL = "@cf/meta/llama-3.1-8b-instruct"
IMAGE_MODELS = [
    "@cf/black-forest-labs/flux-1-schnell",
    "@cf/bytedance/stable-diffusion-xl-lightning",
]

STYLE_SUFFIX = (
    "clean black and white Japanese JLPT textbook illustration, simple expressive "
    "educational manga line art on pure white background, natural Japanese people "
    "with clear facial expressions and everyday gestures, uniform crisp black ink "
    "outlines, minimal flat light-grey shading, no text, no numbers, no letters, "
    "no speech bubbles, no borders, high contrast"
)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "/system/fonts/Roboto-Bold.ttf",
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
    return re.sub(r"<[^>]+>", "", html.unescape(raw or "")).strip()


def classify_layout(category: str, question_type: str, mondai_number: int) -> Optional[str]:
    combined = f"{category} {question_type}".lower()
    if mondai_number in (1, 2) or any(
        k in combined for k in ("task", "point", "key_points", "課題理解", "ポイント理解")
    ):
        return "four_block"
    if mondai_number == 3 or any(k in combined for k in ("verbal", "発話表現")):
        return "single_scene"
    return None


def cf_headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json",
    }


def plan_visual_prompts_with_llama(
    client: httpx.Client,
    layout: str,
    prompt_ja: str,
    transcript_ja: str,
    options: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Uses Workers AI Llama-3.1-8B to translate the Japanese listening context
    and choices into concrete, clear English illustration descriptions.
    """
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/{LLM_MODEL}"

    if layout == "single_scene":
        sys_msg = (
            "You are an art director for official Japanese JLPT N5 listening test illustrations. "
            "Given a Japanese situational prompt and script, describe ONE clear everyday scene "
            "between two Japanese people (e.g., classmates, coworkers, shop clerk and customer, "
            "family members) with clear body language and props so a test-taker immediately "
            "understands what the indicated speaker is about to say. "
            "Respond ONLY with valid JSON: "
            '{"scene": "concrete English visual description of the scene and characters", '
            '"speaker_side": "left" or "right", '
            '"speaker_pose": "short description of the speaker character"}'
        )
        user_msg = f"Prompt: {prompt_ja}\nScript: {transcript_ja}"
    else:
        sys_msg = (
            "You are an art director for official Japanese JLPT N5 listening 4-panel illustrations. "
            "Given a Japanese listening question, dialogue script, and 4 options, write 4 distinct, "
            "concrete English visual descriptions (one per option 1..4) showing the exact action, "
            "object, direction, time, or place so each panel clearly represents its option. "
            "Include a Japanese person performing the action whenever natural. "
            "Respond ONLY with valid JSON: "
            '{"panels": ["panel 1 scene", "panel 2 scene", "panel 3 scene", "panel 4 scene"]}'
        )
        opts_str = "\n".join(f"{o['index']}. {clean_text(o.get('text', ''))}" for o in options)
        user_msg = f"Question: {prompt_ja}\nScript: {transcript_ja}\nOptions:\n{opts_str}"

    for attempt in range(3):
        try:
            resp = client.post(
                url,
                headers=cf_headers(),
                json={
                    "messages": [
                        {"role": "system", "content": sys_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    "max_tokens": 500,
                    "temperature": 0.2,
                },
                timeout=45.0,
            )
            resp.raise_for_status()
            raw_out = resp.json().get("result", {}).get("response", "")
            parsed = None
            if isinstance(raw_out, dict):
                parsed = raw_out
            elif isinstance(raw_out, str):
                m_json = re.search(r"\{.*\}", raw_out, re.S)
                if m_json:
                    parsed = json.loads(m_json.group(0))
            if isinstance(parsed, dict):
                if layout == "single_scene" and parsed.get("scene"):
                    return parsed
                if layout == "four_block" and len(parsed.get("panels", [])) >= 4:
                    return parsed
        except Exception as exc:
            if attempt == 2:
                print(f"\n  [WARN] LLM scene planner fallback ({exc})")
            time.sleep(1.0 * (attempt + 1))

    # Deterministic fallback if LLM JSON parsing fails
    if layout == "single_scene":
        return {
            "scene": f"Two Japanese people talking in an everyday setting: {prompt_ja}",
            "speaker_side": "right",
            "speaker_pose": "Japanese person gesturing politely while speaking",
        }
    return {
        "panels": [
            f"Japanese textbook illustration of: {clean_text(o.get('text', ''))}"
            for o in options[:4]
        ]
    }


def generate_manga_panel_image(client: httpx.Client, scene_desc: str) -> Image.Image:
    """
    Calls Cloudflare Workers AI FLUX.1 Schnell (with SDXL Lightning fallback)
    within strict prompt length limits and normalizes to monochrome JLPT art.
    """
    clean_scene = re.sub(r"\s+", " ", str(scene_desc)).strip()[:420]
    short_style = (
        "black and white Japanese JLPT textbook manga line art on pure white "
        "background, expressive Japanese characters, crisp black ink outlines, "
        "minimal flat light-grey shading, no text, no numbers, no borders"
    )
    full_prompt = f"{clean_scene}, {short_style}"

    for model in IMAGE_MODELS:
        url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/{model}"
        payload = (
            {"prompt": full_prompt, "steps": 4}
            if "flux" in model
            else {"prompt": full_prompt, "num_steps": 4}
        )
        for attempt in range(3):
            try:
                resp = client.post(url, headers=cf_headers(), json=payload, timeout=90.0)
                if resp.status_code == 429:
                    time.sleep(3.0 * (attempt + 1))
                    continue
                if resp.status_code >= 400:
                    raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:180]}")
                ctype = resp.headers.get("content-type", "")
                if "application/json" in ctype:
                    b64_img = resp.json()["result"]["image"]
                    img_bytes = base64.b64decode(b64_img)
                else:
                    img_bytes = resp.content

                img = Image.open(io.BytesIO(img_bytes)).convert("L")
                img = ImageOps.autocontrast(img, cutoff=2)
                return img.convert("RGB")
            except Exception as exc:
                if attempt == 2:
                    print(f"\n  [WARN] Model {model} failed ({exc})")
                time.sleep(1.5 * (attempt + 1))

    raise RuntimeError("All Cloudflare Workers AI image models failed.")


def draw_speaker_arrow(draw: ImageDraw.ImageDraw, tip_x: int, tip_y: int, from_left: bool) -> None:
    """
    Draws the exact solid-black JLPT directional arrow pointing at the speaker
    (matching reference image 1000140454.png).
    """
    ink = "#111111"
    dx = -74 if from_left else 74
    dy = -56
    start = (tip_x + dx, tip_y + dy)
    end = (tip_x + (-20 if from_left else 20), tip_y - 15)

    # White halo for clean separation over any background line
    draw.line([start, end], fill="#FFFFFF", width=22)
    draw.line([start, end], fill=ink, width=14)

    if from_left:
        head = [(tip_x, tip_y), (tip_x - 36, tip_y - 6), (tip_x - 14, tip_y - 34)]
    else:
        head = [(tip_x, tip_y), (tip_x + 36, tip_y - 6), (tip_x + 14, tip_y - 34)]
    draw.polygon(head, fill=ink)


def compose_four_block_sheet(panel_images: List[Image.Image], out_path: Path) -> None:
    """
    Composes 4 monochrome manga panels into the exact 2x2 bordered JLPT booklet
    layout with clean '1', '2', '3', '4' numbers (matching reference 1000140453.png).
    """
    W, H = 960, 720
    margin = 24
    gap = 24
    box_w = (W - margin * 2 - gap) // 2
    box_h = (H - margin * 2 - gap) // 2

    canvas = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(canvas)
    num_font = load_font(34)

    for idx in range(4):
        col = idx % 2
        row = idx // 2
        x0 = margin + col * (box_w + gap)
        y0 = margin + row * (box_h + gap)
        x1 = x0 + box_w
        y1 = y0 + box_h

        panel = ImageOps.fit(panel_images[idx], (box_w - 6, box_h - 6), method=Image.Resampling.LANCZOS)
        canvas.paste(panel, (x0 + 3, y0 + 3))

        # Crisp black border around each panel
        draw.rectangle([x0, y0, x1, y1], outline="#111111", width=3)

        # Clean top-left number badge with white backing so line art never collides
        draw.rectangle([x0 + 6, y0 + 6, x0 + 44, y0 + 48], fill="#FFFFFF")
        draw.text((x0 + 14, y0 + 8), str(idx + 1), fill="#111111", font=num_font)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def compose_single_scene_sheet(
    scene_img: Image.Image, speaker_side: str, out_path: Path
) -> None:
    """
    Composes a single framed monochrome manga scene with a bold black arrow
    pointing at the speaker (matching reference 1000140454.png).
    """
    W, H = 900, 620
    margin = 28
    inner_w = W - margin * 2
    inner_h = H - margin * 2

    canvas = Image.new("RGB", (W, H), "#FFFFFF")
    fitted = ImageOps.fit(scene_img, (inner_w, inner_h), method=Image.Resampling.LANCZOS)
    canvas.paste(fitted, (margin, margin))

    draw = ImageDraw.Draw(canvas)
    draw.rectangle([margin, margin, W - margin, H - margin], outline="#111111", width=3)

    if speaker_side == "left":
        draw_speaker_arrow(draw, tip_x=margin + int(inner_w * 0.36), tip_y=margin + int(inner_h * 0.24), from_left=False)
    else:
        draw_speaker_arrow(draw, tip_x=margin + int(inner_w * 0.56), tip_y=margin + int(inner_h * 0.22), from_left=True)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", type=int, default=0, help="Only process set number 1..6 (0 = all sets)")
    parser.add_argument("--force", action="store_true", help="Regenerate even if local PNG already exists")
    args = parser.parse_args()

    if not CF_ACCOUNT_ID or not CF_API_TOKEN:
        raise RuntimeError("Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN in .env.local")
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")

    compiled_path = Path("data/compiled_n5_6sets.json")
    exams = json.loads(compiled_path.read_text(encoding="utf-8"))
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    cache_root = Path("data/generated_listening_sheets")

    with httpx.Client() as http_client:
        for exam in exams:
            meta = exam["exam_metadata"]
            set_num = int(meta["test_number"])
            if args.set and set_num != args.set:
                continue

            code = meta["exam_code"]
            padded = f"{set_num:02d}"
            print(f"\n=== Generating JLPT Manga Illustrations for {code} ===")

            # Lookup Supabase mondai_group IDs
            mg_id_by_num: Dict[int, str] = {}
            ex_row = supabase.table("exams").select("id").eq("exam_code", code).maybe_single().execute()
            if ex_row.data:
                sec_row = (
                    supabase.table("exam_sections")
                    .select("id")
                    .eq("exam_id", ex_row.data["id"])
                    .eq("section_code", "LISTENING")
                    .maybe_single()
                    .execute()
                )
                if sec_row.data:
                    mg_rows = (
                        supabase.table("mondai_groups")
                        .select("id, mondai_number")
                        .eq("section_id", sec_row.data["id"])
                        .execute()
                    )
                    for r in mg_rows.data or []:
                        mg_id_by_num[int(r["mondai_number"])] = r["id"]

            listening_sec = next(s for s in exam["sections"] if s["section_code"] == "LISTENING")

            for mg in listening_sec["mondai_groups"]:
                m_num = int(mg["mondai_number"])
                q_type = mg.get("question_type", "")
                mg_id = mg_id_by_num.get(m_num)

                for q in mg["questions"]:
                    q_no = int(q["question_number"])
                    layout = classify_layout(q.get("category", ""), q_type, m_num)

                    if layout is None:
                        q["image_url"] = None
                        if mg_id:
                            supabase.table("questions").update({"image_url": None}).eq(
                                "mondai_group_id", mg_id
                            ).eq("question_number", q_no).execute()
                        continue

                    storage_path = f"jlpt/n5/mock{padded}/listening_q{q_no}_sheet_v5.png"
                    local_png = cache_root / storage_path

                    if not local_png.exists() or args.force:
                        prompt_ja = clean_text(q.get("prompt_html", ""))
                        transcript_ja = clean_text(q.get("transcript_ja", ""))
                        plan = plan_visual_prompts_with_llama(
                            http_client, layout, prompt_ja, transcript_ja, q["options"]
                        )

                        if layout == "single_scene":
                            side = plan.get("speaker_side", "right")
                            pos_hint = (
                                "speaker character positioned on the left side of the frame"
                                if side == "left"
                                else "speaker character positioned on the right side of the frame"
                            )
                            scene_desc = f"{plan['scene']}, {pos_hint}"
                            scene_img = generate_manga_panel_image(http_client, scene_desc)
                            compose_single_scene_sheet(scene_img, side, local_png)
                        else:
                            panels: List[Image.Image] = []
                            for p_desc in plan["panels"][:4]:
                                panels.append(generate_manga_panel_image(http_client, p_desc))
                            compose_four_block_sheet(panels, local_png)

                    # Upload to Supabase Storage ('jlpt-media')
                    supabase.storage.from_("jlpt-media").upload(
                        path=storage_path,
                        file=local_png.read_bytes(),
                        file_options={"content-type": "image/png", "upsert": "true"},
                    )
                    q["image_url"] = storage_path

                    if mg_id:
                        supabase.table("questions").update({"image_url": storage_path}).eq(
                            "mondai_group_id", mg_id
                        ).eq("question_number", q_no).execute()

                    sys.stdout.write(f"\r  Synced {code} Q{q_no} ({layout}) -> {storage_path}")
                    sys.stdout.flush()
            print()

    compiled_path.write_text(json.dumps(exams, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nDONE: Context-matched JLPT manga illustrations generated, uploaded, and synced!")


if __name__ == "__main__":
    main()
