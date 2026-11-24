#!/usr/bin/env python3
"""Compiles and validates 20 N5 + 10 N4 staged sets into Supabase-ready JSON."""

import html
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pypdf import PdfReader

STAGED_ROOTS: Tuple[Path, ...] = (
    Path("data/staged_drafts/JLPT_N5_COMPLETE_20_SETS"),
    Path("data/staged_drafts/JLPT_N4_CHUNK1_SETS_01-05"),
    Path("data/staged_drafts/JLPT_N4_CHUNK2_SETS_06-10"),
)
OUTPUT_PATH = Path("data/compiled_n5_n4_30sets.json")

LEVEL_SPECS: Dict[str, Dict[str, Any]] = {
    "N5": {
        "total_time": 90,
        "pass_mark": 80,
        "mins": {"vocab": 20, "gr": 40, "listen": 30},
        "minimums": {"language_knowledge_and_reading": 38, "listening": 19},
    },
    "N4": {
        "total_time": 115,
        "pass_mark": 90,
        "mins": {"vocab": 25, "gr": 55, "listen": 35},
        "minimums": {"language_knowledge_and_reading": 38, "listening": 19},
    },
}

CATEGORY_TYPE: Dict[str, Tuple[str, int, str]] = {
    "Kanji Reading": ("kanji_reading", 1, "＿＿＿の ことばは ひらがなで どう かきますか。"),
    "Orthography": ("orthography", 1, "＿＿＿の ことばは どう かきますか。"),
    "Contextually-defined Expressions": ("contextually_defined_expressions", 1, "（　）に なにを いれますか。"),
    "Paraphrases": ("paraphrases", 1, "＿＿＿の ぶんと だいたい おなじ いみの ぶんは どれですか。"),
    "Usage": ("usage", 1, "つぎの ことばの つかいかたで いちばん いい ものを えらんで ください。"),
    "Sentential Grammar 1 (Selecting Grammar Form)": ("sentence_grammar_1", 1, "（　）に なにを いれますか。"),
    "Sentential Grammar 2 (Sentence Composition)": ("sentence_grammar_2_star", 2, "★に はいる ものは どれですか。"),
    "Text Grammar": ("text_grammar", 2, "つぎの ぶんしょうを よんで、ぶんしょうの ないように あう ものを えらんで ください。"),
    "Comprehension (Short Passages)": ("reading_short_passage", 3, "つぎの ぶんしょうを よんで、しつもんに こたえて ください。"),
    "Comprehension (Mid-size Passages)": ("reading_mid_passage", 3, "つぎの ぶんしょうを よんで、しつもんに こたえて ください。"),
    "Information Retrieval": ("information_retrieval", 3, "つぎの じょうほうを みて、しつもんに こたえて ください。"),
    "Task-based Comprehension": ("task_based_comprehension", 2, "もんだい1では、まず しつもんを きいて ください。"),
    "Comprehension of Key Points": ("comprehension_of_key_points", 2, "もんだい2では、まず しつもんを きいて ください。"),
    "Verbal Expressions": ("verbal_expressions", 2, "もんだい3では、えを みながら しつもんを きいて ください。"),
    "Quick Response": ("quick_response", 2, "もんだい4では、えなどが ありません。ぶんを きいて、1から 3の なかから えらんで ください。"),
}

PASSAGE_CATS = {
    "Text Grammar",
    "Comprehension (Short Passages)",
    "Comprehension (Mid-size Passages)",
    "Information Retrieval",
}

FOOTER_RE = re.compile(
    r"^(JLPT-style Practice Examination|N[1-5]\s+SET\s+\d+|-\s*\d+\s*/\s*\d+\s*-|"
    r"Unofficial practice material|—\s*ここまで|STOP\.\s*Do not continue|"
    r"開始\s*Start:|時間\s*Time allowed:|終了\s*Suggested end:)",
    re.I,
)
MONDAI_HDR_RE = re.compile(r"^問題\s*(\d+)\s*\[([^\]]+)\]\s*$")
INLINE_OPT_RE = re.compile(r"(?:^|(?<=[\s\u3000。？\)\）/?]))([1-4])(?:[\.\uFF0E\)\uFF09\s\u3000]+)")
PASSAGE_START_RE = re.compile(
    r"^(?:[（\(]\s*\d+\s*[）\)]|【[^】]+】|件名[:：]|差出人[:：]|宛先[:：]|"
    r"お知らせ|メモ|手紙|日記|メール|文章\s*\d+|ポスター|案内)"
)


@dataclass(frozen=True)
class ParsedItem:
    no: int
    prompt: str
    options: List[Dict[str, Any]]
    passage: Optional[str]


def read_pdf_lines(pdf_path: Path, start_page: int = 0) -> List[str]:
    reader = PdfReader(str(pdf_path))
    lines: List[str] = []
    for idx in range(start_page, len(reader.pages)):
        for raw in (reader.pages[idx].extract_text() or "").splitlines():
            line = raw.strip()
            if line and not FOOTER_RE.match(line):
                lines.append(line)
    return lines


def split_exam_sections(lines: List[str]) -> Tuple[List[str], List[str]]:
    vocab: List[str] = []
    gr: List[str] = []
    bucket = "vocab"
    for line in lines:
        if "言語知識（文法）・読解" in line or "Language Knowledge (Grammar)" in line:
            bucket = "gr"
            continue
        if line in {"聴解", "Listening"} or line.startswith(("聴解 ", "聴解　", "聴解Listening")):
            break
        if "言語知識（文字・語彙）" in line or "Language Knowledge (Vocabulary)" in line:
            continue
        (vocab if bucket == "vocab" else gr).append(line)
    return vocab, gr


def match_q_header(line: str, expected_no: int, is_cloze: bool) -> Tuple[bool, str]:
    if is_cloze:
        m_c = re.match(
            rf"^{expected_no}[\s\u3000]+(?:[_＿―─\-]+[\s\u3000]*)?[\(\（\[\【]\s*{expected_no}\s*[\)\）\]\】]\s*(.*)$",
            line,
        )
        if m_c:
            tail = (m_c.group(1) or "").strip()
            return True, tail or f"（ {expected_no} ）"
        m_u = re.match(rf"^{expected_no}[\s\u3000]+[_＿―─\-]+\s*(.*)$", line)
        if m_u:
            tail = (m_u.group(1) or "").strip()
            return True, tail or f"（ {expected_no} ）"
        m_p = re.match(rf"^[\(\（]\s*{expected_no}\s*[\)\）]\s*(.*)$", line)
        if m_p:
            tail = (m_p.group(1) or "").strip()
            if not tail or re.match(r"^1(?:[\.\uFF0E\)\uFF09\s\u3000]+)", tail):
                return True, tail or f"（ {expected_no} ）"
        if re.fullmatch(rf"{expected_no}", line):
            return True, f"（ {expected_no} ）"
    m_std = re.match(
        rf"^(?:{expected_no}(?:[\.\uFF0E\)\uFF09\u3001]|:(?!\d)|\uFF1A(?!\d))|"
        rf"(?:問|Q)\s*{expected_no}[\.\uFF0E\)\uFF09:\uFF1A\s\u3000]*|"
        rf"[\[\【]\s*{expected_no}\s*[\]\】])\s*(.*)$",
        line,
    )
    if m_std:
        return True, (m_std.group(1) or "").strip()
    m_bare = re.match(rf"^{expected_no}[\s\u3000]+(1[\.\uFF0E\)\uFF09\s\u3000]+.+)$", line)
    if m_bare:
        return True, (m_bare.group(1) or "").strip()
    return False, ""


def extract_inline_opts(text: str, start_idx: int = 1) -> Tuple[str, Dict[int, str]]:
    matches = list(INLINE_OPT_RE.finditer(text))
    for i, m in enumerate(matches):
        if int(m.group(1)) != start_idx:
            continue
        seq = [m]
        nxt = start_idx + 1
        for m2 in matches[i + 1 :]:
            if int(m2.group(1)) == nxt:
                seq.append(m2)
                nxt += 1
        prefix = text[: m.start()].strip()
        if m.start() == 0 or len(seq) >= 2 or prefix.endswith(("。", "？", "）", ")", "」")):
            opts: Dict[int, str] = {}
            for j, sm in enumerate(seq):
                end = seq[j + 1].start() if j + 1 < len(seq) else len(text)
                opts[int(sm.group(1))] = text[sm.end() : end].strip().rstrip("/").strip()
            return prefix, opts
    return text, {}


def is_instruction_line(line: str) -> bool:
    markers = ("えらんで", "ください。", "ひらがなで", "どう かきますか", "なにを いれますか", "どれですか", "こたえて")
    return any(m in line for m in markers) and not re.match(r"^\d+[\.\uFF0E\)\s]", line)


def parse_section_lines(
    lines: List[str], meta_qs: List[Dict[str, Any]]
) -> Tuple[Dict[int, ParsedItem], Dict[str, str]]:
    parsed: Dict[int, ParsedItem] = {}
    instructions: Dict[str, str] = {}
    q_idx = 0
    cur_no: Optional[int] = None
    cur_cat = ""
    cur_prompt: List[str] = []
    cur_opts: Dict[int, str] = {}
    cur_opt_key: Optional[int] = None
    pending_passage: List[str] = []
    cur_passage: Optional[str] = None
    in_instr = False
    instr_buf: List[str] = []

    def flush_current() -> None:
        nonlocal cur_no, cur_prompt, cur_opts, cur_opt_key, cur_passage
        if cur_no is None:
            return
        opt_list = [{"index": k, "text": cur_opts[k].strip()} for k in sorted(cur_opts) if cur_opts[k].strip()]
        prompt_txt = " ".join(p for p in cur_prompt if p).strip() or f"（ {cur_no} ）"
        parsed[cur_no] = ParsedItem(cur_no, prompt_txt, opt_list, cur_passage)
        cur_no = None
        cur_prompt, cur_opts, cur_opt_key, cur_passage = [], {}, None, None

    for line in lines:
        m_hdr = MONDAI_HDR_RE.match(line)
        if m_hdr:
            flush_current()
            if instr_buf and cur_cat:
                instructions[cur_cat] = " ".join(instr_buf)
            cur_cat = m_hdr.group(2).strip()
            in_instr, instr_buf, pending_passage = True, [], []
            continue

        if q_idx < len(meta_qs):
            exp_no = int(meta_qs[q_idx]["no"])
            exp_cat = str(meta_qs[q_idx]["category"])
            matched, tail = match_q_header(line, exp_no, exp_cat == "Text Grammar")
            if matched:
                flush_current()
                if instr_buf and cur_cat:
                    instructions.setdefault(cur_cat, " ".join(instr_buf))
                in_instr, instr_buf = False, []
                cur_no = exp_no
                cur_cat = exp_cat
                cur_passage = "\n".join(pending_passage).strip() or None
                pending_passage = []
                q_idx += 1
                if tail:
                    pref, found = extract_inline_opts(tail, 1)
                    if pref:
                        cur_prompt.append(pref)
                    if found:
                        cur_opts.update(found)
                        cur_opt_key = max(found)
                continue

        if cur_no is None:
            if in_instr and (is_instruction_line(line) or not instr_buf):
                instr_buf.append(line)
                if line.endswith("ください。") or line.endswith("。"):
                    instructions[cur_cat] = " ".join(instr_buf)
                    in_instr, instr_buf = False, []
            else:
                pending_passage.append(line)
            continue

        if cur_opt_key == 4 and cur_cat in PASSAGE_CATS and (
            PASSAGE_START_RE.match(line) or (len(cur_opts.get(4, "")) > 0 and cur_opts[4].endswith(("。", "か。", "です", "ます", "円", "日", "時")))
        ):
            pending_passage.append(line)
            continue

        nxt_opt = (max(cur_opts) + 1) if cur_opts else 1
        pref, found = extract_inline_opts(line, nxt_opt)
        if found:
            if pref and not cur_opts:
                cur_prompt.append(pref)
            elif pref and cur_opt_key:
                cur_opts[cur_opt_key] = f"{cur_opts[cur_opt_key]} {pref}".strip()
            cur_opts.update(found)
            cur_opt_key = max(found)
        elif cur_opt_key is not None:
            cur_opts[cur_opt_key] = f"{cur_opts[cur_opt_key]} {line}".strip()
        else:
            cur_prompt.append(line)

    flush_current()
    return parsed, instructions


def parse_answer_key(pdf_path: Path) -> Dict[Tuple[str, int], str]:
    lines = read_pdf_lines(pdf_path, start_page=0)
    exps: Dict[Tuple[str, int], str] = {}
    sec = "vocab"
    i = 0
    while i < len(lines):
        ln = lines[i]
        if "言語知識（文法）・読解" in ln or "Language Knowledge (Grammar)" in ln:
            sec = "gr"
            i += 1
            continue
        if "聴解" in ln and "Listening" in ln:
            sec = "listen"
            i += 1
            continue
        m_row = re.match(r"^(\d+)\s+([1-4])\s+(.+?)\s+([smdv])\s+(.+)$", ln)
        if m_row:
            exps[(sec, int(m_row.group(1)))] = m_row.group(5).strip()
            i += 1
            continue
        if re.fullmatch(r"\d+", ln) and i + 2 < len(lines) and re.fullmatch(r"[1-4]", lines[i + 1]):
            q_no = int(ln)
            j = i + 2
            while j < len(lines) and not re.fullmatch(r"[smdv]", lines[j]):
                j += 1
            j += 1
            buf: List[str] = []
            while j < len(lines):
                if re.fullmatch(r"\d+", lines[j]) and j + 1 < len(lines) and re.fullmatch(r"[1-4]", lines[j + 1]):
                    break
                if any(h in lines[j] for h in ("言語知識", "聴解", "No.", "Ans", "Category")):
                    break
                buf.append(lines[j])
                j += 1
            exps[(sec, q_no)] = " ".join(buf).strip()
            i = j
            continue
        i += 1
    return exps


def parse_listening_draft(txt_path: Path) -> Dict[int, Dict[str, Any]]:
    raw = txt_path.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"(?m)^(?=Q\d+\s*\[)", raw)
    items: Dict[int, Dict[str, Any]] = {}
    for blk in blocks:
        m_q = re.match(r"^Q(\d+)\s*\[[^\]]+\]", blk.strip())
        if not m_q:
            continue
        q_no = int(m_q.group(1))
        prompt_m = re.search(r"(?m)^Prompt:\s*(.+)$", blk)
        script_m = re.search(r"(?ms)^Script:\s*\n(.*?)(?=^(?:Options:|Answer:|Explanation))", blk)
        opts_m = re.search(r"(?ms)^Options:\s*\n?(.*?)(?=^Answer:)", blk)
        exp_m = re.search(r"(?ms)^Explanation(?:\s*\(EN\))?:\s*(.+?)\s*$", blk)

        opts: List[Dict[str, Any]] = []
        if opts_m:
            opt_body = opts_m.group(1).strip()
            for m_o in re.finditer(r"(?m)^([1-4])[\.\uFF0E\)\uFF09\s]+(.+)$", opt_body):
                opts.append({"index": int(m_o.group(1)), "text": m_o.group(2).strip()})
            if not opts and opt_body:
                _, inline = extract_inline_opts(opt_body, 1)
                opts = [{"index": k, "text": v} for k, v in sorted(inline.items())]
        items[q_no] = {
            "prompt": prompt_m.group(1).strip() if prompt_m else "（音声を聞いて答えてください）",
            "script": script_m.group(1).strip() if script_m else "",
            "options": opts,
            "explanation_en": exp_m.group(1).strip() if exp_m else "",
        }
    return items


def format_prompt_html(prompt: str, category: str, exp_ja: str) -> str:
    safe = html.escape(prompt)
    if category == "Sentential Grammar 2 (Sentence Composition)":
        return safe.replace("★", "<u>　★　</u>")
    if category in {"Kanji Reading", "Orthography"} and "=" in exp_ja:
        left, right = exp_ja.split("=", 1)
        left_tok = html.escape(re.sub(r"[「」『』\s].*$", "", left.strip().split("の")[-1]))
        right_tok = html.escape(re.split(r"[。(（\s]", right.strip())[0])
        target = left_tok if category == "Kanji Reading" else right_tok
        if target and target in safe:
            return safe.replace(target, f"<u>{target}</u>", 1)
    return safe


def build_section_groups(
    meta_qs: List[Dict[str, Any]],
    parsed: Dict[int, ParsedItem],
    instructions: Dict[str, str],
    ans_exps: Dict[Tuple[str, int], str],
    sec_key: str,
) -> List[Dict[str, Any]]:
    groups: List[Dict[str, Any]] = []
    cur_group: Optional[Dict[str, Any]] = None
    mondai_seq = 0

    for mq in meta_qs:
        q_no = int(mq["no"])
        cat = str(mq["category"])
        q_type, pts, default_instr = CATEGORY_TYPE[cat]
        item = parsed.get(q_no)
        if not item:
            raise ValueError(f"Missing parsed item for {sec_key} Q{q_no} ({cat})")

        new_group_needed = (
            cur_group is None
            or cur_group["_cat"] != cat
            or (cat in PASSAGE_CATS and item.passage is not None)
        )
        if new_group_needed:
            mondai_seq += 1
            passage_html = None
            if item.passage:
                paras = [f"<p>{html.escape(p)}</p>" for p in item.passage.splitlines() if p.strip()]
                passage_html = "".join(paras)
            cur_group = {
                "_cat": cat,
                "mondai_number": mondai_seq,
                "question_type": q_type,
                "instruction_ja": instructions.get(cat, default_instr),
                "passage_html": passage_html,
                "questions": [],
            }
            groups.append(cur_group)

        exp_ja = ans_exps.get((sec_key, q_no), "")
        cur_group["questions"].append(
            {
                "question_number": q_no,
                "prompt_html": format_prompt_html(item.prompt, cat, exp_ja),
                "options": [{"index": o["index"], "text": html.escape(o["text"])} for o in item.options],
                "correct_option": int(mq["answer"]),
                "correct_sequence": None,
                "points": pts,
                "audio_url": None,
                "image_url": None,
                "transcript_ja": None,
                "explanation": {"en": exp_ja or f"Correct option: {mq['answer']}"},
            }
        )

    for g in groups:
        g.pop("_cat", None)
    return groups


def build_listening_groups(
    meta_qs: List[Dict[str, Any]],
    draft: Dict[int, Dict[str, Any]],
    ans_exps: Dict[Tuple[str, int], str],
) -> List[Dict[str, Any]]:
    groups: List[Dict[str, Any]] = []
    cur_group: Optional[Dict[str, Any]] = None
    mondai_seq = 0

    for mq in meta_qs:
        q_no = int(mq["no"])
        cat = str(mq["category"])
        q_type, pts, instr = CATEGORY_TYPE[cat]
        d = draft.get(q_no)
        if not d:
            raise ValueError(f"Missing LISTENING_DRAFT entry for Q{q_no}")

        if cur_group is None or cur_group["_cat"] != cat:
            mondai_seq += 1
            cur_group = {
                "_cat": cat,
                "mondai_number": mondai_seq,
                "question_type": q_type,
                "instruction_ja": instr,
                "passage_html": None,
                "questions": [],
            }
            groups.append(cur_group)

        opts = d["options"]
        if len(opts) not in (3, 4):
            count = 3 if cat in {"Quick Response", "Verbal Expressions"} else 4
            opts = [{"index": i, "text": str(i)} for i in range(1, count + 1)]

        exp_en = d["explanation_en"] or ans_exps.get(("listen", q_no), "") or f"Correct option: {mq['answer']}"
        cur_group["questions"].append(
            {
                "question_number": q_no,
                "prompt_html": html.escape(d["prompt"]),
                "options": [{"index": o["index"], "text": html.escape(o["text"])} for o in opts],
                "correct_option": int(mq["answer"]),
                "correct_sequence": None,
                "points": pts,
                "audio_url": None,
                "image_url": None,
                "transcript_ja": d["script"] or None,
                "explanation": {"en": exp_en},
            }
        )

    for g in groups:
        g.pop("_cat", None)
    return groups


def compile_single_set(meta_path: Path) -> Dict[str, Any]:
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    level = str(meta["level"]).upper()
    set_no = int(meta["set"])
    spec = LEVEL_SPECS[level]
    set_dir = meta_path.parent

    vocab_qs = [q for q in meta["questions"] if q["section"] == "vocab"]
    gr_qs = [q for q in meta["questions"] if q["section"] == "gr"]
    listen_qs = [q for q in meta["questions"] if q["section"] == "listen"]

    exam_lines = read_pdf_lines(set_dir / "Examination.pdf", start_page=1)
    v_lines, gr_lines = split_exam_sections(exam_lines)
    v_parsed, v_instr = parse_section_lines(v_lines, vocab_qs)
    gr_parsed, gr_instr = parse_section_lines(gr_lines, gr_qs)
    ans_exps = parse_answer_key(set_dir / "Answer_Key.pdf")
    listen_draft = parse_listening_draft(set_dir / "LISTENING_DRAFT.txt")

    padded = f"{set_no:02d}"
    return {
        "exam_metadata": {
            "exam_code": f"JLPT-{level}-MOCK-{padded}",
            "level": level,
            "test_number": set_no,
            "is_premium": set_no > 2,
            "title": f"JLPT {level} Full Mock Exam #{padded}",
            "total_time_minutes": spec["total_time"],
            "total_score_required": spec["pass_mark"],
            "max_total_score": 180,
            "sectional_minimums": spec["minimums"],
            "is_published": True,
        },
        "sections": [
            {
                "section_number": 1,
                "section_code": "VOCAB",
                "section_title_ja": "言語知識（文字・語彙）",
                "section_title_en": "Language Knowledge (Vocabulary)",
                "time_limit_minutes": spec["mins"]["vocab"],
                "mondai_groups": build_section_groups(vocab_qs, v_parsed, v_instr, ans_exps, "vocab"),
            },
            {
                "section_number": 2,
                "section_code": "GRAMMAR_READING",
                "section_title_ja": "言語知識（文法）・読解",
                "section_title_en": "Language Knowledge (Grammar) & Reading",
                "time_limit_minutes": spec["mins"]["gr"],
                "mondai_groups": build_section_groups(gr_qs, gr_parsed, gr_instr, ans_exps, "gr"),
            },
            {
                "section_number": 3,
                "section_code": "LISTENING",
                "section_title_ja": "聴解",
                "section_title_en": "Listening",
                "time_limit_minutes": spec["mins"]["listen"],
                "mondai_groups": build_listening_groups(listen_qs, listen_draft, ans_exps),
            },
        ],
    }


def validate_exam(exam: Dict[str, Any]) -> Tuple[int, List[str]]:
    code = exam["exam_metadata"]["exam_code"]
    errors: List[str] = []
    q_count = 0
    for sec in exam["sections"]:
        for mg in sec["mondai_groups"]:
            if mg["question_type"] in {"text_grammar", "reading_short_passage", "reading_mid_passage", "information_retrieval"}:
                if not mg.get("passage_html"):
                    errors.append(f"{code} {sec['section_code']} M{mg['mondai_number']} missing passage_html")
            for q in mg["questions"]:
                q_count += 1
                opts = q["options"]
                if len(opts) not in (3, 4):
                    errors.append(f"{code} {sec['section_code']} Q{q['question_number']} has {len(opts)} opts")
                elif not (1 <= q["correct_option"] <= len(opts)):
                    errors.append(f"{code} {sec['section_code']} Q{q['question_number']} answer out of bounds")
                if not q["prompt_html"].strip():
                    errors.append(f"{code} {sec['section_code']} Q{q['question_number']} empty prompt")
    return q_count, errors


def main() -> None:
    meta_files: List[Path] = []
    for root in STAGED_ROOTS:
        if not root.exists():
            print(f"ERROR: Missing staged directory {root}", file=sys.stderr)
            sys.exit(1)
        meta_files.extend(sorted(root.rglob("SET_METADATA.json")))

    compiled: List[Dict[str, Any]] = []
    all_errors: List[str] = []
    total_qs = 0

    for mf in meta_files:
        try:
            exam = compile_single_set(mf)
        except Exception as exc:
            tag = f"{mf.parent.parent.name}/{mf.parent.name}"
            print(f"  [ERR] {tag}: {exc}")
            all_errors.append(f"{tag}: {exc}")
            v_l, gr_l = split_exam_sections(read_pdf_lines(mf.parent / "Examination.pdf", start_page=1))
            src_lines = gr_l if " gr " in str(exc) else v_l
            m_q = re.search(r"Q(\d+)", str(exc))
            if m_q:
                target = int(m_q.group(1))
                hits = [i for i, ln in enumerate(src_lines) if str(target) in ln or str(target - 1) in ln]
                start = max(0, hits[0] - 2) if hits else 0
                print("    --- PDF CONTEXT ---")
                for ln in src_lines[start : start + 22]:
                    print(f"    | {ln}")
            continue
        q_cnt, errs = validate_exam(exam)
        total_qs += q_cnt
        compiled.append(exam)
        code = exam["exam_metadata"]["exam_code"]
        status = "OK" if not errs else f"WARN({len(errs)})"
        print(f"  [{status}] {code}: {q_cnt} questions")
        all_errors.extend(errs)

    compiled.sort(key=lambda e: (e["exam_metadata"]["level"], e["exam_metadata"]["test_number"]))
    OUTPUT_PATH.write_text(json.dumps(compiled, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nCOMPILED: {len(compiled)} exams | {total_qs} questions -> {OUTPUT_PATH}")
    if all_errors:
        print(f"VALIDATION ISSUES ({len(all_errors)} — showing first 25):")
        for err in all_errors[:25]:
            print(f"  ! {err}")
        sys.exit(1)
    print("VALIDATION PASSED: 0 schema or content errors.")


if __name__ == "__main__":
    main()
