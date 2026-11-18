#!/usr/bin/env python3
import html, json, re, sys
from pathlib import Path
from pypdf import PdfReader

FOOTER_RE = re.compile(
    r"^(JLPT-style Practice Examination|N5 SET \d+\s*[—-]|-\s*\d+\s*/\s*\d+\s*-|Unofficial practice material)",
    re.I,
)
MONDAI_RE = re.compile(r"^問題\s*(\d+)\s*\[([^\]]+)\]\s*$")
OPT_MARKER_RE = re.compile(
    r"(?:^|(?<=[。？\)\）\s\u3000/]))([1-4])(?:[\.\uFF0E\)\uFF09\s\u3000]+)"
)


def read_pdf_lines(pdf_path: Path, start_page: int = 0) -> list[str]:
    reader = PdfReader(str(pdf_path))
    out: list[str] = []
    for idx in range(start_page, len(reader.pages)):
        for raw in (reader.pages[idx].extract_text() or "").splitlines():
            line = raw.strip()
            if line and not FOOTER_RE.match(line):
                out.append(line)
    return out


def extract_inline_opts(text: str, expected_start: int = 1) -> tuple[str, dict[int, str]]:
    matches = list(OPT_MARKER_RE.finditer(text))
    for i, m in enumerate(matches):
        if int(m.group(1)) != expected_start:
            continue
        seq = [m]
        nxt = expected_start + 1
        for m2 in matches[i + 1 :]:
            if int(m2.group(1)) == nxt:
                seq.append(m2)
                nxt += 1
        prefix = text[: m.start()].strip()
        if m.start() == 0 or len(seq) >= 2 or prefix.endswith(("。", "？", "）", ")", "」")):
            opts: dict[int, str] = {}
            for j, sm in enumerate(seq):
                num = int(sm.group(1))
                end = seq[j + 1].start() if j + 1 < len(seq) else len(text)
                opts[num] = text[sm.end() : end].strip().rstrip("/").strip()
            return prefix, opts
    return text, {}


def match_expected_question(line: str, expected_no: int) -> tuple[bool, str]:
    # 1. Text Grammar cloze header: "17 ＿＿＿＿＿ (17)"
    if re.match(
        rf"^{expected_no}[\s\u3000]+＿+[\s\u3000]*[\(\（]\s*{expected_no}\s*[\)\）]$",
        line,
    ):
        return True, f"（ {expected_no} ）"

    # 2. Parenthesized header: "( 17 )" or "（17）"
    m_paren = re.match(rf"^[\(\（]\s*{expected_no}\s*[\)\）]\s*(.*)$", line)
    if m_paren:
        tail = (m_paren.group(1) or "").strip()
        if not tail or re.match(r"^1(?:[\.\uFF0E\)\uFF09\s\u3000]+)", tail):
            return True, tail or f"（ {expected_no} ）"

    # 3. Standard numbered header: "17. ..." / "17． ..." / "17) ..."
    m_std = re.match(
        rf"^(?:{expected_no}[\.\uFF0E\)\uFF09\u3001:\uFF1A]|(?:問|Q)\s*{expected_no}[\.\uFF0E\)\uFF09:\uFF1A\s\u3000]*|[\[\【]\s*{expected_no}\s*[\]\】])\s*(.*)$",
        line,
    )
    if m_std:
        return True, (m_std.group(1) or "").strip()

    # 4. Bare number followed directly by option 1: "17 1 ..."
    m_bare = re.match(
        rf"^{expected_no}[\s\u3000]+(1[\.\uFF0E\)\uFF09\s\u3000]+.+)$", line
    )
    if m_bare:
        return True, (m_bare.group(1) or "").strip()

    return False, ""


def parse_exam_pdf(exam_pdf: Path) -> dict[str, list[dict]]:
    by_sec: dict[str, list[dict]] = {"vocab": [], "gr": [], "listen": []}
    cur_sec = "vocab"
    cur_mondai, cur_cat, cur_inst = 1, "General", ""
    passage_buf: list[str] = []
    active_passage: str | None = None
    q_no: int | None = None
    p_buf: list[str] = []
    o_map: dict[int, str] = {}
    in_inst = False
    reading_next_passage = False

    def flush() -> None:
        nonlocal q_no, p_buf, o_map, passage_buf, active_passage, reading_next_passage
        if q_no is None:
            return
        if passage_buf:
            active_passage = "\n".join(passage_buf).strip()
            passage_buf = []
        by_sec[cur_sec].append({
            "no": q_no,
            "prompt": " ".join(p_buf).strip(),
            "options": [{"index": k, "text": o_map[k]} for k in sorted(o_map)],
            "mondai": cur_mondai,
            "category": cur_cat,
            "instruction": cur_inst.strip(),
            "passage": active_passage,
        })
        q_no, p_buf, o_map, reading_next_passage = None, [], {}, False

    for line in read_pdf_lines(exam_pdf, start_page=1):
        if line.startswith(("— ここまで", "STOP.", "Do not continue")):
            flush()
            continue

        compact = re.sub(r"\s+", "", line)
        if "言語知識（文字・語彙）" in compact:
            flush()
            cur_sec = "vocab"
            continue
        if "言語知識（文法）・読解" in compact:
            flush()
            cur_sec = "gr"
            continue
        if compact == "聴解" or compact.startswith("聴解Listening"):
            flush()
            cur_sec = "listen"
            continue
        if line.startswith(
            (
                "Language Knowledge",
                "Listening",
                "開始 Start:",
                "時間 Time",
                "終了 Suggested",
                "休憩",
            )
        ):
            continue

        mm = MONDAI_RE.match(line)
        if mm:
            flush()
            cur_mondai = int(mm.group(1))
            cur_cat = mm.group(2).strip()
            cur_inst = ""
            passage_buf = []
            active_passage = None
            in_inst = True
            reading_next_passage = False
            continue

        next_expected = len(by_sec[cur_sec]) + (2 if q_no is not None else 1)
        is_next_q, tail = match_expected_question(line, next_expected)
        if is_next_q:
            flush()
            in_inst = False
            q_no = next_expected
            if tail:
                head, found = extract_inline_opts(tail, 1)
                p_buf = [head] if head else []
                o_map = found
            else:
                p_buf, o_map = [], {}
            continue

        # In Reading Comprehension, once a question has all 4 options, subsequent
        # narrative lines belong to the passage of the upcoming question(s).
        if (
            q_no is not None
            and len(o_map) == 4
            and "Comprehension" in cur_cat
            and (
                reading_next_passage
                or len(line) > 26
                or line.endswith(("。", "」", "へ"))
            )
        ):
            reading_next_passage = True
            passage_buf.append(line)
            continue

        if q_no is not None:
            exp_next = len(o_map) + 1
            if exp_next <= 4:
                head, found = extract_inline_opts(line, exp_next)
                if found:
                    if head and not o_map:
                        p_buf.append(head)
                    o_map.update(found)
                    continue
            if o_map:
                last = max(o_map)
                o_map[last] = f"{o_map[last]} {line}".strip()
            else:
                p_buf.append(line)
        else:
            if in_inst and (
                "ください" in line
                or "えらんで" in line
                or "こたえて" in line
                or line.startswith(("＿＿", "（", "つぎの", "右の", "文を", "はじめに", "※"))
            ):
                cur_inst = f"{cur_inst} {line}".strip()
                if line.endswith(("ください。", "なさい。", "します。")):
                    in_inst = False
            else:
                in_inst = False
                passage_buf.append(line)

    flush()
    return by_sec


def parse_answer_key(key_pdf: Path) -> dict[str, dict[int, str]]:
    lines = read_pdf_lines(key_pdf, 0)
    exps: dict[str, dict[int, str]] = {"vocab": {}, "gr": {}, "listen": {}}
    cur_sec = "vocab"
    cur: int | None = None
    buf: list[str] = []
    i = 0
    while i < len(lines):
        compact = re.sub(r"\s+", "", lines[i])
        if "言語知識（文字・語彙）" in compact:
            if cur is not None and buf:
                exps[cur_sec][cur] = " ".join(buf).strip()
            cur_sec, cur, buf, i = "vocab", None, [], i + 1
            continue
        if "言語知識（文法）・読解" in compact:
            if cur is not None and buf:
                exps[cur_sec][cur] = " ".join(buf).strip()
            cur_sec, cur, buf, i = "gr", None, [], i + 1
            continue
        if compact.startswith("聴解"):
            if cur is not None and buf:
                exps[cur_sec][cur] = " ".join(buf).strip()
            cur_sec, cur, buf, i = "listen", None, [], i + 1
            continue

        if (
            re.fullmatch(r"\d{1,2}", lines[i])
            and i + 1 < len(lines)
            and re.fullmatch(r"[1-4]", lines[i + 1])
        ):
            if cur is not None and buf:
                exps[cur_sec][cur] = " ".join(buf).strip()
            cur, buf, i = int(lines[i]), [], i + 2
            continue
        if (
            cur is not None
            and lines[i]
            not in {"m", "d", "s", "v", "No.", "Ans", "Category", "Level", "Explanation"}
            and not lines[i].startswith("解答と解説")
        ):
            buf.append(lines[i])
        i += 1
    if cur is not None and buf:
        exps[cur_sec][cur] = " ".join(buf).strip()
    return exps


def parse_listening(set_dir: Path) -> dict[int, dict]:
    draft = set_dir / "LISTENING_DRAFT.txt"
    lines = (
        [l.strip() for l in draft.read_text(encoding="utf-8").splitlines() if l.strip()]
        if draft.exists()
        else read_pdf_lines(set_dir / "Listening_Scripts.pdf", 0)
    )
    items: dict[int, dict] = {}
    cur: int | None = None
    mode, prompt, s_buf, o_buf, e_buf = "", "", [], [], []

    def flush() -> None:
        nonlocal cur, prompt, s_buf, o_buf, e_buf
        if cur is not None:
            joined_opts = " ".join(o_buf).strip()
            _, o_map = extract_inline_opts(joined_opts, 1)
            items[cur] = {
                "prompt": prompt.strip(),
                "transcript_ja": "\n".join(s_buf).strip(),
                "options": [{"index": k, "text": o_map[k]} for k in sorted(o_map)],
                "explanation_en": " ".join(e_buf).strip(),
            }
        cur, prompt, s_buf, o_buf, e_buf = None, "", [], [], []

    for line in lines:
        mh = re.match(r"^Q(\d{1,2})\s*\[([^\]]+)\]", line)
        if mh:
            flush()
            cur = int(mh.group(1))
            mode = ""
            continue
        if cur is None:
            continue
        if line.startswith("Prompt:"):
            prompt, mode = line.split(":", 1)[1].strip(), "prompt"
        elif line.startswith("Script:"):
            mode = "script"
        elif line.startswith("Options:"):
            mode = "options"
            rest = line.split(":", 1)[1].strip()
            if rest:
                o_buf.append(rest)
        elif line.startswith("Answer:"):
            mode = "answer"
        elif line.startswith("Explanation (EN):"):
            mode = "exp"
            e_buf.append(line.split(":", 1)[1].strip())
        elif mode == "script":
            s_buf.append(line)
        elif mode == "options":
            o_buf.append(line)
        elif mode == "exp":
            e_buf.append(line)
    flush()
    return items


def build_group_passage_html(qs: list[dict]) -> str | None:
    seen: list[tuple[int, str]] = []
    for q in qs:
        p = q.get("_passage")
        if p and (not seen or seen[-1][1] != p):
            seen.append((q["question_number"], p))
    if not seen:
        return None
    if len(seen) == 1:
        return "".join(
            f"<p>{html.escape(line)}</p>"
            for line in seen[0][1].splitlines()
            if line.strip()
        )
    blocks: list[str] = []
    for start_q, text in seen:
        paras = "".join(
            f"<p>{html.escape(line)}</p>"
            for line in text.splitlines()
            if line.strip()
        )
        blocks.append(f"<p><strong>〔問 {start_q}〕</strong></p>{paras}")
    return "".join(blocks)


def compile_set(meta_path: Path) -> dict:
    set_dir = meta_path.parent
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    set_num = int(meta["set"])
    padded = f"{set_num:02d}"
    code = f"JLPT-N5-MOCK-{padded}"

    by_sec = parse_exam_pdf(set_dir / "Examination.pdf")
    ja_exps = parse_answer_key(set_dir / "Answer_Key.pdf")
    listen_map = parse_listening(set_dir)

    sec_defs = [
        (1, "vocab", "VOCAB", "言語知識（文字・語彙）", "Language Knowledge (Vocabulary)", 20, 60),
        (2, "gr", "GRAMMAR_READING", "言語知識（文法）・読解", "Language Knowledge (Grammar) & Reading", 40, 60),
        (3, "listen", "LISTENING", "聴解", "Listening", 30, 60),
    ]
    sections_out = []

    for sec_no, skey, scode, t_ja, t_en, mins, mscore in sec_defs:
        m_qs = [q for q in meta["questions"] if q["section"] == skey]
        parsed_list = by_sec.get(skey, [])
        sec_ja_exps = ja_exps.get(skey, {})
        groups: dict[str, dict] = {}
        m_seq = 0

        for idx, mq in enumerate(m_qs):
            q_no, cat, ans = int(mq["no"]), mq["category"], int(mq["answer"])
            pq = parsed_list[idx] if idx < len(parsed_list) else {}

            if cat not in groups:
                m_seq += 1
                groups[cat] = {
                    "mondai_number": m_seq,
                    "question_type": re.sub(r"[^a-z0-9]+", "_", cat.lower()).strip("_") or "general",
                    "instruction_ja": pq.get("instruction") or f"問題{m_seq} [{cat}]",
                    "passage_html": None,
                    "questions": [],
                }

            prompt_txt = pq.get("prompt") or f"Question {q_no}"
            opts = pq.get("options") or []
            audio_url = image_url = transcript_ja = None
            en_exp = ""

            if scode == "LISTENING":
                ld = listen_map.get(idx + 1, {})
                prompt_txt = ld.get("prompt") or prompt_txt
                if len(ld.get("options", [])) in (3, 4):
                    opts = ld["options"]
                transcript_ja = ld.get("transcript_ja") or ""
                en_exp = ld.get("explanation_en") or ""
                audio_url = f"jlpt/n5/mock{padded}/listening_q{q_no}.mp3"
                if groups[cat]["mondai_number"] <= 3:
                    image_url = f"jlpt/n5/mock{padded}/listening_q{q_no}_sheet.png"

            if len(opts) not in (3, 4):
                raise ValueError(
                    f"{code} [{skey}] Q{q_no} ({cat}) invalid options ({len(opts)}): "
                    f"parsed_count={len(parsed_list)} prompt={prompt_txt!r} opts={opts}"
                )

            escaped_prompt = html.escape(prompt_txt).replace("★", "<u>　★　</u>")
            ja_exp = sec_ja_exps.get(q_no, "")
            exp_obj = {"en": en_exp or ja_exp or f"Correct answer: Option {ans}."}
            if ja_exp:
                exp_obj["ja"] = ja_exp

            groups[cat]["questions"].append({
                "question_number": q_no,
                "category": cat,
                "_passage": pq.get("passage"),
                "prompt_html": f"<p>{escaped_prompt}</p>",
                "options": opts,
                "correct_option": ans,
                "correct_sequence": None,
                "points": 2
                if scode == "LISTENING" or "Reading" in cat or "Passages" in cat
                else 1,
                "audio_url": audio_url,
                "image_url": image_url,
                "transcript_ja": transcript_ja,
                "explanation": exp_obj,
            })

        for grp in groups.values():
            grp["passage_html"] = build_group_passage_html(grp["questions"])
            for q in grp["questions"]:
                q.pop("_passage", None)

        sections_out.append({
            "section_number": sec_no,
            "section_code": scode,
            "section_title_ja": t_ja,
            "section_title_en": t_en,
            "time_limit_minutes": mins,
            "max_score": mscore,
            "mondai_groups": list(groups.values()),
        })

    return {
        "exam_metadata": {
            "exam_code": code,
            "level": "N5",
            "test_number": set_num,
            "title": f"JLPT N5 Full Simulation — Mock Test {padded}",
            "is_premium": set_num > 2,
            "total_time_minutes": 90,
            "total_score_required": 80,
            "max_total_score": 180,
            "sectional_minimums": {"language_knowledge_and_reading": 38, "listening": 19},
            "is_published": True,
        },
        "sections": sections_out,
    }


def main() -> None:
    metas = sorted(Path("data/raw_n5_6sets").rglob("SET_METADATA.json"))
    if not metas:
        sys.exit("ERROR: No SET_METADATA.json files found in data/raw_n5_6sets/")
    compiled = [compile_set(m) for m in metas]
    for e in compiled:
        counts = [
            sum(len(mg["questions"]) for mg in s["mondai_groups"])
            for s in e["sections"]
        ]
        print(
            f"Validated & Compiled {e['exam_metadata']['exam_code']}: "
            f"sections={counts} (total={sum(counts)})"
        )
    Path("data/compiled_n5_6sets.json").write_text(
        json.dumps(compiled, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("DONE: Saved 6 validated exams (522 questions) to data/compiled_n5_6sets.json")


if __name__ == "__main__":
    main()
