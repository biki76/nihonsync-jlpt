#!/usr/bin/env python3
"""
Verifies all staged JLPT N5 sets inside data/raw_n5_6sets and reports
question counts and listening script availability per set.
"""

import json
import sys
from pathlib import Path


def main() -> None:
    root = Path("data/raw_n5_6sets")
    meta_files = sorted(root.rglob("SET_METADATA.json"))
    if not meta_files:
        print("ERROR: No SET_METADATA.json files found under data/raw_n5_6sets.")
        sys.exit(1)

    print(f"Verified {len(meta_files)} N5 sets in {root}:")
    for mf in meta_files:
        data = json.loads(mf.read_text(encoding="utf-8"))
        set_no = data.get("set", "?")
        counts = data.get("counts", {})
        total_q = data.get("total_questions", "?")
        draft_here = list(mf.parent.glob("LISTENING_DRAFT.txt"))
        script_pdf = list(mf.parent.glob("Listening_Scripts.pdf"))
        listen_src = (
            draft_here[0].name
            if draft_here
            else (script_pdf[0].name if script_pdf else "MISSING")
        )
        print(
            f"  - Set {set_no} ({mf.parent.name}): total={total_q}, "
            f"counts={counts}, listening={listen_src}"
        )


if __name__ == "__main__":
    main()
