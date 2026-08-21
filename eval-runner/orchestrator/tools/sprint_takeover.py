#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sprint_takeover.py — 인수 잔여를 3분담으로 재편성 (난희: 4시 반까지 전속력, 2026-08-21)
기존 인수 2벌(takeover1·2)의 완료분을 정확히 빼고, 남은 청크를 3등분해 claude·codex·Kimi 투입.
기존 성과(체크포인트 5벌)는 전부 보존 — 병합 때 합산."""
import argparse
import csv
import io
import json
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import gen_coverage as gc
from olib import ROOT, N, ledger_append, load_config

ap = argparse.ArgumentParser()
ap.add_argument("--piece", type=int, required=True, choices=[1, 2, 3])
ap.add_argument("--role", required=True, choices=["generator", "reviewer", "judge"])
a = ap.parse_args()

cfg = load_config()
z = zipfile.ZipFile(ROOT / "data/CI/벡터감사/exports.zip_")
rows = []
with z.open("chunks-nhkim-all-2026-08-19.csv") as f:
    for i, r in enumerate(csv.DictReader(io.TextIOWrapper(f, "utf-8-sig"))):
        rows.append({"doc": ("FAQ" if r["doc_key"] == "288882413337" else "매뉴얼") + f"_{r['chunk_index']}",
                     "chunk_id": int(r["chunk_index"]),
                     "text": N(r.get("text", "")), "source": N(r.get("title", ""))})
kimi_target = [r for k, r in enumerate(rows) if k % 3 == 1]
plan = gc.plan_batches(kimi_target, cfg)
done_k = json.load(open(ROOT / "results/_ckpt_coverage_CI_rebasecmp_judge_s2.json"))["judge"]["done"]
rest = [c for b in plan[done_k:] for c in b]

# 인수 1·2가 이미 끝낸 청크를 정확히 제외 (같은 결정적 분할·배치 계획 재현)
done_keys = set()
for half in (1, 2):
    mine = [c for k, c in enumerate(rest) if k % 2 == (half - 1)]
    hplan = gc.plan_batches(mine, cfg)
    try:
        hdone = json.load(open(ROOT / f"results/_ckpt_coverage_CI_rebasecmp_takeover{half}.json"))
        d = next(v["done"] for v in hdone.values() if isinstance(v, dict))
    except Exception:
        d = 0
    for b in hplan[:d]:
        for c in b:
            done_keys.add((c["doc"], c["chunk_id"]))
remain = [c for c in rest if (c["doc"], c["chunk_id"]) not in done_keys]
mine = [c for k, c in enumerate(remain) if k % 3 == (a.piece - 1)]
who = {"generator": "claude", "reviewer": "codex", "judge": "Kimi"}[a.role]
print(f"잔여 {len(remain):,}청크 중 내 몫 {len(mine):,} ({who})")
if a.piece == 1:
    ledger_append("SCORING", "REBASE_SPRINT", "script:sprint_takeover",
                  evidence={"잔여": f"{len(remain):,}청크 3분담", "목표": "16:30 완주 (난희 지시)"}, product="CI")
gc.generate_units("CI", mine, cfg, role=a.role, ckpt_tag=f"_rebasecmp_sprint{a.piece}",
                  phase=f"재추출 막판 스퍼트 ({who})")
print("스퍼트 몫 완료")
