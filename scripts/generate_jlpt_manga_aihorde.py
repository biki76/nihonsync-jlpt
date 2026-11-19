#!/usr/bin/env python3
"""
Generates context-accurate, monochrome Japanese JLPT textbook manga
illustrations via AI Horde (aihorde.net) with automatic network-disconnect
recovery and parallel multi-panel batching, compositing into official
4-panel (1-4) and single-scene speaker-arrow JLPT sheets.
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
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont, ImageOps
from supabase import create_client

load_dotenv(".env.local")
load_dotenv()

HORDE_API_KEY = os.environ.get("AI_HORDE_API_KEY", "").strip() or "0000000000"
HORDE_BASE = "https://aihorde.net/api/v2"
CF_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

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


def horde_headers() -> Dict[str, str]:
    return {
        "apikey": HORDE_API_KEY,
        "Client-Agent": "NihonSync-JLPT:1.0:github.com/biki76/nihonsync-jlpt",
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
            "You are an art director for official Japanese JLPT N5 listening illustrations. "
            "Given a Japanese situational prompt and script, describe ONE clear everyday scene "
            "between two Japanese people in G-rated school, office, shop, or living-room settings. "
            "Respond ONLY with valid JSON: "
            '{"scene": "concrete English visual description", "speaker_side": "left" or "right"}'
        )
        user_msg = f"Prompt: {prompt_ja}\nScript: {transcript_ja}"
    else:
        sys_msg = (
            "You are an art director for official Japanese JLPT N5 4-panel illustrations. "
            "Given a Japanese question, script, and 4 options, write 4 distinct English visual "
            "descriptions (1..4) depicting each exact option clearly in G-rated everyday settings. "
            "Respond ONLY with valid JSON: "
            '{"panels": ["panel 1 scene", "panel 2 scene", "panel 3 scene", "panel 4 scene"]}'
        )
        opts_str = "\n".join(f"{o['index']}. {clean_text(o.get('text', ''))}" for o in options)
        user_msg = f"Question: {prompt_ja}\nScript: {transcript_ja}\nOptions:\n{opts_str}"

    # 1. Try Cloudflare Llama-3.1 (~5 Neurons/question) if configured
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
                    "max_tokens": 450,
                    "temperature": 0.2,
                },
                timeout=35.0,
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

    # 2. Fallback to AI Horde text generation
    try:
        t_resp = client.post(
            f"{HORDE_BASE}/generate/text/async",
            headers=horde_headers(),
            json={
                "prompt": f"{sys_msg}\n\n{user_msg}\n\nJSON:",
                "params": {"max_length": 320, "temperature": 0.2},
            },
            timeout=30.0,
        )
        if t_resp.status_code == 202:
            tid = t_resp.json()["id"]
            for _ in range(25):
                time.sleep(2.0)
                try:
                    st = client.get(
                        f"{HORDE_BASE}/generate/text/status/{tid}",
                        headers=horde_headers(),
                        timeout=20.0,
                    ).json()
                except Exception:
                    continue
                if st.get("done"):
                    txt = (st.get("generations") or [{}])[0].get("text", "")
                    m = re.search(r"\{.*\}", txt, re.S)
                    if m:
                        parsed = json.loads(m.group(0))
                        if layout == "single_scene" and parsed.get("scene"):
                            return parsed
                        if layout == "four_block" and len(parsed.get("panels", [])) >= 4:
                            return parsed
                    break
    except Exception:
        pass

    # 3. Deterministic fallback
    if layout == "single_scene":
        return {"scene": f"Two polite Japanese people conversing in everyday clothes: {prompt_ja}", "speaker_side": "right"}
    return {
        "panels": [
            f"Japanese textbook manga illustration of {clean_text(o.get('text', ''))}"
            for o in options[:4]
        ]
    }


def submit_horde_image_job(client: httpx.Client, scene_desc: str) -> str:
    clean_scene = re.sub(r"\s+", " ", str(scene_desc)).strip()[:380]
    positive = (
        f"{clean_scene}, black and white Japanese JLPT textbook manga line art on pure white "
        "background, expressive Japanese characters, crisp black ink outlines, minimal flat "
        "light-grey shading, monochrome, clean educational illustration"
    )
    negative = (
        "color, colored, rainbow, watercolor, gradient, 3d render, photorealistic, blurry, "
        "text, numbers, letters, watermark, signature, speech bubble, border, frame, nsfw"
    )
    payload = {
        "prompt": f"{positive} ### {negative}",
        "params": {
            "sampler_name": "k_euler_a",
            "cfg_scale": 7.0,
            "width": 512,
            "height": 512,
            "steps": 22,
            "n": 1,
        },
        "nsfw": False,
        "censor_nsfw": True,
        "r2": True,
        "shared": False,
    }

    for attempt in range(10):
        try:
            resp = client.post(
                f"{HORDE_BASE}/generate/async",
                headers=horde_headers(),
                json=payload,
                timeout=35.0,
            )
            if resp.status_code == 429:
                time.sleep(6.0 * min(attempt + 1, 4))
                continue
            resp.raise_for_status()
            return resp.json()["id"]
        except (httpx.RequestError, httpx.HTTPStatusError):
            time.sleep(3.0 * min(attempt + 1, 5))

    raise RuntimeError("Failed to submit job to AI Horde after multiple network retries.")


def download_horde_image(client: httpx.Client, img_ref: str) -> Image.Image:
    for attempt in range(8):
        try:
            if img_ref.startswith("http"):
                r = client.get(img_ref, timeout=45.0)
                r.raise_for_status()
                img_bytes = r.content
            else:
                img_bytes = base64.b64decode(img_ref)

            img = Image.open(io.BytesIO(img_bytes)).convert("L")
            img = ImageOps.autocontrast(img, cutoff=2)
            return img.convert("RGB")
        except Exception:
            time.sleep(2.5 * min(attempt + 1, 4))

    raise RuntimeError("Failed to download generated image from AI Horde R2.")


def generate_manga_panels_batch_aihorde(
    client: httpx.Client, scene_descs: List[str]
) -> List[Image.Image]:
    """
    Submits 1 or 4 panels in parallel to AI Horde and polls them together
    with full resilience against transient RemoteProtocolError / socket drops.
    """
    n = len(scene_descs)
    job_ids: List[Optional[str]] = [None] * n
    results: List[Optional[Image.Image]] = [None] * n

    for i, desc in enumerate(scene_descs):
        job_ids[i] = submit_horde_image_job(client, desc)
        time.sleep(0.35)

    deadline = time.time() + 420.0
    while any(img is None for img in results):
        if time.time() > deadline:
            for i in range(n):
                if results[i] is None:
                    job_ids[i] = submit_horde_image_job(client, scene_descs[i])
            deadline = time.time() + 420.0

        time.sleep(3.5)
        for i in range(n):
            if results[i] is not None:
                continue
            jid = job_ids[i]
            if not jid:
                job_ids[i] = submit_horde_image_job(client, scene_descs[i])
                continue

            try:
                st_resp = client.get(
                    f"{HORDE_BASE}/generate/status/{jid}",
                    headers=horde_headers(),
                    timeout=25.0,
                )
                if st_resp.status_code == 429:
                    time.sleep(4.0)
                    continue
                if st_resp.status_code == 404:
                    job_ids[i] = submit_horde_image_job(client, scene_descs[i])
                    continue
                st_resp.raise_for_status()
                st = st_resp.json()
            except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
                continue

            if st.get("faulted"):
                job_ids[i] = submit_horde_image_job(client, scene_descs[i])
                continue

            if st.get("done"):
                gens = st.get("generations") or []
                if not gens or not gens[0].get("img"):
                    job_ids[i] = submit_horde_image_job(client, scene_descs[i])
                    continue
                results[i] = download_horde_image(client, gens[0]["img"])

    return [img for img in results if img is not None]


def draw_speaker_arrow(draw: ImageDraw.ImageDraw, tip_x: int, tip_y: int, from_left: bool) -> None:
    ink = "#111111"
    dx = -74 if from_left else 74
    dy = -56
    start = (tip_x + dx, tip_y + dy)
    end = (tip_x + (-20 if from_left else 20), tip_y - 15)
    draw.line([start, end], fill="#FFFFFF", width=22)
    draw.line([start, end], fill=ink, width=14)
    if from_left:
        head = [(tip_x, tip_y), (tip_x - 36, tip_y - 6), (tip_x - 14, tip_y - 34)]
    else:
        head = [(tip_x, tip_y), (tip_x + 36, tip_y - 6), (tip_x + 14, tip_y - 34)]
    draw.polygon(head, fill=ink)


def compose_four_block_sheet(panel_images: List[Image.Image], out_path: Path) -> None:
    W, H = 960, 720
    margin, gap = 24, 24
    box_w = (W - margin * 2 - gap) // 2
    box_h = (H - margin * 2 - gap) // 2

    canvas = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(canvas)
    num_font = load_font(34)

    for idx in range(4):
        col, row = idx % 2, idx // 2
        x0 = margin + col * (box_w + gap)
        y0 = margin + row * (box_h + gap)
        x1, y1 = x0 + box_w, y0 + box_h

        panel = ImageOps.fit(panel_images[idx], (box_w - 6, box_h - 6), method=Image.Resampling.LANCZOS)
        canvas.paste(panel, (x0 + 3, y0 + 3))
        draw.rectangle([x0, y0, x1, y1], outline="#111111", width=3)
        draw.rectangle([x0 + 6, y0 + 6, x0 + 44, y0 + 48], fill="#FFFFFF")
        draw.text((x0 + 14, y0 + 8), str(idx + 1), fill="#111111", font=num_font)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def compose_single_scene_sheet(scene_img: Image.Image, speaker_side: str, out_path: Path) -> None:
    W, H = 900, 620
    margin = 28
    inner_w, inner_h = W - margin * 2, H - margin * 2

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
    parser.add_argument("--set", type=int, default=0, help="Only process set 1..6 (0 = all sets)")
    parser.add_argument("--force", action="store_true", help="Regenerate even if cached PNG exists")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")

    key_mode = "registered API key" if HORDE_API_KEY != "0000000000" else "anonymous key"
    print(f"Using AI Horde ({key_mode})...")

    compiled_path = Path("data/compiled_n5_6sets.json")
    exams = json.loads(compiled_path.read_text(encoding="utf-8"))
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    cache_root = Path("data/generated_listening_sheets")

    with httpx.Client(http2=False) as http_client:
        for exam in exams:
            meta = exam["exam_metadata"]
            set_num = int(meta["test_number"])
            if args.set and set_num != args.set:
                continue

            code = meta["exam_code"]
            padded = f"{set_num:02d}"
            print(f"\n=== Generating JLPT Manga Sheets via AI Horde for {code} ===")

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
                            imgs = generate_manga_panels_batch_aihorde(
                                http_client, [f"{plan['scene']}, {pos_hint}"]
                            )
                            compose_single_scene_sheet(imgs[0], side, local_png)
                        else:
                            panels = generate_manga_panels_batch_aihorde(
                                http_client, plan["panels"][:4]
                            )
                            compose_four_block_sheet(panels, local_png)

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

                    print(f"  Synced {code} Q{q_no} ({layout}) -> {storage_path}")

            compiled_path.write_text(json.dumps(exams, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\nDONE: All 6 N5 sets generated via AI Horde, uploaded to jlpt-media, and synced!")


if __name__ == "__main__":
    main()
