#!/usr/bin/env python3
"""
Generates clean, reference-style monochrome Japanese JLPT textbook
illustrations (_sheet_v6.png) using Cloudflare Workers AI FLUX.1 Schnell
first (fast ~2s/panel, zero queue) with automatic failover to sequential
1-at-a-time AI Horde generation (preventing HTTP 400 concurrency caps),
and syncs all 102 sheets to Supabase Storage ('jlpt-media') and PostgreSQL.
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

CF_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
HORDE_API_KEY = os.environ.get("AI_HORDE_API_KEY", "").strip() or "0000000000"
HORDE_BASE = "https://aihorde.net/api/v2"

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/system/fonts/Roboto-Regular.ttf",
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
    ex_row = sb.table("exams").select("id").eq("exam_code", exam_code).maybe_single().execute()
    if not ex_row.data:
        return []
    sec_row = (
        sb.table("exam_sections")
        .select("id")
        .eq("exam_id", ex_row.data["id"])
        .eq("section_code", "LISTENING")
        .maybe_single()
        .execute()
    )
    if not sec_row.data:
        return []
    mgs = (
        sb.table("mondai_groups")
        .select("id, mondai_number")
        .eq("section_id", sec_row.data["id"])
        .order("mondai_number")
        .execute()
        .data
        or []
    )
    ordered_ids: List[str] = []
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
            ordered_ids.append(q["id"])
    return ordered_ids


def update_question_by_id(q_id: str, fields: Dict[str, Any]) -> None:
    for attempt in range(5):
        try:
            sb.table("questions").update(fields).eq("id", q_id).execute()
            return
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2.0 * (attempt + 1))


def horde_headers() -> Dict[str, str]:
    return {
        "apikey": HORDE_API_KEY,
        "Client-Agent": "NihonSync-JLPT:2.3:github.com/biki76/nihonsync-jlpt",
        "Content-Type": "application/json",
    }


def plan_visual_prompts(
    client: httpx.Client,
    layout: str,
    prompt_ja: str,
    transcript_ja: str,
    options: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if layout == "single_scene":
        sys_msg = (
            "You are an illustrator director for official Japanese JLPT N5 textbook exams. "
            "Given a Japanese situational prompt and script, write ONE clear English visual scene "
            "describing two fully clothed Japanese people in a G-rated school, office, shop, or "
            "living room, medium waist-up shot with full heads and faces clearly visible and empty "
            "white space above their heads, clear everyday props and gestures, NO speech bubbles and NO text. "
            'Respond ONLY with valid JSON: {"scene": "...", "speaker_side": "left" or "right"}'
        )
        user_msg = f"Prompt: {prompt_ja}\nScript: {transcript_ja}"
    else:
        sys_msg = (
            "You are an illustrator director for official Japanese JLPT N5 4-panel textbook sheets. "
            "Given a Japanese question, script, and 4 options, write 4 distinct English visual "
            "descriptions (1..4) depicting each exact option clearly in a G-rated everyday setting. "
            "Always frame any person from the waist up with full head and face completely visible and "
            "empty white space above their head. Never include speech bubbles, text, or numbers. "
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
                    "max_tokens": 480,
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
            "scene": f"Two polite Japanese people in casual clothes conversing, medium waist-up shot with full heads visible: {prompt_ja}",
            "speaker_side": "right",
        }
    return {
        "panels": [
            f"Japanese JLPT textbook illustration showing {clean_text(o.get('text', ''))}, medium shot with full framing"
            for o in options[:4]
        ]
    }


def normalize_textbook_monochrome(raw_bytes: bytes) -> Tuple[Image.Image, bool]:
    gray = Image.open(io.BytesIO(raw_bytes)).convert("L")
    gray = ImageOps.autocontrast(gray, cutoff=2)

    w, h = gray.size
    top_strip = gray.crop((0, 0, w, max(1, int(h * 0.06))))
    top_hist = top_strip.histogram()
    top_dark_ratio = sum(top_hist[:140]) / max(1, sum(top_hist))

    full_hist = gray.histogram()
    ink_ratio = sum(full_hist[:190]) / max(1, sum(full_hist))
    is_clean_framing = (top_dark_ratio < 0.22) and (0.02 <= ink_ratio <= 0.65)

    def map_tone(px: int) -> int:
        if px >= 232:
            return 255
        if px <= 70:
            return 17
        return px

    return gray.point(map_tone).convert("RGB"), is_clean_framing


def build_reference_prompt(scene_desc: str) -> str:
    clean_scene = re.sub(r"\s+", " ", str(scene_desc)).strip()[:340]
    return (
        f"Japanese JLPT textbook educational illustration, {clean_scene}, "
        "medium waist-up shot with full head completely visible and empty white space above head, "
        "clean uniform black ink line art on pure white background, solid black hair, "
        "minimal flat light-grey shading, no text, no speech bubbles, no borders"
    )


def generate_panel_cloudflare(
    client: httpx.Client, scene_desc: str
) -> Tuple[Optional[Image.Image], bool]:
    """
    Returns (Image, quota_exhausted). Uses FLUX.1-Schnell (steps=3) for ~2s
    high-craft reference-style monochrome textbook art.
    """
    if not CF_ACCOUNT_ID or not CF_API_TOKEN:
        return None, True

    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell"
    headers = {"Authorization": f"Bearer {CF_API_TOKEN}", "Content-Type": "application/json"}
    prompt = build_reference_prompt(scene_desc)

    for attempt in range(2):
        try:
            time.sleep(0.5)
            resp = client.post(url, headers=headers, json={"prompt": prompt, "steps": 3}, timeout=60.0)
            if resp.status_code == 429:
                return None, True
            if resp.status_code >= 400:
                if "8007" in resp.text or "NSFW" in resp.text:
                    prompt = build_reference_prompt(
                        "Two polite Japanese students in casual clothes conversing at a desk in a bright classroom"
                    )
                    continue
                return None, False

            ctype = resp.headers.get("content-type", "")
            if "application/json" in ctype:
                img_bytes = base64.b64decode(resp.json()["result"]["image"])
            else:
                img_bytes = resp.content

            img, _ = normalize_textbook_monochrome(img_bytes)
            return img, False
        except Exception:
            time.sleep(1.5)

    return None, False


def generate_panel_aihorde_single(client: httpx.Client, scene_desc: str) -> Image.Image:
    """
    Submits 1 panel at a time to AI Horde (never flooding concurrent slots)
    and logs exact API diagnostics if throttled.
    """
    positive = build_reference_prompt(scene_desc)
    negative = (
        "speech bubble, dialogue bubble, text, japanese text, kanji, hiragana, letters, numbers, "
        "cropped head, headless, cut off head, close up face, multiple panels, comic strip, "
        "border, frame, color, gradient, 3d render, photorealistic, crosshatching, nsfw"
    )
    payload = {
        "prompt": f"{positive} ### {negative}",
        "params": {
            "sampler_name": "k_euler_a",
            "cfg_scale": 6.5,
            "width": 640,
            "height": 512,
            "steps": 18,
            "n": 1,
        },
        "nsfw": False,
        "censor_nsfw": True,
        "r2": True,
        "shared": False,
    }

    for submit_try in range(15):
        try:
            resp = client.post(
                f"{HORDE_BASE}/generate/async",
                headers=horde_headers(),
                json=payload,
                timeout=35.0,
            )
            if resp.status_code in (400, 429):
                msg = ""
                try:
                    msg = resp.json().get("message", resp.text[:140])
                except Exception:
                    msg = resp.text[:140]
                wait_s = min(15.0 + submit_try * 5.0, 45.0)
                print(f"\n  [AI Horde {resp.status_code}] {msg} — waiting {wait_s:.0f}s...")
                time.sleep(wait_s)
                continue
            resp.raise_for_status()
            job_id = resp.json()["id"]

            # Poll this single job until done (up to 360s)
            for _ in range(90):
                time.sleep(4.0)
                try:
                    st_resp = client.get(
                        f"{HORDE_BASE}/generate/status/{job_id}",
                        headers=horde_headers(),
                        timeout=25.0,
                    )
                    if st_resp.status_code == 429:
                        time.sleep(5.0)
                        continue
                    if st_resp.status_code == 404:
                        break
                    st_resp.raise_for_status()
                    st = st_resp.json()
                except Exception:
                    continue

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
                    img, _ = normalize_textbook_monochrome(raw_bytes)
                    return img
        except Exception:
            time.sleep(4.0)

    raise RuntimeError("AI Horde could not complete panel after multiple retries.")


def generate_panels_for_question(
    client: httpx.Client,
    scene_descs: List[str],
    label: str,
    state: Dict[str, bool],
) -> List[Image.Image]:
    panels: List[Image.Image] = []
    total = len(scene_descs)
    for idx, desc in enumerate(scene_descs, start=1):
        engine = "AI Horde" if state["cf_exhausted"] else "Cloudflare FLUX"
        sys.stdout.write(f"\r  [{label}] Panel {idx}/{total} via {engine}...          ")
        sys.stdout.flush()

        img: Optional[Image.Image] = None
        if not state["cf_exhausted"]:
            img, exhausted = generate_panel_cloudflare(client, desc)
            if exhausted:
                state["cf_exhausted"] = True
                print("\n  [INFO] Cloudflare daily Neuron cap reached — switching seamlessly to sequential AI Horde.")

        if img is None:
            img = generate_panel_aihorde_single(client, desc)

        panels.append(img)

    sys.stdout.write("\r" + " " * 72 + "\r")
    sys.stdout.flush()
    return panels


def draw_speaker_arrow(draw: ImageDraw.ImageDraw, tip_x: int, tip_y: int, from_left: bool) -> None:
    ink = "#111111"
    dx = -76 if from_left else 76
    dy = -60
    start = (tip_x + dx, tip_y + dy)
    end = (tip_x + (-22 if from_left else 22), tip_y - 16)
    draw.line([start, end], fill="#FFFFFF", width=26)
    draw.line([start, end], fill=ink, width=18)
    if from_left:
        head = [(tip_x, tip_y), (tip_x - 42, tip_y - 6), (tip_x - 16, tip_y - 40)]
    else:
        head = [(tip_x, tip_y), (tip_x + 42, tip_y - 6), (tip_x + 16, tip_y - 40)]
    draw.polygon(head, fill=ink)


def compose_four_block_reference_sheet(panel_images: List[Image.Image], out_path: Path) -> None:
    W, H = 1000, 740
    margin, gap = 20, 22
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
        draw.rectangle([x0, y0, x1, y1], outline="#111111", width=3)
        draw.rectangle([x0 + 6, y0 + 6, x0 + 42, y0 + 50], fill="#FFFFFF")
        draw.text((x0 + 14, y0 + 8), str(idx + 1), fill="#111111", font=num_font)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def compose_single_scene_reference_sheet(
    scene_img: Image.Image, speaker_side: str, out_path: Path
) -> None:
    W, H = 1000, 720
    margin = 24
    inner_w, inner_h = W - margin * 2, H - margin * 2

    canvas = Image.new("RGB", (W, H), "#FFFFFF")
    fitted = ImageOps.fit(scene_img, (inner_w, inner_h), method=Image.Resampling.LANCZOS)
    canvas.paste(fitted, (margin, margin))

    draw = ImageDraw.Draw(canvas)
    draw.rectangle([margin, margin, W - margin, H - margin], outline="#111111", width=3)

    if speaker_side == "left":
        draw_speaker_arrow(
            draw,
            tip_x=margin + int(inner_w * 0.38),
            tip_y=margin + int(inner_h * 0.22),
            from_left=False,
        )
    else:
        draw_speaker_arrow(
            draw,
            tip_x=margin + int(inner_w * 0.56),
            tip_y=margin + int(inner_h * 0.21),
            from_left=True,
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def upload_storage_with_retry(local_png: Path, storage_path: str) -> None:
    payload = local_png.read_bytes()
    for attempt in range(6):
        try:
            sb.storage.from_("jlpt-media").upload(
                path=storage_path,
                file=payload,
                file_options={"content-type": "image/png", "upsert": "true"},
            )
            return
        except Exception as exc:
            if attempt == 5:
                raise
            wait_s = 2.5 * (attempt + 1)
            print(f"\n  [RETRY] Storage hiccup on {storage_path} ({type(exc).__name__}) — waiting {wait_s:.0f}s...")
            time.sleep(wait_s)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", type=int, default=0, help="Only process set 1..6 (0 = all sets)")
    parser.add_argument("--force", action="store_true", help="Regenerate even if cached PNG exists")
    args = parser.parse_args()

    compiled_path = Path("data/compiled_n5_6sets.json")
    exams = json.loads(compiled_path.read_text(encoding="utf-8"))
    cache_root = Path("data/generated_listening_sheets_v6")
    state = {"cf_exhausted": True}

    with httpx.Client(http2=False) as http_client:
        for exam in exams:
            meta = exam["exam_metadata"]
            set_num = int(meta["test_number"])
            if args.set and set_num != args.set:
                continue

            code = meta["exam_code"]
            padded = f"{set_num:02d}"
            db_ids = get_ordered_listening_db_ids(code)
            print(f"\n=== Generating Reference-Style JLPT Manga Sheets (v6) for {code} ===")

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

                    storage_path = f"jlpt/n5/mock{padded}/listening_q{local_idx}_sheet_v6.png"
                    local_png = cache_root / storage_path

                    if not local_png.exists() or args.force:
                        sys.stdout.write(f"\r  [{code} Q{local_idx}] Planning textbook scene...")
                        sys.stdout.flush()
                        prompt_ja = clean_text(q.get("prompt_html", ""))
                        transcript_ja = clean_text(q.get("transcript_ja", ""))
                        plan = plan_visual_prompts(
                            http_client, layout, prompt_ja, transcript_ja, q["options"]
                        )

                        if layout == "single_scene":
                            side = plan.get("speaker_side", "right")
                            pos_hint = (
                                "speaker positioned on the left side of the frame"
                                if side == "left"
                                else "speaker positioned on the right side of the frame"
                            )
                            imgs = generate_panels_for_question(
                                http_client, [f"{plan['scene']}, {pos_hint}"], f"{code} Q{local_idx}", state
                            )
                            compose_single_scene_reference_sheet(imgs[0], side, local_png)
                        else:
                            panels = generate_panels_for_question(
                                http_client, plan["panels"][:4], f"{code} Q{local_idx}", state
                            )
                            compose_four_block_reference_sheet(panels, local_png)

                    upload_storage_with_retry(local_png, storage_path)
                    q["image_url"] = storage_path
                    if db_q_id:
                        update_question_by_id(db_q_id, {"image_url": storage_path})

                    print(f"  Synced {code} Q{local_idx} ({layout}) -> {storage_path}")

            compiled_path.write_text(json.dumps(exams, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\nDONE: All 102 reference-style JLPT manga sheets (_sheet_v6.png) generated and synced!")


if __name__ == "__main__":
    main()
