#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rebase_compare_extract.py — 팀장님 데이터에서 claude 단독 재추출(표본) → 우리 지도와 비교 (난희 발주 2026-08-19)

목적: "팀장님 데이터 기준으로 만들면 우리 지도와 얼마나 다른가"를 실제 추출로 검증.
  전량(880배치·2~3일) 대신 결정적 표본(기본 5%, 20청크마다 1개 — 난수 없음·재현 가능)으로 먼저.

비교 지표:
  ① 재추출 사실이 우리 지도에 이미 있는가 (겹침률 — 높을수록 두 지도가 같음)
  ② 우리 지도에 없는 신규 사실 (팀장님 데이터에서만 보이는 것 — 낮아야 정상, 내용 동일 증명됐으므로)
사용: python3 tools/rebase_compare_extract.py CI [--rate 20]
"""
import argparse
import csv
import datetime
import io
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import gen_coverage as gc
import map_gapfill as mg
from olib import ROOT, N, ledger_append, load_config

STRIP = re.compile(r"[^0-9A-Za-zぁ-ヿ一-鿿가-힣]")


def anorm(s):
    return STRIP.sub("", unicodedata.normalize("NFC", str(s or ""))).lower()


def main(prod, rate):
    cfg = load_config()
    z = zipfile.ZipFile(ROOT / "data" / prod / "벡터감사" / "exports.zip_")
    rows = []
    with z.open("chunks-nhkim-all-2026-08-19.csv") as f:
        for i, r in enumerate(csv.DictReader(io.TextIOWrapper(f, "utf-8-sig"))):
            if i % rate:      # 결정적 표본: rate청크마다 1개
                continue
            rows.append({"doc": ("FAQ" if r["doc_key"] == "288882413337" else "매뉴얼") + f"_{r['chunk_index']}",
                         "chunk_id": int(r["chunk_index"]),
                         "text": N(r.get("text", "")), "source": N(r.get("title", ""))})
    chars = sum(len(r["text"]) for r in rows)
    plan = gc.plan_batches(rows, cfg)
    print(f"표본: {len(rows):,}청크 · {chars:,}자 → {len(plan)}배치 (claude 단독)")
    ledger_append("SCORING", "REBASE_EXTRACT_START", "script:rebase_compare",
                  evidence={"표본": f"{len(rows):,}청크 (1/{rate}) · {len(plan)}배치", "주자": "claude 단독",
                            "목적": "팀장님 데이터 재추출 vs 우리 지도 비교 (난희 발주)"}, product=prod)
    units = gc.generate_units(prod, rows, cfg, role="generator",
                              ckpt_tag="_rebasecmp", phase="재추출 비교 (팀장님 데이터 표본, claude)")
    # 1축: 팀장님 텍스트 기준
    big = anorm(" ".join(r["text"] for r in rows))
    ok = [u for u in units if isinstance(u, dict) and len(anorm(u.get("fact", ""))) >= 10
          and anorm(u["fact"]) in big]
    print(f"추출 {len(units):,} → 1축(팀장님 원문) 통과 {len(ok):,}")

    # 비교: 우리 지도와 겹침
    ours = mg.read_map(mg.latest_map(prod))
    our_facts = " § ".join(anorm(u["fact"]) for u in ours)
    overlap = new = 0
    new_ex = []
    for u in ok:
        f = anorm(u["fact"])
        if f in our_facts:
            overlap += 1
        else:
            new += 1
            if len(new_ex) < 10:
                new_ex.append(str(u.get("fact", ""))[:70])
    ov_rate = overlap / max(1, len(ok))
    print(f"겹침(우리 지도에 이미 있음): {overlap:,} ({ov_rate:.1%}) · 신규(우리에 없음): {new:,}")

    out = ROOT / "data" / prod / "벡터감사" / f"재추출비교_r1_{datetime.date.today():%Y%m%d}.md"
    L = [f"# 재추출 비교 r1 — 팀장님 데이터 표본 {len(rows):,}청크, claude 단독",
         "", f"- 실행: {datetime.datetime.now().isoformat(timespec='seconds')} · 표본 1/{rate} (결정적)",
         "", "| 지표 | 값 |", "|---|---|",
         f"| 추출 단위 (1축 통과) | {len(ok):,} |",
         f"| **우리 지도와 겹침** | {overlap:,} (**{ov_rate:.1%}**) |",
         f"| 우리 지도에 없는 신규 | {new:,} ({new/max(1,len(ok)):.1%}) |",
         "", "## 신규 사실 예시 (우리 지도에 없던 것)"]
    L += [f"- {e}" for e in new_ex] or ["- (없음)"]
    L += ["", "## 해석 기준",
          "- 겹침률이 높을수록(≥90%) '어떤 데이터로 만들어도 같은 지도' — 재추출 불필요 확정",
          "- 신규가 유의미하게 나오면 그 소재를 보강 출제 후보로 검토"]
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    ledger_append("SCORING", "REBASE_EXTRACT_DONE", "script:rebase_compare",
                  evidence={"추출(1축 통과)": len(ok), "겹침": f"{overlap} ({ov_rate:.1%})",
                            "신규": new, "리포트": N(out.name)}, product=prod)
    print("리포트:", out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("product")
    ap.add_argument("--rate", type=int, default=20, help="N청크마다 1개 표본 (기본 20 = 5%)")
    a = ap.parse_args()
    main(a.product, a.rate)
