#!/usr/bin/env python3
"""
Finds the copied N5 question set .zip archive in the project folder or
Acode storage mount, extracts it into data/raw_n5_6sets/, and summarizes
the extracted files.
"""

import json
import sys
import zipfile
from pathlib import Path
from typing import List, Optional

ZIP_LOCATIONS: List[Path] = [
    Path("/public/nihonsync-jlpt/JLPT_N5_SETS_01-05.zip"),
    Path("/public/nihonsync-jlpt/nihonsync-jlpt Question set.zip"),
    Path("/sdcard/Android/media/com.foxdebug.acodefree/nihonsync-jlpt/JLPT_N5_SETS_01-05.zip"),
    Path("/sdcard/Android/media/com.foxdebug.acodefree/nihonsync-jlpt/nihonsync-jlpt Question set.zip"),
]


def find_zip() -> Optional[Path]:
    for candidate in ZIP_LOCATIONS:
        try:
            if candidate.is_file():
                return candidate
        except OSError:
            continue

    for folder in (
        Path("/public/nihonsync-jlpt"),
        Path("/sdcard/Android/media/com.foxdebug.acodefree/nihonsync-jlpt"),
    ):
        try:
            if not folder.is_dir():
                continue
            zips = sorted(
                (p for p in folder.glob("*.zip") if p.is_file()),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if zips:
                return zips[0]
        except OSError:
            continue

    return None


def main() -> None:
    zip_path = Path(sys.argv[1]) if len(sys.argv) > 1 else find_zip()
    if zip_path is None or not zip_path.is_file():
        print("ERROR: No .zip archive found in /public/nihonsync-jlpt or Acode storage.")
        print("Verify the .zip is inside /public/nihonsync-jlpt or pass its path:")
        print("  python3 scripts/stage_copied_zip.py /path/to/file.zip")
        sys.exit(1)

    out_dir = Path("data/raw_n5_6sets")
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Found zip : {zip_path}")
    print(f"Extracting: {out_dir.resolve()}")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(out_dir)

    extracted = sorted(p for p in out_dir.rglob("*") if p.is_file())
    print(f"STAGED: {len(extracted)} files in {out_dir}")
    for item in extracted[:25]:
        print(f"  - {item.relative_to(out_dir)}")

    metas = sorted(out_dir.rglob("SET_METADATA.json"))
    if metas:
        sample = json.loads(metas[0].read_text(encoding="utf-8"))
        print(f"\n=== Sample {metas[0].relative_to(out_dir)} ===")
        print(json.dumps(sample, ensure_ascii=False, indent=2)[:1200])


if __name__ == "__main__":
    main()
