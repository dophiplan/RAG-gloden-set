#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
serve.py — 관제 대시보드 로컬 서버 (사양서 v1.3 §10)

- state.json + ledger.jsonl **읽기 전용 뷰** (원장 편집 UI 없음 — 스크롤만)
- 검수큐 카드의 approve/reject 는 pipeline CLI 를 그대로 호출 (사유 필수·원장 기록)
- 로컬 전용: 127.0.0.1 바인딩

실행: python3 dashboard/serve.py [--port 8791]
"""
import argparse
import json
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "tools"))


def N(s):
    return unicodedata.normalize("NFC", str(s)) if s is not None else ""


def j(o):
    return json.dumps(o, ensure_ascii=False).encode("utf-8")


# ── 제품 1뎁스 구조 (U1) ──────────────────────────────────
# 사용자에게 보이는 건 제품(RV·RC). 내부 트랙 코드(RV2 등)는 세대 구현 상세.
PRODUCT_META = {
    "RV2": {"display": "RV", "product_name": "리모트뷰", "gen": "골든셋 v2.0 — 현역(구축 중)"},
    "RC2": {"display": "RC", "product_name": "리모트콜", "gen": "골든셋 v2.0 — 현역(구축 중)"},
    # CI: 채점센터 vault(data/CI = RAG-eval-CI-vault 클론) 연동 제품 — 채점은 vault에서 수행,
    # 관제판은 data/CI를 읽어 표시만 한다. 동기화: dashboard/CI_동기화.command (git pull)
    "CI": {"display": "CI", "product_name": "파트너 CI (채점센터 연동)", "gen": "r1 채점 완료 — r2 신규 출제 중"},
}
LEGACY_GENS = {   # display → 이전 세대 (데이터 폴더 코드, 라벨) — 은퇴일: 원장 GOLDENSET_RETIRED
    "RV": [{"code": "RV", "gen": "골든셋 v1 · 806문항 — 2026-07-20 은퇴(정답키 공개, 참고용)"}],
    "RC": [{"code": "RC", "gen": "골든셋 v1.1 · 891문항 — 2026-07-20 은퇴(정답키 공개, 참고용)"}],
}
HIDDEN_CODES = {"EE"}   # 자동 테스트 전용 제품 — 화면에서 숨김 (E2E가 쓰고 지나가는 자리)


def display_of(code):
    return PRODUCT_META.get(code, {}).get("display", code)


def _worker_alive(code):
    """제품별 실행 주체 생존 — 상태가 RUNNING인데 실행 주체가 없으면 '유령 RUNNING'.
    [수리 2026-08-13 난희 지적] 멈춰 있는데 돌고 있는 것처럼 보이던 문제.
    [수리 2026-08-13 2차] auto_run pid 파일만 보면 nohup으로 도는 보조 작업(구멍 메우기 등)을
    '유령'으로 오판 — 진행 파일이 최근(10분 내) 갱신됐으면 실행 주체가 있는 것."""
    pf = ROOT / "results" / f"_run_{code}.pid"
    if pf.exists():
        try:
            pid = int(pf.read_text().strip())
            st = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)],
                                capture_output=True, text=True).stdout.strip()
            if st and not st.startswith("Z"):   # 좀비(Z)는 죽은 것
                return True
        except Exception:
            pass
    # 폴백: 진행 파일 신선도 — 배치마다 갱신되므로 최근 갱신 = 뛰는 중
    pg = ROOT / "results" / f"_progress_{code}.json"
    try:
        import time
        return (time.time() - pg.stat().st_mtime) < 600
    except Exception:
        return False


def _qa_ver(p):
    """외부QA 파일의 vN — 최신 선택은 반드시 이 숫자로 (import_qa._ver_of와 동일 규칙 [P1-2])"""
    m = re.search(r"_v(\d+)\.xlsx$", p.name)
    return int(m.group(1)) if m else 0


def api_state():
    import os
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    # 제품 1뎁스 뷰모델: display 제품 → {현역 트랙 코드, 세대 라벨, 이전 세대들}
    st["_products"] = {}
    for code, ps in st["products"].items():
        if code in HIDDEN_CODES:
            continue
        meta = PRODUCT_META.get(code, {"display": code, "product_name": code, "gen": "현역"})
        if code == "CI":   # vault 동기화분에서 최신 회차 실측을 라벨에 반영 (하드코딩 금지)
            try:
                best = None
                for d in sorted((ROOT / "data" / "CI" / "08_scoring").glob("score_CI_r2_*")):
                    rp = d / "score_report.json"
                    if not rp.exists():
                        continue
                    rep = json.loads(rp.read_text(encoding="utf-8"))["results"]
                    n = sum(1 for r in rep if r.get("검색") != "해당없음(E형)")
                    t5 = sum(1 for r in rep if r.get("검색") in ("hit_top1", "hit_top5"))
                    if n and (best is None or t5 / n > best):
                        best = t5 / n
                if best is not None:
                    meta = {**meta, "gen": f"r2 검색축 채점 완료(top5 {best:.1%} · 앵커 확정 33.3%→56.7%) — 생성축 응시 대기"}
                else:
                    meta = {**meta, "gen": "r2 발행 완료(488문항) — 응답로그 대기"}
                # 생성축 이중판정 실시간 진행 — 체크포인트/확정 파일에서 즉석 계산 (화면 15초 자동 갱신)
                # [수리 2026-09-01] 특정 폴더 하드코딩 → 생성축 폴더 중 '가장 최근에 움직인' 것을 자동 추적
                # (회차가 늘어도 관제탑이 항상 현재 도는 판정을 보여준다 — 난희 지적)
                _gdirs = sorted((ROOT / "data" / "CI" / "08_scoring").glob("score_CI_*생성축*"),
                                key=lambda p: max([f.stat().st_mtime for f in p.glob("*")] or [0]))
                gdir = _gdirs[-1] if _gdirs else (ROOT / "data" / "CI" / "08_scoring" / "score_CI_r2_생성축")
                _rnd = gdir.name.replace("score_CI_", "").replace("_생성축", "")
                if gdir.exists():
                    def _jn(p):
                        # [2026-09-02] 샤드 병렬 실행(judge_x.shardKofN.json.ckpt)도 합산 — 문항 ID 기준 중복 제거
                        ids = set()
                        cands = [p] + sorted(p.parent.glob(p.name.replace(".json.ckpt", ".shard*of*.json.ckpt")))
                        for q in cands:
                            try:
                                d_ = json.loads(q.read_text(encoding="utf-8"))
                                ids |= set((d_.get("verdicts", d_) if isinstance(d_, dict) else {}).keys())
                            except Exception:
                                pass
                        return len(ids)
                    kimi_fin = gdir / "judge_kimi_v1_1.json"
                    kimi_ck = gdir / "judge_kimi_v1_1.json.ckpt"
                    rev_fin = gdir / "judge_claude_review.json"
                    rev_ck = gdir / "judge_claude_review.json.ckpt"
                    _fin = gdir / "최종판정_488.json"
                    if rev_fin.exists() and _fin.exists():
                        try:
                            _v = json.loads(_fin.read_text(encoding="utf-8"))
                            # 비E형만 집계 (E형 부재인정은 별도 지표) — 라벨 오해 방지
                            import openpyxl as _ox
                            _led = sorted((ROOT / "data" / "CI" / "05_unified_ledger").glob("*통합대장_488*.xlsx"))
                            _et = {}
                            if _led:
                                _ws = _ox.load_workbook(_led[-1], read_only=True)["골든셋_전체"]
                                _h = [N(c) for c in next(_ws.iter_rows(max_row=1, values_only=True))]
                                for _r in _ws.iter_rows(min_row=2, values_only=True):
                                    _et[N(_r[0])] = "E" in N(_r[_h.index("유형")])
                            _g = [i for i in _v if not _et.get(i)]
                            _p = sum(1 for i in _g if _v[i].get("최종") == "합격")
                            _e = sum(1 for i in _v if _et.get(i) and _v[i].get("최종") in ("0점", "환각"))   # [2026-09-02] 신형 라벨 '환각' 포함
                            _sum = f"비E형 합격 {_p}/{len(_g)} ({_p/max(1,len(_g)):.1%}) · E환각 {_e}"
                        except Exception:
                            _sum = "확정"
                        # 표 제목은 라벨의 " — " 앞부분만 쓴다 → 회차명을 제목부에 넣어야 보인다
                        meta = {**meta, "gen": meta["gen"].split(" — ")[0]
                                + f" · {_rnd} 생성축({_sum}) — 다음 로그 대기"}
                    elif rev_fin.exists():
                        meta = {**meta, "gen": meta["gen"].split(" — ")[0] + f" — {_rnd} 생성축 이중판정 ✅ 완료 (확정 집계 중)"}
                    elif kimi_ck.exists() and rev_ck.exists() and not kimi_fin.exists():
                        # [2026-09-02] 두 판정자가 병렬로 뛰는 경우 — 둘의 진행을 함께 보인다 (기존 분기는 순차 실행 가정)
                        meta = {**meta, "gen": meta["gen"].split(" — ")[0]
                                + f" — {_rnd} 생성축 이중판정 진행 중: Kimi {_jn(kimi_ck)}/488 · claude {_jn(rev_ck)}/488"}
                    elif rev_ck.exists():
                        meta = {**meta, "gen": meta["gen"].split(" — ")[0] + f" — {_rnd} 생성축 판정: Kimi 완료 · claude 검토 {_jn(rev_ck)}/488"}
                    elif kimi_fin.exists():
                        meta = {**meta, "gen": meta["gen"].split(" — ")[0] + f" — {_rnd} 생성축 판정: Kimi 488/488 완료 · claude 교차 검토 대기"}
                    elif kimi_ck.exists():
                        meta = {**meta, "gen": meta["gen"].split(" — ")[0] + f" — {_rnd} 생성축 판정 진행 중: Kimi {_jn(kimi_ck)}/488"}
            except Exception:
                pass
        st["_products"][meta["display"]] = {
            "code": code, "name": meta["product_name"], "gen": meta["gen"],
            "legacy": LEGACY_GENS.get(meta["display"], []),
        }
        # G20: 외부 Q&A 별도 트랙 현황 — 최신 = 버전 숫자 기준 (문자열 정렬은 문항 수 자릿수에 속음 [P1-2])
        papers = list((ROOT / "data" / code / "external_qa").glob(f"외부QA_시험지_{code}_*문항_v*.xlsx"))
        latest = max(papers, key=_qa_ver) if papers else None
        pm = re.search(r"_(\d+)문항_", latest.name) if latest else None
        ps["_qa"] = {"paper": N(latest.name), "n": int(pm.group(1)) if pm else None} if latest else None
        ps["_worker"] = _worker_alive(code)   # RUNNING 표시의 진위 판정용
        try:
            ps["_paper"] = _paper_track(code, ps)   # 새 세대 시험지 제작 트랙(r3~) 배지
        except Exception as _e:
            ps["_paper"] = {"gen": "r?", "stage": "상태 확인 실패", "tail": str(_e)}
    # 모델 모드 부가
    try:
        from model_adapter import detect_mode, effective_recheck_rate
        m = detect_mode()
        if os.environ.get("ORCH_MOCK") == "1":
            label, cls = "연습 모드 — 가짜 AI (공짜)", "practice"
        elif m["mode"] == 0:
            label, cls = "모델 미연결 — 실전모드_켜기 실행 필요", "off"
        else:
            parts = []
            if m["have"].get("generator"): parts.append("출제 claude")
            if m["have"].get("judge"): parts.append("채점 Kimi" if m["mode"] >= 2 else "채점 claude(신규세션)")
            if m["have"].get("reviewer"): parts.append("교차 codex")
            label, cls = "실전 모드 — " + " · ".join(parts), "live"
        st["_mode"] = {"mode": m["mode"], "label": label, "cls": cls,
                       "plan": m["plan"], "recheck": effective_recheck_rate()}
    except Exception as e:
        st["_mode"] = {"mode": "?", "label": "상태 확인 실패", "cls": "off", "error": str(e)}
    # 킬스위치: HALTED 제품 수
    # 의도적 잠금(정책 보류)은 사고 카운트에서 제외 — 헤더 '사고 N'은 진짜 사고만
    st["_halt_count"] = sum(1 for p in st["products"].values()
                            if p["status"] == "HALTED"
                            and not str(p.get("halt_reason") or "").startswith("의도적 잠금"))
    return st


def api_ledger(n=60):
    """원장 테일 — 화면 표시용. 테스트 전용 제품(EE·ZZ) 행은 숨김 [P1-5]
    (원장 파일 자체는 append-only 그대로 — 표시만 거른다. 과거 누적 테스트 소음이 원장의 60%)"""
    p = ROOT / "ledger.jsonl"
    if not p.exists():
        return []
    hidden = HIDDEN_CODES | {"ZZ", "TT"}
    out = []
    for x in reversed(p.read_text(encoding="utf-8").strip().splitlines()):
        try:
            r = json.loads(x)
        except Exception:
            continue   # 손상 행 1개로 화면 전체가 백지 되지 않게 (전수검수 F3 계열)
        if r.get("product") in hidden:
            continue
        out.append(r)
        if len(out) >= n:
            break
    return out


def api_vertex():
    """Vertex 대조군 탭 — 자사 r4·r5와 Vertex 세 판(기본값·옵션 변경·자체 문서)을 같은 잣대로 한 표에. 수치는 채점 산출물(_분석.json·score_report·응답로그)에서 즉석 계산.
    [2026-09-09 난희] Vertex 자료는 CI 회차 흐름과 성격이 달라(대조군) 별도 탭으로."""
    import statistics as _st
    ci = ROOT / "data" / "CI" / "08_scoring"
    panels = [("자사 r4 (9/1)", "score_CI_r2-2_생성축", None, "팀장님 v1 청킹 · 하이브리드+리랭크 폭50+ReAct · 2단 판단 · 임계 0.7"),
              ("자사 r5 (9/4)", "score_CI_r2-3_생성축", None, "v2 재청킹 색인 · 임계 0.5 · 그 외 r4 동일"),
              ("Vertex 기본값 판 (9/3)", "score_CI_vertex_r2", "vertex_r2/CI_골든셋_r2v2_Vertex_응답로그_*.json", "같은 21,354 청크 · 옵션 미변경 · 내장 요약 stable"),
              ("Vertex 옵션 변경 판 (9/4)", "score_CI_vertex_r2_knobs", "vertex_r2/*손잡이판*응답로그_*.json", "같은 청크 · 풀50→Ranking API→answer API(모델 고정·저관련 폴백·인용·grounding)"),
              ("Vertex 자체 문서 판 (9/7)", "score_CI_vertex_b2_digital", "score_CI_vertex_b2_digital/CI_Vertex_b2_digital_응답로그*.json", "원본 xlsx 2종→문서 3,009 · 디지털 파서(무료) · Vertex 자체 구절 추출 · answer API 네이티브")]
    cols = []
    for label, folder, logglob, shape in panels:
        d = ci / folder; row = {"판": label, "형상": shape}
        try:
            a = json.loads((d / "_분석.json").read_text(encoding="utf-8"))
            row.update({"합격률": a["비E형"]["합격률"], "합격": a["비E형"]["합격"], "부분": a["비E형"]["부분"], "0점": a["비E형"]["0점"],
                        "E부재": a["E형"].get("부재인정"), "E환각": a["E형"].get("환각"), "앵커": a["앵커 120"].get("합격률"),
                        "과잉거절": a["과잉 거절"].get("그중 합격 실패"), "적중군": a["검색 적중/미적중 분리"]["적중군"]["합격률"],
                        "미적중군": a["검색 적중/미적중 분리"]["미적중군"]["합격률"], "일치": a["이중판정 일치(비E형)"]})
        except Exception as e:
            row["오류"] = str(e)[:80]
        try:
            rep = json.loads((d / "score_report.json").read_text(encoding="utf-8")); rep = rep.get("results", rep)
            seen = set(); rr = []
            for r in rep:
                if r.get("id") in seen: continue
                seen.add(r.get("id")); rr.append(r)
            ne = [r for r in rr if r.get("검색") != "해당없음(E형)" and not r.get("E형거절") and not r.get("E형환각")]
            t1 = sum(1 for r in ne if r.get("검색") == "hit_top1"); t5 = t1 + sum(1 for r in ne if r.get("검색") == "hit_top5")
            row.update({"검색_top1": f"{t1}/{len(ne)} ({t1/len(ne):.1%})" if ne else None, "검색_top5": f"{t5}/{len(ne)} ({t5/len(ne):.1%})" if ne else None})
            if "b2" in folder:
                try:
                    dd = json.loads((d / "score_report_검색축_문서.json").read_text(encoding="utf-8"))["results"]; seen2 = set(); ne2 = []
                    for r in dd:
                        if r.get("id") in seen2 or r.get("검색") == "해당없음(E형)": continue
                        seen2.add(r.get("id")); ne2.append(r)
                    t5d = sum(1 for r in ne2 if str(r.get("검색", "")).startswith("hit"))
                    row["검색_top5"] = f"구절(엄격) {row['검색_top5']} · 문서(관대) {t5d/len(ne2):.1%}" if ne2 else row["검색_top5"]
                    row["검색_주의"] = "문서 단위 hits — 청크 단위 자사와 직접 비교 불가"
                except Exception:
                    pass
        except Exception as e:
            row.setdefault("오류", str(e)[:80])
        if logglob:
            try:
                lf = sorted(ci.glob(logglob))[-1]; lg = json.loads(lf.read_text(encoding="utf-8"))["responses"]
                ok = [r for r in lg if not r.get("error") and isinstance(r.get("latency_ms"), dict)]
                def pct(k, q):
                    v = sorted(r["latency_ms"][k] for r in ok if r["latency_ms"].get(k) is not None)
                    return v[min(len(v) - 1, int(len(v) * q))] / 1000 if v else None
                tot = "total" if ok and "total" in ok[0]["latency_ms"] else None
                s50 = pct("search", .5); a50 = pct(tot, .5) if tot else None; a95 = pct(tot, .95) if tot else None
                if a50 is None:  # 기본값 판: search+answer 합
                    v = sorted((r["latency_ms"].get("search") or 0) + (r["latency_ms"].get("answer") or 0) for r in ok)
                    a50 = v[len(v) // 2] / 1000 if v else None; a95 = v[int(len(v) * .95)] / 1000 if v else None
                row["속도"] = f"검색 {s50:.2f}s · 답변 완료 P50 {a50:.1f}s / P95 {a95:.1f}s (클라이언트 왕복)" if s50 is not None else None
            except Exception as e:
                row["속도"] = None
        else:
            row["속도"] = "답변 완료 31s P50 (서버 내부, 플랫폼 보고) · 검색 단계 28.7s P50 (9/8 v3 로그 search_ms)" if "r2-3" in folder else "답변 완료 31s P50 (서버 내부, 플랫폼 보고)"
        cols.append(row)
    docs = []
    for rel, title in [("CI_Vertex비교_보고_20260903.md", "본부장님용 전체 보고서 (4열 · 속도 A/B안 · 3계층)"),
                       ("CI_Vertex비교_팀장님공유_20260907.md", "팀장님 공유 정리 (강점/보강 · 유형별 분해)"),
                       ("CI_청킹비교_자사v2_vs_Vertex_20260907.md", "청킹 비교 — 자사 v2 청크 vs Vertex 구절"),
                       ("vertex_r2/CI_Vertex_세팅기록_2026-09-03.md", "세팅 기록 — 세 판의 형상·옵션·결과"),
                       ("CI_본부장미션_Vertex비교_분석_20260902.md", "9/2 미션 분석 · 되묻기"),
                       ("score_CI_vertex_b2_digital/CI_성적_Vertex_4열비교집계.xlsx", "4열 집계 xlsx (유형별 분해 시트)")]:
        f = ci / rel
        if f.exists():
            import datetime as _dt
            docs.append({"name": rel, "title": title, "mtime": _dt.datetime.fromtimestamp(f.stat().st_mtime).strftime("%m/%d %H:%M"), "viewable": f.suffix == ".md"})
    return {"panels": cols, "docs": docs,
            "미션": "본부장님(9/2): Vertex와 비교 · 속도 1~2초(=답변 완료 4~5초, Vertex 수준으로 읽힘 — 확인 전) · 사용자 눈높이 Vertex만큼",
            "한줄": "자사 청크를 준 Vertex는 −11.5%p, 원본을 준 Vertex는 −1.4%p → 격차의 본체는 청킹·색인. 자사가 지키는 것: E형 부재 인정·수치·근거 단위. 따라갈 것: 속도(검색 단계 28.7s)·FAQ/표 청킹",
            "자원": "GCP nhkim-test · 데이터 스토어 3종 · 예산 알림 ₩20,000 · 실험 후 삭제하지 않고 상시 대조군으로 유지(난희 결정) · 추가 청구 0~수백 원"}


def api_vertex_doc(name):
    ci = ROOT / "data" / "CI" / "08_scoring"
    allow = {"CI_Vertex비교_보고_20260903.md", "CI_Vertex비교_팀장님공유_20260907.md", "CI_청킹비교_자사v2_vs_Vertex_20260907.md",
             "vertex_r2/CI_Vertex_세팅기록_2026-09-03.md", "CI_본부장미션_Vertex비교_분석_20260902.md"}
    if name not in allow:
        return None
    return (ci / name).read_text(encoding="utf-8")


def _paper_track(code, ps):
    """새 세대 시험지 제작 트랙(채점센터, 2026-09-10 난희 지적: 관제판이 '실물 채점'에 서 있어 r3 착수가 안 보임).
    새 시험지는 파이프라인 단계(①~⑨)가 아니라 금고 data/<code>/09_r<N>_시험지/ 폴더로 진행되므로,
    폴더 실물(설계서·파일럿·검증·발행본)과 열린 게이트로 단계를 읽어 진행선 배지 하나로 보인다."""
    import glob as _g
    dirs = sorted(_g.glob(str(ROOT / "data" / code / "09_r[0-9]*_시험지")))
    if not dirs:
        return None
    d = Path(dirs[-1]); gen = re.search(r"09_(r\d+)_", d.name).group(1)
    design = sorted(d.glob(f"{code}_{gen}_시험지_설계_v*.md"))
    pilots = sorted(d.glob(f"{code}_{gen}_파일럿_*문항_v*.xlsx"))
    pub = sorted((ROOT / "data" / code / "08_scoring").glob(f"{code}_질문셋_발행본_v{gen[1:]}_*.xlsx"))
    verdict = None
    vj = d / "_파일럿_verify.json"
    if vj.exists():
        try:
            verdict = json.loads(vj.read_text(encoding="utf-8")).get("verdict")
        except Exception:
            verdict = "?"
    gate = next((g["id"] for g in ps.get("open_gates", []) if g["id"].upper().startswith(gen.upper())), None)
    n_pilot = int(re.search(r"_(\d+)문항_", pilots[-1].name).group(1)) if pilots else 0
    batches = sorted((d / "배치").glob(f"{code}_{gen}_골든셋_*문항_v*.xlsx")) if (d / "배치").is_dir() else []
    n_batch = sum(int(m.group(1)) for b in batches for m in [re.search(r"_(\d+)문항_", b.name)] if m)
    pilot_done = (ROOT / "검수큐" / "완료" / f"GATE_{gen.upper()}PILOT_{code}.md").exists()
    target = 300   # 설계서 v1_0 §1 신규 본문항(파일럿 30 포함)
    sel300 = (d / f"{code}_{gen}_통합대장_본문항300_내부봉인.xlsx").exists()
    if pub:
        stage, tail = "발행 완료 — 응시 대기", f"팀장님께 발행본(ID·질문)만 전달: {N(pub[-1].name)}"
    elif sel300:
        stage = f"본문항 {target} 확정 · 발행 준비"
        tail = "본문항 300 선정 완료(예비는 보관) → 교차 검토 → 쌍둥이 40·앵커 120·E형 50 병합 → 발행본 v3_0(ID·질문만) → 팀장님·Vertex 응시"
    elif batches or (pilot_done and pilots):
        made = min(n_pilot + n_batch, target)
        stage = f"본출제 진행 중 {made}/{target}" + (f" ({len(batches)}차수)" if batches else "")
        tail = ("파일럿 승인(난희) → 채점센터 직접 출제 25문항×11차수 → 기계 게이트 → 쌍둥이 40·앵커 120·E형 50 병합 → 발행본. "
                f"지금: {len(batches)}차수 조립됨 · 남은 본문항 {max(0, target - made)}")
    elif gate and pilots:
        stage, tail = f"파일럿 {n_pilot}문항 검수 대기", f"지금: 검수큐 카드 {gate} → [👁 실물 보고 결정]에서 첫 탭(0_검수용)으로 {n_pilot}문항 확인 → 승인/반려. 승인 뒤 본출제 착수"
    elif pilots:
        stage, tail = f"파일럿 {n_pilot}문항 검증 {verdict or '중'}", "기계 게이트 통과 후 검수 카드가 뜹니다"
    elif design:
        stage, tail = "설계 중", f"설계서 {N(design[-1].name)} 작성 중"
    else:
        stage, tail = "착수", "재료 선정 중"
    return {"gen": gen, "stage": stage, "tail": tail, "design": N(design[-1].name) if design else None,
            "pilot": N(pilots[-1].name) if pilots else None, "verdict": verdict, "gate": gate, "dir": N(d.name), "batches": len(batches), "made": n_pilot + n_batch, "target": target}


def api_queue():
    import time
    q = ROOT / "검수큐"
    cards = []
    # 열린 게이트 명세 — 이미 닫힌(승인/반려 완료) 게이트의 유령 카드를 청소하기 위해
    try:
        _st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
        open_ids = {g["id"] for ps in _st["products"].values() for g in ps.get("open_gates", [])}
    except Exception:
        open_ids = None
    if q.is_dir():
        for f in sorted(q.glob("*.md")):
            body = f.read_text(encoding="utf-8")
            # 유령 카드 청소 — 게이트는 닫혔는데 카드만 남으면(늦은 소견 재생성 등) 사람이
            # 죽은 카드에 반려를 눌러 사유가 소실되는 사고. 발행 직후 레이스 방지: 2분 유예.
            if (open_ids is not None and f.name.startswith("GATE_")
                    and f.stem.removeprefix("GATE_") not in open_ids
                    and time.time() - f.stat().st_mtime > 120):
                done = q / "완료" / f.name
                done.parent.mkdir(exist_ok=True)
                if done.exists() and "## 설계본부 소견" in body:
                    # [P3] 2회차 재생성 소견도 보존 — 완료본에 (구)소견이 있어도 새 소견이
                    # 다른 내용이면 이어붙인다 (기존: 구 소견 존재 시 새 소견 무통보 폐기)
                    seg = body[body.index("## 설계본부 소견"):].strip()
                    dtext = done.read_text(encoding="utf-8")
                    if seg not in dtext:
                        done.write_text(dtext.rstrip() + "\n\n" + seg + "\n", encoding="utf-8")
                elif not done.exists():
                    done.write_text(body, encoding="utf-8")
                f.unlink()
                continue
            kind = "GATE" if f.name.startswith("GATE_") else "INPUT"
            gate_id = f.stem.removeprefix("GATE_")
            m = re.search(r"제품: (\w+)", body)
            acks = re.findall(r"- \[ \] (?:ack: )?(.+)", body)
            prod_s = m.group(1) if m else "?"
            uploaded = None
            if kind == "INPUT":   # 코퍼스처럼 여러 파일을 나눠 올리는 카드 — 현황을 화면에
                sub = "corpus" if "CORPUS" in f.stem else "08_scoring"
                d = ROOT / "data" / prod_s / sub
                uploaded = sorted(p.name for p in d.glob("*")
                                  if p.is_file() and not p.name.startswith(".")) if d.is_dir() else []
            cards.append({"file": N(f.name), "kind": kind, "id": gate_id,
                          "product": prod_s,
                          "title": N(body.splitlines()[0].lstrip("# ")),
                          "body": body, "acks": acks if kind == "GATE" else [],
                          "uploaded": uploaded})
    return cards


def api_scores():
    """회차 성적 미니보드 — results/score_<P>_<r>/score_report.json 실측 집계"""
    out = {}
    for d in sorted(list((ROOT / "results").glob("score_*_r*"))
                    + list((ROOT / "results").glob("score_*_base*"))):
        # 정식 회차(rN) + 기준선(baseN — 우리가 미리 잰 참고분, 화면에서 별도 줄로 표시)
        m = re.fullmatch(r"score_([A-Z0-9]+)_(r\d+|base\d+)", d.name)   # 병기(_v12 등) 제외
        if not m:
            continue
        prod, rnd = m.group(1), m.group(2)
        if prod == "CI":
            continue   # CI 정본은 vault(data/CI) 어댑터 — results의 옛 실패 잔해(전건 miss)가 0%로 덮어쓰지 않게
        rp = d / "score_report.json"
        if not rp.exists():
            continue
        try:
            rep = json.loads(rp.read_text(encoding="utf-8"))
        except Exception:
            continue   # 쓰는 중/손상 회차 하나로 성적판 전체가 500 되지 않게
        c = Counter(r.get("검색") for r in rep)
        g = Counter(r.get("생성") for r in rep)
        top1 = c.get("hit_top1", 0)
        # 검색축만 회차 감지 — 회차 리포트에 '검색축만' 명기 여부로 판단 (생성 수치를 미응시로 표기)
        search_only = any("검색축만" in md.read_text(encoding="utf-8")[:2500]
                          for md in d.glob("*리포트*.md"))
        # 지표 툴팁용 분석(엄격/결측 제외/합집합) — report_gen 이 회차마다 생성
        anal = None
        ap = d / "analysis.json"
        if ap.exists():
            try:
                anal = json.loads(ap.read_text(encoding="utf-8"))
            except Exception:
                pass
        out.setdefault(prod, {})[rnd] = {
            "top1": top1, "top5": top1 + c.get("hit_top5", 0),
            "pass": ("미응시" if search_only else g.get("pass", 0)),
            "partial": ("미응시" if search_only else g.get("partial", 0)),
            "검색축만": search_only, "분석": anal,
            "E환각": ("미응시" if search_only else sum(1 for r in rep if r.get("E형환각"))),
            "E거절": ("미응시" if search_only else sum(1 for r in rep if r.get("E형거절"))),
            "n": len(rep),
            # G20: 외부 Q&A 별도 트랙은 기계 내용 대조 채점 — 라벨로 구분 (골든셋 채점기 아님)
            "scorer": ("내용 대조(Q&A 트랙)" if any(d.glob("외부QA_r*_리포트.md"))
                       else "run_score_v11"),
        }
    # CI — 채점센터 vault(data/CI) 실측 집계. vault의 score_report.json은 {"meta","results"} 형식
    ci_dir = ROOT / "data" / "CI" / "08_scoring"
    if ci_dir.exists():
        for d in sorted(ci_dir.glob("score_CI_*")):
            rp = d / "score_report.json"
            if not rp.exists():
                continue
            try:
                raw = json.loads(rp.read_text(encoding="utf-8"))
                rep = raw.get("results", raw) if isinstance(raw, dict) else raw
            except Exception:
                continue
            # [2026-09-09 난희 지적 "비교 불가가 뭐냐"] 검색축 리포트는 쌍둥이 40문항이 두 번(원문항 목록+쌍둥이 매핑) 실려 528행,
            # 생성축·Vertex는 488행 → 같은 시험지인데 '문항 수 다름 → 비교 불가'로 오표시. ID 기준 첫 행만 남겨 전 회차 488 기준으로 통일.
            _seen = set(); _dedup = []
            for _r in rep:
                _k = _r.get("id")
                if _k in _seen:
                    continue
                _seen.add(_k); _dedup.append(_r)
            rep = _dedup
            m = re.fullmatch(r"score_CI_(r\d+|base\d+)", d.name)
            rnd = m.group(1) if m else d.name.replace("score_CI_", "")
            c = Counter(r.get("검색") for r in rep)
            g = Counter(r.get("생성") for r in rep)
            top1 = c.get("hit_top1", 0)
            top5 = top1 + c.get("hit_top5", 0)
            # [2026-09-07] 후보 50 덤프처럼 hits가 6~50위까지 실린 리포트: 채점기는 rank≤50을 전부 hit_top5로 세므로
            # '적중순위'로 다시 세어 top5는 1~5위만, top50(1~50위 누적)은 별도 칸에 — 누적은 하되 오독은 막는다
            ranks = [r.get("적중순위") for r in rep if isinstance(r.get("적중순위"), int)]
            top50 = None
            if ranks and max(ranks) > 5:
                top1 = sum(1 for k in ranks if k == 1); top5 = sum(1 for k in ranks if k <= 5); top50 = len(ranks)
            search_only = all(r.get("생성") in (None, "미응시") for r in rep)   # 로그 실측으로 판정
            # [2026-09-10 난희] 회차가 많아 월 필터 필요 → 채점일(meta) 기준 월 태그. 없으면 파일 mtime
            try:
                _meta = raw.get("meta", {}) if isinstance(raw, dict) else {}
                _date = str(_meta.get("채점일") or "")[:10] or __import__("datetime").date.fromtimestamp(rp.stat().st_mtime).isoformat()
            except Exception:
                _date = ""
            out.setdefault("CI", {})[rnd] = {
                "date": _date, "month": _date[:7],
                "top1": top1, "top5": top5, **({"top50": top50} if top50 is not None else {}),
                "pass": ("미응시" if search_only else g.get("pass", 0)),
                "partial": ("미응시" if search_only else g.get("partial", 0)),
                "검색축만": search_only,
                "분석": {"사람판독_도달률": "58.2% (미적중 708건 전건판독 확정)" if rnd == "r1" else None,
                         "출처": "채점센터 vault(data/CI) 동기화분"},
                "E환각": ("미응시" if search_only else sum(1 for r in rep if r.get("E형환각"))),
                "E거절": ("미응시" if search_only else sum(1 for r in rep if r.get("E형거절"))),
                "n": len(rep), "scorer": "채점센터 vault",
                # 줄(lane) — 정식 회차(생성축 포함) / 검색축 실험(색인·옵션 실험, 검색만) / Vertex 대조군. Δ는 같은 줄 안에서만 의미 있음
                # [2026-09-09 난희 "비교 불가 값이 뭐냐"] r1 시험지(1,033문항) 회차는 r2(488)와 시험지가 달라 건수 비교가 무의미 → 별도 줄(참고)
                "lane": ("이전 세대 — r1 시험지 1,033문항 (참고)" if len(rep) > 1000
                         else "Vertex 대조군" if "vertex" in rnd
                         else "검색축 실험" if search_only and not re.fullmatch(r"r\d+(-\d+)?(_생성축)?", rnd)
                         else "정식 회차"),
            }
        # top50 진단 — 문항별 리포트 없이 회차인덱스의 집계만 존재 → 진단 행으로 병기
        try:
            import glob as _g
            idxs = list(ci_dir.glob("*회차인덱스*.json"))
            if idxs and "base50" not in out.get("CI", {}):
                idx = json.loads(idxs[0].read_text(encoding="utf-8"))
                for ent in idx.get("회차", []):
                    rname = str(ent.get("회차"))
                    if not rname.startswith("top50진단"):
                        continue
                    key = "base50" if rname == "top50진단" else "r2진단50"
                    mm = re.search(r"(\d+)\s*/\s*(\d+)", str(ent.get("채점", {}).get("기계대조_top50", "")))
                    if mm:
                        out.setdefault("CI", {})[key] = {
                            "date": str(ent.get("일자") or ""), "month": str(ent.get("일자") or "")[:7],
                            "lane": ("진단 — r1 시험지 top50 (참고)" if key == "base50" else "진단 — r2 시험지 top50 (참고)"),
                            "top1": None, "top5": int(mm.group(1)), "n": int(mm.group(2)),
                            "pass": "미응시", "partial": "미응시", "검색축만": True,
                            "E환각": "미응시", "E거절": "미응시",
                            "scorer": ent.get("채점", {}).get("표시", "진단(top_k=50·개선 전 형상)"),
                            "분석": {"note": ent.get("채점", {}).get("미적중708_분해")
                                             or ent.get("채점", {}).get("미적중_분해"),
                                     "출처": "채점센터 vault 회차인덱스"}}
        except Exception:
            pass
    # CIQA 기준선 라벨 — base1/2/3은 재응시가 아니라 서로 다른 기준선 3종 (사전 실측 참고선)
    _ciqa_names = {"base1": "문자검색(FAQ 포함) — 사전 기준선", "base2": "매뉴얼만 문자검색 — 사전 기준선",
                   "base3": "맥락 질문 14문항 — 사전 기준선"}
    for rnd, nm_ in _ciqa_names.items():
        if rnd in out.get("CIQA", {}):
            out["CIQA"][rnd].setdefault("분석", {})
            if isinstance(out["CIQA"][rnd]["분석"], dict) or out["CIQA"][rnd]["분석"] is None:
                out["CIQA"][rnd]["분석"] = {**(out["CIQA"][rnd]["분석"] or {}), "기준선": nm_}
    # 문서 기록 이관 — 로컬 재채점본이 없는 회차를 인수인계 보고서 수치로 병기 (출처 라벨)
    for f in (ROOT / "results").glob("기록이관_*.json"):
        prod = f.stem.split("_", 1)[1]
        try:
            rec = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        for rnd, v in rec.items():
            if rnd.startswith("_") or rnd in out.get(prod, {}):
                continue   # 로컬 실측이 항상 우선 — 이관본은 빈 회차만 채움
            out.setdefault(prod, {})[rnd] = {**v, "scorer": "기록 이관",
                "분석": {"top1": v.get("top1"), "top5": v.get("top5"), "n": v.get("n"),
                         "note": v.get("note"), "이관": True}}
    return out


def _scan_stage_files(code, sm, canon, gen_label=None):
    d = ROOT / "data" / code / sm["dir"]
    files = []
    if d.is_dir():
        fl = sorted((p for p in d.iterdir() if p.is_file() and not p.name.startswith(".")),
                    key=lambda p: p.name)

        def vkey(p):
            m = re.search(r"_v(\d+(?:_\d+)+)", p.name)
            return tuple(int(x) for x in m.group(1).split("_")) if m else (0,)
        best = max(fl, key=vkey).name if fl else None
        import datetime
        for p in fl:
            st_ = p.stat()
            files.append({"file": N(p.name), "version": "",
                          "canonical": canon.get(N(p.name), p.name == best),
                          "size": st_.st_size, "gen": gen_label,
                          "mtime": datetime.datetime.fromtimestamp(st_.st_mtime).strftime("%m-%d %H:%M"),
                          "path": f"{code}/{sm['dir']}/{p.name}"})
    return files


def api_catalog():
    """제품(1뎁스) → 단계 → 파일. 현역 세대 + 이전 세대(라벨 병기) 통합 스캔 (U1·U6)."""
    meta = json.loads((ROOT / "catalog" / "stage_meta.json").read_text(encoding="utf-8"))
    canon = {}
    mf = ROOT / "catalog" / "manifest.json"
    if mf.exists():
        for r in json.loads(mf.read_text(encoding="utf-8"))["files"]:
            if r.get("canonical"):
                canon[r["file"]] = True
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    out = {"products": {}}
    for code in st["products"]:
        if code in HIDDEN_CODES:
            continue
        disp = display_of(code)
        stages = []
        for sm in meta["stages"]:
            files = _scan_stage_files(code, sm, canon)                      # 현역 세대
            for lg in LEGACY_GENS.get(disp, []):                            # 이전 세대 (참고)
                files += _scan_stage_files(lg["code"], sm, canon, gen_label="v1·은퇴")
            stages.append({"no": sm["no"], "name": sm["name"], "gate": sm["gate"],
                           "what": sm["what"], "consumes": sm["consumes"],
                           "produces": sm["produces"], "tool": sm["tool"],
                           "file_count": len(files), "files": files})
        out["products"][disp] = {"stages": stages,
                                 "total_files": sum(s["file_count"] for s in stages)}
    return out


_MODEL_CACHE = {"ts": 0, "ids": None}


def _moonshot_models():
    """Kimi 가용 모델 목록 (1시간 캐시) — 단종·신모델 감지용. 실패 시 None(판단 보류)"""
    import time
    import urllib.request
    if time.time() - _MODEL_CACHE["ts"] < 3600:
        return _MODEL_CACHE["ids"]
    try:
        import os
        key = os.environ.get("JUDGE_KEY", "")
        req = urllib.request.Request("https://api.moonshot.ai/v1/models",
                                     headers={"Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=10) as r:
            ids = [m["id"] for m in json.loads(r.read().decode()).get("data", [])]
        _MODEL_CACHE.update(ts=time.time(), ids=ids)
    except Exception:
        _MODEL_CACHE.update(ts=time.time(), ids=None)
    return _MODEL_CACHE["ids"]


def _kimi_ver(mid):
    m = re.search(r"kimi-k([\d.]+)$", mid or "")
    return float(m.group(1)) if m else None


def _model_alert_card(engine, alert):
    """모델 단종·신모델 감지 → 검수큐 카드 발행 (같은 내용이면 중복 발행 안 함)"""
    import datetime
    qdir = ROOT / "검수큐"
    f = qdir / f"MODELALERT_{engine}.md"
    if f.exists() and alert in f.read_text(encoding="utf-8"):
        return
    # 사람이 닫은(완료로 이동) 알림은 같은 내용으로 재발행 안 함 — 새 모델이 나오면 내용이 달라져 다시 뜸
    done = qdir / "완료" / f"MODELALERT_{engine}.md"
    if done.exists() and alert in done.read_text(encoding="utf-8"):
        return
    qdir.mkdir(exist_ok=True)
    f.write_text(
        f"# MODELALERT_{engine} — 모델 교체 검토 필요\n"
        f"- 발행: {datetime.datetime.now().isoformat(timespec='seconds')} · 제품: 공통 · 단계: 운영\n\n"
        f"## 무엇을\n{alert}\n\n"
        f"## 처리 방법\n"
        f"- 교체하기로 하면: 저(Claude)에게 말하면 config 변경 + 규칙 C(캘리브레이션 재시험) 자동 처리\n"
        f"- 유지하기로 하면: 이 카드를 검수큐/완료 로 옮기면 끝 (성적 비교 보전)\n",
        encoding="utf-8")
    sys.path.insert(0, str(ROOT / "tools"))
    from olib import ledger_append
    ledger_append("MAINTENANCE", "MODEL_ALERT", "script:serve",
                  evidence={"engine": engine, "알림": alert})


def api_ai_status():
    """AI 팀 현황 — 역할별 엔진·연결 상태(🟢/⚪) + 제품별 투입 선택(ai_use 체크박스)"""
    import os
    from olib import load_config
    cfg = load_config()
    mock = os.environ.get("ORCH_MOCK") == "1"
    have = {}
    try:
        from model_adapter import detect_mode
        have = detect_mode(cfg, os.environ)["have"]
    except Exception:
        pass
    # role_ko = 본업. 앙상블에선 전원이 '추출'도 겸한다 — 라벨 앞머리는 화면(전략별)에서 붙임
    ROLE_META = [("generator", "병합·출제 대표", "claude"),
                 ("judge", "채점", "Kimi"),
                 ("reviewer", "교차 검토", "codex")]
    engines = []
    for role, role_ko, default_eng in ROLE_META:
        m = cfg.get("models", {}).get(role) or {}
        cmd = m.get("command", [])
        raw = " ".join([str(m.get("model", "")), m.get("provider", ""),
                        " ".join(cmd) if isinstance(cmd, list) else str(cmd)]).lower()
        if "kimi" in raw or "moonshot" in raw:
            eng = "Kimi"
        elif "codex" in raw or "gpt" in raw:
            eng = "codex"
        elif "claude" in raw or "anthropic" in raw:
            eng = "claude"
        else:
            eng = default_eng
        connected = bool(mock or have.get(role))
        if mock:
            how = "가짜 AI (연습 모드)"
        elif not m:
            how = "미설정 — config.yaml 에 없음"
        elif m.get("provider") == "cli":
            how = "구독 계정 (CLI)" if connected else "구독 CLI 미설치 — 계정 대기"
        else:
            how = "API 키" if connected else f"API 키 없음 ({m.get('api_key_env', '?')})"
        entry = {"role": role, "role_ko": role_ko, "engine": eng,
                 "connected": connected, "how": how, "model": m.get("model", "")}
        # 최신성 감시 (Kimi) — 자동 교체는 안 함: 채점 모델 교체 = 규칙 C(캘리브 재시험), 사람 결정
        if m.get("provider") == "moonshot" and connected and not mock:
            ids = _moonshot_models()
            if ids is not None:
                if m.get("model") not in ids:
                    entry["alert"] = f"⚠ {m.get('model')} 단종 — 목록에 없음, 교체 필요"
                else:
                    cur_v = _kimi_ver(m.get("model"))
                    top = max((v for v in (_kimi_ver(i) for i in ids) if v), default=None)
                    if cur_v and top and top > cur_v:
                        entry["alert"] = f"✨ kimi-k{top:g} 출시 — 교체는 사람 결정 (규칙 C: 교체 시 캘리브레이션 재시험)"
            if entry.get("alert"):
                _model_alert_card(eng, entry["alert"])   # 검수큐 카드로 사람 호출
        engines.append(entry)
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    use = {}
    for code, ps in st["products"].items():
        if code in HIDDEN_CODES:
            continue
        use[display_of(code)] = {
            "code": code,
            "ai_use": ps.get("ai_use") or {"generator": True, "judge": True, "reviewer": True},
            "strategy": ps.get("strategy", "ensemble"),
        }
    return {"mock": mock, "engines": engines, "products": use}


def api_runlog(code, n=8):
    """실행 기록 요약 — 원문은 파일(results/_run_*.log)에 저장, 화면엔 '챕터 전환'급만.
    이정표: 단계 결과(→)·재개·중단·완료·사고. 배치 카운트 잡음은 제외(진행선이 담당)."""
    if not re.fullmatch(r"[A-Z0-9]{1,8}", code or ""):
        return {"lines": []}
    p = ROOT / "results" / f"_run_{code}.log"
    if not p.exists():
        return {"lines": []}
    try:
        lines = p.read_text(encoding="utf-8", errors="replace").strip().splitlines()
    except Exception:
        return {"lines": []}
    KEEP = ("→", "체크포인트", "⏸", "⛔", "✅", "🤖", "🔁", "재개", "중단", "완료", "HALT")
    marks = [l for l in lines if any(k in l for k in KEEP) and "배치…" not in l]
    return {"lines": marks[-n:]}


def _race_started_at(code):
    """이번 경주의 시작 시각 — 재온보딩 시 갱신되는 ①감사 완료 시각(state.stage_history).
    이전 경주의 체크포인트·역할 기록이 새 경주 화면에 합산되는 것을 막는 기준.
    [난희 실측 2026-08-25] r2 재온보딩 후에도 codex가 '8/8 배치(100%)·막대 84%'로 표시 —
    8/21 재추출(rebasecmp) 잔재 파일이 글롭 합산에 섞여서. 이 시각 이전 기록은 화면에서 제외."""
    try:
        st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))["products"][code]
        ts = st["stage_history"]["CORPUS_AUDIT"]["done_at"]
        import datetime as _dt
        return _dt.datetime.fromisoformat(ts).timestamp() - 60   # 파일시각 오차 여유
    except Exception:
        return None


def _extractor_rows(code, prog=None):
    """추출자별 현황 — 체크포인트가 진실. 진행 파일(뛰는 중에만 갱신)이 없어도 읽힌다.
    [난희 요청 2026-08-10] 멈춤·사고 상태에서도 '누가 어디까지' 보여야 한다.
    [수리 2026-08-13 난희 실측] 구멍 메우기(_gapfaq 등 태그 체크포인트)가 도는데 패널이 안 보임 —
    본 추출 파일(_ckpt_coverage_CI.json)만 읽어서. 태그 파일 전부 합산한다.
    단, 합산은 '이번 경주' 안에서만 — 이전 경주 잔재는 _race_started_at 기준으로 제외."""
    roles = (prog or {}).get("roles") or {}
    tt_any = max([(v or {}).get("total") or 0 for v in roles.values()] or [0])
    names = {"generator": "claude", "judge": "Kimi", "reviewer": "codex"}
    agg = {}   # role → {done,total,units,fails} (여러 구간 합산)
    import time as _time
    race = _race_started_at(code)
    for ck in sorted((ROOT / "results").glob(f"_ckpt_coverage_{code}*.json")):
        try:
            c = json.loads(ck.read_text(encoding="utf-8"))
            mt = ck.stat().st_mtime
        except Exception:
            continue
        if race and mt < race:
            continue   # 이전 경주의 체크포인트 — 이번 경주 합산에서 제외
        tagged = ck.stem != f"_ckpt_coverage_{code}"   # 태그 파일 = 구멍 메우기 등 부가 구간
        for role in names:
            v = c.get(role)
            if not isinstance(v, dict):
                continue
            a = agg.setdefault(role, {"done": 0, "total": 0, "units": 0, "fails": 0, "chunks_est": 0})
            a["done"] += v.get("done", 0)
            a["total"] += int(v.get("n_batches") or (0 if tagged else tt_any))
            a["units"] += len(v.get("units", []))
            a["fails"] += len(v.get("fails") or [])
            # 이 구간에서 지나간 청크 수 근사 (배치 비율 × 구간 청크) — '한 경주 %' 분자용
            nb, nc = int(v.get("n_batches") or 0), int(v.get("n_chunks") or 0)
            if nb and nc:
                a["chunks_est"] += int(nc * min(1.0, v.get("done", 0) / nb))
            # 주자별 최신 움직임 시각 — "누가 진짜 뛰고 있나"를 주자 단위로 (전수조사 2026-08-13)
            a["mtime"] = max(a.get("mtime", 0), mt)
    # [난희 지적 2026-08-13] Kimi·codex가 안 보임 — 체크포인트가 정리되면 줄이 사라지고,
    # 이어달리기 대기조는 애초에 기록이 없어 화면에서 증발. 편성된 AI는 '대기'로라도 항상 표시.
    active_roles = set()
    try:
        import os as _os
        from model_adapter import detect_mode
        have = detect_mode(None, _os.environ)["have"]
        st_ = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))["products"].get(code, {})
        use = st_.get("ai_use") or {}
        active_roles = {r for r in ("generator", "judge", "reviewer")
                        if have.get(r) and use.get(r, True)}
    except Exception:
        pass
    # [난희 지적 2026-08-13 2차] %는 '한 경주'로 이어져야 한다 — 구멍을 발견하면 떨어진 채로
    # 이어지고, 조각(범위)마다 0%부터 새로 시작하는 것처럼 보이면 안 됨.
    # 분모 = 코퍼스 전체 청크(고정). 분자 = 이미 지도에 들어간 청크(기커버) + 이번 조각 진행분(근사).
    whole = None
    try:
        _gp = ROOT / "results" / f"_gapctx_{code}.json"
        # 이전 경주가 남긴 gapctx(예: 옛 지도 v1_18의 기커버 2,964)로 '전체 %'를 계산하면
        # 새 경주 막대가 부풀어 보임 — 이번 경주 것일 때만 신뢰
        if not (race and _gp.stat().st_mtime < race):
            ctx = json.loads(_gp.read_text(encoding="utf-8"))
            whole = {"total": int(ctx["total_chunks"]), "before": int(ctx["covered_before"]),
                     "base_role": ctx.get("base_role", "generator")}
    except Exception:
        pass
    rows, tot = [], 0
    for role, label in names.items():
        if role in agg:
            a = agg[role]
            tot += a["units"]
            row = {"who": label, "role": role, "done": a["done"],
                   "total": a["total"] or tt_any, "units": a["units"], "fails": a["fails"]}
            if a.get("mtime"):
                row["age_min"] = max(0, int((_time.time() - a["mtime"]) // 60))
            # [난희 실측 2026-08-20] '전체의 %'는 커버리지맵 분모(우리 3,007청크) 기준이라
            # 재추출(팀장님 21,354청크) 같은 다른 작업에선 91%에 얼어붙은 것처럼 보임 —
            # 진행 파일의 국면이 구멍 메우기가 아니면 조각 배치 %로 표시 (분모가 맞는 자만 쓴다)
            phase_now = str((prog or {}).get("phase") or "")
            if whole and whole["total"] and ("구멍 메우기" in phase_now or not phase_now):
                seg = int(a.get("chunks_est") or 0)
                base = whole["before"] if role == whole["base_role"] else 0
                row["whole_pct"] = round(min(base + seg, whole["total"]) / whole["total"] * 100)
            rows.append(row)
        elif role in active_roles:
            rows.append({"who": label, "role": role, "done": 0, "total": 0,
                         "units": 0, "fails": 0, "idle": True,
                         **({"whole_pct": 0} if whole else {})})
    return rows, tot


def api_progress(code):
    """③ 등 장시간 작업의 실시간 진행/막힘 — 엔진이 배치마다 갱신하는 파일을 그대로.
    진행 파일이 없어도(멈춤·사고) 체크포인트 기반 현황은 항상 반환한다."""
    if not re.fullmatch(r"[A-Z0-9]{1,8}", code or ""):
        return {"active": False}
    try:
        _st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))["products"][code]
    except Exception:
        _st = {}
    p = ROOT / "results" / f"_progress_{code}.json"
    d = {}
    if p.exists():
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            d = {}
    # 진행 파일의 역할 칸은 그 역할이 뛸 때만 다시 써진다 — 이번 경주에서 아직 안 뛴 주자의
    # 칸에는 이전 경주 기록이 그대로 남는다(예: codex 8/8, ts 8/21). 이번 경주 이전 ts는 제거
    # → 그 주자는 아래 대기조(⏳) 줄로 표시된다.
    _race = _race_started_at(code)
    if _race and isinstance(d.get("roles"), dict):
        import datetime as _dt
        def _fresh(v):
            try:
                return _dt.datetime.fromisoformat(str((v or {}).get("ts"))).timestamp() >= _race
            except Exception:
                return True   # ts 없으면 판단 불가 — 기존 동작 유지
        d["roles"] = {r: v for r, v in d["roles"].items() if _fresh(v)}
    stale_stage = bool(d) and d.get("stage", "COVERAGE_MAP") != _st.get("stage")
    if not d or stale_stage:
        # 진행 파일이 없거나 낡음 — 체크포인트만으로 '멈춘 자리' 보고 (active=False, snapshot=True)
        # [2026-08-20] 스냅샷 경로도 진행 파일의 국면은 넘긴다 — '전체의 %' 적용 여부 판단용
        rows, tot = _extractor_rows(code, d if d else None)
        if not rows:
            return {"active": False}
        return {"active": False, "snapshot": True, "stage": _st.get("stage"),
                "status": _st.get("status"), "worker_alive": _worker_alive(code),
                "extractors": rows, "units_total": tot,
                "phase": "멈춘 자리 (체크포인트 보존)"}
    d["active"] = True
    d["status"] = _st.get("status")
    d["worker_alive"] = _worker_alive(code)
    rows, tot = _extractor_rows(code, d)
    if rows:
        d["extractors"] = rows
        d["units_total"] = tot
    # (전체 지도 % 표시는 난희 결정으로 제거 2026-08-13 — 필요 시 map_gapfill --measure 로 실측)
    return d


def api_xlsx(relpath, max_rows=400, name=None, prod=None):
    """xlsx 미리보기 — 엑셀 안 열고 툴에서 본다 (data/ 하위만, 숨김 시트=봉인은 비노출).
    name+prod 로 부르면 파일명만으로 최신 실물을 찾는다 (게이트 카드 → 실물 팝업)."""
    import openpyxl
    base = (ROOT / "data").resolve()
    if name and prod:
        hits = sorted((ROOT / "data" / prod).rglob(name)) if (ROOT / "data" / prod).is_dir() else []
        if not hits:
            return {"error": f"파일 못 찾음: {name}"}
        p = hits[-1].resolve()
    else:
        p = (base / (relpath or "")).resolve()
    try:
        p.relative_to(base)   # [P3] prefix 문자열 비교는 data2/ 같은 형제 디렉토리를 통과시킴
    except ValueError:
        return {"error": "미리보기 불가 (data 하위 xlsx만)"}
    if not p.exists() or p.suffix != ".xlsx":
        return {"error": "미리보기 불가 (data 하위 xlsx만)"}
    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    sheets = {}
    for sn in wb.sheetnames:
        ws = wb[sn]
        if getattr(ws, "sheet_state", "visible") != "visible":
            continue   # 숨김 시트 = 봉인(블라인드) — 노출 금지
        rows = []
        for r in ws.iter_rows(max_row=max_rows + 1, values_only=True):
            rows.append([("" if c is None else str(c))[:400] for c in (r or [])[:14]])
        sheets[N(sn)] = {"rows": rows, "truncated": (ws.max_row or 0) > max_rows + 1,
                         "total": ws.max_row or 0}
    wb.close()
    return {"file": N(p.name), "path": N(str(p.relative_to(base))), "sheets": sheets}


_TR_SYSTEM = """[TASK:TRANSLATE_JA_KO] 너는 일본어→한국어 통역사다.
입력: JSON 배열 [{"no":1,"ja":"일본어"}, …]. 규칙: ① 의역 금지 — 원문 구조 유지(오역 검증 가능하게)
② 고유명사(서비스명·요금제명)는 원문 표기 유지 ③ 확신 없으면 뒤에 " (※확인 필요)".
출력: JSON 배열만 — [{"no":1,"ko":"한국어"}, …]"""


def api_translate(prod, texts, cap=120):
    """실물 팝업 [日|한] — 일본어 문자열 목록을 한국어로. 캐시 우선, 미번역분만 AI 호출.
    캐시는 금고(data/<prod>/번역/_팝업번역캐시.json)에 원문 병기로 저장 (난희 규칙 2026-08-07).
    번역은 판정이 아니라 통역 — 추출전용 모델(judge_extract) 사용, 규칙 C 무관."""
    import sys as _sys
    _sys.path.insert(0, str(ROOT / "tools"))
    import llm
    from olib import load_config
    if not re.fullmatch(r"[A-Z0-9]{1,8}", prod or ""):
        return {"ok": False, "out": "제품 코드 오류"}
    texts = [str(t)[:500] for t in texts][:cap]
    cdir = ROOT / "data" / prod / "번역"
    cdir.mkdir(parents=True, exist_ok=True)
    cf = cdir / "_팝업번역캐시.json"
    try:
        cache = json.loads(cf.read_text(encoding="utf-8")) if cf.exists() else {}
    except Exception:
        cache = {}
    todo = [t for t in dict.fromkeys(texts) if t not in cache]
    err = None
    if todo:
        cfg = load_config()
        role = "judge_extract" if cfg.get("models", {}).get("judge_extract") else "generator"
        for i in range(0, len(todo), 30):
            part = todo[i:i + 30]
            payload = [{"no": k + 1, "ja": t} for k, t in enumerate(part)]
            try:
                out = llm.chat(role, _TR_SYSTEM, json.dumps(payload, ensure_ascii=False), cfg)
                got = llm.extract_json(out)
                for x in got if isinstance(got, list) else []:
                    if isinstance(x, dict) and "no" in x and 1 <= int(x["no"]) <= len(part):
                        cache[part[int(x["no"]) - 1]] = str(x.get("ko", ""))[:600]
            except Exception as e:
                err = str(e)[:150]
                break
        # 캐시 = 원문 병기 통역 기록 (키=일본어 원문, 값=한국어) — 금고 저장이라 유출 없음
        cf.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding="utf-8")
    return {"ok": True, "map": {t: cache[t] for t in texts if t in cache},
            "미번역": sum(1 for t in texts if t not in cache), "err": err}


def _s2_ledger_file(prod):
    d = ROOT / "data" / prod / "07_stage2"
    c = sorted(d.glob(f"{prod}_본판정_판정대장_*.xlsx")) if d.is_dir() else []
    return c[-1] if c else None


def api_s2diff(prod):
    """⑦ 이중 판정 불일치 검토 — 갈린 문항만 팝업에서 클릭으로 확정 (엑셀 왕복 금지)"""
    import openpyxl
    f = _s2_ledger_file(prod)
    if not f:
        return {"rows": []}
    # 질문·정답은 통합 대장에서 조인
    led = sorted((ROOT / "data" / prod / "05_unified_ledger").glob("*통합대장*.xlsx"))
    qmap = {}
    if led:
        lw = openpyxl.load_workbook(led[-1], read_only=True, data_only=True).active
        lh = [N(c) for c in next(lw.iter_rows(max_row=1, values_only=True))]
        qi = lh.index("질문") if "질문" in lh else 3
        ai = next((i for i, h in enumerate(lh) if h.startswith("정답")), 4)
        for r in lw.iter_rows(min_row=2, values_only=True):
            qmap[N(r[0])] = (N(r[qi]), N(r[ai]))
    wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
    ws = wb.active
    hdr = [N(c) for c in next(ws.iter_rows(max_row=1, values_only=True))]
    col = {h: i for i, h in enumerate(hdr)}
    rows = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if N(r[col.get("불일치", 6)]) != "✚":
            continue
        iid = N(r[0])
        q, a = qmap.get(iid, ("", ""))
        rows.append({"id": iid, "q": q, "a": a,
                     "kimi": N(r[col.get("판정(채점관 Kimi)", 2)]),
                     "kimi_why": N(r[col.get("판정문(전건 보존)", 3)])[:400],
                     "claude": N(r[col.get("검토 판정(claude 새 세션)", 4)]),
                     "claude_why": N(r[col.get("검토 판정문", 5)])[:400],
                     "final": N(r[col["최종 판정"]]) if "최종 판정" in col and col["최종 판정"] < len(r) else ""})
    wb.close()
    return {"rows": rows, "file": N(f.name)}


def api_qa_handoff(prod):
    """G20 · 외부 Q&A 별도 트랙 전달 꾸러미 — 시험지(질문만) + 안내문 + 응답로그 예시 zip."""
    import io
    import zipfile
    import openpyxl
    import datetime
    d = ROOT / "data" / prod / "external_qa"
    papers = list(d.glob(f"외부QA_시험지_{prod}_*문항_v*.xlsx"))
    if not papers:
        return None, "Q&A 시험지 없음 — 외부 Q&A 분류 카드 승인 후 이용 가능"
    pub = max(papers, key=_qa_ver)   # [P1-2] 최신 = 버전 숫자
    ws = openpyxl.load_workbook(pub, read_only=True).active
    first = next(ws.iter_rows(min_row=2, max_row=2, values_only=True), None)
    qid0 = str(first[0]) if first else f"{prod}-Q001"
    n = max(0, (ws.max_row or 1) - 1)
    name = "리모트콜" if prod.startswith("RC") else ("리모트뷰" if prod.startswith("RV") else prod)
    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    guide = f"""# {name} 외부 Q&A 세트 응시 요청 (별도 트랙 — 골든셋 아님)

> 꾸러미 생성: {stamp} · 시험지: {N(pub.name)} ({n}문항)
> **검색축만**: 답변 생성(LLM 호출)은 생략하고 검색 결과(hits)만 기록해 주세요.

## 이 시험지는 무엇이 다른가
- 외부에서 제작된 질문·답변 세트 중 코퍼스에 근거가 실재하는 문항만 추린 것입니다.
- 기존 골든셋 회차와는 **성적이 분리 집계**됩니다 (별도 트랙).

## 부탁드리는 것
각 질문을 RAG 시스템에 넣고, 검색 hits(rank 순, 본문 포함)를 json 1개로 회신 부탁드립니다.
hits 항목에 **본문(content) 텍스트가 꼭 포함**돼야 합니다 — 채점이 내용 대조 방식이라 URL만으로는 판정이 안 됩니다.

## 응답 로그 형식 (예시 파일 동봉)
{{
  "responses": [
    {{ "id": "{qid0}", "hits": [ {{"rank": 1, "url": "…", "content": "…청크 본문…"}} ], "answer": null }}
  ]
}}
"""
    example = json.dumps({"responses": [
        {"id": qid0, "hits": [{"rank": 1, "url": "https://…", "content": "…검색된 청크 본문…"},
                              {"rank": 2, "url": "https://…", "content": "…"}], "answer": None}]},
        ensure_ascii=False, indent=1)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(pub, N(pub.name))
        z.writestr("응시_안내문.md", guide)
        z.writestr("응답로그_예시.json", example)
    ledger_append_safe("EXTERNAL_QA", "QA_HANDOFF_DOWNLOADED",
                       evidence={"시험지": N(pub.name), "문항": n}, product=prod)
    return buf.getvalue(), f"외부QA_꾸러미_{prod}_{n}문항.zip"


def ledger_append_safe(stage, action, evidence=None, product=None):
    try:
        sys.path.insert(0, str(ROOT / "tools"))
        from olib import ledger_append
        ledger_append(stage, action, "사람:대시보드", evidence=evidence, product=product)
    except Exception:
        pass


def api_handoff(prod, scope="full"):
    """⑧ 팀장님 전달 꾸러미 — 발행본 + 응시 안내문을 zip 한 방에 (툴에서 직접 다운로드).
    scope: full=전체 응시(검색+생성) / search=검색축만(top1·top5, answer:null) — 안내문이 달라진다."""
    import io
    import zipfile
    import openpyxl
    import datetime
    pubs = sorted((ROOT / "data" / prod / "08_scoring").glob("*질문셋_발행본*.xlsx"))
    if not pubs:
        return None, "발행본 없음 — ⑧ 도달 후 이용 가능"
    pub = pubs[-1]
    ws = openpyxl.load_workbook(pub, read_only=True).active
    n = max(0, (ws.max_row or 1) - 1)
    name = "리모트콜" if prod.startswith("RC") else ("리모트뷰" if prod.startswith("RV") else prod)
    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    search = scope == "search"
    scope_ko = "검색축만 (top1·top5 히트율 — answer 미제출)" if search else "전체 (검색축 + 생성축)"
    ans_line = ('"answer": null  ← 이번 회차는 전 문항 null로 통일해 주세요'
                if search else '"answer": "…시스템 답변…"')
    ask = ("RAG 시스템에 각 질문을 넣되, **답변 생성(LLM 호출)은 생략**하고 검색 결과(hits)만 기록해 주세요. "
           "answer는 전 문항 null로 통일합니다 (일부만 null이면 결손으로 반려됩니다)."
           if search else
           "RAG 시스템에 각 질문을 그대로 넣고, 응답 로그를 json 1개로 회신 부탁드립니다.")
    tail = ("- 채점: 검색축(top1·top5)만 산출 — 생성축·E형은 리포트에 '미응시' 표기\n"
            if search else
            "- hits: 검색 근거(rank 순) · answer: 최종 생성 답변\n")
    guide = f"""# {name} RAG 평가 질문셋 응시 요청 (골든셋 v2)

> 꾸러미 생성: {stamp} · 발행본: {N(pub.name)} ({n}문항)
> **이번 회차 응시 범위: {scope_ko}**
> ※ 꾸러미는 요청 시점의 최신판으로 자동 조립됩니다 — 재요청 시 관제판에서 버튼 한 번 더.

## 파일
- {N(pub.name)} — {name} {n}문항 (문항ID · 질문 2컬럼, 정답 비공개)

## 부탁드리는 것
{ask}

## 응답 로그 형식
{{
  "meta": {{ "corpus_version": "…(인입 코퍼스 버전 — 문서 N건·청크 M건 표기)" }},
  "responses": [
    {{ "id": "{prod}-001", "hits": [ {{"rank":1, "source":"…"}} ], {ans_line} }}
  ]
}}

- responses는 전 문항(빠짐없이), id는 발행본의 문항ID 그대로
{tail}- 받는 즉시 자동 채점 → 성적 리포트로 회신드립니다.
"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(pub, N(pub.name))
        z.writestr("응시_안내.md", guide)
    try:
        sys.path.insert(0, str(ROOT / "tools"))
        from olib import ledger_append
        ledger_append("SCORING", "HANDOFF_DOWNLOADED", "사람:난희",
                      evidence={"발행본": N(pub.name), "응시 범위": scope_ko, "생성": stamp},
                      product=prod)
    except Exception:
        pass
    tag = "검색축만" if search else "전체응시"
    return buf.getvalue(), f"{prod}_전달꾸러미_{tag}_{datetime.date.today():%m%d}.zip"


def api_report(prod, rnd):
    """회차 리포트 꾸러미 — 리포트 md + 원자료(json/xlsx)를 zip으로 (툴에서 직접 다운로드)"""
    import io
    import re as _re
    import zipfile
    if not _re.fullmatch(r"[A-Z0-9]{1,8}", prod) or not _re.fullmatch(r"r\d{1,3}", rnd):
        return None, "인자 오류"
    d = ROOT / "results" / f"score_{prod}_{rnd}"
    if not d.is_dir():
        return None, f"{prod} {rnd} 채점 산출물 없음"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(d.iterdir()):
            if p.is_file() and not p.name.startswith("."):
                z.write(p, N(p.name))
    sys.path.insert(0, str(ROOT / "tools"))
    from olib import ledger_append
    ledger_append("SCORING", "REPORT_DOWNLOADED", "사람:난희",
                  evidence={"회차": rnd, "구성": [N(p.name) for p in sorted(d.iterdir()) if p.is_file()]},
                  product=prod)
    return buf.getvalue(), f"{prod}_{rnd}_리포트꾸러미.zip"


def _calin_file(prod):
    d = ROOT / "data" / prod / "06_calibration"
    c = sorted(d.glob("*판정30*.xlsx")) if d.is_dir() else []
    return c[-1] if c else None


def api_calin(prod):
    """⑥ 채점관 면접 답안지 — 카드 안에서 바로 판정하도록 기입 시트를 화면에 노출.
    블라인드: judge 판정(숨김 시트)은 절대 내보내지 않는다."""
    import openpyxl
    f = _calin_file(prod)
    if not f:
        return {"rows": []}
    wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
    sn = next((s for s in wb.sheetnames if "기입" in N(s)), None)
    if not sn:
        wb.close()
        return {"rows": []}
    rows = []
    for r in wb[sn].iter_rows(min_row=2, values_only=True):
        if not r or r[0] is None:
            continue
        rows.append({"id": N(r[0]), "type": N(r[1]), "q": N(r[2]), "a": N(r[3]),
                     "crit": N(r[4]), "v": N(r[5]) if len(r) > 5 and r[5] else ""})
    wb.close()
    # [난희 요청 2026-08-18] 일본어 문항 한국어 병기 — 번역 캐시(금고)에서 붙임 (참고용, 원문이 정본)
    try:
        cache = json.loads((ROOT / "data" / prod / "번역" / "_팝업번역캐시.json").read_text(encoding="utf-8"))
        for row in rows:
            row["q_ko"] = cache.get(row["q"], "")
            row["a_ko"] = cache.get(row["a"], "")
    except Exception:
        pass
    return {"rows": rows, "file": N(f.name)}


def api_action(payload):
    """approve / reject / onboard / resume / run — pipeline CLI 경유 (원장 기록 보장)"""
    cmd = payload.get("cmd")
    args = [sys.executable, str(ROOT / "tools" / "pipeline.py")]
    if cmd == "approve":
        args += ["approve", payload["gate_id"], "--actor", payload.get("actor", "난희")]
        if payload.get("ack_all"):
            args += ["--ack-all"]
    elif cmd == "reject":
        if not payload.get("reason"):
            return {"ok": False, "out": "반려는 사유 필수"}
        args += ["reject", payload["gate_id"], "--reason", payload["reason"],
                 "--actor", payload.get("actor", "난희")]
    elif cmd == "resume":
        if not payload.get("reason"):
            return {"ok": False, "out": "HALT 해제는 사유 필수"}
        args += ["resume", "--after-fix", payload["product"], "--reason", payload["reason"],
                 "--actor", payload.get("actor", "난희")]
    elif cmd == "onboard":
        args += ["onboard", "--product", payload["product"], "--name", payload.get("name", ""),
                 "--base", payload.get("base", "blank"), "--actor", payload.get("actor", "난희"),
                 "--start", payload.get("start", "full"),
                 "--strategy", payload.get("strategy", "ensemble")]
    elif cmd == "set-strategy":
        args += ["set-strategy", "--product", payload["product"],
                 "--strategy", payload["strategy"], "--actor", payload.get("actor", "난희")]
    elif cmd == "set-members":
        args += ["set-members", "--product", payload["product"],
                 "--use", payload.get("use", "generator"), "--actor", payload.get("actor", "난희")]
    elif cmd == "new-round":
        args += ["new-round", "--product", payload["product"], "--actor", payload.get("actor", "난희")]
    elif cmd == "expand":
        args += ["expand", "--product", payload["product"], "--actor", payload.get("actor", "난희")]
    elif cmd == "translate":
        # [난희 요청 2026-08-14] 실물 팝업 [日|한] 전환 — 일본어 셀을 한국어로 (참고용)
        # 번역 기록 규칙: 원문 병기 캐시를 금고(data/<제품>/번역/)에 저장 — 오역 검증 가능
        return api_translate(payload.get("product", ""), payload.get("texts") or [])
    elif cmd == "qa-import":
        # 외부 Q&A 인입 — 업로드 직후 자동 대조·분류 (G19)
        args += ["qa-import", "--product", payload["product"], "--actor", payload.get("actor", "난희")]
    elif cmd == "close-ensemble":
        # ③ 앙상블 조기 마감 — 완주한 추출자 기준으로 병합 진행 (난희 요청)
        args += ["close-ensemble", "--product", payload["product"], "--actor", payload.get("actor", "난희")]
        if payload.get("force"):
            args += ["--force"]
    elif cmd == "qa-score":
        # 외부 Q&A 별도 트랙 채점 — 응답로그 업로드 직후 (G20)
        args += ["qa-score", "--product", payload["product"], "--actor", payload.get("actor", "난희")]
        if payload.get("log"):
            args += ["--log", payload["log"]]
    elif cmd == "s2diff-set":
        # 불일치 문항 확정 클릭 → 판정대장 '최종 판정' 컬럼에 즉시 기록
        import openpyxl
        prod, iid, final = payload["product"], N(payload.get("id", "")), N(payload.get("final", ""))
        f = _s2_ledger_file(prod)
        if not f:
            return {"ok": False, "out": "판정대장 없음"}
        wb = openpyxl.load_workbook(f)
        ws = wb.active
        hdr = [N(c.value) for c in ws[1]]
        if "최종 판정" not in hdr:
            ws.cell(1, len(hdr) + 1).value = "최종 판정"
            ws.cell(1, len(hdr) + 2).value = "사람 개입"
            hdr += ["최종 판정", "사람 개입"]
        fc, hc = hdr.index("최종 판정") + 1, hdr.index("사람 개입") + 1
        hit = False
        for r in range(2, ws.max_row + 1):
            if N(ws.cell(r, 1).value) == iid:
                ws.cell(r, fc).value = final
                ws.cell(r, hc).value = "○"
                hit = True
                break
        if not hit:
            return {"ok": False, "out": f"문항 없음: {iid}"}
        wb.save(f)
        sys.path.insert(0, str(ROOT / "tools"))
        from olib import ledger_append
        ledger_append("STAGE2", "S2DIFF_HUMAN_FINAL", "사람:난희",
                      evidence={"문항": iid, "최종": final}, product=prod)
        return {"ok": True, "out": f"{iid} → 최종 {final}"}
    elif cmd == "calin-set-bulk":
        # 체크한 문항들 일괄 판정 — 파일 1회 열고 한 번에 기록
        import openpyxl
        prod, v = payload["product"], N(payload.get("verdict", ""))
        ids = {N(i) for i in payload.get("ids", [])}
        if v not in ("합격", "부분", "0점", "불합격", "") or not ids:   # 불합격=구형 시트 호환
            return {"ok": False, "out": "판정 값/대상 오류"}
        f = _calin_file(prod)
        if not f:
            return {"ok": False, "out": "판정지 없음"}
        wb = openpyxl.load_workbook(f)
        ws = wb[next(s for s in wb.sheetnames if "기입" in N(s))]
        hit = done = total = 0
        for row in ws.iter_rows(min_row=2):
            if row[0].value is None:
                continue
            if N(row[0].value) in ids:
                row[5].value = v
                hit += 1
            total += 1
            done += 1 if N(row[5].value or "") else 0
        wb.save(f)
        return {"ok": True, "hit": hit, "filled": done, "total": total,
                "out": f"{hit}건 일괄 {v or '해제'} · {done}/{total}"}
    elif cmd == "calin-set":
        # 카드 안 판정 클릭 → 기입 시트에 즉시 기록 (엑셀 파일이 단일 원장 — 채점기와 동일 소스)
        import openpyxl
        prod, iid, v = payload["product"], N(payload.get("id", "")), N(payload.get("verdict", ""))
        if v not in ("합격", "부분", "0점", "불합격", ""):   # 불합격=구형 시트 호환
            return {"ok": False, "out": "판정 값 오류"}
        f = _calin_file(prod)
        if not f:
            return {"ok": False, "out": "판정지 없음"}
        wb = openpyxl.load_workbook(f)
        sn = next((s for s in wb.sheetnames if "기입" in N(s)), None)
        ws = wb[sn]
        hit, done, total = False, 0, 0
        for row in ws.iter_rows(min_row=2):
            if row[0].value is None:
                continue
            if N(row[0].value) == iid:
                row[5].value = v
                hit = True
            total += 1
            done += 1 if N(row[5].value or "") else 0
        if not hit:
            return {"ok": False, "out": f"문항 없음: {iid}"}
        wb.save(f)
        return {"ok": True, "filled": done, "total": total, "out": f"기록됨 · {done}/{total}"}
    elif cmd == "dismiss-card":
        # 알림형 카드 닫기 — 완료로 이동 (MODELALERT 전용, 경로 이탈 차단)
        name = N(payload.get("file", "")).replace("/", "").replace("..", "")
        if not name.startswith("MODELALERT_") or not name.endswith(".md"):
            return {"ok": False, "out": "닫기는 알림형(MODELALERT) 카드만 가능"}
        src = ROOT / "검수큐" / name
        if not src.exists():
            return {"ok": False, "out": "카드 없음"}
        dst = ROOT / "검수큐" / "완료"
        dst.mkdir(exist_ok=True)
        (dst / name).write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
        src.unlink()
        sys.path.insert(0, str(ROOT / "tools"))
        from olib import ledger_append
        ledger_append("MAINTENANCE", "ALERT_DISMISSED", "사람:난희",
                      evidence={"card": name, "처리": "확인 후 닫음 — 같은 내용 재발행 억제"})
        return {"ok": True, "out": "알림 닫음 — 같은 내용으로는 다시 안 떠요"}
    elif cmd == "stop":
        # ⏹ 비상 정지 — 이 제품의 자동 진행 워커와 하위 작업을 즉시 종료 (잘못 올린 파일 등)
        import os, signal
        prod = payload["product"]
        killed = []
        pidf = ROOT / "results" / f"_run_{prod}.pid"
        if pidf.exists():
            try:
                os.kill(int(pidf.read_text()), signal.SIGTERM)
                killed.append(f"auto_run({pidf.read_text()})")
            except (ValueError, ProcessLookupError):
                pass
            pidf.unlink(missing_ok=True)
        # auto_run이 낳은 하위 pipeline 프로세스도 같이 정리
        out = subprocess.run(["pgrep", "-f", f"pipeline.py run --product {prod}"],
                             capture_output=True, text=True).stdout.split()
        for pid in out:
            try:
                os.kill(int(pid), signal.SIGTERM)
                killed.append(f"pipeline({pid})")
            except (ValueError, ProcessLookupError):
                pass
        sys.path.insert(0, str(ROOT / "tools"))
        from olib import ledger_append
        ledger_append("INPUT", "EMERGENCY_STOP", "사람:난희",
                      evidence={"종료": killed or "실행 중인 작업 없음",
                                "사유": "사람이 관제판 [⏹ 멈추기] — 잘못 올린 파일 등"}, product=prod)
        return {"ok": True, "out": killed and f"⏹ 멈췄어요 — {', '.join(killed)} 종료. "
                "상태·산출물 정리가 필요하면 Claude에게 알려주세요." or
                "지금 실행 중인 자동 작업이 없어요 (이미 멈춘 상태)."}
    elif cmd == "run":
        # 장시간 AI 작업(③ 등) — 백그라운드 실행. 서버(단일 스레드)와 화면이 얼지 않게.
        import os
        prod = payload["product"]
        # 출제 AI 미연결 가드 — 돌려봤자 즉시 실패할 실행을 친절하게 차단
        try:
            sys.path.insert(0, str(ROOT / "tools"))
            from model_adapter import detect_mode
            from olib import load_config as _lc
            if os.environ.get("ORCH_MOCK") != "1" and not detect_mode(_lc(), os.environ)["have"].get("generator"):
                return {"ok": False,
                        "out": "⛔ 출제 AI(claude)가 연결돼 있지 않아 실행할 수 없어요. "
                               "터미널에서 claude 로그인(구독) 또는 키설정.txt에 API 키를 넣고 "
                               "실전모드_켜기.command 를 다시 실행한 뒤 시도해 주세요."}
        except ImportError:
            pass   # 어댑터 로드 실패 시 가드는 건너뛴다 (실행 자체를 막지 않음)
        pidf = ROOT / "results" / f"_run_{prod}.pid"
        pidf.parent.mkdir(exist_ok=True)
        # 중복 실행 방지 — 이미 도는 프로세스가 있으면 새로 안 띄운다 (재개 버튼 연타 등)
        if pidf.exists():
            try:
                old = int(pidf.read_text())
                stat = subprocess.run(["ps", "-o", "stat=", "-p", str(old)],
                                      capture_output=True, text=True).stdout.strip()
                if stat and not stat.startswith("Z"):   # 좀비(Z)는 죽은 것 — 실행 중 오인 금지
                    return {"ok": True, "out": "이미 실행 중이에요 — 진행선에서 상태를 확인하세요 (중복 실행 안 함)."}
            except ValueError:
                pass                      # 깨진 pid 파일 — 무시하고 새로 시작
        # 무인 자동 진행 워커 — 한도로 멈춰도 스스로 재개 (사람이 밤새 버튼 누를 필요 없음)
        worker = [sys.executable, str(ROOT / "tools" / "auto_run.py"), "--product", prod]
        # 원문 로그 보관 체계: 제품별 폴더 + 날짜_시각_시작파트 파일명 — 나중에 찾을 수 있게
        import datetime
        try:
            stage = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))["products"][prod]["stage"]
        except Exception:
            stage = "run"
        ldir = ROOT / "results" / "logs" / prod
        ldir.mkdir(parents=True, exist_ok=True)
        logf = ldir / f"{datetime.datetime.now():%Y-%m-%d_%H%M}_{stage}.log"
        cur = ROOT / "results" / f"_run_{prod}.log"
        cur.unlink(missing_ok=True)
        cur.symlink_to(logf)          # '_run_<제품>.log' = 항상 최신 로그를 가리키는 별칭
        p = subprocess.Popen(worker, cwd=str(ROOT), env={**os.environ},
                             stdout=open(logf, "ab"), stderr=subprocess.STDOUT)
        pidf.write_text(str(p.pid))
        return {"ok": True, "out": "⏳ 실행 시작 — 한도로 멈춰도 자동으로 이어가요(사람 개입 불필요). 진행은 트랙 아래 진행선에서."}
    else:
        return {"ok": False, "out": f"미지원: {cmd}"}
    import os
    p = subprocess.run(args, capture_output=True, text=True, cwd=str(ROOT),
                       env={**os.environ})   # ORCH_MOCK 등 서버 환경 승계
    return {"ok": p.returncode == 0, "out": (p.stdout + p.stderr).strip()}


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?") or self.path.startswith("/dashboard/index.html"):
            # 대시보드 HTML은 항상 최신으로 — 브라우저 캐시가 옛 화면을 보여주는 사고 방지
            body = (ROOT / "dashboard" / "index.html").read_bytes()
            return self._send(200, body, "text/html; charset=utf-8")
        if self.path.startswith("/api/state"):
            return self._send(200, j(api_state()))
        if self.path.startswith("/api/ledger"):
            return self._send(200, j(api_ledger()))
        if self.path.startswith("/api/queue"):
            return self._send(200, j(api_queue()))
        if self.path.startswith("/api/vertex-doc"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query); t = api_vertex_doc(N(q.get("name", [""])[0]))
            return self._send(404 if t is None else 200, j({"ok": t is not None, "text": t or ""}))
        if self.path.startswith("/api/vertex"):
            return self._send(200, j(api_vertex()))
        if self.path.startswith("/api/scores"):
            return self._send(200, j(api_scores()))
        if self.path.startswith("/api/catalog"):
            return self._send(200, j(api_catalog()))
        if self.path.startswith("/api/ai_status"):
            return self._send(200, j(api_ai_status()))
        if self.path.startswith("/api/progress"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            return self._send(200, j(api_progress(N(q.get("product", [""])[0]))))
        if self.path.startswith("/api/calin"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            return self._send(200, j(api_calin(N(q.get("product", [""])[0]))))
        if self.path.startswith("/api/xlsx"):
            from urllib.parse import urlparse, parse_qs, unquote
            q = parse_qs(urlparse(self.path).query)
            return self._send(200, j(api_xlsx(N(unquote(q.get("path", [""])[0]))or None,
                                              name=N(unquote(q.get("name", [""])[0])) or None,
                                              prod=N(q.get("product", [""])[0]) or None)))
        if self.path.startswith("/api/qa-handoff"):
            from urllib.parse import urlparse, parse_qs, quote
            q = parse_qs(urlparse(self.path).query)
            data, fname = api_qa_handoff(N(q.get("product", [""])[0]))
            if data is None:
                return self._send(404, j({"ok": False, "out": fname}))
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(fname)}")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if self.path.startswith("/api/handoff"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            data, fname = api_handoff(N(q.get("product", [""])[0]),
                                      N(q.get("scope", ["full"])[0]) or "full")
            if data is None:
                return self._send(404, j({"ok": False, "out": fname}))
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            from urllib.parse import quote
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(fname)}")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if self.path.startswith("/api/report"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            data, fname = api_report(N(q.get("product", [""])[0]), N(q.get("round", [""])[0]))
            if data is None:
                return self._send(404, j({"ok": False, "out": fname}))
            from urllib.parse import quote
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(fname)}")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if self.path.startswith("/api/s2diff"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            return self._send(200, j(api_s2diff(N(q.get("product", [""])[0]))))
        if self.path.startswith("/api/runlog"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            return self._send(200, j(api_runlog(N(q.get("product", [""])[0]))))
        return super().do_GET()

    def do_POST(self):
        # [P2-6] CSRF 방어 — 브라우저의 타 사이트 페이지가 localhost로 승인/업로드 POST를
        # 쏘는 것 차단. Origin 없는 요청(CLI·봇·curl)은 로컬 도구라 허용.
        origin = self.headers.get("Origin")
        if origin and origin not in ("http://localhost:8791", "http://127.0.0.1:8791"):
            return self._send(403, j({"ok": False, "out": f"차단된 출처: {origin}"}))
        if self.path.startswith("/api/action"):
            n = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(n) or b"{}")
            return self._send(200, j(api_action(payload)))
        if self.path.startswith("/api/upload"):
            return self._send(200, j(self._upload()))
        return self._send(404, j({"ok": False}))

    UPLOAD_DIRS = {"CORPUS": "corpus", "SCORING": "08_scoring",
                   "COVERAGE": "03_coverage_map", "UNIFIED": "05_unified_ledger",
                   "CALIBRATION": "06_calibration",
                   "QALOG": "external_qa/로그",   # Q&A 응답로그 — 원본과 섞이면 재대조가 오인 (QA보다 먼저 매칭돼야 함)
                   "QA": "external_qa"}

    def _upload(self):
        """INPUT 카드용 파일 업로드 — 쿼리: product, target(카드 종류), name. 본문 = 파일 원바이트.
        저장 후 입구 검사는 pipeline run 이 수행 ('받으면 무조건 실측부터')."""
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        prod = N(q.get("product", [""])[0])
        target = N(q.get("target", ["CORPUS"])[0]).upper()
        name = N(q.get("name", ["upload.bin"])[0])   # [P3] parse_qs가 이미 디코드 — unquote 중복 금지
        name = name.replace("/", "_").replace("\\", "_").replace("..", "_")  # 경로 이탈 차단
        sub = next((d for k, d in self.UPLOAD_DIRS.items() if k in target), "corpus")
        # 채점만 모드: SCORING 카드에 골든셋(xlsx)과 로그(json)를 같이 올려도 자동 분류
        if "SCORING" in target and name.lower().endswith(".xlsx"):
            sub = "05_unified_ledger"
        # [난희 지시 2026-08-28] CI 수신 자료(팀장님 응답로그 등)는 전용 폴더에 모은다
        if prod == "CI" and sub == "08_scoring":
            sub = "08_scoring/전달 받은 자료"
        if not re.fullmatch(r"[A-Z0-9]{1,8}", prod):
            return {"ok": False, "out": f"제품 코드 오류: {prod}"}
        dest_dir = ROOT / "data" / prod / sub
        dest_dir.mkdir(parents=True, exist_ok=True)
        n = int(self.headers.get("Content-Length", 0))
        if n <= 0 or n > 500 * 1024 * 1024:
            return {"ok": False, "out": f"크기 오류: {n}B"}
        dest = dest_dir / name
        with open(dest, "wb") as f:
            remaining = n
            while remaining > 0:
                chunk = self.rfile.read(min(1 << 20, remaining))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)
        if remaining > 0:
            # [P3] 부분 수신 = 잘린 파일 — 저장·원장 기록 금지 (손상 코퍼스가 입구 검사로 흘러들던 것)
            dest.unlink(missing_ok=True)
            return {"ok": False, "out": f"업로드 중단 감지 — {n-remaining:,}/{n:,}B만 수신. 다시 올려주세요."}
        # 응시 범위 선언 사이드카 — 형식 게이트가 실물(answer null 여부)과 대조
        scope = N(q.get("scope", [""])[0])
        if scope in ("search", "full") and name.lower().endswith(".json") and "08_scoring" in sub:
            (dest_dir / f"{name}.scope").write_text(scope, encoding="utf-8")
        # 파일별 메모 사이드카 — 보낸 사람이 단 조건("생성축 전체 응시", "top_k=50 진단" 등)을
        # 파일 옆에 붙여 보존. 채점자가 로그를 열기 전에 조건을 읽는다.
        memo = N(q.get("memo", [""])[0]).strip()[:500]
        if memo:
            (dest_dir / f"{name}.memo").write_text(memo, encoding="utf-8")
        sys.path.insert(0, str(ROOT / "tools"))
        from olib import ledger_append
        ledger_append("INPUT", "FILE_UPLOADED", "사람:대시보드",
                      evidence={"file": name, "size": n, "dest": f"data/{prod}/{sub}/",
                                **({"응시 범위 선언": "검색축만" if scope == "search" else "전체"}
                                   if scope in ("search", "full") else {}),
                                **({"메모": memo} if memo else {})},
                      product=prod)
        return {"ok": True, "out": f"업로드 완료: {name} ({n:,}B) → data/{prod}/{sub}/"
                                   f"{' · 메모 저장됨' if memo else ''} — 입구 검사를 실행합니다"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8791)
    a = ap.parse_args()
    srv = HTTPServer(("127.0.0.1", a.port), H)
    print(f"관제 대시보드: http://localhost:{a.port}/  (Ctrl+C 종료)")
    srv.serve_forever()


if __name__ == "__main__":
    main()
