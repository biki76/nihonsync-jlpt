#!/usr/bin/env python3
"""Stages and inspects N5 (01-20) and N4 (01-05, 06-10) ZIP drafts."""

import json
import shutil
import sys
import zipfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

UPLOADS_DIR = Path("data/uploads")
STAGED_DIR = Path("data/staged_drafts")

SOURCE_DIRS: Tuple[Path, ...] = (
    Path("/public/nihonsync-jlpt/data/uploads"),
    Path("/storage/emulated/0/App Project/Mocktest Questions"),
    Path("/sdcard/App Project/Mocktest Questions"),
    Path("/public/App Project/Mocktest Questions"),
    Path("/public/nihonsync-jlpt"),
)


@dataclass(frozen=True)
class ProbeReport:
    readable_zips: List[Path]
    blocked_paths: List[str]
    missing_dirs: List[str]


def test_zip_readability(path: Path) -> Tuple[bool, str]:
    """Verifies OS read permission and ZIP header magic bytes."""
    try:
        with path.open("rb") as fh:
            header = fh.read(4)
        if not header.startswith(b"PK"):
            return False, "not a valid ZIP header"
        return True, "ok"
    except PermissionError:
        return False, "PermissionError (Android Scoped Storage)"
    except OSError as exc:
        return False, f"OSError: {exc}"


def scan_source_directories() -> ProbeReport:
    """Scans candidate storage folders and classifies readable vs blocked."""
    readable: List[Path] = []
    blocked: List[str] = []
    missing: List[str] = []
    seen_names: set[str] = set()

    for directory in SOURCE_DIRS:
        try:
            if not directory.exists():
                missing.append(str(directory))
                continue
            entries = sorted(directory.iterdir())
        except PermissionError:
            blocked.append(f"{directory} (directory read denied)")
            continue
        except OSError as exc:
            blocked.append(f"{directory} ({exc})")
            continue

        for item in entries:
            if item.suffix.lower() != ".zip" or item.name in seen_names:
                continue
            ok, reason = test_zip_readability(item)
            if ok:
                seen_names.add(item.name)
                readable.append(item)
            else:
                blocked.append(f"{item} -> {reason}")

    return ProbeReport(readable, blocked, missing)


def stage_to_uploads(zip_path: Path) -> Path:
    """Copies readable external ZIP into data/uploads/ for stable reuse."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    target = (UPLOADS_DIR / zip_path.name).resolve()
    source = zip_path.resolve()
    if source != target:
        shutil.copy2(source, target)
        print(f"STAGED COPY: {source} -> {target}")
    return target


def infer_level_tag(zip_name: str, rel_paths: List[str]) -> str:
    """Infers JLPT level tag from archive name or inner file paths."""
    haystack = (zip_name + " " + " ".join(rel_paths[:20])).upper()
    if "N4" in haystack and "N5" not in haystack:
        return "N4"
    if "N5" in haystack and "N4" not in haystack:
        return "N5"
    return "UNKNOWN"


def preview_json(path: Path, rel_label: str) -> None:
    """Prints top-level keys and a bounded JSON snippet."""
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
    """Prints the opening excerpt of a Markdown or plain text file."""
    print(f"\n  [TEXT SAMPLE] {rel_label}")
    print(path.read_text(encoding="utf-8", errors="replace")[:1000])


def preview_pdf(path: Path, rel_label: str) -> None:
    """Extracts page count and a short text excerpt if pypdf is available."""
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
    """Extracts one ZIP into data/staged_drafts/ and prints schema details."""
    out_dir = STAGED_DIR / staged_zip.stem
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(staged_zip, "r") as zf:
            zf.extractall(out_dir)
    except zipfile.BadZipFile as exc:
        print(f"ERROR: Corrupt ZIP {staged_zip.name}: {exc}")
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

    jsons = [p for p in files if p.suffix.lower() == ".json"]
    texts = [p for p in files if p.suffix.lower() in {".md", ".txt"}]
    pdfs = [p for p in files if p.suffix.lower() == ".pdf"]

    if jsons:
        preview_json(jsons[0], str(jsons[0].relative_to(out_dir)))
    if texts:
        preview_text(texts[0], str(texts[0].relative_to(out_dir)))
    if pdfs:
        preview_pdf(pdfs[0], str(pdfs[0].relative_to(out_dir)))


def print_scoped_storage_help(report: ProbeReport) -> None:
    """Explains exact next step if Android Scoped Storage blocks external reads."""
    print("NO READABLE ZIP ARCHIVES FOUND.")
    if report.blocked_paths:
        print("\nBLOCKED BY ANDROID SCOPED STORAGE:")
        for line in report.blocked_paths:
            print(f"  ! {line}")
    print("\nACTION REQUIRED (via Acode File Sidebar):")
    print("  1. Open Internal Storage -> App Project -> Mocktest Questions")
    print("  2. Copy your 3 ZIP files (1 N5 + 2 N4) into:")
    print("     nihonsync-jlpt/data/uploads/")
    print("  3. Re-run: python3 scripts/stage_and_inspect_zips.py")


def main() -> None:
    report = scan_source_directories()
    if not report.readable_zips:
        print_scoped_storage_help(report)
        sys.exit(1)

    print(f"FOUND {len(report.readable_zips)} READABLE ZIP ARCHIVE(S):")
    for item in report.readable_zips:
        print(f"  - {item} ({item.stat().st_size:,} bytes)")

    for item in report.readable_zips:
        staged = stage_to_uploads(item)
        extract_and_inspect(staged)


if __name__ == "__main__":
    main()
