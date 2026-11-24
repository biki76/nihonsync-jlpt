#!/usr/bin/env python3
"""Locates, stages, and inspects N5/N4 ZIP drafts in Acode storage."""

import json
import os
import shutil
import sys
import zipfile
from collections import Counter
from pathlib import Path
from typing import Dict, List, Set, Tuple

UPLOADS_DIR = Path("data/uploads")
STAGED_DIR = Path("data/staged_drafts")
MAX_FILES = 3000
MAX_BYTES = 350 * 1024 * 1024

SKIP_DIRS = {
    ".git", "node_modules", ".next", ".venv", "staged_drafts",
    "raw_n5_6sets", "generated_listening_audio",
    "generated_listening_sheets", "generated_listening_sheets_v6",
}

SCAN_ROOTS: Tuple[Path, ...] = (
    Path("/public/nihonsync-jlpt/data/uploads"),
    Path("/public/nihonsync-jlpt"),
    Path("/public"),
    Path("/sdcard/Android/media/com.foxdebug.acodefree"),
    Path("/sdcard/Android/media/com.foxdebug.acode"),
    Path("/sdcard/Android/data/com.foxdebug.acodefree/files"),
    Path("/sdcard/Android/data/com.foxdebug.acode/files"),
)


def is_readable_zip(path: Path) -> Tuple[bool, str]:
    try:
        with path.open("rb") as fh:
            return (True, "ok") if fh.read(4).startswith(b"PK") else (False, "bad header")
    except PermissionError:
        return False, "EACCES"
    except OSError as exc:
        return False, str(exc)


def walk_zips(root: Path, max_depth: int, blocked: List[str]) -> List[Path]:
    found: List[Path] = []
    stack: List[Tuple[Path, int]] = [(root, 0)]
    while stack:
        cur, depth = stack.pop()
        try:
            entries = sorted(cur.iterdir())
        except OSError as exc:
            blocked.append(f"{cur} -> {exc}")
            continue
        for item in entries:
            if item.is_file() and item.suffix.lower() == ".zip":
                found.append(item)
            elif item.is_dir() and depth < max_depth and item.name not in SKIP_DIRS:
                stack.append((item, depth + 1))
    return found


def safe_extract(zip_path: Path, out_dir: Path) -> None:
    base = out_dir.resolve()
    total = 0
    with zipfile.ZipFile(zip_path, "r") as zf:
        infos = zf.infolist()
        if len(infos) > MAX_FILES:
            raise ValueError(f"Too many files ({len(infos)})")
        for info in infos:
            rel = Path(info.filename)
            if rel.is_absolute():
                raise ValueError(f"Absolute path blocked: {info.filename}")
            dest = (base / rel).resolve()
            if not dest.is_relative_to(base):
                raise ValueError(f"Path traversal blocked: {info.filename}")
            if info.is_dir():
                dest.mkdir(parents=True, exist_ok=True)
                continue
            total += info.file_size
            if total > MAX_BYTES:
                raise ValueError("Archive exceeds size limit")
            dest.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info, "r") as src, dest.open("wb") as dst:
                shutil.copyfileobj(src, dst)


def preview_file(path: Path, label: str) -> None:
    ext = path.suffix.lower()
    print(f"\n  [{ext.upper()} SAMPLE] {label}")
    if ext == ".json":
        raw = path.read_text(encoding="utf-8", errors="replace")
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict):
                print("  TOP KEYS:", list(obj.keys()))
            elif isinstance(obj, list):
                keys = list(obj[0].keys()) if obj and isinstance(obj[0], dict) else []
                print(f"  ARRAY LEN: {len(obj)} | ITEM[0] KEYS: {keys}")
            print(json.dumps(obj, ensure_ascii=False, indent=2)[:1200])
        except json.JSONDecodeError as exc:
            print(f"  JSON ERROR: {exc}\n{raw[:800]}")
    elif ext in {".md", ".txt"}:
        print(path.read_text(encoding="utf-8", errors="replace")[:900])
    elif ext == ".pdf":
        try:
            from pypdf import PdfReader

            r = PdfReader(str(path))
            print(f"  PAGES: {len(r.pages)}")
            txt = "\n".join((r.pages[i].extract_text() or "") for i in range(min(2, len(r.pages))))
            print(txt[:900])
        except Exception as exc:
            print(f"  PDF preview skipped: {exc}")


def inspect_archive(src_zip: Path) -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    staged = (UPLOADS_DIR / src_zip.name).resolve()
    if src_zip.resolve() != staged:
        shutil.copy2(src_zip, staged)
        print(f"STAGED: {src_zip} -> {staged}")

    out_dir = STAGED_DIR / staged.stem
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        safe_extract(staged, out_dir)
    except (zipfile.BadZipFile, ValueError) as exc:
        print(f"ERROR extracting {staged.name}: {exc}")
        return

    files = sorted(p for p in out_dir.rglob("*") if p.is_file())
    rels = [str(p.relative_to(out_dir)) for p in files]
    exts: Dict[str, int] = dict(Counter(p.suffix.lower() or "(none)" for p in files))
    metas = [p for p in files if p.name == "SET_METADATA.json"]

    print("\n" + "=" * 64)
    print(f"ARCHIVE: {staged.name} | FILES: {len(files)} | METAS: {len(metas)}")
    print(f"EXTENSIONS: {exts}")
    print("SAMPLE PATHS (first 25):")
    for rel in rels[:25]:
        print(f"  - {rel}")

    for ext in (".json", ".txt", ".md", ".pdf"):
        matches = metas if (ext == ".json" and metas) else [p for p in files if p.suffix.lower() == ext]
        if matches:
            preview_file(matches[0], str(matches[0].relative_to(out_dir)))


def main() -> None:
    readable: List[Path] = []
    blocked: List[str] = []
    seen: Set[str] = set()

    for root in SCAN_ROOTS:
        try:
            os.stat(root)
        except OSError:
            continue
        for zp in walk_zips(root, max_depth=4, blocked=blocked):
            if zp.name in seen:
                continue
            ok, reason = is_readable_zip(zp)
            if ok:
                seen.add(zp.name)
                readable.append(zp)
            else:
                blocked.append(f"{zp} -> {reason}")

    if not readable:
        print("NO READABLE ZIP ARCHIVES FOUND.")
        if blocked:
            print("BLOCKED:", blocked[:10])
        print("\nVISIBLE TOP-LEVEL ENTRIES:")
        for d in SCAN_ROOTS[:5]:
            if d.is_dir():
                names = sorted(p.name for p in d.iterdir())[:20]
                print(f"  - {d}: {names}")
        sys.exit(1)

    print(f"FOUND {len(readable)} READABLE ZIP ARCHIVE(S):")
    for zp in readable:
        print(f"  - {zp} ({zp.stat().st_size:,} bytes)")

    for zp in readable:
        inspect_archive(zp)


if __name__ == "__main__":
    main()
