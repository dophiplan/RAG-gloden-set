#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
card_ko.py — 게이트 카드에 '사람용 한국어 판정 요약' 자동 첨부 (③ 커버리지맵)

왜 (난희 지시 2026-08-13): "검수해야 하는데 일본어라서 모르겠는데 어떻게 하지?"
  → 사람이 일본어 원문을 읽을 필요가 없게 만든다. 사람이 판단할 것은 **숫자와 절차** 3개뿐이고,
    "무엇을 뽑았는지 감"은 표본 10건 한국어 번역으로 확인한다.
  → 번역은 오역 가능성이 있으니 **원문 병기 전문을 금고 통역기록에 남긴다** (난희 지시 2026-08-07).

안전: 이 카드(검수큐/*CI*.md)는 .gitignore로 공개 저장소에서 제외돼 있다 — 확인 후 첨부.
      번역 기록은 금고(data/CI, 비공개 RAG-eval-CI-vault)에만 저장한다.

핵심 원칙: 번역은 **참고**, 판정 근거는 **기계 실측 숫자**. 번역이 틀려도 판정은 흔들리지 않는다.

사용:
  python3 tools/card_ko.py CI                    # 표본 10건 번역 + 카드 첨부
  python3 tools/card_ko.py CI --samples 20
  python3 tools/card_ko.py CI --no-translate     # 숫자만 (AI 호출 없음)
"""
import argparse
import datetime
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import gen_coverage as gc
import llm
import map_gapfill as mg
from olib import ROOT, N, ledger_append, load_config

TRANSLATE_SYSTEM = """[TASK:TRANSLATE_JA_KO] 너는 일본어→한국어 통역사다.
입력: JSON 배열 [{"no":1,"ja":"일본어 문장"}, …].
규칙:
1. 의역 금지 — 사람이 원문과 대조해 오역을 잡을 수 있도록 문장 구조를 최대한 유지.
2. 고유명사(서비스명·요금제명)는 원문 표기를 남기고 필요하면 괄호로 설명.
3. 확신이 없으면 번역 뒤에 " (※확인 필요)" 를 붙인다 — 추측을 확신처럼 쓰지 말 것.
출력: JSON 배열만 — [{"no":1,"ko":"한국어"}, …]"""


def ckpt_rows(prod):
    """추출 주자별 실적 — 본 추출 + 구멍 메우기 체크포인트 전부"""
    rows = []
    for p in sorted((ROOT / "results").glob(f"_ckpt_coverage_{prod}*.json")):
        tag = p.stem.replace(f"_ckpt_coverage_{prod}", "") or "(본 추출)"
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        for role, v in d.items():
            if not isinstance(v, dict):
                continue
            rows.append({"구간": tag, "주자": role, "배치": f"{v.get('done', 0)}/{v.get('n_batches', '?')}",
                         "원시 단위": len(v.get("units", [])), "실패 배치": len(v.get("fails", []))})
    return rows


def _ledger_extract_history(prod, limit=6):
    """체크포인트는 완주 시 정리되므로, 지난 추출의 '어디까지 뛰었나'는 원장에서 읽는다.
    (판정에 필요한 사실: 3주자 중 실제로 완주한 사람이 몇 명인가)"""
    p = ROOT / "ledger.jsonl"
    if not p.exists():
        return []
    keep = ("COVERAGE_PAUSED", "ENSEMBLE_CLOSED_EARLY", "MAP_GENERATED",
            "MAP_GAPFILL_DONE", "MERGE_SKIPPED_SCALE")
    out = []
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            r = json.loads(line)
        except Exception:
            continue
        if r.get("product") == prod and r.get("action") in keep:
            ev = r.get("evidence") or {}
            out.append({"시각": str(r.get("ts", ""))[:16], "사건": r["action"],
                        "주체": str(r.get("actor", ""))[:24],
                        "요지": "; ".join(f"{k}={v}" for k, v in list(ev.items())[:3])[:120]})
    return out[-limit:]


def translate(units, cfg):
    """표본 일본어 → 한국어. 실패하면 번역 없이 진행 (판정은 숫자 기준이므로 치명적이지 않음).
    번역은 판정이 아니라 통역이므로 규칙 C(판정 모델 분리) 무관 — 추출전용 모델을 쓴다.
    claude 한도는 구멍 메우기 추출에 써야 하므로 여기서는 쓰지 않는다."""
    payload = [{"no": i + 1, "ja": str(u.get("fact", ""))[:400]} for i, u in enumerate(units)]
    role = "judge_extract" if (cfg.get("models", {}).get("judge_extract")) else "generator"
    try:
        out = llm.chat(role, TRANSLATE_SYSTEM, json.dumps(payload, ensure_ascii=False), cfg)
        got = llm.extract_json(out)
        m = {int(x["no"]): str(x.get("ko", "")) for x in got if isinstance(x, dict) and "no" in x}
        return m, None
    except Exception as e:
        return {}, str(e)[:200]


def sample_units(units, n):
    """균등 간격 표본 — 무작위 금지(재현 가능해야 함). 앞·중간·뒤가 골고루 들어간다."""
    if len(units) <= n:
        return list(range(len(units))), units
    step = len(units) / n
    idx = [int(i * step) for i in range(n)]
    return idx, [units[i] for i in idx]


def build(prod, n_samples=10, do_translate=True):
    cfg = load_config()
    chunks = gc.load_corpus(prod)
    mp = mg.latest_map(prod)
    units = mg.read_map(mp)
    unc = mg.uncovered(chunks, units)
    tot_n, tot_ch = len(chunks), mg._chars(chunks)
    cov_n = 1 - len(unc) / tot_n
    cov_ch = 1 - mg._chars(unc) / tot_ch

    # 독립 재검증 — 카드 숫자를 그대로 믿지 않는다
    ok, rej = gc.verify_units(units, chunks)
    dup_id = len(units) - len({u["unit_id"] for u in units})
    dup_fact = len(units) - len({gc.norm(u["fact"]) for u in units})
    rows = ckpt_rows(prod)

    idx, samp = sample_units(units, n_samples)
    ko, terr = ({}, "번역 생략(--no-translate)")
    if do_translate and samp:
        ko, terr = translate(samp, cfg)

    # ── 판정 3항목 (사람이 볼 것은 이것뿐) ─────────────────────────────
    checks = [
        {"항목": "① 코퍼스를 다 읽었나 (커버율)",
         "실측": f"청크 {cov_n:.1%} · 글자 {cov_ch:.1%}",
         "판정": "✅ 충분" if cov_ch >= 0.9 else ("⚠ 부분" if cov_ch >= 0.6 else "❌ 부족"),
         "뜻": "이 %만큼의 원문에서만 시험 문제가 나올 수 있음"},
        {"항목": "② 뽑은 문장이 원문에 실재하나 (1축 문자 대조)",
         "실측": f"통과 {len(ok):,} / 탈락 {len(rej):,}",
         "판정": "✅ 통과" if not rej else "❌ 탈락 있음",
         "뜻": "AI가 없는 말을 지어냈는지 — 기계가 글자 단위로 대조 (사람이 일본어 읽을 필요 없음)"},
        {"항목": "③ 중복이 없나",
         "실측": f"ID 중복 {dup_id} · 사실 중복 {dup_fact}",
         "판정": "✅ 없음" if dup_id == 0 and dup_fact == 0 else "⚠ 있음",
         "뜻": "같은 내용이 여러 번 시험에 나오면 성적이 왜곡됨"},
    ]
    verdict = ("승인 권고" if all(c["판정"].startswith("✅") for c in checks)
               else "반려/보류 권고")

    L = []
    L.append("## 🇰🇷 사람용 한국어 요약 (자동 생성 — 기계 실측 + AI 번역)")
    L.append("")
    L.append(f"- 생성: {datetime.datetime.now().isoformat(timespec='seconds')} · 대상 맵: `{mp.name}` ({len(units):,}단위)")
    L.append(f"- **판단은 아래 3개만 보면 됩니다. 일본어 원문을 읽을 필요 없습니다.**")
    L.append(f"- 기계 종합: **{verdict}**")
    L.append("")
    L.append("### 확인해야 할 3가지")
    L.append("")
    L.append("| 확인 항목 | 실측 | 판정 | 이게 무슨 뜻인가 |")
    L.append("|---|---|---|---|")
    for c in checks:
        L.append(f"| {c['항목']} | {c['실측']} | {c['판정']} | {c['뜻']} |")
    L.append("")
    if cov_ch < 0.9:
        L.append(f"> ⚠ **커버율 경고**: 코퍼스 {tot_ch:,}자 중 {mg._chars(unc):,}자(미커버 {len(unc):,}청크)에서는 "
                 f"아직 아무 단위도 나오지 않았습니다. 이 상태로 승인하면 시험 범위가 그만큼 좁아집니다. "
                 f"→ `python3 tools/map_gapfill.py {prod}` (구멍 메우기)")
        L.append("")
    L.append("### 누가 어디까지 뛰었나 (추출 주자 실적)")
    L.append("")
    L.append("| 구간 | 주자 | 배치 | 원시 단위 | 실패 배치 |")
    L.append("|---|---|---|---|---|")
    for r in rows or [{"구간": "-", "주자": "-", "배치": "-", "원시 단위": 0, "실패 배치": 0}]:
        L.append(f"| {r['구간']} | {r['주자']} | {r['배치']} | {r['원시 단위']:,} | {r['실패 배치']} |")
    L.append("")
    hist = _ledger_extract_history(prod)
    if hist:
        L.append("지난 추출 이력 (원장 정본 — 체크포인트는 완주 시 정리되므로 여기서 확인):")
        L.append("")
        L.append("| 시각 | 사건 | 주체 | 요지 |")
        L.append("|---|---|---|---|")
        for h in hist:
            L.append(f"| {h['시각']} | {h['사건']} | {h['주체']} | {h['요지']} |")
        L.append("")
    L.append(f"### 무엇을 뽑았는지 감 잡기 — 표본 {len(samp)}건 (한국어)")
    L.append("")
    if terr and not ko:
        L.append(f"> 번역 실패/생략: {terr} — 숫자 판정에는 영향 없습니다.")
        L.append("")
    L.append("| # | 뽑힌 사실 (한국어 번역) | 출처 |")
    L.append("|---|---|---|")
    for i, u in enumerate(samp, 1):
        src = str(u.get("source") or "")
        src = src if len(src) <= 44 else src[:41] + "…"
        txt = ko.get(i) or "(번역 없음)"
        L.append(f"| {i} | {txt[:160]} | {src} |")
    L.append("")
    L.append("> 번역은 **참고용**입니다. 오역 가능성이 있어 원문 병기 전문을 금고 통역기록에 남겼습니다"
             " (판정 근거는 위 기계 실측 숫자).")
    L.append("")

    # ── 번역 기록(원문 병기) 금고 저장 ───────────────────────────────
    rec = None
    if ko:
        vdir = ROOT / "data" / prod / "번역"
        vdir.mkdir(parents=True, exist_ok=True)
        seq = len(list(vdir.glob("통역기록_*.md"))) + 1
        rec = vdir / f"통역기록_{seq:03d}_카드표본{len(samp)}건_{datetime.date.today():%Y%m%d}.md"
        R = [f"# 통역 기록 {seq:03d} — 커버리지맵 카드 표본 {len(samp)}건 (원문 병기)", "",
             "> 규칙: 번역 오류를 사람이 검증할 수 있도록 원문·번역 병기 (난희 지시 2026-08-07)",
             f"> 맥락: {mp.name} · 게이트 COVMAP_{prod} 사람 판정용 표본 (균등 간격 추출, 재현 가능)",
             f"> 번역: Claude (card_ko.py) · 표본 행번호: {[i + 1 for i in idx]}", "",
             "| 맵 # | Unit ID | 원문 (일본어) | 번역 (한국어) | 출처 |", "|---|---|---|---|---|"]
        for i, (mi, u) in enumerate(zip(idx, samp), 1):
            R.append(f"| {mi + 1} | {u['unit_id']} | {str(u.get('fact', ''))[:300]} | "
                     f"{(ko.get(i) or '(번역 없음)')[:300]} | {str(u.get('source') or '')} |")
        rec.write_text("\n".join(R) + "\n", encoding="utf-8")

    return "\n".join(L), {"맵": mp.name, "단위": len(units), "청크 커버율": f"{cov_n:.1%}",
                          "글자 커버율": f"{cov_ch:.1%}", "1축 탈락": len(rej),
                          "ID 중복": dup_id, "사실 중복": dup_fact, "표본": len(samp),
                          "번역 성공": len(ko), "통역기록": rec.name if rec else "-",
                          "기계 종합": verdict}


HDR = "## 🇰🇷 사람용 한국어 요약"


def attach(prod, digest):
    """카드에 첨부 — 기존 한국어 요약 섹션이 있으면 교체(중복 누적 금지)"""
    card = ROOT / "검수큐" / f"GATE_COVMAP_{prod}.md"
    if not card.exists():
        print(f"⚠ 카드 없음: {card} — 요약만 출력합니다.")
        return None
    cur = card.read_text(encoding="utf-8")
    if HDR in cur:
        cur = cur[:cur.index(HDR)].rstrip() + "\n\n"
    else:
        cur = cur.rstrip() + "\n\n---\n\n"
    card.write_text(cur + digest, encoding="utf-8")
    return card


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("product")
    ap.add_argument("--samples", type=int, default=10)
    ap.add_argument("--no-translate", action="store_true")
    a = ap.parse_args()
    digest, ev = build(a.product, a.samples, not a.no_translate)
    card = attach(a.product, digest)
    print(digest)
    ledger_append("COVERAGE_MAP", "CARD_KO_DIGEST", "script:card_ko",
                  evidence={**ev, "카드": N(card.name) if card else "-",
                            "목적": "일본어 코퍼스로 사람 검수가 막히는 문제 — 판정은 숫자 3개 + 표본 번역"},
                  product=a.product)
    print(f"\n✅ 카드 첨부 완료: {card}" if card else "")
