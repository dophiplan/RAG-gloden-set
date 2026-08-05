#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
import_qa.py — 외부 제작 Q&A 셋 인입 어댑터 (G19)

외부(타 회사 등)가 만든 질문·답변 파일을 받아 골든셋 재료로 쓰기 위한 옆문.
핵심 원칙: 옆문으로 들어와도 검문소는 같다 — 코퍼스 대조를 통과한 것만 편입 후보.

흐름: data/<제품>/external_qa/ 의 파일(xlsx·csv·json) 전부 파싱
  → 실측(건수·컬럼·중복) → 코퍼스 문자 대조(답변 절 단위 실재 확인)
  → 3갈래 분류: 편입 후보(근거 실재) / E형 후보(코퍼스 부재) / 부분 일치(사람 검토)
  → 분류결과 xlsx + QAIMP 게이트 카드 (사람 승인)
코퍼스가 비어 있으면 전량 '보류(코퍼스 대기)' — 코퍼스 인입 후 다시 실행하면 재대조.

사용: python3 tools/import_qa.py run --product CI
"""
import argparse
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from olib import ROOT, N, ledger_append, issue_gate_card, load_state, save_state, now

DATA = ROOT / "data"

Q_KEYS = ("질문", "문의", "question", "query", "q")
A_KEYS = ("답변", "정답", "응답", "답", "answer", "a", "response")


def _norm(s):
    """대조용 정규화 — 공백 전부 제거 (1축 문자 대조와 같은 원리)"""
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", str(s or "")))


def _pick_col(headers, keys):
    hs = [N(str(h or "")).strip().lower() for h in headers]
    for k in keys:                       # 정확 일치 우선, 다음 부분 일치
        if k in hs:
            return hs.index(k)
    for i, h in enumerate(hs):
        if any(k in h for k in keys if len(k) > 1):
            return i
    return None


def _rows_from_xlsx(p):
    import openpyxl
    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    out = []
    for sn in wb.sheetnames:
        ws = wb[sn]
        rows = [[("" if c is None else str(c)) for c in (r or [])]
                for r in ws.iter_rows(values_only=True)]
        if not rows:
            continue
        qi, ai = _pick_col(rows[0], Q_KEYS), _pick_col(rows[0], A_KEYS)
        if qi is None or ai is None:
            continue
        for r in rows[1:]:
            q = r[qi].strip() if qi < len(r) else ""
            a = r[ai].strip() if ai < len(r) else ""
            if q:
                out.append({"질문": q, "답변": a})
    wb.close()
    return out


def _rows_from_csv(p):
    out = []
    with open(p, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    if not rows:
        return out
    qi, ai = _pick_col(rows[0], Q_KEYS), _pick_col(rows[0], A_KEYS)
    if qi is None or ai is None:
        return out
    for r in rows[1:]:
        q = (r[qi] if qi < len(r) else "").strip()
        a = (r[ai] if ai < len(r) else "").strip()
        if q:
            out.append({"질문": q, "답변": a})
    return out


def _rows_from_json(p):
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []
    if isinstance(data, dict):           # {"qa": [...]} / {"items": [...]} 포장 해제
        for k in ("qa", "items", "data", "questions"):
            if isinstance(data.get(k), list):
                data = data[k]
                break
    if not isinstance(data, list):
        return []
    out = []
    for it in data:
        if not isinstance(it, dict):
            continue
        km = {N(str(k)).strip().lower(): v for k, v in it.items()}
        q = next((str(km[k]).strip() for k in Q_KEYS if km.get(k)), "")
        a = next((str(km[k]).strip() for k in A_KEYS if km.get(k)), "")
        if q:
            out.append({"질문": q, "답변": a})
    return out


def parse_qa_files(qa_dir):
    """external_qa/ 의 원본 파일 전부 → [{출처, 질문, 답변}] (분류결과·반려 파일 제외)"""
    items, skipped = [], []
    for p in sorted(qa_dir.glob("*")):
        if (not p.is_file() or p.name.startswith((".", "반려_", "외부QA_분류결과"))
                or p.suffix == ".md"):
            continue
        rows = ({".xlsx": _rows_from_xlsx, ".csv": _rows_from_csv,
                 ".json": _rows_from_json}.get(p.suffix.lower(), lambda _: [])(p))
        if rows:
            for r in rows:
                r["출처 파일"] = N(p.name)
            items += rows
        else:
            skipped.append(N(p.name))
    return items, skipped


def load_corpus_text(prod):
    """코퍼스 원문 수집 — 읽을 수 있는 형식만 (pdf·zip 등은 미대조 목록으로 보고)"""
    d = DATA / prod / "corpus"
    corpus, used, unread = [], [], []
    if not d.is_dir():
        return "", used, unread
    for p in sorted(d.rglob("*")):
        if not p.is_file() or p.name.startswith("."):
            continue
        sfx = p.suffix.lower()
        try:
            if sfx in (".txt", ".md", ".csv", ".json", ".html", ".htm"):
                corpus.append(p.read_text(encoding="utf-8", errors="ignore"))
                used.append(N(p.name))
            elif sfx == ".xlsx":
                import openpyxl
                wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
                for sn in wb.sheetnames:
                    for r in wb[sn].iter_rows(values_only=True):
                        corpus.append(" ".join(str(c) for c in (r or []) if c is not None))
                wb.close()
                used.append(N(p.name))
            else:
                unread.append(N(p.name))
        except Exception:
            unread.append(N(p.name))
    return _norm("\n".join(corpus)), used, unread


def _clauses(answer):
    """답변을 대조 가능한 절 단위로 — 문장·줄 단위로 쪼개 정규화 길이 10자 이상만"""
    parts = re.split(r"[.。!?\n;·•]|(?:니다|세요|합니다)\s", str(answer or ""))
    return [c.strip() for c in parts if len(_norm(c)) >= 10]


def classify(items, corpus_norm):
    """3갈래 분류 — 절 실재율로 판정. 코퍼스 없으면 전량 보류."""
    seen_q = set()
    for it in items:
        qn = _norm(it["질문"])
        it["비고"] = "중복 질문" if qn in seen_q else ""
        seen_q.add(qn)
        cl = _clauses(it["답변"])
        if not corpus_norm:
            it.update({"분류": "보류(코퍼스 대기)", "일치율": "", "확인 발췌": ""})
            continue
        if not cl:
            it.update({"분류": "부분 일치(사람 검토)", "일치율": "0/0",
                       "확인 발췌": "", "비고": (it["비고"] + " 답변이 짧아 대조 불가").strip()})
            continue
        hits = [c for c in cl if _norm(c) in corpus_norm]
        ratio = len(hits) / len(cl)
        it["일치율"] = f"{len(hits)}/{len(cl)}"
        it["확인 발췌"] = (hits[0][:120] if hits else "")
        it["분류"] = ("편입 후보(근거 실재)" if ratio >= 0.6
                     else "E형 후보(코퍼스 부재)" if ratio == 0
                     else "부분 일치(사람 검토)")
    return items


def write_report(prod, items, version):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "분류결과"
    cols = ["번호", "출처 파일", "질문", "답변", "분류", "일치율", "확인 발췌", "비고"]
    ws.append(cols)
    for i, it in enumerate(items, 1):
        ws.append([i] + [it.get(c, "") for c in cols[1:]])
    for c, w in zip("ABCDEFGH", (6, 18, 46, 46, 22, 8, 40, 16)):
        ws.column_dimensions[c].width = w
    out = DATA / prod / "external_qa" / f"외부QA_분류결과_{prod}_v{version}.xlsx"
    wb.save(out)
    return out


def run(prod, actor="난희"):
    qa_dir = DATA / prod / "external_qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    items, skipped = parse_qa_files(qa_dir)
    if not items:
        msg = ("외부 Q&A 파일에서 질문·답변을 찾지 못했어요 — "
               "질문/답변 컬럼(또는 question/answer 키)이 있는 xlsx·csv·json 인지 확인해 주세요."
               + (f" (읽지 못한 파일: {', '.join(skipped)})" if skipped else " (올라온 파일 없음)"))
        print(msg)
        return {"ok": False, "out": msg}
    corpus_norm, corpus_used, corpus_unread = load_corpus_text(prod)
    items = classify(items, corpus_norm)
    version = 1 + len(list(qa_dir.glob(f"외부QA_분류결과_{prod}_v*.xlsx"))) \
                + len(list(qa_dir.glob(f"반려_외부QA_분류결과_{prod}_v*.xlsx")))
    report = write_report(prod, items, version)
    cnt = {}
    for it in items:
        cnt[it["분류"]] = cnt.get(it["분류"], 0) + 1
    dup = sum(1 for it in items if "중복" in it.get("비고", ""))
    ev = {"총 문항": len(items),
          **{k: f"{v}건" for k, v in sorted(cnt.items(), key=lambda x: -x[1])},
          "중복 질문": f"{dup}건",
          "대조한 코퍼스": f"{len(corpus_used)}파일" if corpus_used else "없음 (전량 보류)",
          "분류결과 파일": N(report.name)}
    if corpus_unread:
        ev["대조 못한 코퍼스(형식)"] = ", ".join(corpus_unread[:5]) + \
            (f" 외 {len(corpus_unread)-5}" if len(corpus_unread) > 5 else "")
    if skipped:
        ev["읽지 못한 Q&A 파일"] = ", ".join(skipped)
    ledger_append("EXTERNAL_QA", "QA_IMPORTED", f"script:import_qa({actor})",
                  evidence=ev, product=prod)
    # 재대조면 이전 QAIMP 카드는 자동 교체 — 낡은 카드에 승인/반려하는 사고 방지
    from olib import close_gate
    st = load_state()
    for g in list(st["products"][prod].get("open_gates", [])):
        if g["id"].startswith("QAIMP_"):
            close_gate(prod, g["id"])
            ledger_append("EXTERNAL_QA", "GATE_SUPERSEDED", "script:import_qa",
                          gate_id=g["id"], evidence={"사유": "재대조로 새 분류 발행"}, product=prod)
    gate_id = f"QAIMP_{prod}_v{version}"
    if corpus_norm:
        what = (f"외부 Q&A {len(items)}문항을 코퍼스와 대조해 3갈래로 분류했어요. "
                f"[👁 실물 보고 결정] 팝업에서 분류결과({N(report.name)})를 확인해 주세요.\n"
                "- 편입 후보(근거 실재): 승인하면 골든셋 출제 재료로 쓰입니다 (검수 8종·사람 게이트는 그대로 통과해야 함)\n"
                "- E형 후보(코퍼스 부재): v3 함정 문항(E형 10%) 재료로 보관됩니다\n"
                "- 부분 일치: 코퍼스와 다르게 서술된 것 — 어느 쪽이 정본인지 사람 확인이 필요합니다\n"
                "- 반려하면 이번 분류는 폐기돼요 (원본 Q&A 파일은 보존 — 다시 올릴 필요 없음)")
    else:
        what = (f"외부 Q&A {len(items)}문항을 접수했어요. 아직 이 제품의 코퍼스가 없어서 "
                "대조를 못 했고 전량 '보류(코퍼스 대기)'예요.\n"
                "- 승인 = 접수 확정 (코퍼스를 올린 뒤 [📥 외부 Q&A 올리기] 옆 재대조를 누르면 3갈래 분류가 돌아요)\n"
                "- 골든셋 자격은 코퍼스 대조 통과가 조건이라, 코퍼스 없이 편입은 안 됩니다")
    issue_gate_card(prod, "EXTERNAL_QA", gate_id, what, ev)
    out = (f"외부 Q&A 인입 완료 — {len(items)}문항 · " +
           " · ".join(f"{k} {v}" for k, v in cnt.items()) +
           f" → 카드 {gate_id} 발행 (분류결과: {N(report.name)})")
    print(out)
    return {"ok": True, "out": out}


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--product", required=True)
    r.add_argument("--actor", default="난희")
    a = ap.parse_args()
    run(a.product, a.actor)


if __name__ == "__main__":
    main()
