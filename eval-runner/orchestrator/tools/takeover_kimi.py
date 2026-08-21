#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""takeover_kimi.py — Kimi 조각의 남은 배치를 완주한 주자가 이어받기 (재편성, 2026-08-21)
Kimi 배치 계획을 결정적으로 재구성 → 이미 완료(done)된 배치 이후의 청크를 반으로 나눠
claude(--half 1)·codex(--half 2)가 별도 태그로 추출. Kimi 기존 성과(체크포인트)는 보존."""
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
ap.add_argument("--half", type=int, required=True, choices=[1, 2])
ap.add_argument("--role", required=True, choices=["generator", "reviewer"])
a = ap.parse_args()

cfg = load_config()
z = zipfile.ZipFile(ROOT / "data/CI/벡터감사/exports.zip_")
rows = []
with z.open("chunks-nhkim-all-2026-08-19.csv") as f:
    for i, r in enumerate(csv.DictReader(io.TextIOWrapper(f, "utf-8-sig"))):
        rows.append({"doc": ("FAQ" if r["doc_key"] == "288882413337" else "매뉴얼") + f"_{r['chunk_index']}",
                     "chunk_id": int(r["chunk_index"]),
                     "text": N(r.get("text", "")), "source": N(r.get("title", ""))})
kimi_target = [r for k, r in enumerate(rows) if k % 3 == 1]          # shard 2/3 재현
plan = gc.plan_batches(kimi_target, cfg)
done = json.load(open(ROOT / "results/_ckpt_coverage_CI_rebasecmp_judge_s2.json"))["judge"]["done"]
rest = [c for b in plan[done:] for c in b]
mine = [c for k, c in enumerate(rest) if k % 2 == (a.half - 1)]
who = {"generator": "claude", "reviewer": "codex"}[a.role]
print(f"Kimi 완료 {done}/{len(plan)}배치 — 남은 청크 {len(rest):,} 중 내 몫 {len(mine):,} ({who})")
ledger_append("SCORING", "REBASE_TAKEOVER", "script:takeover_kimi",
              evidence={"인수 주자": who, "몫": f"{len(mine):,}청크 (남은 {len(rest):,}의 절반)",
                        "Kimi 보존": f"{done}배치 성과 체크포인트 유지"}, product="CI")
gc.generate_units("CI", mine, cfg, role=a.role, ckpt_tag=f"_rebasecmp_takeover{a.half}",
                  phase=f"재추출 인수 (Kimi 잔여, {who})")
print("인수 몫 완료")
