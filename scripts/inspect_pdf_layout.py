#!/usr/bin/env python3
"""
Extracts sample pages from SET_01/Examination.pdf, SET_01/Answer_Key.pdf,
and SET_04/Listening_Scripts.pdf via pypdf to verify Japanese glyph extraction
and exact question/option formatting before batch compilation.
"""

from pathlib import Path
from pypdf import PdfReader


def dump_pdf_sample(pdf_path: Path, max_pages: int = 3, max_chars: int = 2400) -> None:
    print(f"\n==================== {pdf_path} ====================")
    if not pdf_path.exists():
        print("MISSING:", pdf_path)
        return
    reader = PdfReader(str(pdf_path))
    print(f"Total pages: {len(reader.pages)}")
    chunks: list[str] = []
    for idx in range(min(max_pages, len(reader.pages))):
        txt = reader.pages[idx].extract_text() or ""
        chunks.append(f"--- Page {idx + 1} ---\n{txt}")
    combined = "\n".join(chunks)
    print(combined[:max_chars])


def main() -> None:
    base = Path("data/raw_n5_6sets")
    exam_pdfs = sorted(base.rglob("Examination.pdf"))
    key_pdfs = sorted(base.rglob("Answer_Key.pdf"))
    script_pdfs = sorted(base.rglob("Listening_Scripts.pdf"))

    print(f"Found {len(exam_pdfs)} Examination.pdf, {len(key_pdfs)} Answer_Key.pdf, {len(script_pdfs)} Listening_Scripts.pdf")

    if exam_pdfs:
        dump_pdf_sample(exam_pdfs[0], max_pages=4, max_chars=3000)
    if key_pdfs:
        dump_pdf_sample(key_pdfs[0], max_pages=2, max_chars=1800)
    if len(script_pdfs) >= 4:
        dump_pdf_sample(script_pdfs[3], max_pages=2, max_chars=1800)


if __name__ == "__main__":
    main()
