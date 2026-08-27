#!/usr/bin/env python3
"""인수인계 현황 브리핑 — 어떤 Claude 세션(계정 무관)이 와도 이것만 읽으면 이어받는다.

사용: python3 tools/handover.py          # 화면 출력 + 인수인계_현황.md 갱신
설계: 결정적(LLM 없음) · 실시간 상태(state.json·ledger·프로세스)에서 즉석 생성 — 낡은 문서가 될 수 없음.
"""
import json
import subprocess
import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

NEXT_GUIDE = {
    # (stage, status) → 사람 말로 된 다음 행동
    ("SCORING", "WAITING_INPUT"): "⑧ 응답로그 대기 — 팀장님 로그(json)가 오면 data/<P>/08_scoring/에 넣고 채점기 실행",
    ("SCORING", "RUNNING"): "채점 진행 중 — results/logs/<P>/ 로그 확인",
    ("STAGE2", "WAITING_HUMAN"): "⑦ 본판정 카드 대기 — 대시보드 검수큐에서 카드 확인·승인",
    ("CALIBRATION", "WAITING_HUMAN"): "⑥ 캘리브레이션 카드 대기 — 사람 블라인드 판정 필요",
}


def sh(cmd):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        return ""


def main():
    state = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    lines = [f"# 인수인계 현황 — {datetime.datetime.now():%Y-%m-%d %H:%M} 자동 생성",
             "",
             "> 이 파일은 `python3 tools/handover.py`가 실시간 상태에서 만든다. 직접 수정 금지 — 다시 실행하면 갱신된다.",
             ""]

    lines.append("## 제품별 현재 위치")
    lines.append("")
    for prod, p in state.get("products", {}).items():
        stage, status = p.get("stage"), p.get("status")
        gates = p.get("open_gates") or []
        nxt = NEXT_GUIDE.get((stage, status), "대시보드(http://localhost:8791)에서 카드·진행 확인")
        lines.append(f"### {prod} — {stage} · {status}")
        if gates:
            lines.append(f"- 열린 카드: {', '.join(gates)}")
        if p.get("halt_reason"):
            lines.append(f"- 정지 사유: {p['halt_reason']}")
        hist = p.get("stage_history", {})
        if hist:
            last = max(hist.items(), key=lambda kv: kv[1].get("done_at", ""))
            lines.append(f"- 마지막 완료 단계: {last[0]} ({last[1].get('done_at', '')[:16]})")
        lines.append(f"- **다음 행동**: {nxt}")
        lines.append("")

    lines.append("## 최근 원장 기록 (제품별 마지막 5건)")
    lines.append("")
    tail = {}
    for ln in (ROOT / "ledger.jsonl").read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(ln)
        except Exception:
            continue
        tail.setdefault(e.get("product"), []).append(e)
    for prod, es in tail.items():
        if prod is None:
            continue
        lines.append(f"### {prod}")
        for e in es[-5:]:
            ev = json.dumps(e.get("evidence") or {}, ensure_ascii=False)
            lines.append(f"- {e['ts'][:16]} · {e.get('actor','')} · **{e.get('action','')}** — {ev[:160]}")
        lines.append("")

    lines.append("## 살아있는 프로세스")
    lines.append("")
    procs = sh("pgrep -fl 'auto_run|dashboard/serve|overnight|watchdog' | grep -v pgrep")
    lines.append("```")
    lines.append(procs or "(없음 — 대시보드가 필요하면: nohup python3 dashboard/serve.py --port 8791 &)")
    lines.append("```")
    lines.append("")

    lines.append("## 위치 지도")
    lines.extend([
        "",
        "| 무엇 | 어디 |",
        "|---|---|",
        "| 원장(모든 결정 기록) | `ledger.jsonl` — 막힐 때 여기부터 검색 |",
        "| 파이프라인 상태 | `state.json` |",
        "| CI 채점센터 금고 | `data/CI/` (별도 repo, 브랜치 `claude/resume-token-work-id1xu0`) |",
        "| CI r2 지시서·설계 | `docs/CI_r2_재출제_지시서_v1_0.md`, `data/CI/09_r2_시험지/` |",
        "| CI 채점 결과 | `data/CI/08_scoring/score_CI_*/` |",
        "| 판정기준서(유도리) | `data/CI/07_stage2/CI_판정기준서_v1_1.md` |",
        "| 대시보드 | `python3 dashboard/serve.py --port 8791` → http://localhost:8791 |",
        "| 파이프라인 재개 | `python3 tools/pipeline.py run --product <P>` |",
        "",
    ])

    out = ROOT / "인수인계_현황.md"
    out.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    print(f"\n→ 저장: {out}")


if __name__ == "__main__":
    main()
