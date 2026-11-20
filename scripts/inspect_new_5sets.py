#!/usr/bin/env python3
"""
Extracts a staged N5 question set .zip archive from /public/nihonsync-jlpt
into data/raw_n5_sets/ and prints a summary of extracted files and metadata.
"""

import json
import sys
import zipfile
from pathlib import Path


def main() -> None:
    zip_files = sorted(Path(".").glob("*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not zip_files:
        print("ERROR: No .zip file found in", Path.cwd().resolve())
        print("Copy your .zip archive into /public/nihonsync-jlpt first, then re-run.")
        sys.exit(1)

    archive_path = zip_files[0]
    extract_root = Path("data/raw_n5_sets")
    extract_root.mkdir(parents=True, exist_ok=True)

    print(f"Extracting {archive_path.name} -> {extract_root}/ ...")
    with zipfile.ZipFile(archive_path, "r") as zf:
        zf.extractall(extract_root)

    extracted_entries = sorted(p for p in extract_root.rglob("*") if p.is_file())
    print(f"Extracted {len(extracted_entries)} files.")
    for entry in extracted_entries[:25]:
        print(f"  - {entry}")

    meta_files = sorted(extract_root.rglob("SET_METADATA.json"))
    if meta_files:
        sample_meta = json.loads(meta_files[0].read_text(encoding="utf-8"))
        print("\n=== Sample SET_METADATA.json ===")
        print(json.dumps(sample_meta, ensure_ascii=False, indent=2)[:1200])


if __name__ == "__main__":
    main()
