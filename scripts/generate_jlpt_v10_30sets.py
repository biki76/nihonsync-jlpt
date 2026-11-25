#!/usr/bin/env python3
"""v10.2 monochrome JLPT textbook manga sheet generator for N5 (01-20) & N4 (01-10)."""

import argparse
import base64
import html
import io
import json
import math
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

import httpx
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageStat
from supabase import Client, create_client

CACHE_ROOT = Path("data/generated_listening_sheets_v10")
CHECKPOINT_PATH = Path("data/visuals_v10_checkpoint.json")
SHEET_VERSION = "v10"
PAGE_SIZE = 1000
HORDE_BASE = "https://aihorde.net/api/v2"

CF_IMAGE_MODELS: Tuple[str, ...] = (
    "@cf/black-forest-labs/flux-1-schnell",
    "@cf/bytedance/stable-diffusion-xl-lightning-4step",
)
GENERAL_HORDE_MODELS: List[str] = [
    "FLUX.1-Schnell",
    "AlbedoBase XL (SDXL)",
    "Juggernaut XL",
    "Dreamshaper XL",
]
FONT_PATHS: Tuple[str, ...] = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "/system/fonts/Roboto-Bold.ttf",
)
CJK_FONT_PATHS: Tuple[str, ...] = (
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/system/fonts/NotoSansCJK-Regular.ttc",
    "/system/fonts/DroidSansFallback.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
)
KANJI_NUM_MAP: Dict[str, int] = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6,
    "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12,
}
DAY_KANJI_RULES: Tuple[Tuple[str, str], ...] = (
    ("月よう", "月"), ("月曜", "月"), ("火よう", "火"), ("火曜", "火"),
    ("水よう", "水"), ("水曜", "水"), ("木よう", "木"), ("木曜", "木"),
    ("金よう", "金"), ("金曜", "金"), ("土よう", "土"), ("土曜", "土"),
    ("日よう", "日"), ("日曜", "日"),
)
STYLE_SUFFIX = (
    "black and white Japanese JLPT textbook ink line art on pure white paper, "
    "clean monochrome educational illustration, ordinary Japanese people in everyday clothes, "
    "solid black hair, minimal flat light-grey shading, ample headroom above heads, "
    "no speech bubbles, no text, no letters, no numbers, no comic frames"
)
NEGATIVE_PROMPT = (
    "color, colored, watercolor, 3d render, photorealistic, dark background, "
    "whiteboard, blackboard, speech bubble, text, kanji, hiragana, numbers, letters, "
    "watermark, border, split screen, diptych, cropped head, anime waifu, nsfw, chibi"
)


@dataclass
class RuntimeConfig:
    supabase_url: str
    supabase_key: str
    cf_account_id: str
    cf_api_token: str
    horde_api_key: str
    cf_image_exhausted: bool = False
    cf_llm_exhausted: bool = False


def load_config(skip_cf: bool) -> RuntimeConfig:
    load_dotenv(".env.local")
    load_dotenv(".env")
    sb_url = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL") or "").strip()
    sb_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not sb_url or not sb_key:
        print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", file=sys.stderr)
        sys.exit(1)
    cf_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
    cf_tok = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()
    horde_key = os.getenv("AI_HORDE_API_KEY", "").strip() or "0000000000"
    no_cf = skip_cf or not (cf_id and cf_tok)
    return RuntimeConfig(sb_url, sb_key, cf_id, cf_tok, horde_key, no_cf, not (cf_id and cf_tok))


def chunked(items: Sequence[Any], size: int) -> List[Sequence[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def fetch_paginated(
    sb: Client, table: str, parent_col: str, parent_ids: List[str], cols: str
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for batch in chunked(parent_ids, 25):
        offset = 0
        while True:
            res = (
                sb.table(table)
                .select(cols)
                .in_(parent_col, list(batch))
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
            )
            page = res.data or []
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
    return rows


def clean_text(raw: Any) -> str:
    txt = str(raw or "")
    txt = re.sub(r"<rt[^>]*>.*?</rt>", "", txt, flags=re.I | re.S)
    txt = re.sub(r"<[^>]+>", "", txt)
    return re.sub(r"\s+", " ", html.unescape(txt)).strip()


def parse_japanese_clock_time(text: str) -> Optional[Tuple[int, int]]:
    cleaned = clean_text(text)
    m_colon = re.search(r"\b(\d{1,2})\s*[:：]\s*(\d{2})\b", cleaned)
    if m_colon:
        return int(m_colon.group(1)), int(m_colon.group(2))
    m_ja = re.search(
        r"(十二|十一|十|九|八|七|六|五|四|三|二|一|\d{1,2})\s*時"
        r"(?:\s*(半|(?:[二三四五]?十)?[一二三四五六七八九]?\s*分|\d{1,2}\s*分))?",
        cleaned,
    )
    if not m_ja:
        return None
    h_raw = m_ja.group(1)
    hour = int(h_raw) if h_raw.isdigit() else KANJI_NUM_MAP.get(h_raw, 12)
    min_raw = (m_ja.group(2) or "").strip()
    minute = 0
    if min_raw == "半":
        minute = 30
    elif min_raw:
        m_digits = re.search(r"\d+", min_raw)
        if m_digits:
            minute = int(m_digits.group(0))
        else:
            m_clean = min_raw.replace("分", "").strip()
            if "十" in m_clean:
                parts = m_clean.split("十")
                tens = KANJI_NUM_MAP.get(parts[0], 1) if parts[0] else 1
                ones = KANJI_NUM_MAP.get(parts[1], 0) if len(parts) > 1 and parts[1] else 0
                minute = tens * 10 + ones
            else:
                minute = KANJI_NUM_MAP.get(m_clean, 0)
    return hour, minute


def parse_japanese_day_kanji(text: str) -> Optional[str]:
    cleaned = clean_text(text)
    for token, kanji in DAY_KANJI_RULES:
        if token in cleaned:
            return kanji
    return None


def classify_layout(question_type: str) -> Optional[str]:
    qt = (question_type or "").lower()
    if qt in ("task_based_comprehension", "comprehension_of_key_points"):
        return "four_block"
    if qt == "verbal_expressions":
        return "single_scene"
    return None


def parse_set_range(spec: str) -> Set[int]:
    nums: Set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            nums.update(range(int(lo), int(hi) + 1))
        else:
            nums.add(int(part))
    return nums


def load_checkpoint() -> Set[str]:
    if not CHECKPOINT_PATH.is_file():
        return set()
    try:
        return set(json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8")).get("synced", []))
    except (OSError, json.JSONDecodeError):
        return set()


def save_checkpoint(synced: Set[str]) -> None:
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_PATH.write_text(
        json.dumps({"version": SHEET_VERSION, "synced": sorted(synced)}, indent=2),
        encoding="utf-8",
    )


def load_font(size: int, cjk: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for fp in (CJK_FONT_PATHS if cjk else FONT_PATHS):
        if Path(fp).exists():
            try:
                return ImageFont.truetype(fp, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def horde_headers(cfg: RuntimeConfig) -> Dict[str, str]:
    return {
        "apikey": cfg.horde_api_key,
        "Client-Agent": "NihonSync-JLPT:1.2:github.com/biki76/nihonsync-jlpt",
        "Content-Type": "application/json",
    }


def normalize_monochrome(img_bytes: bytes) -> Optional[Image.Image]:
    try:
        gray = Image.open(io.BytesIO(img_bytes)).convert("L")
    except Exception:
        return None
    if ImageStat.Stat(gray).mean[0] < 95.0:
        return None
    return ImageOps.autocontrast(gray, cutoff=2).convert("RGB")


def extract_json_object(raw: Any) -> Optional[Dict[str, Any]]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        return None
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        return None
    try:
        parsed = json.loads(m.group(0))
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def plan_visual_prompts(
    http: httpx.Client,
    cfg: RuntimeConfig,
    layout: str,
    level: str,
    prompt_ja: str,
    transcript_ja: str,
    options: List[Dict[str, Any]],
) -> Dict[str, Any]:
    safety_rule = (
        "Depict fully clothed ordinary Japanese people in G-rated everyday school, office, "
        "station, cafe, shop, or living-room scenes. Never use words like bath, shower, bed, "
        "or undress. Do NOT add whiteboards unless explicitly about a classroom. Never draw "
        "clocks or calendar text (overlaid separately)."
    )
    if layout == "single_scene":
        sys_msg = (
            f"You are an art director for official Japanese JLPT {level} textbook listening sheets. "
            f"{safety_rule} Describe ONE clear medium-shot scene between two polite Japanese people "
            'and respond ONLY with JSON: {"scene": "concise English visual", '
            '"speaker_side": "left" or "right", "speaker_posture": "seated" or "standing"}'
        )
        user_msg = f"Prompt: {prompt_ja}\nScript: {transcript_ja[:600]}"
    else:
        sys_msg = (
            f"You are an art director for official Japanese JLPT {level} 4-panel textbook sheets. "
            f"{safety_rule} Write 4 distinct, concrete English visual scenes matching each option 1-4 "
            'with no text or numbers drawn in the art. Respond ONLY with JSON: {"panels": ["p1", "p2", "p3", "p4"]}'
        )
        opts_txt = "\n".join(f"{o['index']}. {clean_text(o.get('text', ''))}" for o in options[:4])
        user_msg = f"Question: {prompt_ja}\nScript: {transcript_ja[:500]}\nOptions:\n{opts_txt}"

    if not cfg.cf_llm_exhausted:
        cf_url = f"https://api.cloudflare.com/client/v4/accounts/{cfg.cf_account_id}/ai/run/@cf/meta/llama-3.1-8b-instruct"
        try:
            resp = http.post(
                cf_url,
                headers={"Authorization": f"Bearer {cfg.cf_api_token}", "Content-Type": "application/json"},
                json={
                    "messages": [{"role": "system", "content": sys_msg}, {"role": "user", "content": user_msg}],
                    "max_tokens": 380,
                    "temperature": 0.15,
                },
                timeout=35.0,
            )
            if resp.status_code == 429:
                cfg.cf_llm_exhausted = True
            elif resp.status_code == 200:
                parsed = extract_json_object(resp.json().get("result", {}).get("response"))
                if parsed:
                    if layout == "single_scene" and parsed.get("scene"):
                        return {
                            "scene": str(parsed["scene"]),
                            "speaker_side": "left" if parsed.get("speaker_side") == "left" else "right",
                            "speaker_posture": "seated" if parsed.get("speaker_posture") == "seated" else "standing",
                        }
                    if layout == "four_block" and isinstance(parsed.get("panels"), list) and len(parsed["panels"]) >= 4:
                        return {"panels": [str(x) for x in parsed["panels"][:4]]}
        except Exception:
            pass

    if layout == "single_scene":
        return {
            "scene": f"Two polite Japanese people talking in everyday clothes in a bright room: {prompt_ja}",
            "speaker_side": "right",
            "speaker_posture": "standing",
        }
    return {"panels": [f"Clear Japanese textbook illustration depicting {clean_text(o.get('text', ''))}" for o in options[:4]]}


def build_prompt_pair(scene_desc: str, suppress_ai_clock: bool) -> Tuple[str, str]:
    safe_scene = re.sub(r"\s+", " ", scene_desc).strip()[:340]
    neg = NEGATIVE_PROMPT
    if suppress_ai_clock:
        safe_scene = re.sub(r"\b(?:wall\s+|analog\s+|round\s+)?clock(?:\s+showing\s+\d{1,2}:\d{2})?", "", safe_scene, flags=re.I)
        safe_scene = f"{safe_scene.strip().rstrip(',')}, plain clean wall background, no clock"
        neg += ", clock, wall clock, analog clock, digital clock, alarm clock"
    return f"{safe_scene}, {STYLE_SUFFIX}", neg


def render_via_cloudflare(
    http: httpx.Client, cfg: RuntimeConfig, scene_desc: str, suppress_ai_clock: bool
) -> Optional[Image.Image]:
    if cfg.cf_image_exhausted:
        return None
    prompt, _ = build_prompt_pair(scene_desc, suppress_ai_clock)
    fallback_prompt = f"Two polite Japanese students talking indoors with everyday study items, {STYLE_SUFFIX}"

    for model in CF_IMAGE_MODELS:
        url = f"https://api.cloudflare.com/client/v4/accounts/{cfg.cf_account_id}/ai/run/{model}"
        cur_prompt = prompt
        for _ in range(2):
            payload = {"prompt": cur_prompt, "steps": 3} if "flux" in model else {"prompt": cur_prompt, "num_steps": 4}
            try:
                resp = http.post(
                    url,
                    headers={"Authorization": f"Bearer {cfg.cf_api_token}", "Content-Type": "application/json"},
                    json=payload,
                    timeout=75.0,
                )
            except httpx.RequestError:
                time.sleep(2.0)
                continue

            if resp.status_code == 429 or "limit" in resp.text.lower() or "quota" in resp.text.lower():
                cfg.cf_image_exhausted = True
                print("\n  [INFO] Cloudflare daily Neuron quota reached -> switching to sequential AI Horde (640x512).")
                return None
            if resp.status_code >= 400:
                if "8007" in resp.text or "nsfw" in resp.text.lower():
                    cur_prompt = fallback_prompt
                    continue
                break

            ctype = resp.headers.get("content-type", "")
            raw = base64.b64decode(resp.json()["result"]["image"]) if "application/json" in ctype else resp.content
            img = normalize_monochrome(raw)
            if img is not None:
                return img
            cur_prompt = fallback_prompt
    return None


def submit_horde_job(
    http: httpx.Client, cfg: RuntimeConfig, scene_desc: str, suppress_ai_clock: bool, restrict_models: bool
) -> str:
    pos, neg = build_prompt_pair(scene_desc, suppress_ai_clock)
    payload: Dict[str, Any] = {
        "prompt": f"{pos} ### {neg}",
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
    if restrict_models:
        payload["models"] = GENERAL_HORDE_MODELS

    for attempt in range(8):
        try:
            resp = http.post(f"{HORDE_BASE}/generate/async", headers=horde_headers(cfg), json=payload, timeout=35.0)
            if resp.status_code == 429:
                time.sleep(5.0 * min(attempt + 1, 4))
                continue
            resp.raise_for_status()
            return str(resp.json()["id"])
        except (httpx.RequestError, httpx.HTTPStatusError):
            time.sleep(3.0 * min(attempt + 1, 5))
    raise RuntimeError("AI Horde job submission failed after retries.")


def render_via_aihorde(
    http: httpx.Client, cfg: RuntimeConfig, scene_desc: str, label: str, suppress_ai_clock: bool
) -> Image.Image:
    for job_try in range(3):
        jid = submit_horde_job(http, cfg, scene_desc, suppress_ai_clock, restrict_models=(job_try < 2))
        deadline = time.time() + 240.0
        while time.time() < deadline:
            time.sleep(3.0)
            try:
                st_resp = http.get(f"{HORDE_BASE}/generate/status/{jid}", headers=horde_headers(cfg), timeout=25.0)
                if st_resp.status_code in (404, 429):
                    if st_resp.status_code == 404:
                        break
                    time.sleep(4.0)
                    continue
                st_resp.raise_for_status()
                st = st_resp.json()
            except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
                continue

            if st.get("faulted"):
                break
            if st.get("done"):
                gens = st.get("generations") or []
                img_ref = gens[0].get("img", "") if gens else ""
                if not img_ref:
                    break
                raw = http.get(img_ref, timeout=45.0).content if img_ref.startswith("http") else base64.b64decode(img_ref)
                img = normalize_monochrome(raw)
                if img is not None:
                    return img
                break
            wait_s = st.get("wait_time", "?")
            sys.stdout.write(f"\r  [{label}] AI Horde ~{wait_s}s (try {job_try + 1}/3)   ")
            sys.stdout.flush()
    raise RuntimeError(f"AI Horde failed to produce valid monochrome panel for {label}.")


def render_panel(
    http: httpx.Client, cfg: RuntimeConfig, scene_desc: str, label: str, suppress_ai_clock: bool = False
) -> Image.Image:
    img = render_via_cloudflare(http, cfg, scene_desc, suppress_ai_clock)
    if img is not None:
        return img
    return render_via_aihorde(http, cfg, scene_desc, label, suppress_ai_clock)


def draw_speaker_arrow(draw: ImageDraw.ImageDraw, tip_x: int, tip_y: int, from_left: bool) -> None:
    dx = -76 if from_left else 76
    start = (tip_x + dx, tip_y - 56)
    end = (tip_x + (-20 if from_left else 20), tip_y - 14)
    draw.line([start, end], fill="#FFFFFF", width=26)
    draw.line([start, end], fill="#141414", width=16)
    head = (
        [(tip_x, tip_y), (tip_x - 40, tip_y - 6), (tip_x - 16, tip_y - 38)]
        if from_left
        else [(tip_x, tip_y), (tip_x + 40, tip_y - 6), (tip_x + 16, tip_y - 38)]
    )
    draw.polygon(head, fill="#141414")


def draw_jlpt_clock_badge(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, hour: int, minute: int) -> None:
    ink, pad = "#141414", 5
    draw.rounded_rectangle([cx - radius - pad, cy - radius - pad, cx + radius + pad, cy + radius + pad], radius=10, fill="#FFFFFF", outline=ink, width=2)
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill="#FFFFFF", outline=ink, width=3)
    for tick in range(12):
        ang = math.radians(tick * 30 - 90)
        r_in = radius - (9 if tick % 3 == 0 else 5)
        draw.line(
            [(cx + int(round(r_in * math.cos(ang))), cy + int(round(r_in * math.sin(ang)))),
             (cx + int(round((radius - 2) * math.cos(ang))), cy + int(round((radius - 2) * math.sin(ang))))],
            fill=ink, width=3 if tick % 3 == 0 else 2,
        )
    h_ang = math.radians(((hour % 12) + minute / 60.0) * 30.0 - 90.0)
    m_ang = math.radians(minute * 6.0 - 90.0)
    draw.line([(cx, cy), (cx + int(round(radius * 0.52 * math.cos(h_ang))), cy + int(round(radius * 0.52 * math.sin(h_ang))))], fill=ink, width=5)
    draw.line([(cx, cy), (cx + int(round(radius * 0.78 * math.cos(m_ang))), cy + int(round(radius * 0.78 * math.sin(m_ang))))], fill=ink, width=3)
    draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=ink)


def draw_jlpt_day_badge(draw: ImageDraw.ImageDraw, cx: int, cy: int, day_kanji: str) -> None:
    ink, hw, hh = "#141414", 34, 38
    x0, y0, x1, y1 = cx - hw, cy - hh, cx + hw, cy + hh
    draw.rounded_rectangle([x0, y0 + 6, x1, y1], radius=8, fill="#FFFFFF", outline=ink, width=2)
    draw.rectangle([x0, y0 + 6, x1, y0 + 21], fill=ink)
    draw.rectangle([x0 + 14, y0, x0 + 21, y0 + 11], fill="#FFFFFF", outline=ink, width=2)
    draw.rectangle([x1 - 21, y0, x1 - 14, y0 + 11], fill="#FFFFFF", outline=ink, width=2)
    day_font = load_font(34, cjk=True)
    bbox = draw.textbbox((0, 0), day_kanji, font=day_font)
    tx = cx - (bbox[2] - bbox[0]) // 2 - bbox[0]
    ty = (y0 + 21 + y1) // 2 - (bbox[3] - bbox[1]) // 2 - bbox[1]
    draw.text((tx, ty), day_kanji, fill=ink, font=day_font)


def compose_four_block(panels: List[Image.Image], options: List[Dict[str, Any]], out_path: Path) -> None:
    w, h, margin, gap = 1000, 760, 14, 16
    bw, bh = (w - margin * 2 - gap) // 2, (h - margin * 2 - gap) // 2
    canvas = Image.new("RGB", (w, h), "#FFFFFF")
    draw = ImageDraw.Draw(canvas)
    font = load_font(36)

    for idx in range(4):
        col, row = idx % 2, idx // 2
        x0, y0 = margin + col * (bw + gap), margin + row * (bh + gap)
        x1, y1 = x0 + bw, y0 + bh
        fitted = ImageOps.fit(panels[idx], (bw - 6, bh - 6), method=Image.Resampling.LANCZOS)
        canvas.paste(fitted, (x0 + 3, y0 + 3))
        draw.rectangle([x0, y0, x1, y1], outline="#141414", width=3)
        draw.rectangle([x0 + 6, y0 + 6, x0 + 46, y0 + 50], fill="#FFFFFF")
        draw.text((x0 + 15, y0 + 8), str(idx + 1), fill="#141414", font=font)

        if idx < len(options):
            opt_txt = str(options[idx].get("text", ""))
            tm = parse_japanese_clock_time(opt_txt)
            day_k = parse_japanese_day_kanji(opt_txt)
            if tm is not None and day_k is not None:
                draw_jlpt_clock_badge(draw, x1 - 50, y0 + 50, 36, tm[0], tm[1])
                draw_jlpt_day_badge(draw, x1 - 130, y0 + 50, day_k)
            elif tm is not None:
                draw_jlpt_clock_badge(draw, x1 - 54, y0 + 54, 40, tm[0], tm[1])
            elif day_k is not None:
                draw_jlpt_day_badge(draw, x1 - 48, y0 + 50, day_k)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def compose_single_scene(scene_img: Image.Image, speaker_side: str, speaker_posture: str, out_path: Path) -> None:
    w, h, margin = 1000, 680, 16
    iw, ih = w - margin * 2, h - margin * 2
    canvas = Image.new("RGB", (w, h), "#FFFFFF")
    canvas.paste(ImageOps.fit(scene_img, (iw, ih), method=Image.Resampling.LANCZOS), (margin, margin))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([margin, margin, w - margin, h - margin], outline="#141414", width=3)
    seated = speaker_posture == "seated"
    if speaker_side == "left":
        draw_speaker_arrow(draw, margin + int(iw * (0.31 if seated else 0.34)), margin + int(ih * (0.42 if seated else 0.25)), from_left=False)
    else:
        draw_speaker_arrow(draw, margin + int(iw * (0.69 if seated else 0.66)), margin + int(ih * (0.42 if seated else 0.25)), from_left=True)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def upload_png_with_retry(sb: Client, local_png: Path, storage_path: str) -> None:
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
            wait_s = 2.0 * (attempt + 1)
            print(f"\n  [RETRY {attempt + 1}/5] Upload {storage_path} ({type(exc).__name__}) -> wait {wait_s:.0f}s")
            time.sleep(wait_s)


def batch_upsert_questions(sb: Client, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    for attempt in range(4):
        try:
            sb.table("questions").upsert(rows, on_conflict="id").execute()
            return
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2.0 * (attempt + 1))


def process_exam(
    sb: Client,
    http: httpx.Client,
    cfg: RuntimeConfig,
    exam: Dict[str, Any],
    mg_type_by_id: Dict[str, str],
    questions: List[Dict[str, Any]],
    checkpoint: Set[str],
    force: bool,
) -> Tuple[int, int]:
    code = str(exam["exam_code"])
    lvl = str(exam["level"]).lower()
    padded = f"{int(exam['test_number']):02d}"
    sorted_qs = sorted(questions, key=lambda r: int(r["question_number"]))
    visual_qs = [q for q in sorted_qs if classify_layout(mg_type_by_id.get(q["mondai_group_id"], "")) is not None]
    print(f"\n=== {code} ({len(visual_qs)} visual sheets | {len(sorted_qs) - len(visual_qs)} audio-only) ===")

    updated_rows: List[Dict[str, Any]] = []
    synced_now, skipped = 0, 0
    for q in sorted_qs:
        q_no = int(q["question_number"])
        layout = classify_layout(mg_type_by_id.get(q["mondai_group_id"], ""))
        if layout is None:
            if q.get("image_url") is not None:
                row = dict(q)
                row["image_url"] = None
                updated_rows.append(row)
            continue

        storage_path = f"jlpt/{lvl}/mock{padded}/listening_q{q_no}_sheet_{SHEET_VERSION}.png"
        local_png = CACHE_ROOT / storage_path
        if not force and storage_path in checkpoint and q.get("image_url") == storage_path:
            skipped += 1
            continue

        if force or not local_png.exists() or local_png.stat().st_size < 1024:
            opts = q.get("options") or []
            plan = plan_visual_prompts(
                http, cfg, layout, str(exam["level"]),
                clean_text(q.get("prompt_html")), clean_text(q.get("transcript_ja")), opts,
            )
            if layout == "single_scene":
                side = plan.get("speaker_side", "right")
                posture = plan.get("speaker_posture", "standing")
                pos = "speaker on the left side" if side == "left" else "speaker on the right side"
                panel = render_panel(http, cfg, f"{plan['scene']}, {pos}", f"{code} Q{q_no} 1/1")
                compose_single_scene(panel, side, posture, local_png)
            else:
                panels = [
                    render_panel(
                        http, cfg, desc, f"{code} Q{q_no} {i + 1}/4",
                        suppress_ai_clock=(i < len(opts) and parse_japanese_clock_time(str(opts[i].get("text", ""))) is not None),
                    )
                    for i, desc in enumerate(plan["panels"][:4])
                ]
                compose_four_block(panels, opts, local_png)

        upload_png_with_retry(sb, local_png, storage_path)
        checkpoint.add(storage_path)
        save_checkpoint(checkpoint)
        row = dict(q)
        row["image_url"] = storage_path
        updated_rows.append(row)
        synced_now += 1
        print(f"\r  Synced {code} Q{q_no} ({layout}) -> {storage_path}          ")

    if updated_rows:
        batch_upsert_questions(sb, updated_rows)
        print(f"  DB synced: {len(updated_rows)} rows updated in 1 batch for {code}.")
    else:
        print(f"  All {skipped} visual sheets already synced for {code}.")
    return synced_now, skipped


def print_live_coverage(sb: Client) -> None:
    exams = sb.table("exams").select("id,level,test_number").in_("level", ["N5", "N4"]).execute().data or []
    secs = [
        s for s in fetch_paginated(sb, "exam_sections", "exam_id", [e["id"] for e in exams], "id,exam_id,section_code")
        if s["section_code"] == "LISTENING"
    ]
    mgs = fetch_paginated(sb, "mondai_groups", "section_id", [s["id"] for s in secs], "id,section_id,question_type")
    qs = fetch_paginated(sb, "questions", "mondai_group_id", [m["id"] for m in mgs], "id,mondai_group_id,image_url")

    def bucket(e: Dict[str, Any]) -> str:
        lvl, n = str(e["level"]), int(e["test_number"])
        return "N4 (curated 01-10)" if (lvl == "N4" and n <= 10) else (
            "N4 (placeholder 11-20)" if lvl == "N4" else "N5 (curated 01-20)"
        )

    exam_b = {e["id"]: bucket(e) for e in exams}
    sec_b = {s["id"]: exam_b[s["exam_id"]] for s in secs}
    mg_info = {m["id"]: (sec_b[m["section_id"]], classify_layout(m["question_type"])) for m in mgs}

    totals: Dict[str, List[int]] = {}
    for q in qs:
        b, layout = mg_info[q["mondai_group_id"]]
        if layout is None:
            continue
        totals.setdefault(b, [0, 0])
        totals[b][1] += 1
        if (q.get("image_url") or "").endswith(f"_sheet_{SHEET_VERSION}.png"):
            totals[b][0] += 1

    print(f"\n=== LIVE {SHEET_VERSION} VISUAL SHEET COVERAGE IN SUPABASE ===")
    for b in sorted(totals):
        done, total = totals[b]
        print(f"  {b:<24}: {done}/{total} visual questions have _sheet_{SHEET_VERSION}.png")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and sync v10.2 JLPT listening manga sheets.")
    parser.add_argument("--level", choices=["N5", "N4", "ALL"], default="ALL")
    parser.add_argument("--sets", default="1-2", help="Set range, e.g. '3-6', '7-10', '3-20'")
    parser.add_argument("--horde-only", action="store_true", help="Skip Cloudflare image API and use AI Horde directly")
    parser.add_argument("--force", action="store_true", help="Regenerate cached PNGs")
    args = parser.parse_args()

    cfg = load_config(args.horde_only)
    sb = create_client(cfg.supabase_url, cfg.supabase_key)
    levels = ["N5", "N4"] if args.level == "ALL" else [args.level]
    wanted = parse_set_range(args.sets)

    all_exams = sb.table("exams").select("id,exam_code,level,test_number").in_("level", levels).order("exam_code").execute().data or []
    exams = [
        e for e in all_exams
        if int(e["test_number"]) in wanted and not (e["level"] == "N4" and int(e["test_number"]) > 10)
    ]
    if not exams:
        print("No matching curated exams found.")
        return

    secs = [
        s for s in fetch_paginated(sb, "exam_sections", "exam_id", [e["id"] for e in exams], "id,exam_id,section_code")
        if s["section_code"] == "LISTENING"
    ]
    mgs = fetch_paginated(sb, "mondai_groups", "section_id", [s["id"] for s in secs], "id,section_id,question_type")
    qs = fetch_paginated(sb, "questions", "mondai_group_id", [m["id"] for m in mgs], "*")

    sec_to_exam = {s["id"]: s["exam_id"] for s in secs}
    mg_to_exam = {m["id"]: sec_to_exam[m["section_id"]] for m in mgs}
    mg_type = {m["id"]: str(m["question_type"]) for m in mgs}
    qs_by_exam: Dict[str, List[Dict[str, Any]]] = {}
    for q in qs:
        qs_by_exam.setdefault(mg_to_exam[q["mondai_group_id"]], []).append(q)

    mode = "AI Horde only (general 640x512)" if cfg.cf_image_exhausted else "Cloudflare FLUX -> AI Horde failover"
    print(f"Starting v10.2 Visual Pipeline | Mode: {mode} | Exams: {len(exams)}")
    checkpoint = load_checkpoint()
    total_new, total_skip = 0, 0
    with httpx.Client(http2=False) as http:
        for exam in exams:
            n_new, n_skip = process_exam(
                sb, http, cfg, exam, mg_type, qs_by_exam.get(exam["id"], []), checkpoint, args.force
            )
            total_new += n_new
            total_skip += n_skip

    print(f"\nRUN COMPLETE: {total_new} newly synced | {total_skip} skipped.")
    print_live_coverage(sb)


if __name__ == "__main__":
    main()
