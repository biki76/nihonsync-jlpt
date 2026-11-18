#!/usr/bin/env python3
"""
Directly probes Acode's Android storage paths (bypassing Android 11+ /sdcard
readdir restrictions) for 'JLPT_N5_SET_01'..'JLPT_N5_SET_06', copies them into
data/raw_n5_6sets/, and prints SET_01's schema.
"""

import json
import shutil
import sys
import zipfile
from pathlib import Path

DIRECT_BASE_CANDIDATES = [
    Path("data/raw_n5_6sets"),
    Path("."),
    Path("/sdcard/Android/data/com.foxdebug.acodefree/files/nihonsync-jlpt"),
    Path("/storage/emulated/0/Android/data/com.foxdebug.acodefree/files/nihonsync-jlpt"),
    Path("/sdcard/Android/media/com.foxdebug.acodefree/nihonsync-jlpt"),
    Path("/storage/emulated/0/Android/media/com.foxdebug.acodefree/nihonsync-jlpt"),
    Path("/sdcard/Acode Files/nihonsync-jlpt"),
    Path("/storage/emulated/0/Acode Files/nihonsync-jlpt"),
]

DIRECT_ZIP_CANDIDATES = [
    Path("nihonsync-jlpt Question set.zip"),
    Path("/sdcard/Android/data/com.foxdebug.acodefree/files/nihonsync-jlpt Question set.zip"),
    Path("/storage/emulated/0/Android/data/com.foxdebug.acodefree/files/nihonsync-jlpt Question set.zip"),
    Path("/sdcard/Android/data/com.foxdebug.acodefree/files/nihonsync-jlpt/nihonsync-jlpt Question set.zip"),
    Path("/storage/emulated/0/Android/data/com.foxdebug.acodefree/files/nihonsync-jlpt/nihonsync-jlpt Question set.zip"),
    Path("/sdcard/Download/nihonsync-jlpt Question set.zip"),
    Path("/storage/emulated/0/Download/nihonsync-jlpt Question set.zip"),
]


def locate_and_stage(extract_dir: Path) -> bool:
    # 1. Check if already staged in data/raw_n5_6sets
    if list(extract_dir.rglob("SET_METADATA.json")):
        print("Using already staged sets in:", extract_dir)
        return True

    # 2. Probe direct Acode Files folders for JLPT_N5_SET_01..06
    for base in DIRECT_BASE_CANDIDATES:
        try:
            set1 = base / "JLPT_N5_SET_01"
            if set1.exists() and set1.is_dir():
                print("Found Acode Files folder:", base)
                for idx in range(1, 7):
                    src = base / f"JLPT_N5_SET_0{idx}"
                    if src.exists() and src.is_dir():
                        dest = extract_dir / src.name
                        if dest.exists():
                            shutil.rmtree(dest)
                        shutil.copytree(src, dest)
                        print(f"  Copied {src.name} -> {dest}")
                return True
        except OSError:
            continue

    # 3. Probe direct ZIP paths
    for zpath in DIRECT_ZIP_CANDIDATES:
        try:
            if zpath.exists() and zpath.is_file():
                print("Found ZIP archive:", zpath)
                with zipfile.ZipFile(zpath, "r") as zf:
                    zf.extractall(extract_dir)
                return True
        except OSError:
            continue

    return False


def main() -> None:
    extract_dir = Path("data/raw_n5_6sets")
    extract_dir.mkdir(parents=True, exist_ok=True)

    if not locate_and_stage(extract_dir):
        print("Android Scoped Storage blocked direct access to Acode Files from proot.")
        print("Quick 5-second fix in Acode File Browser:")
        print("  1. Select JLPT_N5_SET_01..06 in 'Acode Files > nihonsync-jlpt' and tap Copy.")
        print("  2. Open 'public > nihonsync-jlpt > data > raw_n5_6sets' and tap Paste.")
        print("  3. Re-run: python3 scripts/extract_and_inspect.py")
        sys.exit(1)

    metas = sorted(extract_dir.rglob("SET_METADATA.json"))
    drafts = sorted(extract_dir.rglob("LISTENING_DRAFT.txt"))
    print(f"\nREADY: {len(metas)} SET_METADATA.json & {len(drafts)} LISTENING_DRAFT.txt files staged.")
    for mf in metas:
        print(f"  - {mf}")

    if metas:
        data = json.loads(metas[0].read_text(encoding="utf-8"))
        print("\n=== SET_01 SET_METADATA.json (Top keys & preview) ===")
        if isinstance(data, dict):
            print("Top keys:", list(data.keys()))
        print(json.dumps(data, ensure_ascii=False, indent=2)[:2800])

    if drafts:
        print("\n=== SET_01 LISTENING_DRAFT.txt (Preview) ===")
        print(drafts[0].read_text(encoding="utf-8")[:2800])


if __name__ == "__main__":
    main()
