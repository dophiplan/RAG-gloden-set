#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
map_gapfill.py — ③ 커버리지맵 '구멍 메우기' (미커버 청크만 재추출 → 기존 맵에 증분 병합)

왜 필요한가 (실측 사고 2026-08-13, CI):
  카드에는 `GAP_AUDIT 누락 문서: 0`이 찍혔지만, 실제 청크 커버율은 **17.8%**(글자 기준)였다.
  원인 ① 배치를 청크 '개수'(25개)로만 잘라 매뉴얼 PDF 구간에서 배치 1건이 60만 자 →
  judge·reviewer 입력 초과 하드 실패, generator는 앞부분만 읽고 응답.
  원인 ② 출처 빈값이면 GAP 검사가 공허하게 0을 반환(거짓 안심) — 별건 수리 완료.
  원인 ③ `ensemble_generate`는 중단(CoveragePaused)된 주자의 체크포인트 단위를 **풀에 넣지 않는다**
        → 90/121·92/121까지 뛴 두 주자의 결과가 통째로 버려졌다.

이 도구가 하는 일:
  1. 기존 맵의 사실 문장을 코퍼스와 문자 대조해 **아직 아무 단위도 안 나온 청크**를 산출
  2. 그 청크만 글자수 기준 배치로 나눠 추출 (이어달리기: generator→judge→reviewer)
  3. **중단 주자의 체크포인트 단위까지 전부 회수** (원인 ③ 회피)
  4. 1축 문자 대조 검수 → 기존 맵 사실과 중복 제거 → 새 버전 xlsx로 증분 저장
  5. 전/후 청크 커버율을 원장에 실측 기록

사용:
  python3 tools/map_gapfill.py CI                 # 미커버 전량 (작은 것부터 = FAQ→매뉴얼)
  python3 tools/map_gapfill.py CI --scope faq     # FAQ/웹만
  python3 tools/map_gapfill.py CI --scope manual  # 매뉴얼 PDF만
  python3 tools/map_gapfill.py CI --measure       # 측정만 (추출 안 함)
"""
import argparse
import collections
import json
import re
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
import gen_coverage as gc
from olib import ROOT, N, ledger_append, load_config

MAPDIR = "03_coverage_map"


def latest_map(prod):
    d = ROOT / "data" / prod / MAPDIR
    cands = sorted(d.glob(f"{prod}_커버리지맵_코퍼스판_v*.xlsx"),
                   key=lambda p: [int(x) for x in re.findall(r"\d+", p.stem[-6:])] or [0])
    if not cands:
        sys.exit(f"[중단] 커버리지맵이 없습니다: {d}")
    return cands[-1]


def next_version(path):
    m = re.search(r"_v(\d+)_(\d+)\.xlsx$", path.name)
    maj, mnr = (int(m.group(1)), int(m.group(2))) if m else (1, 0)
    return f"v{maj}_{mnr + 1}"


def read_map(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = []
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        if not r or not r[1]:
            continue
        rows.append({"unit_id": str(r[1]), "type": r[2] or "Doc", "title": r[3] or "",
                     "fact": r[4] or "", "question_hint": r[5] or "",
                     "source": r[6] or ""})
    return rows


def uncovered(chunks, units):
    """맵의 사실 문장이 (같은 출처의) 청크 원문에 실재하는지 문자 대조 → 단위 0개인 청크 목록.
    출처로 범위를 좁히는 이유: 서로 다른 문서의 짧은 상투구(「はい。」 등)가 우연히 맞아
    미커버 청크를 커버로 위장하는 것을 막는다."""
    by_src = collections.defaultdict(list)
    for u in units:
        f = gc.norm(u.get("fact", ""))
        if len(f) >= 8:
            by_src[gc._gkey(u.get("source", ""))].append(f)
    out = []
    for c in chunks:
        t = gc.norm(c.get("text", ""))
        if not any(f in t for f in by_src.get(gc._gkey(c.get("source", "")), [])):
            out.append(c)
    return out


def _chars(lst):
    return sum(len(str(c.get("text") or "")) for c in lst)


def _is_manual(c):
    return str(c.get("source") or "").lower().endswith((".pdf", ".docx", ".xlsx", ".pptx"))


def collect_ckpt_units(prod, tag):
    """[핵심] 중단 주자 포함 — 체크포인트에 남은 모든 주자의 원시 단위를 회수.
    ensemble_generate 는 CoveragePaused 를 pool.append 전에 잡아 중단 주자 기여를 0으로 만든다.
    구멍 메우기에서는 한 조각도 버리지 않는다."""
    ck = gc._ckpt_load(prod, tag) or {}
    got, per = [], {}
    for role, v in ck.items():
        if not isinstance(v, dict):
            continue
        us = [u for u in v.get("units", []) if isinstance(u, dict)]
        per[role] = {"배치": f"{v.get('done', 0)}/{v.get('n_batches', '?')}", "원시 단위": len(us),
                     "실패 배치": len(v.get("fails", []))}
        got += us
    return got, per


def shard(target, i, n):
    """미커버 청크를 n등분한 i번째 조각 (0-base). 배치 경계와 무관하게 청크 단위로 균등 분할 —
    큰 청크가 한쪽에 몰리지 않게 라운드로빈으로 나눈다 (글자수 편중 방지)."""
    return [c for k, c in enumerate(target) if k % n == i]


def run(prod, scope="all", measure=False, role=None, shard_spec=None, merge=True):
    cfg = load_config()
    chunks = gc.load_corpus(prod)
    mp = latest_map(prod)
    units = read_map(mp)
    unc_all = uncovered(chunks, units)

    tot_n, tot_ch = len(chunks), _chars(chunks)
    print(f"■ 코퍼스: {tot_n:,}청크 · {tot_ch:,}자   |  기존 맵: {mp.name} ({len(units):,}단위)")
    print(f"■ 미커버: {len(unc_all):,}청크 · {_chars(unc_all):,}자 "
          f"→ 현재 커버율 청크 {1 - len(unc_all) / tot_n:.1%} · 글자 {1 - _chars(unc_all) / tot_ch:.1%}")

    man = [c for c in unc_all if _is_manual(c)]
    faq = [c for c in unc_all if not _is_manual(c)]
    print(f"   · 매뉴얼류 {len(man):,}청크 ({_chars(man):,}자)  · FAQ/웹 {len(faq):,}청크 ({_chars(faq):,}자)")

    target = {"all": faq + man, "faq": faq, "manual": man}[scope]   # 작은 것부터 = 성과가 빨리 보인다
    if not target:
        print("✅ 해당 범위에 미커버 청크가 없습니다.")
        return 3          # 3 = 이 범위 완료 (무인 반복 루프의 정상 종료 신호)
    plan = gc.plan_batches(target, cfg)
    print(f"■ 이번 범위: {len(target):,}청크 · {_chars(target):,}자 → {len(plan):,}배치 "
          f"(배치당 최대 {gc._batch_chars(cfg):,}자)")
    if measure:
        return 0

    tag = f"_gap{scope}"
    # [난희 지적 2026-08-13] 패널 %가 '이번 조각' 진도만 보여줌 — 전체 지도 완성도로 보여야 한다.
    # 대시보드가 전체 %를 계산할 수 있게 맥락 저장: 전체 청크 · 이미 커버 · 이번 범위.
    ctx = {"total_chunks": tot_n, "covered_before": tot_n - len(unc_all),
           "scope": scope, "scope_chunks": len(target),
           "map": mp.name, "stage": "COVERAGE_MAP"}
    (ROOT / "results" / f"_gapctx_{prod}.json").write_text(
        json.dumps(ctx, ensure_ascii=False), encoding="utf-8")
    ledger_append("COVERAGE_MAP", "MAP_GAPFILL_START", "script:map_gapfill",
                  evidence={"기존 맵": mp.name, "기존 단위": len(units), "범위": scope,
                            "미커버 청크": len(target), "미커버 글자": _chars(target),
                            "배치": len(plan), "착수 전 청크 커버율": f"{1 - len(unc_all) / tot_n:.1%}"},
                  product=prod)

    roles = gc._ensemble_roles(cfg, gc.get_strategy(prod), prod)
    paused = []
    for role in roles:
        try:
            gc.generate_units(prod, target, cfg, role=role, ckpt_tag=tag,
                              phase=f"커버리지 구멍 메우기 ({scope})")
            print(f"  ✅ [{role}] 완주")
            break                     # 한 주자가 전량 훑으면 충분 (나머지는 한도 절약)
        except gc.CoveragePaused as e:
            paused.append(role)
            print(f"  ⏸ [{role}] 중단 — {e} → 다음 주자가 이어달림 (중간 결과 보존)")
            ledger_append("COVERAGE_MAP", "GAPFILL_PAUSED_CONTINUE", f"script:{role}",
                          evidence={"사유": str(e)[:150], "조치": "다음 주자 이어달리기 · 중간 단위 회수"},
                          product=prod)
        except Exception as e:
            paused.append(role)
            print(f"  ✖ [{role}] 실패 — {str(e)[:150]}")

    raw, per_role = collect_ckpt_units(prod, tag)
    print(f"■ 회수한 원시 단위: {len(raw):,}  {per_role}")
    if not raw:
        ledger_append("COVERAGE_MAP", "MAP_GAPFILL_EMPTY", "script:map_gapfill",
                      evidence={"주자별": per_role, "중단 주자": paused,
                                "판단": "추출 0 — 맵 미변경 (한도 회복 후 재실행하면 이어서)"}, product=prod)
        print("⚠ 추출 0 — 맵을 바꾸지 않았습니다. 한도 회복 후 같은 명령으로 재실행하면 이어서 진행합니다.")
        return 2

    ok, rej = gc.verify_units(raw, chunks)
    have = {gc.norm(u["fact"]) for u in units}
    nums = [int(m.group(1)) for u in units
            for m in [re.search(r"(\d+)$", str(u["unit_id"]))] if m]
    nxt = (max(nums) + 1) if nums else 1
    added = []
    for u in ok:
        k = gc.norm(u.get("fact", ""))
        if len(k) < 8 or k in have:
            continue
        have.add(k)
        uid = f"{prod}-DOC-{nxt:03d}" if nxt < 1000 else f"{prod}-DOC-{nxt:04d}"
        nxt += 1
        added.append({"unit_id": uid, "type": u.get("type", "Doc"), "title": u.get("title", ""),
                      "fact": u.get("fact", ""), "question_hint": u.get("question_hint", ""),
                      "source": u.get("source", "")})
    print(f"■ 1축 검수: 통과 {len(ok):,} / 탈락 {len(rej):,}  → 중복 제거 후 신규 {len(added):,}")

    if not added:
        ledger_append("COVERAGE_MAP", "MAP_GAPFILL_NO_NEW", "script:map_gapfill",
                      evidence={"검수 통과": len(ok), "탈락": len(rej), "신규": 0,
                                "주자별": per_role}, product=prod)
        print("⚠ 신규 단위 0 — 맵 미변경.")
        return 2

    merged = units + added
    ver = next_version(mp)
    out = gc.write_map(prod, merged, version=ver)
    # 이 조각의 성과는 방금 지도에 합쳐졌다 — 조각 기록장(체크포인트)을 정리해야
    # 다음 실행에서 '기커버(지도) + 옛 조각 기록'으로 이중 계산되지 않는다 (한 경주 % 정합).
    gc._ckpt_path(prod, tag).unlink(missing_ok=True)
    unc_after = uncovered(chunks, merged)
    # 한 경주 % 기준점 갱신 — 다음 폴링부터 '지도에 실제로 들어간 만큼'으로 표시
    ctx.update({"covered_before": tot_n - len(unc_after), "map": out.name,
                "scope_chunks": 0})
    (ROOT / "results" / f"_gapctx_{prod}.json").write_text(
        json.dumps(ctx, ensure_ascii=False), encoding="utf-8")
    print(f"■ 저장: {out.name}  ({len(units):,} → {len(merged):,}단위)")
    print(f"■ 커버율: 청크 {1 - len(unc_all) / tot_n:.1%} → {1 - len(unc_after) / tot_n:.1%} · "
          f"글자 {1 - _chars(unc_all) / tot_ch:.1%} → {1 - _chars(unc_after) / tot_ch:.1%}")
    ledger_append("COVERAGE_MAP", "MAP_GAPFILL_DONE", "script:map_gapfill",
                  evidence={"산출": out.name, "기존 단위": len(units), "신규 단위": len(added),
                            "합계": len(merged), "1축 탈락": len(rej), "주자별": per_role,
                            "중단 주자": paused, "범위": scope,
                            "청크 커버율": f"{1 - len(unc_all) / tot_n:.1%} → {1 - len(unc_after) / tot_n:.1%}",
                            "글자 커버율": f"{1 - _chars(unc_all) / tot_ch:.1%} → {1 - _chars(unc_after) / tot_ch:.1%}",
                            "남은 미커버 청크": len(unc_after)}, product=prod)
    gc._progress(prod, f"구멍 메우기 완료 ({scope}) — 신규 {len(added):,}단위", "-", 0, 0, [])
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("product")
    ap.add_argument("--scope", default="all", choices=["all", "faq", "manual"])
    ap.add_argument("--measure", action="store_true", help="측정만 (AI 호출 없음)")
    a = ap.parse_args()
    sys.exit(run(a.product, a.scope, a.measure))
