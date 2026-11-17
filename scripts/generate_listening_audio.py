#!/usr/bin/env python3
"""
NihonSync Multi-Speaker JLPT Listening Audio Generator (edge-tts)
Parses Japanese listening scripts (男： / 女： / ナレーター：), synthesizes
neural Japanese speech via Microsoft Edge TTS, and uploads MP3 files to the
'jlpt-media' Supabase Storage bucket.
"""

import asyncio
import os
import re
import sys
from pathlib import Path
import edge_tts
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")
load_dotenv()

VOICE_MALE = "ja-JP-KeitaNeural"
VOICE_FEMALE = "ja-JP-NanamiNeural"
VOICE_NARRATOR = "ja-JP-NanamiNeural"

SPEAKER_PATTERN = re.compile(r"^(男|女|男性|女性|ナレーター|アナウンサー)\s*[：:]\s*(.+)$")


def parse_dialogue_turns(transcript_ja: str) -> list[tuple[str, str, str]]:
    """Splits a multi-line JLPT transcript into (voice, rate, spoken_text) turns."""
    turns: list[tuple[str, str, str]] = []
    for raw_line in transcript_ja.strip().splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = SPEAKER_PATTERN.match(line)
        if match:
            speaker, spoken = match.group(1), match.group(2).strip()
            if speaker in ("男", "男性"):
                turns.append((VOICE_MALE, "-4%", spoken))
            elif speaker in ("女", "女性"):
                turns.append((VOICE_FEMALE, "-4%", spoken))
            else:
                turns.append((VOICE_NARRATOR, "-6%", spoken))
        else:
            turns.append((VOICE_NARRATOR, "-5%", line))
    return turns


async def synthesize_transcript_mp3(transcript_ja: str, output_path: Path) -> Path:
    """Synthesizes all speaker turns into a single MP3 file without needing ffmpeg."""
    turns = parse_dialogue_turns(transcript_ja)
    if not turns:
        raise ValueError("Empty transcript_ja provided for TTS synthesis.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    audio_chunks: list[bytes] = []

    for voice, rate, text in turns:
        communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])

    output_path.write_bytes(b"".join(audio_chunks))
    return output_path


def upload_to_jlpt_media(local_mp3: Path, storage_path: str) -> str:
    """Uploads an MP3 file to Supabase Storage bucket 'jlpt-media'."""
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")

    supabase = create_client(url, key)
    clean_storage_path = storage_path.lstrip("/")
    with local_mp3.open("rb") as f:
        supabase.storage.from_("jlpt-media").upload(
            path=clean_storage_path,
            file=f,
            file_options={"content-type": "audio/mpeg", "upsert": "true"},
        )
    return clean_storage_path


async def run_smoke_test() -> None:
    sample_script = (
        "女：すみません、郵便局はどこですか。\n"
        "男：この道をまっすぐ行って、一つ目の角を右に曲がってください。"
    )
    out = Path("/tmp/nihonsync_tts_test.mp3")
    await synthesize_transcript_mp3(sample_script, out)
    print(f"OK: Generated {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    if "--test" in sys.argv:
        asyncio.run(run_smoke_test())
    else:
        print("Ready: import synthesize_transcript_mp3 & upload_to_jlpt_media, or run with --test.")
