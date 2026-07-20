#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_coverage.py — ③ 커버리지맵 생성 엔진 (사양서 §4-③·③′)

흐름: 코퍼스 로드(청크) → generator 호출(커버 단위 추출) → 스크립트 검수
  (1축: '사실' 필드가 코퍼스 원문에 실재 · Unit ID 중복 0) → 불합격 반려 루프(최대 2회)
  → 통과분으로 커버리지맵 xlsx 생성 → 사람확인 큐 카드 → ③′ GAP_AUDIT(별도 세션).

코퍼스 형식 (data/<제품>/corpus/):
  - *.json: [{doc, chunk_id, text, source?}] 또는 {docs:[{doc, chunks:[...]}]}
  - *.md/*.txt: 파일=문서, 빈 줄 2개 구분=청크
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
import llm
from olib import ROOT, N, ledger_append, issue_gate_card

DATA = ROOT / "data"


def norm(s):
    return re.sub(r"\s+", "", N(s)).lower()


def load_corpus(prod):
    """→ [{doc, chunk_id, text, source}]"""
    cdir = DATA / prod / "corpus"
    chunks = []
    for f in sorted(cdir.glob("*")):
        if f.name.startswith("."):
            continue
        if f.suffix == ".json":
            d = json.loads(f.read_text(encoding="utf-8"))
            rows = d if isinstance(d, list) else [
                {"doc": doc["doc"], "chunk_id": i, "text": t, "source": doc.get("source", doc["doc"])}
                for doc in d.get("docs", []) for i, t in enumerate(doc["chunks"], 1)]
            for r in rows:
                chunks.append({"doc": N(r["doc"]), "chunk_id": int(r.get("chunk_id", 0)),
                               "text": N(r["text"]), "source": N(r.get("source", r["doc"]))})
        elif f.suffix in (".md", ".txt"):
            parts = [p.strip() for p in re.split(r"\n\s*\n\s*\n?", f.read_text(encoding="utf-8")) if p.strip()]
            for i, p in enumerate(parts, 1):
                chunks.append({"doc": N(f.stem), "chunk_id": i, "text": N(p), "source": N(f.name)})
    return chunks


SYSTEM = """[TASK:COVERAGE_UNITS] 너는 RAG 평가용 커버리지맵 추출기다.
입력 JSON의 각 청크에서 '평가 가능한 사실 단위'를 추출하라.
출력: JSON 배열만 — [{unit_id, type, title, fact, source, chunk, question_hint}].
규칙: fact 는 반드시 청크 원문 문장을 그대로 사용(변형 금지 — 문자 대조 검수됨).
unit_id 형식: <제품>-<문서약칭대문자>-<청크번호3자리>. 청크당 1~2단위."""


def generate_units(prod, chunks, cfg, retry_ids=None):
    payload = {"product": prod,
               "chunks": [c for c in chunks if retry_ids is None
                          or any(u.startswith(f"{prod}-{N(c['doc']).upper()[:6]}-{c['chunk_id']:03d}") for u in retry_ids)]}
    out = llm.chat("generator", SYSTEM, json.dumps(payload, ensure_ascii=False), cfg)
    return llm.extract_json(out)


def verify_units(units, chunks):
    """스크립트 검수(규칙 A): 사실 실재(1축) + ID 중복. → (합격, 반려[(unit, 사유)])"""
    pool = {}
    for c in chunks:
        pool.setdefault(N(c["doc"]), "")
        pool[N(c["doc"])] += " " + norm(c["text"])
    all_text = " ".join(pool.values())
    seen, ok, rej = set(), [], []
    for u in units:
        uid = N(u.get("unit_id", ""))
        if not uid or uid in seen:
            rej.append((u, "unit_id 부재/중복"))
            continue
        seen.add(uid)
        f = norm(u.get("fact", ""))
        if len(f) < 6:
            rej.append((u, "사실 필드 과소(len<6)"))
            continue
        if f not in all_text:
            rej.append((u, "1축 불일치 — 사실이 코퍼스 원문에 없음"))
            continue
        ok.append(u)
    return ok, rej


def write_map(prod, units, version="v1_0"):
    out = DATA / prod / "03_coverage_map" / f"{prod}_커버리지맵_코퍼스판_{version}.xlsx"
    out.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "B1_커버리지맵"
    ws.append(["#", "Unit ID", "type", "title", "이 단위가 말하는 사실",
               "답변 가능한 질문", "source/resource", "citation_id", "상태"])
    for i, u in enumerate(units, 1):
        ws.append([i, u["unit_id"], u.get("type", "Doc"), u.get("title", ""),
                   u["fact"], u.get("question_hint", ""), u.get("source", ""),
                   u["unit_id"], "생성-검수통과"])
    wb.save(out)
    return out


def gap_audit(prod, chunks, units):
    """③′ 인입 누락 대조 — 별도 세션(생성 맥락 미공유): 문서별 커버 단위 유무"""
    docs = {N(c["doc"]) for c in chunks}
    covered = {N(u["unit_id"]).split("-")[1] if "-" in N(u["unit_id"]) else "" for u in units}
    gaps = [d for d in sorted(docs) if d.upper()[:6] not in covered]
    return gaps


def run(prod, cfg):
    chunks = load_corpus(prod)
    if not chunks:
        return "WAITING_INPUT", {"코퍼스 청크": 0}
    units = generate_units(prod, chunks, cfg)
    ok, rej = verify_units(units, chunks)
    # 반려 루프 (최대 2회): 불합격 단위 재생성
    for attempt in range(2):
        if not rej:
            break
        ledger_append("COVERAGE_MAP", "UNITS_REJECTED", "script:coverage_verify",
                      evidence={"round": attempt + 1, "reject": len(rej),
                                "reasons": [r for _, r in rej[:5]]}, product=prod)
        retry = generate_units(prod, chunks, cfg, retry_ids=[N(u.get("unit_id", "")) for u, _ in rej])
        ok2, rej = verify_units(retry, chunks)
        known = {N(u["unit_id"]) for u in ok}
        ok += [u for u in ok2 if N(u["unit_id"]) not in known]
    if not ok:
        return "HALTED", {"halt": "생성 단위 전건 검수 불합격 — 카운트 미실측 방지"}
    path = write_map(prod, ok)
    gaps = gap_audit(prod, chunks, ok)
    ev = {"커버 단위(검수 통과)": len(ok), "반려 잔존": len(rej),
          "1축 문자 대조": "불일치 0 (통과분)", "GAP_AUDIT 누락 문서": len(gaps),
          "산출": N(path.name)}
    ledger_append("COVERAGE_MAP", "MAP_GENERATED", "script:gen_coverage", evidence=ev, product=prod)
    flags = ([{"type": "GAP_AUDIT 누락 의심", "id": d, "candidates": [],
               "ack_required": True} for d in gaps]
             + [{"type": "생성 반려 잔존", "id": N(u.get("unit_id", "?")), "candidates": [r]}
                for u, r in rej])
    issue_gate_card(prod, "COVERAGE_MAP", f"COVMAP_{prod}",
                    what_stopped=f"커버리지맵 생성·검수 완료 — 확정은 사람 (사람확인 큐)",
                    evidence=ev, flags=flags,
                    recommendation="GAP 누락·반려 잔존 항목 ack 후 승인 시 맵 확정 → ④ 진입")
    return "WAITING_HUMAN", ev


if __name__ == "__main__":
    import argparse
    from olib import load_config
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", required=True)
    a = ap.parse_args()
    print(run(a.product, load_config()))
