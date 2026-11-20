#!/usr/bin/env python3
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=".env.local")

cache_base = Path("data/generated_listening_sheets_v6/jlpt/n5")
total_local = 0
next_pending = None

print("=== Local v6 Manga Sheet Progress (Target: 17 per set | 102 total) ===")
for s in range(1, 7):
    folder = cache_base / f"mock{s:02d}"
    files = sorted(folder.glob("listening_q*_sheet_v6.png")) if folder.exists() else []
    done_nums = sorted(int(f.name.split("_q")[1].split("_")[0]) for f in files)
    total_local += len(done_nums)
    missing = [q for q in range(1, 18) if q not in done_nums]
    if missing and next_pending is None:
        next_pending = f"JLPT-N5-MOCK-{s:02d} Q{missing[0]}"
    status = "COMPLETE" if len(done_nums) == 17 else f"Next: Q{missing[0]}"
    print(f"  MOCK-{s:02d}: {len(done_nums):2d}/17 generated  ({status})")

print(f"\nLocal PNG Cache Total : {total_local} / 102")
print(f"Resume Point          : {next_pending or 'All 102 sheets generated!'}")

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)
rows = (
    sb.table("questions")
    .select("audio_url, image_url")
    .not_.is_("audio_url", "null")
    .execute()
    .data
    or []
)
v6_img = sum(1 for r in rows if "_sheet_v6.png" in (r.get("image_url") or ""))
v6_aud = sum(1 for r in rows if "_v6.mp3" in (r.get("audio_url") or ""))
print(f"Synced in Supabase    : {v6_img} / 102 v6 sheets | {v6_aud} / 144 v6 audio tracks")
