#!/usr/bin/env python3
"""
Finds .zip files in accessible workspace directories, extracts N5 question
archives into data/raw_n5_6sets, and reports what was discovered.
"""

import json
import sys
import zipfile
from pathlib import Path
from typing import List, Optional


def find_zip_candidates() -> List[Path]:
    search_dirs = [
        Path.cwd(),
        Path.cwd().parent,
        Path("data/raw_n5_6sets"),
    ]
    found: List[Path] = []
    seen = set()
    for folder in search_dirs:
        try:
            if not folder.is_dir():
                continue
            for item in sorted(folder.glob("*.zip")):
                key = str(item)
                if key not in seen and item.is_file():
                    seen.add(key)
                    found.append(item)
        except OSError:
            continue
    return found


def pick_n5_zip(candidates: List[Path]) -> Optional[Path]:
    for zp in candidates:
        try:
            with zipfile.ZipFile(zp, "r") as zf:
                names = zf.namelist()
                if any("SET_" in n or "METADATA" in n or "LISTENING" in n for n in names):
                    return zp
        except (zipfile.BadZipFile, OSError):
            continue
    return candidates[0] if candidates else None


def main() -> None:
    out_dir = Path("data/raw_n5_6sets")
    out_dir.mkdir(parents=True, exist_ok=True)

    existing_metas = sorted(out_dir.rglob("SET_METADATA.json"))
    if existing_metas:
        print(f"ALREADY STAGED: {len(existing_metas)} SET_METADATA.json files in {out_dir}")
        for m in existing_metas:
            print(f"  - {m}")
        return

    candidates = find_zip_candidates()
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else pick_n5_zip(candidates)

    if target is None or not target.is_file():
        print("NO ACCESSIBLE ZIP FOUND in /public/nihonsync-jlpt or /public.")
        print("In Acode's file tree, copy your .zip file into /public/nihonsync-jlpt/ and run:")
        print("  python3 scripts/locate_and_extract_zip.py")
        sys.exit(1)

    print(f"EXTRACTING: {target} -> {out_dir}")
    with zipfile.ZipFile(target, "r") as zf:
        zf.extractall(out_dir)

    files = sorted(p for p in out_dir.rglob("*") if p.is_file())
    print(f"EXTRACTED: {len(files)} files into {out_dir}")
    for f in files[:25]:
        print(f"  - {f.relative_to(out_dir)}")

    metas = sorted(out_dir.rglob("SET_METADATA.json"))
    if metas:
        sample = json.loads(metas[0].read_text(encoding="utf-8"))
        print(f"\nSample {metas[0].name} keys:", list(sample.keys()) if isinstance(sample, dict) else type(sample))


if __name__ == "__main__":
    main()
