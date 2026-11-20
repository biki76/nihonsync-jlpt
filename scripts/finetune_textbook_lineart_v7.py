#!/usr/bin/env python3
"""
Upgrades JLPT N5 listening illustrations from geometric shapes to zoomed,
clear, bubble-free 2D Japanese educational textbook line art (_sheet_v7.png).
- Primary: Cloudflare Workers AI FLUX.1-Schnell
- Fallback: Sequential AI Horde locked to clean 2D models (640x512)
- Layout: Q1-Q12 -> 4-block (1..4) | Q13-Q17 -> single scene + arrow | Q18-Q24 -> None
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

CLEAN_2D_HORDE_MODELS: List[str] = [
    "Animagine XL 3.1",
    "Anything Diffusion",
    "Counterfeit",
    "MeinaMix",
]

FONT_CANDIDATES: List[str] = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/system/fonts/Roboto-Regular.ttf",
]

STYLE_POSITIVE = (
    "Original Japanese language examination illustration in traditional Japanese "
    "educational listening-test textbook style, strict monochrome black-and-white "
    "2D instructional line art, clean confident uniform black ink outlines, "
    "natural human proportions and anatomically correct hands, minimal clear facial "
    "expressions, pure flat white background, very limited flat light-gray shading "
    "on clothing and furniture, ordinary Japanese people in everyday clothes, "
    "clear zoomed medium shot filling the frame with full heads and faces completely "
    "visible and clean white space above heads, silent wordless visual scene, "
    "zero speech bubbles, zero dialogue balloons, zero text, zero captions, zero signs"
)

STYLE_NEGATIVE = (
    "speech bubble, speech balloon, dialogue box, thought bubble, comic bubble, "
    "text, letters, kanji, hiragana, katakana, captions, subtitles, calligraphy, "
    "color, colorful, photorealistic, photo, 3D, CGI, cinematic lighting, "
    "dramatic shadows, watercolor, painterly, fantasy, chibi, exaggerated anime, "
    "manga screentones, oversized eyes, distorted anatomy, extra fingers, "
    "malformed hands, cropped head, cut off head, headless, close-up face, "
    "cluttered background, poster, book cover, dark background, black background, "
    "watermark, logo, signature, blurry, low quality, nsfw"
)


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
    layout: str,
    prompt_ja: str,
    transcript_ja: str,
    options: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if layout == "single_scene":
        sys_msg = (
            "You are an illustrator director for official Japanese JLPT N5 listening textbooks. "
            "Write ONE clear English visual scene depicting two ordinary Japanese people in a "
            "clean everyday setting (classroom, office, shop, dining table, or street). "
            "Frame both people from the waist up, zoomed in clearly, with BOTH full heads and "
            "faces completely visible and empty white wall space above their heads. "
            "Pure silent pantomime: absolutely NO speech bubbles, NO captions, NO signs, NO text. "
            'Respond ONLY with valid JSON: {"scene": "...", "speaker_side": "left" or "right"}'
        )
        user_msg = f"Prompt: {prompt_ja}\nScript: {transcript_ja}"
    else:
        sys_msg = (
            "You are an illustrator director for official Japanese JLPT N5 4-panel textbook sheets. "
            "Given a Japanese listening question, script, and 4 options, write 4 clear, distinct "
            "English visual descriptions (1..4) depicting each exact option unambiguously with "
            "large, zoomed, easily recognizable objects or actions. Keep character appearance "
            "consistent across all 4 panels. Whenever a person appears, show their full head and "
            "upper body with clean white space above their head. "
            "Pure silent illustration: NO speech bubbles, NO captions, NO text, NO panel numbers. "
            'Respond ONLY with valid JSON: {"panels": ["scene 1", "scene 2", "scene 3", "scene 4"]}'
        )
        opts_str = "\n".join(f"{o['index']}. {clean_text(o.get('text', ''))}" for o in options)
        user_msg = f"Question: {prompt_ja}\nScript: {transcript_ja}\nOptions:\n{opts_str}"

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
                    "max_tokens": 520,
                    "temperature": 0.2,
                },
                timeout=30.0,
            )
            if resp.status_code == 200:
                raw_out = resp.json().get("result", {}).get("response", "")
                parsed = raw_out if isinstance(raw_out, dict) else None
                if isinstance(raw_out, str):
                    m = re.search(r"\{.*\}", raw_out, re.S)
                    if m:
                        parsed = json.loads(m.group(0))
                if isinstance(parsed, dict):
                    if layout == "single_scene" and parsed.get("scene"):
                        return parsed
                    if layout == "four_block" and len(parsed.get("panels", [])) >= 4:
                        return parsed
        except Exception:
            pass

    if layout == "single_scene":
        return {
            "scene": (
                "Two ordinary Japanese people in everyday clothes across a simple table "
                f"on a flat white background, both full heads clearly visible: {prompt_ja}"
            ),
            "speaker_side": "right",
        }
    return {
        "panels": [
            f"Clear zoomed 2D textbook line-art illustration showing {clean_text(o.get('text', ''))}, "
            "full subject visible on flat white background, no speech bubbles, no text"
            for o in options[:4]
        ]
    }


def auto_zoom_monochrome(img_rgb: Image.Image) -> Image.Image:
    """
    Trims excess outer blank white margin around the 2D line art while keeping
    safe top-of-head breathing space so illustrations appear zoomed and clear.
    """
    gray = img_rgb.convert("L")
    inv = gray.point(lambda px: 255 if px < 225 else 0)
    bbox = inv.getbbox()
    if not bbox:
        return img_rgb

    w, h = img_rgb.size
    x0, y0, x1, y1 = bbox
    pad_x = max(8, int((x1 - x0) * 0.05))
    pad_top = max(14, int((y1 - y0) * 0.07))
    pad_bot = max(8, int((y1 - y0) * 0.04))

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
    bright_ratio = sum(hist[200:]) / total_px
    if dark_ratio > 0.32 or bright_ratio < 0.48:
        return gray.convert("RGB"), False, f"dark_or_nsfw ({dark_ratio:.2f})"

    ink_ratio = sum(hist[:175]) / total_px
    if ink_ratio < 0.025:
        return gray.convert("RGB"), False, "blank_canvas"

    top_strip = gray.crop((0, 0, w, max(1, int(h * 0.06))))
    top_hist = top_strip.histogram()
    top_dark = sum(top_hist[:130]) / max(1, sum(top_hist))
    if top_dark > 0.16:
        return gray.convert("RGB"), False, f"top_cropped_head ({top_dark:.2f})"

    gray = ImageOps.autocontrast(gray, cutoff=1)

    def map_tone(px: int) -> int:
        if px >= 224:
            return 255
        if px <= 78:
            return 20
        return min(238, max(178, int(178 + (px - 78) * 0.41)))

    cleaned = gray.point(map_tone).convert("RGB")
    zoomed = auto_zoom_monochrome(cleaned)
    return zoomed, True, "ok"


def build_prompt(scene_desc: str) -> str:
    clean_scene = re.sub(r"\s+", " ", str(scene_desc)).strip()[:320]
    return f"{STYLE_POSITIVE}. Scene: {clean_scene}."


def generate_panel_cloudflare(
    client: httpx.Client, scene_desc: str
) -> Tuple[Optional[Image.Image], bool]:
    if not CF_ACCOUNT_ID or not CF_API_TOKEN:
        return None, True

    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell"
    headers = {"Authorization": f"Bearer {CF_API_TOKEN}", "Content-Type": "application/json"}
    prompt = build_prompt(scene_desc)

    for attempt in range(3):
        try:
            time.sleep(0.35)
            resp = client.post(url, headers=headers, json={"prompt": prompt, "steps": 4}, timeout=60.0)
            if resp.status_code == 429:
                return None, True
            if resp.status_code >= 400:
                if "8007" in resp.text or "NSFW" in resp.text:
                    prompt = build_prompt(
                        "Two polite Japanese adults in everyday clothes talking across a desk, full heads visible, silent scene"
                    )
                    continue
                return None, False

            ctype = resp.headers.get("content-type", "")
            img_bytes = (
                base64.b64decode(resp.json()["result"]["image"])
                if "application/json" in ctype
                else resp.content
            )
            img, valid, _ = normalize_and_validate_panel(img_bytes)
            if valid:
                return img, False
            prompt = build_prompt(
                f"Medium-wide silent 2D textbook line art with clean white wall above all heads, {scene_desc}"
            )
            if attempt == 2:
                return img, False
        except Exception:
            time.sleep(1.5)

    return None, False


def generate_panel_aihorde_safe(client: httpx.Client, scene_desc: str) -> Image.Image:
    positive = build_prompt(scene_desc)
    payload: Dict[str, Any] = {
        "prompt": f"{positive} ### {STYLE_NEGATIVE}",
        "models": CLEAN_2D_HORDE_MODELS,
        "params": {
            "sampler_name": "k_euler_a",
            "cfg_scale": 7.0,
            "width": 640,
            "height": 512,
            "steps": 22,
            "n": 1,
        },
        "nsfw": False,
        "censor_nsfw": True,
        "r2": True,
        "shared": False,
    }
    headers = {
        "apikey": HORDE_API_KEY,
        "Client-Agent": "NihonSync-JLPT:3.1:github.com/biki76/nihonsync-jlpt",
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
    raise RuntimeError("Failed to generate a clean 2D textbook panel after retries.")


def generate_panels_for_question(
    client: httpx.Client,
    scene_descs: List[str],
    label: str,
    state: Dict[str, bool],
) -> List[Image.Image]:
    panels: List[Image.Image] = []
    total = len(scene_descs)
    for idx, desc in enumerate(scene_descs, start=1):
        engine = "AI Horde 2D" if state["cf_exhausted"] else "Cloudflare FLUX"
        sys.stdout.write(f"\r  [{label}] Panel {idx}/{total} via {engine}...          ")
        sys.stdout.flush()

        img: Optional[Image.Image] = None
        if not state["cf_exhausted"]:
            img, exhausted = generate_panel_cloudflare(client, desc)
            if exhausted:
                state["cf_exhausted"] = True
                print("\n  [INFO] Cloudflare daily Neuron quota reached — switching to safe 2D AI Horde.")

        if img is None:
            img = generate_panel_aihorde_safe(client, desc)

        panels.append(img)

    sys.stdout.write("\r" + " " * 72 + "\r")
    sys.stdout.flush()
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
    parser.add_argument("--force", action="store_true", help="Regenerate even if cached v7 PNG exists")
    args = parser.parse_args()

    compiled_path = Path("data/compiled_n5_6sets.json")
    exams = json.loads(compiled_path.read_text(encoding="utf-8"))
    cache_root = Path("data/generated_listening_sheets_v7")
    state = {"cf_exhausted": False}

    with httpx.Client(http2=False) as http_client:
        for exam in exams:
            meta = exam["exam_metadata"]
            set_num = int(meta["test_number"])
            if args.set and set_num != args.set:
                continue

            code = meta["exam_code"]
            padded = f"{set_num:02d}"
            db_ids = get_ordered_listening_db_ids(code)
            print(f"\n=== Generating Zoomed Bubble-Free 2D Textbook Line Art (v7) for {code} ===")

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

                    storage_path = f"jlpt/n5/mock{padded}/listening_q{local_idx}_sheet_v7.png"
                    local_png = cache_root / storage_path

                    if not local_png.exists() or args.force:
                        sys.stdout.write(f"\r  [{code} Q{local_idx}] Planning silent 2D textbook scene...")
                        sys.stdout.flush()
                        prompt_ja = clean_text(q.get("prompt_html", ""))
                        transcript_ja = clean_text(q.get("transcript_ja", ""))
                        plan = plan_visual_prompts(
                            http_client, layout, prompt_ja, transcript_ja, q["options"]
                        )

                        if layout == "single_scene":
                            side = plan.get("speaker_side", "right")
                            pos_hint = (
                                "speaker positioned on the left, listener on the right"
                                if side == "left"
                                else "listener positioned on the left, speaker on the right"
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

    print("\nDONE: Zoomed, bubble-free 2D Japanese textbook line-art sheets (_sheet_v7.png) synced!")


if __name__ == "__main__":
    main()
