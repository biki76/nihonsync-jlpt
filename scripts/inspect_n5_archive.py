#!/usr/bin/env python3
"""
Locates 'nihonsync-jlpt Question set.zip' (or extracted JLPT_N5_SET_* folders)
in internal storage (/public and mounted storage roots), extracts into
data/raw_n5_6sets/, and prints the schema of SET_01..SET_06.
"""

import json
import shutil
import sys
import zipfile
from pathlib import Path

SKIP_ROOTS = {
    "/proc", "/sys", "/dev", "/usr", "/lib", "/lib64",
    "/bin", "/sbin", "/etc", "/var", "/run", "/tmp",
}


def find_archive_or_extracted() -> tuple[Path | None, list[Path]]:
    candidates: list[Path] = [
        Path.cwd().parent / "nihonsync-jlpt Question set.zip",
        Path.cwd() / "nihonsync-jlpt Question set.zip",
    ]

    # Also scan top-level mounted storage directories (such as /public, /storage, /mnt, /sdcard)
    for top in Path("/").iterdir():
        if str(top) in SKIP_ROOTS or not top.is_dir():
            continue
        for pat in ("*.zip", "*/*.zip"):
            try:
                for z in top.glob(pat):
                    if z.is_file():
                        candidates.append(z)
            except OSError:
                continue

    seen: set[str] = set()
    for z in candidates:
        try:
            key = str(z.resolve())
        except OSError:
            key = str(z)
        if key in seen or not z.exists():
            continue
        seen.add(key)
        try:
            with zipfile.ZipFile(z, "r") as zf:
                names = zf.namelist()
                if any("JLPT_N5_SET_01" in n or "SET_METADATA.json" in n for n in names):
                    return z, []
        except (zipfile.BadZipFile, OSError):
            continue

    # Fallback: check if JLPT_N5_SET_* directories are already extracted in cwd or parent
    extracted_dirs: list[Path] = []
    for base in (Path.cwd(), Path.cwd().parent):
        if base.exists():
            extracted_dirs.extend(sorted(base.glob("JLPT_N5_SET_*")))
    return None, extracted_dirs


def main() -> None:
    extract_dir = Path("data/raw_n5_6sets")
    extract_dir.mkdir(parents=True, exist_ok=True)

    zip_path, extracted_dirs = find_archive_or_extracted()

    if zip_path:
        print(f"Found archive: {zip_path}")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_dir)
        print(f"Extracted to: {extract_dir}")
    elif extracted_dirs:
        print(f"Found {len(extracted_dirs)} extracted set directories:")
        for d in extracted_dirs:
            dest = extract_dir / d.name
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(d, dest)
            print(f"  Copied {d} -> {dest}")
    else:
        print("ERROR: Could not find 'nihonsync-jlpt Question set.zip' or JLPT_N5_SET_* folders.")
        print("Checked parent directory:", Path.cwd().parent)
        sys.exit(1)

    meta_files = sorted(extract_dir.rglob("SET_METADATA.json"))
    draft_files = sorted(extract_dir.rglob("LISTENING_DRAFT.txt"))
    print(f"\nDiscovered {len(meta_files)} SET_METADATA.json files and {len(draft_files)} LISTENING_DRAFT.txt files:")
    for mf in meta_files:
        print(f"  - {mf}")

    if meta_files:
        data = json.loads(meta_files[0].read_text(encoding="utf-8"))
        print(f"\n=== {meta_files[0].name} (Top-level keys) ===")
        if isinstance(data, dict):
            print("Keys:", list(data.keys()))
        print(json.dumps(data, ensure_ascii=False, indent=2)[:2800])

    if draft_files:
        print(f"\n=== {draft_files[0].name} (First 2800 chars) ===")
        print(draft_files[0].read_text(encoding="utf-8")[:2800])


if __name__ == "__main__":
    main()
