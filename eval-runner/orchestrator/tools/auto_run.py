#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
auto_run.py — 무인 자동 진행 워커 (사람 개입 0)

한도로 멈추면(HALTED·한도성) 스스로 기다렸다 재개한다. 밤새 토큰이 만료됐다
회복되기를 반복해도 사람이 버튼을 누를 필요가 없다 — 알아서 이어간다.

멈춤/종료 규칙:
- WAITING_HUMAN / WAITING_INPUT / DONE → 사람 차례거나 완료 → 워커 종료
- HALTED(한도·일시중단) → 지수 백오프(5→10→20→40→상한)분 대기 후 자동 재개
- HALTED(비한도 = 진짜 사고) → 워커 종료 (사람 판단 필요)

사용: python3 tools/auto_run.py --product RC2 [--max-wait 60]
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from olib import ledger_append


def _state(prod):
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    return st["products"][prod]


def _pipeline(*a, env=None):
    subprocess.run([sys.executable, str(ROOT / "tools" / "pipeline.py"), *a],
                   cwd=str(ROOT), env=env)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", required=True)
    ap.add_argument("--max-wait", type=int, default=60, help="자동 재개 최대 대기(분)")
    a = ap.parse_args()
    env = {**os.environ}
    waits = [5, 10, 20, 40, a.max_wait]
    tries = 0
    print(f"🤖 무인 자동 진행 시작 — {a.product} (한도 걸리면 스스로 재개)")
    while True:
        _pipeline("run", "--product", a.product, env=env)
        ps = _state(a.product)
        s, stage = ps["status"], ps["stage"]
        if s in ("WAITING_HUMAN", "WAITING_INPUT", "DONE"):
            if s == "WAITING_HUMAN" and os.environ.get("ORCH_MOCK") != "1":
                # 3권 분립: 사람 게이트 도달 → 설계본부(독립 세션) 자동 소환, 소견을 카드에 첨부
                print("🏛 설계본부 소환 — 독립 세션 검수 소견 첨부 중…")
                _pipeline_raw = subprocess.run(
                    [sys.executable, str(ROOT / "tools" / "sbb_review.py"), "--product", a.product],
                    cwd=str(ROOT), env=env, capture_output=True, text=True, timeout=1800)
                print(_pipeline_raw.stdout.strip() or _pipeline_raw.stderr.strip()[:200])
            print(f"⏹ {a.product} {stage} · {s} — 사람 차례거나 완료. 자동 진행 종료.")
            ledger_append(stage, "AUTO_RUN_STOPPED", "script:auto_run",
                          evidence={"사유": f"{s} 도달 — 사람 차례거나 완료"}, product=a.product)
            return
        if s == "HALTED":
            hr = ps.get("halt_reason") or ""
            if "한도" in hr or "일시 중단" in hr:
                w = waits[min(tries, len(waits) - 1)]
                print(f"⏸ 한도로 멈춤 — {w}분 후 자동 재개 (시도 {tries + 1}회째)")
                ledger_append(stage, "AUTO_RESUME_SCHEDULED", "script:auto_run",
                              evidence={"대기_분": w, "시도": tries + 1,
                                        "안내": "사람 개입 없이 대기 후 스스로 재개"}, product=a.product)
                time.sleep(w * 60)
                _pipeline("resume", "--after-fix", a.product,
                          "--reason", f"자동 재개 — 한도 회복 대기 {w}분 경과 (auto_run)",
                          "--actor", "auto_run", env=env)
                tries += 1
                continue
            print(f"⛔ {a.product} HALTED (비한도 — 진짜 사고) — 사람 필요: {hr[:80]}")
            return
        # PENDING/RUNNING 잔존 등 중간 상태 — 재시도하되 무한 루프 방지 (연속 5회 무진전이면 정지)
        tries += 1
        if tries >= 12:
            print(f"⛔ 무진전 반복 {tries}회 — 자동 진행 중단 (사람 확인 필요)")
            ledger_append(stage, "AUTO_RUN_STOPPED", "script:auto_run",
                          evidence={"사유": f"무진전 반복 {tries}회 — 사람 확인 필요"}, product=a.product)
            return
        time.sleep(30)


if __name__ == "__main__":
    main()
