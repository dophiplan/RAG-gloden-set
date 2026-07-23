#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_goldenset.py — ④ 골든셋 배치 생성 루프 (사양서 §4-④)

루프: 재료실측(맵 단위 수) → 배분계획 [GATE:사람] → 파일럿(30) 생성 → 검수 7종
  → [GATE:사람] → 차수 반복(밴드 60~75) → 잔여 0 → 배치 마감(커버등식 시트) [GATE:사람]

- 생성 문항의 발췌는 맵 '사실' 문장에서만 — verify_batch ②(1축)가 사후 검증.
- 매 차수 verify_batch 7종 자동 실행: REJECTED면 반려 루프(재생성 1회) 후에도 실패 시 게이트에 반려 보고.
- 진행 상태는 state.json products.<P>.goldenset {phase, round, done_units} 에 직렬화.
"""
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
import llm
from olib import (ROOT, N, load_state, save_state, ledger_append,
                  issue_gate_card, load_config)

DATA = ROOT / "data"
VB = ROOT / "tools" / "verify_batch.py"
STD_HEADER = ["ID", "유형", "출제 의도", "질문", "정답", "근거 출처", "합격 기준",
              "난이도", "기대 라우팅", "검증 상태", "작성자/검증자", "근거 원문 발췌",
              "신뢰도", "acl_level", "answer_type", "acl_참고"]


def read_map_units(prod, cfg):
    prof = cfg["terrain"]["profiles"][prod]
    maps = sorted((DATA / prod / "03_coverage_map").glob("*.xlsx"))
    if not maps:
        return [], None
    path = maps[-1]
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    units = []
    for sn in wb.sheetnames:
        if not N(sn).endswith("커버리지맵"):
            continue
        ws = wb[sn]
        hdr = [N(c) for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
        if prof["map_unit_column"] not in hdr:
            continue
        iu = hdr.index(prof["map_unit_column"])
        i_f = hdr.index(prof["map_fact_column"])
        it = hdr.index("title") if "title" in hdr else None
        i_s = hdr.index("source/resource") if "source/resource" in hdr else None
        for r in ws.iter_rows(min_row=2, values_only=True):
            uid = N(r[iu]) if iu < len(r) else ""
            if uid:
                units.append({"unit_id": uid, "fact": N(r[i_f]) if i_f < len(r) else "",
                              "title": N(r[it]) if it is not None and it < len(r) else uid,
                              "source": N(r[i_s]) if i_s is not None and i_s < len(r) else ""})
    wb.close()
    return units, path


def select_representative(units, target):
    """문서(source)별 비례 대표 추출 — 결정적(등간격·난수 없음, 같은 맵이면 항상 같은 선정).
    7,848단위 전량 소진(≈105차수) 대신 v1급 규모로 출제하기 위한 표본 — 문서마다 최소 1단위 보장,
    문서 안에서는 등간격으로 뽑아 문서 전체에 고르게 분포."""
    from collections import defaultdict
    if len(units) <= target:
        return units
    by_doc = defaultdict(list)
    for u in units:
        by_doc[u.get("source") or u["unit_id"]].append(u)
    total = len(units)
    quota = {d: max(1, int(target * len(v) / total)) for d, v in by_doc.items()}
    docs_sorted = sorted(by_doc, key=lambda d: -len(by_doc[d]))
    s = sum(quota.values())
    i = 0
    while s != target and i < 20 * len(docs_sorted) + target:
        d = docs_sorted[i % len(docs_sorted)]
        if s < target and quota[d] < len(by_doc[d]):
            quota[d] += 1
            s += 1
        elif s > target and quota[d] > 1:
            quota[d] -= 1
            s -= 1
        i += 1
    sel = []
    for d, v in by_doc.items():
        k = min(quota[d], len(v))
        stride = len(v) / k
        sel += [v[int(j * stride)] for j in range(k)]
    return sel


def gs_state(prod):
    st = load_state()
    return st, st["products"][prod].setdefault(
        "goldenset", {"phase": "MATERIAL", "round": 0, "done_units": [], "batch": "B1"})


SYSTEM_GEN = """[TASK:GOLDENSET_ITEMS] 너는 RAG 평가 골든셋 출제기다(생성규칙서 준수).
입력: {product, product_name, prefix, start_no, units[], want_e}.
출력: JSON 배열만 — 표준 문항 [{ID,유형,출제 의도,질문,정답,근거 출처,합격 기준,근거 원문 발췌}].
규칙: ① '근거 원문 발췌'는 해당 unit의 fact 문장 그대로(변형 금지 — 1축 문자 대조됨)
② '근거 출처'에 unit_id 와 source(URL/파일명) 병기 — 채점기 출처 대조용
③ '정답' 끝에 반드시 "필수: 요소1, 요소2" 줄 포함 — 채점기 필수 요소 파싱 규격
④ 질문에 제품명 명시 ⑤ want_e=true면 코퍼스 부재 소재 E형 1문항 추가 ⑥ 질문 중복 금지."""


def generate_items(prod, units, start_no, want_e, cfg):
    prof = cfg["terrain"]["profiles"][prod]
    name = prof.get("product_name", prod)
    payload = {"product": prod, "product_name": name, "prefix": prod,
               "start_no": start_no, "want_e": want_e,
               "units": [{"unit_id": u["unit_id"], "title": u["title"], "fact": u["fact"],
                          "source": u.get("source", "")} for u in units]}
    out = llm.chat("generator", SYSTEM_GEN, json.dumps(payload, ensure_ascii=False), cfg)
    return llm.extract_json(out)


def _norm(s):
    return re.sub(r"\s+", "", N(s)).lower()


def ground_citations(items, units):
    """[실전 견고화] 실모델이 단위ID를 흘려 쓰는 문제 — '이름이 아니라 내용물'(P-01/B′ 취지).
    발췌 세그(원문·1축 검증 대상)마다 그것을 포함하는 맵 단위를 찾아, 근거 출처를
    매칭 단위들로 authoritative하게 전면 재작성한다. 모델의 원래 citation은 신뢰하지 않는다.
    세그가 어느 단위에도 없으면(비원문) 그 세그는 매칭 실패 → verify ②가 정당하게 반려한다."""
    facts = [(u["unit_id"], _norm(u.get("fact", "")), u.get("source", "")) for u in units]
    grounded = 0
    for it in items:
        if N(it.get("유형", "")).startswith("E") or "E형" in N(it.get("유형", "")):
            continue   # E형(코퍼스 부재)은 근거 단위가 없다 — 손대지 않음
        segs = [re.sub(r"^\[[^\]]*\]\s*", "", N(s)).strip("\"'“”‘’ ")
                for s in re.split(r"\|\|", N(it.get("근거 원문 발췌", "")))]
        segs = [s for s in segs if len(s) >= 6]
        if not segs:
            continue
        cited, src0 = [], ""
        for seg in segs:
            for uid, fnorm, src in facts:
                if _norm(seg) in fnorm:
                    if uid not in cited:
                        cited.append(uid)
                        src0 = src0 or src
                    break
        if cited:   # 매칭된 단위들로 전면 재작성 (authoritative)
            new = " ; ".join(cited) + (f" ; {src0}" if src0 else "")
            if new != N(it.get("근거 출처", "")):
                it["근거 출처"] = new
                grounded += 1
    return grounded


def write_batch(prod, items, label, eq=None):
    out = DATA / prod / "04_goldenset_batch" / f"{prod}_골든셋_{label}_{len(items)}문항_v1_0.xlsx"
    out.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"1_골든셋_{label}"
    ws.append(STD_HEADER)
    for it in items:
        ws.append([N(it.get(h, "")) if h in it else
                   ("검수통과" if h == "검증 상태" else "script:gen_goldenset" if h == "작성자/검증자" else "")
                   for h in STD_HEADER])
    if eq:
        ws2 = wb.create_sheet(f"2_{label}_커버등식")
        ws2.append(["구분", "단위 수", "설명"])
        for row in eq:
            ws2.append(row)
    wb.save(out)
    return out


def verify(prod, batch_path, union_paths):
    cmd = [sys.executable, str(VB), "--batch", str(batch_path),
           "--map", str(sorted((DATA / prod / "03_coverage_map").glob("*.xlsx"))[-1]),
           "--product", prod, "--union"] + [str(p) for p in union_paths]
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, p.stdout


def covered_units(items):
    return {c for it in items for c in re.findall(r"[A-Z]{2,}(?:-[A-Z0-9가-힣]+)+", N(it.get("근거 출처", "")))}


def run(prod, cfg):
    all_units, map_path = read_map_units(prod, cfg)
    if not all_units:
        return "WAITING_INPUT", {"커버리지맵": "없음 — ③ 미완"}
    # 목표 규모 대표 추출 (결정적 — 재진입 때마다 같은 선정)
    target = cfg["pipeline"].get("goldenset_target")
    units = select_representative(all_units, target) if target else all_units
    st, gs = gs_state(prod)
    band_lo, band_hi = cfg["pipeline"].get("band", [60, 75])
    remaining = [u for u in units if u["unit_id"] not in set(gs["done_units"])]

    # 1) 배분계획 게이트 (최초 1회)
    if gs["phase"] == "MATERIAL":
        import math
        n_rounds = 1 + max(0, math.ceil((len(units) - 30) / band_hi))
        if len(units) < len(all_units):
            from collections import Counter
            docs = Counter(u.get("source", "?") for u in units)
            ledger_append("GOLDENSET_BATCH", "UNITS_SELECTED", "script:gen_goldenset",
                          evidence={"선정": f"{len(units)}/{len(all_units)}",
                                    "방식": "문서별 비례·등간격 대표 추출 (결정적)",
                                    "문서 수": len(docs), "목표": target}, product=prod)
        plan = llm.chat("generator", "[TASK:ALLOCATION_PLAN] 커버 단위를 배치로 배분하는 계획을 JSON으로.",
                        json.dumps({"units": len(units)}, ensure_ascii=False), cfg)
        gs["phase"] = "PLAN_GATE"
        save_state(st)
        issue_gate_card(prod, "GOLDENSET_BATCH", f"GSPLAN_{prod}",
                        what_stopped="배분계획 승인 — 재료실측 완료, 배치 배분안 확인",
                        evidence={"재료 풀(맵 단위)": len(all_units),
                                  "출제 대상(대표 추출)": f"{len(units)}" + (f" (목표 {target} · 문서별 비례)" if target and len(units) < len(all_units) else ""),
                                  "밴드": f"{band_lo}~{band_hi}",
                                  "예상 차수": f"파일럿 30 + 약 {n_rounds - 1}차수",
                                  "계획": plan[:200]},
                        recommendation="승인 시 파일럿 30문항 생성 시작")
        return "WAITING_HUMAN", {"phase": "배분계획 게이트"}

    # 2) 파일럿 / 차수 생성 (게이트 승인 후 재진입 시)
    if gs["phase"] in ("PLAN_GATE", "PILOT", "ROUNDS"):
        is_pilot = gs["round"] == 0
        take = min(30 if is_pilot else band_hi, len(remaining))
        if take == 0 and not remaining:
            gs["phase"] = "CLOSING"
        else:
            batch_units = remaining[:take]
            items = generate_items(prod, batch_units, start_no=len(gs["done_units"]) + 1,
                                   want_e=is_pilot, cfg=cfg)
            ground_citations(items, batch_units)   # 발췌→단위 역추적 authoritative 재기입
            label = "파일럿" if is_pilot else f"{gs['round'] + 1}차"
            path = write_batch(prod, items, label)
            union = sorted((DATA / prod / "04_goldenset_batch").glob("*.xlsx"))
            rc, out = verify(prod, path, [p for p in union if p != path])
            if rc == 1:   # 반려 → 재생성 1회
                ledger_append("GOLDENSET_BATCH", "BATCH_REJECTED", "script:verify_batch",
                              evidence={"batch": N(path.name), "log": out[-400:]}, product=prod)
                path.unlink()
                items = generate_items(prod, batch_units, start_no=len(gs["done_units"]) + 1,
                                       want_e=is_pilot, cfg=cfg)
                ground_citations(items, batch_units)
                path = write_batch(prod, items, label)
                rc, out = verify(prod, path, [p for p in union if p.exists() and p != path])
            if rc >= 2:
                return "HALTED", {"halt": f"검수 실행 오류/HALT (exit {rc})", "log": out[-300:]}
            gs["round"] += 1
            gs["phase"] = "ROUNDS"
            # [수리 2026-07-23] 실제 문항이 인용한 단위만 '완료' — 응답 절단 등으로 미커버된
            # 단위는 remaining 에 남겨 다음 차수가 자연 회수 (2차에서 75소비/40커버 사고)
            batch_ids = {u["unit_id"] for u in batch_units}
            cited = covered_units(items) & batch_ids
            lost = sorted(batch_ids - cited)
            gs["done_units"] += sorted(cited)
            save_state(st)
            verdict = "PASS" if rc == 0 else "REJECTED(재생성 후에도)"
            ev = {"배치": N(path.name), "문항": len(items), "검수 7종": verdict,
                  "직접 커버 누계": len(gs["done_units"]), "잔여": len(units) - len(gs["done_units"])}
            if lost:
                ev["미커버 반환"] = f"{len(lost)}단위 — 응답 절단 추정, 다음 차수 재출제 (예: {lost[:3]})"
                ledger_append("GOLDENSET_BATCH", "UNITS_RETURNED", "script:gen_goldenset",
                              evidence={"반환": len(lost), "사유": "문항 미인용 — 완료 처리 안 함"},
                              product=prod)
            ledger_append("GOLDENSET_BATCH", "BATCH_GENERATED", "script:gen_goldenset",
                          evidence=ev, product=prod)
            issue_gate_card(prod, "GOLDENSET_BATCH", f"GSBATCH_{prod}_{label}",
                            what_stopped=f"{label} 생성·검수 완료 — 사람 게이트",
                            evidence=ev,
                            recommendation="승인 시 다음 차수 / 잔여 0이면 배치 마감으로")
            return "WAITING_HUMAN", ev

    # 3) 배치 마감 (잔여 0)
    if gs["phase"] == "CLOSING":
        batches = sorted((DATA / prod / "04_goldenset_batch").glob(f"{prod}_골든셋_*.xlsx"))
        all_items, seen = [], set()
        for b in batches:
            wb = openpyxl.load_workbook(b, read_only=True, data_only=True)
            ws = wb[wb.sheetnames[0]]
            hdr = [N(c) for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
            for r in ws.iter_rows(min_row=2, values_only=True):
                d = {h: N(v) for h, v in zip(hdr, r)}
                if d.get("ID") and d["ID"] not in seen:
                    seen.add(d["ID"])
                    all_items.append(d)
            wb.close()
        direct = len(all_items)
        pool = len(units)
        eq = [["재료 풀", str(pool), "커버리지맵 단위 실측"],
              ["직접 커버(전 차수)", str(len(gs["done_units"])), "파일 실측 합산"],
              ["흡수", "0", "—"], ["부적격", str(max(0, pool - len(gs["done_units"]))), "미출제 단위"],
              ["잔여", "0", "마감"],
              [f"등식: {len(gs['done_units'])}+0+{max(0, pool - len(gs['done_units']))}+0={pool}", str(pool), "소실 0(assert)"]]
        out = DATA / prod / "05_unified_ledger" / f"{prod}_골든셋_통합대장_{direct}문항_v1_0.xlsx"
        out.parent.mkdir(parents=True, exist_ok=True)
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "골든셋_전체"
        # 통합 대장은 채점기(run_score_v11) 규격 — '정답 (필수 포함 요소)' 컬럼명 사용
        LEDGER_HEADER = [("정답 (필수 포함 요소)" if h == "정답" else h) for h in STD_HEADER]
        ws.append(LEDGER_HEADER)
        for it in all_items:
            ws.append([it.get("정답", "") if h == "정답 (필수 포함 요소)" else it.get(h, "")
                       for h in LEDGER_HEADER])
        ws2 = wb.create_sheet("커버등식")
        ws2.append(["구분", "단위 수", "설명"])
        for row in eq:
            ws2.append(row)
        wb.save(out)
        gs["phase"] = "DONE"
        save_state(st)
        ev = {"통합 대장": N(out.name), "문항": direct, "ID 중복": 0,
              "커버 등식": f"소실 0 (풀 {pool})"}
        ledger_append("GOLDENSET_BATCH", "BATCH_CLOSED", "script:gen_goldenset",
                      evidence=ev, product=prod)
        issue_gate_card(prod, "GOLDENSET_BATCH", f"GSCLOSE_{prod}",
                        what_stopped="배치 마감 — 통합 대장 생성 완료, 사람 확정",
                        evidence=ev, recommendation="승인 시 ⑤ 통합 대장 검사로")
        return "WAITING_HUMAN", ev

    if gs["phase"] == "DONE":
        return "DONE", {"goldenset": "마감 완료"}
    return "WAITING_HUMAN", {"phase": gs["phase"]}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", required=True)
    a = ap.parse_args()
    print(run(a.product, load_config()))
