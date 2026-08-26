#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""원격추출_병합.py — 원격 추출자(claude-원격) shard 를 로컬 체크포인트에 병합

원격 세션이 results/원격추출_CI/shard.jsonl 에 배치 단위로 적재한 커버 단위를
로컬 커버리지 체크포인트(results/_ckpt_coverage_CI.json)의 generator 슬롯에 합친다.

사용 (Mac, eval-runner/orchestrator 에서):
    git pull
    python3 tools/원격추출_병합.py                # CI 기본
    python3 tools/원격추출_병합.py --product CI --dry-run

동작:
  - shard 의 각 줄 = {"batch": n, "units": [...], "추출자": "claude-원격", "ts": ...}
  - 같은 배치번호가 여러 줄이면 마지막 줄만 사용 (중복 제거)
  - 체크포인트에 이미 done 처리된 배치(순번 ≤ done)와 이미 병합된 원격 배치
    (generator.remote_batches 기록)는 스킵 — 재실행해도 이중 적재 없음
  - fact 정규화(공백·제어문자 무시) 기준으로 기존 단위와 중복인 단위는 버림
  - 병합 후 done 은 '1번부터 끊김 없이 이어지는 최대 배치번호'로 전진
    (gen_coverage 의 done 은 고수위 카운터라 중간에 빈 배치가 있으면 못 올린다 —
     빈 구간은 로컬 재개 실행이 이어달리고, 원격분은 remote_batches 로 추적)
  - n_batches/n_chunks 불일치 시 병합 중단 (배치번호 의미가 달라져 오염 위험)
"""
import argparse
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECT = {"CI": {"n_batches": 828, "n_chunks": 3007}}   # 2026-08-25 원격 재현 실측


def N(s):
    return unicodedata.normalize("NFC", str(s or ""))


def norm(s):
    return re.sub(r"[\s\x00-\x1f]+", "", N(s)).lower()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", default="CI")
    ap.add_argument("--shard", default=None, help="shard.jsonl 경로 (기본: results/원격추출_<제품>/shard.jsonl)")
    ap.add_argument("--ckpt", default=None, help="체크포인트 경로 (기본: results/_ckpt_coverage_<제품>.json)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    shard = Path(a.shard) if a.shard else ROOT / "results" / f"원격추출_{a.product}" / "shard.jsonl"
    ckp = Path(a.ckpt) if a.ckpt else ROOT / "results" / f"_ckpt_coverage_{a.product}.json"
    if not shard.exists():
        raise SystemExit(f"shard 없음: {shard}")

    # shard 로드 — 배치번호 중복은 마지막 줄 우선
    by_batch = {}
    for line in shard.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
            by_batch[int(row["batch"])] = row
        except Exception as e:
            print(f"  ! 손상 줄 스킵: {e}")

    ck = {}
    if ckp.exists():
        try:
            ck = json.loads(ckp.read_text(encoding="utf-8"))
        except Exception:
            raise SystemExit(f"체크포인트 파싱 실패 — 손대지 않음: {ckp}")
    g = ck.get("generator") or {}
    exp = EXPECT.get(a.product, {})
    if g and exp:
        for k, v in exp.items():
            if g.get(k) not in (None, v):
                raise SystemExit(f"체크포인트 {k}={g.get(k)} ≠ 원격 재현 {v} — 배치번호 의미가 달라 병합 중단")

    units = [u for u in g.get("units", []) if isinstance(u, dict)]
    seen = {norm(u.get("fact", "")) for u in units}
    ids = {N(u.get("unit_id", "")) for u in units}
    done = int(g.get("done", 0))
    merged_remote = set(g.get("remote_batches", []))
    total = int(g.get("n_batches") or exp.get("n_batches") or max(by_batch, default=0))

    new_units, new_batches, skipped = 0, [], 0
    for bno in sorted(by_batch):
        if bno <= done or bno in merged_remote:
            skipped += 1
            continue
        added = 0
        for u in by_batch[bno].get("units", []):
            if not isinstance(u, dict):
                continue
            k = norm(u.get("fact", ""))
            if len(k) < 6 or k in seen:
                continue
            uid = N(u.get("unit_id", ""))
            if not uid or uid in ids:   # ID 충돌 — 원격 표식으로 재부여
                n = 1
                while f"{uid or a.product + '-RMT'}-r{n}" in ids:
                    n += 1
                u = {**u, "unit_id": f"{uid or a.product + '-RMT'}-r{n}"}
                uid = u["unit_id"]
            seen.add(k)
            ids.add(uid)
            units.append(u)
            added += 1
        merged_remote.add(bno)
        new_batches.append(bno)
        new_units += added

    covered = set(range(1, done + 1)) | merged_remote
    while done + 1 in covered:
        done += 1

    print(f"shard 배치 {len(by_batch)}건 · 신규 병합 {len(new_batches)}건 · 스킵(기병합/기완료) {skipped}건")
    print(f"신규 단위 {new_units} → 누적 {len(units)} · done {g.get('done', 0)} → {done} / {total}")
    if a.dry_run:
        print("(dry-run — 저장 안 함)")
        return
    ck["generator"] = {**g, "done": done, "units": units,
                       "fails": list(g.get("fails", [])),
                       "n_chunks": int(g.get("n_chunks") or exp.get("n_chunks") or 0) or g.get("n_chunks"),
                       "n_batches": total,
                       "remote_batches": sorted(merged_remote)}
    ckp.parent.mkdir(exist_ok=True)
    ckp.write_text(json.dumps(ck, ensure_ascii=False), encoding="utf-8")
    print(f"저장: {ckp}")


if __name__ == "__main__":
    main()
