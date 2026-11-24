#!/usr/bin/env python3
"""Stages and inspects N5 (01-20) and N4 (01-05, 06-10) ZIP drafts safely."""

import json
import os
import shutil
import sys
import zipfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

UPLOADS_DIR = Path("data/uploads")
STAGED_DIR = Path("data/staged_drafts")
MAX_ZIP_FILES = 2000
MAX_ZIP_BYTES = 250 * 1024 * 1024

SOURCE_DIRS: Tuple[Path, ...] = (
    Path("/public/nihonsync-jlpt/data/uploads"),
    Path("/public/nihonsync-jlpt"),
    Path("/sdcard/Android/media/com.foxdebug.acodefree/nihonsync-jlpt"),
    Path("/sdcard/Android/media/com.foxdebug.acodefree"),
    Path("/storage/emulated/0/Android/media/com.foxdebug.acodefree/nihonsync-jlpt"),
    Path("/sdcard/Android/data/com.foxdebug.acodefree/files/nihonsync-jlpt"),
    Path("/storage/emulated/0/App Project/Mocktest Questions"),
    Path("/sdcard/App Project/Mocktest Questions"),
)


@dataclass(frozen=True)
class ProbeReport:
    readable_zips: List[Path]
    blocked_paths: List[str]
    missing_dirs: List[str]
    empty_dirs: List[str]


def test_zip_readability(path: Path) -> Tuple[bool, str]:
    """Verifies OS read permission and ZIP magic bytes."""
    try:
        with path.open("rb") as fh:
            header = fh.read(4)
        return (True, "ok") if header.startswith(b"PK") else (False, "invalid ZIP header")
    except PermissionError:
        return False, "EACCES (Android Scoped Storage)"
    except OSError as exc:
        return False, f"OSError: {exc}"


def collect_zips_bounded(root: Path, max_depth: int, blocked: List[str]) -> List[Path]:
    """Collects .zip files up to max_depth without swallowing PermissionError."""
    found: List[Path] = []
    stack: List[Tuple[Path, int]] = [(root, 0)]
    while stack:
        current, depth = stack.pop()
        try:
            entries = sorted(current.iterdir())
        except PermissionError:
            blocked.append(f"{current} -> EACCES (directory list denied)")
            continue
        except OSError as exc:
            blocked.append(f"{current} -> {exc}")
            continue
        for entry in entries:
            if entry.is_file() and entry.suffix.lower() == ".zip":
                found.append(entry)
            elif entry.is_dir() and depth < max_depth and entry.name not in {
                ".git", "node_modules", ".next", ".venv", "staged_drafts",
            }:
                stack.append((entry, depth + 1))
    return found


def scan_source_directories(cli_paths: List[str]) -> ProbeReport:
    """Explicitly distinguishes EACCES, ENOENT, empty dirs, and readable ZIPs."""
    readable: List[Path] = []
    blocked: List[str] = []
    missing: List[str] = []
    empty: List[str] = []
    seen_names: set[str] = set()

    for raw in cli_paths:
        p = Path(raw)
        ok, reason = test_zip_readability(p)
        if ok:
            seen_names.add(p.name)
            readable.append(p)
        else:
            blocked.append(f"{p} -> {reason}")

    for directory in SOURCE_DIRS:
        try:
            os.stat(directory)
        except FileNotFoundError:
            missing.append(str(directory))
            continue
        except PermissionError:
            blocked.append(f"{directory} -> EACCES (stat denied by Scoped Storage)")
            continue
        except OSError as exc:
            blocked.append(f"{directory} -> {exc}")
            continue

        zips = collect_zips_bounded(directory, max_depth=1, blocked=blocked)
        if not zips:
            empty.append(str(directory))
            continue
        for item in zips:
            if item.name in seen_names:
                continue
            ok, reason = test_zip_readability(item)
            if ok:
                seen_names.add(item.name)
                readable.append(item)
            else:
                blocked.append(f"{item} -> {reason}")

    return ProbeReport(readable, blocked, missing, empty)


def stage_to_uploads(zip_path: Path) -> Path:
    """Copies readable external ZIP into data/uploads/."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    target = (UPLOADS_DIR / zip_path.name).resolve()
    source = zip_path.resolve()
    if source != target:
        shutil.copy2(source, target)
        print(f"STAGED COPY: {source} -> {target}")
    return target


def safe_extract_zip(zip_path: Path, out_dir: Path) -> None:
    """Extracts ZIP while blocking Zip-Slip traversal and oversized payloads."""
    base = out_dir.resolve()
    total_bytes = 0
    with zipfile.ZipFile(zip_path, "r") as zf:
        infos = zf.infolist()
        if len(infos) > MAX_ZIP_FILES:
            raise ValueError(f"Archive exceeds {MAX_ZIP_FILES} file limit ({len(infos)})")
        for info in infos:
            member_path = Path(info.filename)
            if member_path.is_absolute():
                raise ValueError(f"Blocked absolute ZIP path: {info.filename}")
            dest = (base / member_path).resolve()
            if not dest.is_relative_to(base):
                raise ValueError(f"Blocked Zip-Slip traversal path: {info.filename}")
            if info.is_dir():
                dest.mkdir(parents=True, exist_ok=True)
                continue
            total_bytes += info.file_size
            if total_bytes > MAX_ZIP_BYTES:
                raise ValueError(f"Archive exceeds {MAX_ZIP_BYTES} byte uncompressed limit")
            dest.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info, "r") as src, dest.open("wb") as dst:
                shutil.copyfileobj(src, dst)


def infer_level_tag(zip_name: str, rel_paths: List[str]) -> str:
    haystack = (zip_name + " " + " ".join(rel_paths[:20])).upper()
    if "N4" in haystack and "N5" not in haystack:
        return "N4"
    if "N5" in haystack and "N4" not in haystack:
        return "N5"
    return "UNKNOWN"


def preview_json(path: Path, rel_label: str) -> None:
    print(f"\n  [JSON SAMPLE] {rel_label}")
    raw = path.read_text(encoding="utf-8", errors="replace")
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            print("  TOP KEYS:", list(parsed.keys()))
        elif isinstance(parsed, list):
            first_keys = list(parsed[0].keys()) if parsed and isinstance(parsed[0], dict) else []
            print(f"  ARRAY LEN: {len(parsed)} | ITEM[0] KEYS: {first_keys}")
        print(json.dumps(parsed, ensure_ascii=False, indent=2)[:1200])
    except json.JSONDecodeError as exc:
        print(f"  JSON ERROR: {exc}")
        print(raw[:900])


def preview_text(path: Path, rel_label: str) -> None:
    print(f"\n  [TEXT SAMPLE] {rel_label}")
    print(path.read_text(encoding="utf-8", errors="replace")[:1000])


def preview_pdf(path: Path, rel_label: str) -> None:
    print(f"\n  [PDF SAMPLE] {rel_label}")
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        print(f"  PAGES: {len(reader.pages)}")
        excerpt = "\n".join(
            (reader.pages[i].extract_text() or "")
            for i in range(min(2, len(reader.pages)))
        )
        print(excerpt[:900])
    except Exception as exc:
        print(f"  PDF preview skipped: {exc}")


def extract_and_inspect(staged_zip: Path) -> None:
    out_dir = STAGED_DIR / staged_zip.stem
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        safe_extract_zip(staged_zip, out_dir)
    except (zipfile.BadZipFile, ValueError) as exc:
        print(f"ERROR extracting {staged_zip.name}: {exc}")
        return

    files = sorted(p for p in out_dir.rglob("*") if p.is_file())
    rel_paths = [str(p.relative_to(out_dir)) for p in files]
    ext_counts: Dict[str, int] = dict(Counter(p.suffix.lower() or "(none)" for p in files))
    level_tag = infer_level_tag(staged_zip.name, rel_paths)

    print("\n" + "=" * 68)
    print(f"ARCHIVE: {staged_zip.name} | LEVEL: {level_tag} | FILES: {len(files)}")
    print(f"EXTENSIONS: {ext_counts}")
    print("SAMPLE PATHS (first 25):")
    for rel in rel_paths[:25]:
        print(f"  - {rel}")

    for ext, fn in ((".json", preview_json), (".md", preview_text), (".txt", preview_text), (".pdf", preview_pdf)):
        matches = [p for p in files if p.suffix.lower() == ext]
        if matches:
            fn(matches[0], str(matches[0].relative_to(out_dir)))


def print_diagnostics(report: ProbeReport) -> None:
    print("NO READABLE ZIP ARCHIVES FOUND.\n")
    print("DIAGNOSTIC REPORT:")
    for label, items in (
        ("BLOCKED (EACCES)", report.blocked_paths),
        ("EMPTY (0 .zip files)", report.empty_dirs),
        ("NOT FOUND (ENOENT)", report.missing_dirs),
    ):
        if items:
            print(f"  [{label}]")
            for line in items:
                print(f"    - {line}")
    print("\nCOPY YOUR 3 ZIPS TO ONE OF THESE PROOT-READABLE FOLDERS:")
    print("  1. Android/media/com.foxdebug.acodefree/nihonsync-jlpt")
    print("  2. /public/nihonsync-jlpt/data/uploads")
    print("Then re-run: python3 scripts/stage_and_inspect_zips.py")


def main() -> None:
    report = scan_source_directories(sys.argv[1:])
    if not report.readable_zips:
        print_diagnostics(report)
        sys.exit(1)

    print(f"FOUND {len(report.readable_zips)} READABLE ZIP ARCHIVE(S):")
    for item in report.readable_zips:
        print(f"  - {item} ({item.stat().st_size:,} bytes)")

    for item in report.readable_zips:
        staged = stage_to_uploads(item)
        extract_and_inspect(staged)


if __name__ == "__main__":
    main()
