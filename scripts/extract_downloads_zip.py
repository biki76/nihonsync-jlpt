#!/usr/bin/env python3
"""
Finds and extracts the N5 question set .zip archive from Android internal
storage Downloads folders into data/raw_n5_sets/, then prints a summary.
"""

import json
import sys
import zipfile
from pathlib import Path
from typing import List, Optional

DOWNLOAD_CANDIDATE_DIRS: List[Path] = [
    Path("/sdcard/Download"),
    Path("/storage/emulated/0/Download"),
    Path("/storage/self/primary/Download"),
    Path.home() / "storage" / "downloads",
    Path.home() / "downloads",
    Path("/public/nihonsync-jlpt"),
    Path("/public"),
]

KNOWN_FILENAMES: List[str] = [
    "JLPT_N5_SET_01-05.zip",
    "JLPT_N5_SETS_01-05.zip",
    "nihonsync-jlpt Question set.zip",
]


def resolve_archive() -> Optional[Path]:
    for directory in DOWNLOAD_CANDIDATE_DIRS:
        for name in KNOWN_FILENAMES:
            candidate = directory / name
            try:
                if candidate.is_file():
                    return candidate
            except OSError:
                continue

    for directory in DOWNLOAD_CANDIDATE_DIRS:
        try:
            if not directory.is_dir():
                continue
            zips = sorted(
                (p for p in directory.glob("*.zip") if p.is_file()),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            for zpath in zips:
                try:
                    with zipfile.ZipFile(zpath, "r") as zf:
                        names = zf.namelist()
                        if any("SET_" in n or "METADATA" in n or "LISTENING" in n for n in names):
                            return zpath
                except (zipfile.BadZipFile, OSError):
                    continue
        except OSError:
            continue

    return None


def main() -> None:
    archive_path = Path(sys.argv[1]) if len(sys.argv) > 1 else resolve_archive()
    if archive_path is None or not archive_path.is_file():
        print("ERROR: Could not locate the .zip archive in internal storage Downloads.")
        print("Checked directories:")
        for d in DOWNLOAD_CANDIDATE_DIRS:
            print(f"  - {d}")
        print("\nTip: Copy the .zip into Acode's project root (/public/nihonsync-jlpt/) or pass its exact path:")
        print("  python3 scripts/extract_downloads_zip.py /path/to/archive.zip")
        sys.exit(1)

    output_dir = Path("data/raw_n5_sets")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Found archive : {archive_path}")
    print(f"Extracting to : {output_dir.resolve()}")
    with zipfile.ZipFile(archive_path, "r") as zf:
        zf.extractall(output_dir)

    extracted_files = sorted(p for p in output_dir.rglob("*") if p.is_file())
    print(f"Extracted {len(extracted_files)} files:")
    for item in extracted_files[:30]:
        print(f"  - {item.relative_to(output_dir)}")

    meta_files = sorted(output_dir.rglob("SET_METADATA.json"))
    if meta_files:
        meta_preview = json.loads(meta_files[0].read_text(encoding="utf-8"))
        print(f"\n=== Sample {meta_files[0].relative_to(output_dir)} ===")
        print(json.dumps(meta_preview, ensure_ascii=False, indent=2)[:1500])


if __name__ == "__main__":
    main()
