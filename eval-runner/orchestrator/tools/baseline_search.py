#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
baseline_search.py — 베이스라인 응시자 (로컬 BM25, 외부 전송 0)

시험지(질문)를 로컬 검색으로 풀어 응답로그를 만든다 — 벡터 RAG(팀장님 시스템)의
대조군. "벡터 대비 +N%p"를 증명하려면 단순 검색 기준점이 먼저 있어야 한다.

- 색인: data/<제품>/corpus/*.json 의 청크 (문자 바이그램 BM25 — 일본어/한국어 형태소 불요)
- 응시: 외부QA 시험지(문항ID·질문) → 문항별 top5 청크 → 응답로그 json (answer 전건 null)
- 채점: import_qa.score 가 그대로 받는 형식 (external_qa/로그/ 에 저장)

사용: python3 tools/baseline_search.py --product CI [--exclude-doc-prefix FAQ_]
      (--exclude-doc-prefix: 특정 문서군 제외 색인 — 예: FAQ 빼고 매뉴얼만으로 답 찾기 실험)
"""
import argparse
import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
from olib import ROOT, N

DATA = ROOT / "data"


def _norm(s):
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", str(s or ""))).lower()


def bigrams(s):
    t = _norm(s)
    return [t[i:i + 2] for i in range(len(t) - 1)] or ([t] if t else [])


class BM25:
    """교과서 BM25 (k1=1.5, b=0.75) — 의존성 없이 순정 구현"""

    def __init__(self, docs_tokens):
        self.N = len(docs_tokens)
        self.avgdl = sum(len(d) for d in docs_tokens) / max(1, self.N)
        self.tf = [Counter(d) for d in docs_tokens]
        self.dl = [len(d) for d in docs_tokens]
        df = defaultdict(int)
        for c in self.tf:
            for w in c:
                df[w] += 1
        self.idf = {w: math.log(1 + (self.N - n + 0.5) / (n + 0.5)) for w, n in df.items()}
        # 역색인 — 질문 2,161개 × 청크 3,007개 전수 곱을 피한다
        self.inv = defaultdict(list)
        for i, c in enumerate(self.tf):
            for w in c:
                self.inv[w].append(i)

    def top(self, query_tokens, k=5, k1=1.5, b=0.75):
        scores = defaultdict(float)
        for w in set(query_tokens):
            if w not in self.idf:
                continue
            idf = self.idf[w]
            for i in self.inv[w]:
                f = self.tf[i][w]
                scores[i] += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * self.dl[i] / self.avgdl))
        return sorted(scores.items(), key=lambda x: -x[1])[:k]


def load_chunks(prod, exclude_prefix=None):
    chunks = []
    for f in sorted((DATA / prod / "corpus").glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        for c in d.get("chunks", []):
            if exclude_prefix and str(c.get("doc", "")).startswith(exclude_prefix):
                continue
            chunks.append(c)
    return chunks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", required=True)
    ap.add_argument("--exclude-doc-prefix", default=None)
    ap.add_argument("--label", default="베이스라인BM25")
    a = ap.parse_args()
    prod = a.product

    chunks = load_chunks(prod, a.exclude_doc_prefix)
    print(f"색인: {len(chunks)}청크" + (f" (제외: {a.exclude_doc_prefix}*)" if a.exclude_doc_prefix else ""))
    bm = BM25([bigrams(c["text"]) for c in chunks])

    papers = sorted((DATA / prod / "external_qa").glob(f"외부QA_시험지_{prod}_*문항_v*.xlsx"),
                    key=lambda p: int(re.search(r"_v(\d+)\.xlsx$", p.name).group(1)))
    paper = papers[-1]
    ws = openpyxl.load_workbook(paper, read_only=True).active
    items = [(str(r[0]), str(r[1])) for r in ws.iter_rows(min_row=2, values_only=True) if r[0]]
    print(f"응시: {N(paper.name)} — {len(items)}문항")

    responses = []
    for qi, (qid, q) in enumerate(items, 1):
        hits = []
        for rank, (ci, score) in enumerate(bm.top(bigrams(q), k=5), 1):
            c = chunks[ci]
            hits.append({"rank": rank, "url": N(c.get("source", c["doc"])),
                         "doc": N(c["doc"]),
                         "content": N(c["text"])[:8000]})   # 대조 창 — FAQ 청크는 전문 포함
        responses.append({"id": qid, "hits": hits, "answer": None})
        if qi % 500 == 0:
            print(f"  …{qi}/{len(items)}")

    out_dir = DATA / prod / "external_qa" / "로그"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"{a.label}_응답로그.json"
    out.write_text(json.dumps({"meta": {"system": f"{a.label} (로컬 문자 바이그램 BM25 — 외부 전송 0)",
                                        "index": len(chunks), "paper": N(paper.name)},
                               "responses": responses}, ensure_ascii=False), encoding="utf-8")
    print(f"응답로그: {N(out.name)} ({out.stat().st_size:,}B)")


if __name__ == "__main__":
    main()
