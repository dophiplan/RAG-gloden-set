#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""merge_reextract.py — 재추출 전 구간(조각·인수·스퍼트·질주) 수확 병합 + 최종 실측 리포트
산출: ① 병합 단위(중복 제거·원문 검증) ② 우리 지도와 비교(겹침/신규) ③ 지도 v2 후보 xlsx"""
import datetime
import glob
import json
import re
import sys
import unicodedata
import zipfile, csv, io
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
import map_gapfill as mg
from olib import ROOT, N, ledger_append

STRIP = re.compile(r"[^0-9A-Za-zぁ-ヿ一-鿿가-힣]")
def anorm(s): return STRIP.sub("", unicodedata.normalize("NFC", str(s or ""))).lower()

# ① 전 구간 체크포인트 수확
raw, per = [], {}
for f in sorted(glob.glob(str(ROOT / "results/_ckpt_coverage_CI_rebasecmp*.json"))):
    tag = Path(f).stem.replace("_ckpt_coverage_CI_rebasecmp", "") or "(표본)"
    d = json.load(open(f))
    for r, v in d.items():
        us = [u for u in v.get("units", []) if isinstance(u, dict)]
        per[f"{tag}:{r}"] = len(us)
        raw += us
print(f"① 수확: 구간 {len(per)}벌 · 원시 {len(raw):,}단위")

# ② 팀장님 원문 검증 + 중복 제거
z = zipfile.ZipFile(ROOT / "data/CI/벡터감사/exports.zip_")
parts = []
with z.open("chunks-nhkim-all-2026-08-19.csv") as fh:
    for r in csv.DictReader(io.TextIOWrapper(fh, "utf-8-sig")):
        parts.append(anorm(r.get("text", "")))
big = " ".join(parts)
seen, ok = set(), []
for u in raw:
    fct = anorm(u.get("fact", ""))
    if len(fct) < 10 or fct in seen:
        continue
    if fct in big:
        seen.add(fct)
        ok.append(u)
print(f"② 검증·중복 제거: {len(ok):,}단위 (원문 실재·유일)")

# ③ 우리 지도와 비교
import re as _re
def _vkey(p): return [int(x) for x in _re.findall(r"\d+", p.stem.split("코퍼스판")[-1])]
_arc = sorted((ROOT / "data/CI/아카이브_r1_제작산출물/03_coverage_map").glob("*코퍼스판_v*.xlsx"), key=_vkey)
_live = sorted((ROOT / "data/CI/03_coverage_map").glob("*코퍼스판_v*.xlsx"), key=_vkey)
_map = (_live or _arc)[-1]
print("비교 기준 지도:", _map.name)
ours = mg.read_map(_map)   # r1 지도가 아카이브로 이동됨(r2 준비) — 비교는 아카이브 최신판(v1_18)
our_facts = " § ".join(anorm(u["fact"]) for u in ours)
overlap = sum(1 for u in ok if anorm(u["fact"]) in our_facts)
new = [u for u in ok if anorm(u["fact"]) not in our_facts]
# 신규 중 조각 일치(자르기 차이) 제거 → 진짜 신규
true_new = []
for u in new:
    fct = anorm(u["fact"])
    pos = [int(len(fct) * p) for p in (0.2, 0.5, 0.8)]
    if sum(1 for p in pos if fct[p:p+12] and fct[p:p+12] in our_facts) < 2:
        true_new.append(u)
print(f"③ 비교: 겹침 {overlap:,} · 진짜 신규 {len(true_new):,} (자르기차이 {len(new)-len(true_new):,})")

# ④ 지도 v2 후보 저장
out = ROOT / "data/CI/벡터감사/CI_재추출_전량병합.xlsx"
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "재추출_병합"
ws.append(["#", "fact", "source", "우리지도에"])
for i, u in enumerate(ok, 1):
    ws.append([i, str(u.get("fact", ""))[:500], str(u.get("source", ""))[:120],
               "신규" if u in true_new else "기존"])
wb.save(out)

rep = ROOT / "data/CI/벡터감사/재추출_최종리포트.md"
rep.write_text(f"""# 재추출 전량 최종 리포트 ({datetime.datetime.now():%F %H:%M})

| 지표 | 값 |
|---|---|
| 원시 수확 (전 구간 {len(per)}벌) | {len(raw):,}단위 |
| 검증·중복 제거 후 | **{len(ok):,}단위** |
| 우리 지도(41,067)와 겹침 | {overlap:,} |
| **진짜 신규 (지도가 놓쳤던 사실)** | **{len(true_new):,}** |
| 자르기 차이 (같은 지식) | {len(new)-len(true_new):,} |

## 신규 예시
{chr(10).join('- ' + str(u.get('fact',''))[:80] for u in true_new[:10])}

## 다음 결정 (사람)
1. 지도 v2 병합: 기존 41,067 + 신규 {len(true_new):,} → 새 커버리지맵
2. 골든셋 증분 확대 여부 (기존 834문항·성적 보존, 신규 재료만 추가 출제)
""", encoding="utf-8")
ledger_append("SCORING", "REEXTRACT_MERGED", "script:merge_reextract",
              evidence={"원시": len(raw), "검증 후": len(ok), "겹침": overlap,
                        "진짜 신규": len(true_new), "리포트": N(rep.name)}, product="CI")
print(f"리포트: {rep}")
