#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RAG 채점기 (STAGE3 — 실물 채점)
사용법:
    python3 grade_final.py --golden 골든셋.xlsx --log 응답로그.json [--mapping 매핑시트.xlsx]
    python3 grade_final.py --selftest
출력:
    score_report.json
    score_report.xlsx (4시트: 요약, 문항별, 결함목록, 인입누락의심)
"""

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import pandas as pd


# ---------------------------------------------------------------------------
# 상수 (확장 가능)
# ---------------------------------------------------------------------------
REFUSAL_PATTERNS = [
    "자료에 없",
    "찾을 수 없",
    "확인되지 않",
    "제공되지 않",
    "알 수 없",
    "문서에 없",
    "정보가 없",
    "확인할 수 없",
    "제공할 수 없",
    "찾을 수 없습니다",
    "확인되지 않습니다",
    "제공되지 않습니다",
    "알 수 없습니다",
    "문서에 없습니다",
    "정보가 없습니다",
    "확인할 수 없습니다",
    "제공할 수 없습니다",
    "cannot find",
    "not found",
    "no information",
    "unable to",
    "does not contain",
]

GOLDEN_REQUIRED_COLUMNS = [
    "ID",
    "유형",
    "질문",
    "정답 (필수 포함 요소)",
    "합격 기준",
    "근거 출처",
    "근거 원문 발췌",
]

URL_RE = re.compile(r"https?://[^\s|)]+")


# ---------------------------------------------------------------------------
# 정규화 유틸
# ---------------------------------------------------------------------------
def normalize_url(url: str) -> str:
    """프로토콜·www·말미 슬래시·쿼리스트링 제거."""
    if not url:
        return ""
    url = unicodedata.normalize("NFC", url).strip().lower()
    parsed = urlparse(url)
    netloc = parsed.netloc
    if netloc.startswith("www."):
        netloc = netloc[4:]
    path = parsed.path
    while path.endswith("/"):
        path = path[:-1]
    return f"{netloc}{path}"


def normalize_text(text: str) -> str:
    """포함 판정용 정규화: NFC, 소문자, 공백 제거, 콤마 제거."""
    if not isinstance(text, str):
        text = str(text)
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = re.sub(r"[\s,，]", "", text)
    return text


def extract_url(text: str) -> str:
    """근거 출처 텍스트에서 첫 URL 추출."""
    if not isinstance(text, str):
        return ""
    m = URL_RE.search(text)
    return m.group(0) if m else ""


# ---------------------------------------------------------------------------
# 파싱
# ---------------------------------------------------------------------------
def parse_required_elements(answer_field: str) -> list[str]:
    """
    '정답 (필수 포함 요소)' 필드에서 '필수:' 뒤 요소를 파싱.
    구분자: 개행, ';', ',', '·', '•' 및 번호/글머리 기호.
    """
    if not isinstance(answer_field, str):
        return []

    # '필수:' 이후 텍스트 추출 (대소문자 무관)
    match = re.search(r"필수[:：]\s*(.*)", answer_field, re.IGNORECASE)
    if not match:
        return []

    raw = match.group(1)
    # 괄호 설명 제거는 하지 않음 — 정규화 후 포함 판정
    # 우선 개행 기준 분리
    parts = re.split(r"[\n\r]", raw)
    elements: list[str] = []
    for part in parts:
        # 번호/글머리 기호 제거: 1), 1., -, *, •, ·
        part = re.sub(r"^(\d+[.):]\s*|[\-*·•]\s*)", "", part.strip())
        if not part:
            continue
        # 추가 구분자로 분리
        for sub in re.split(r"[;，,·•]", part):
            sub = sub.strip()
            # 뒤쪽 괄호 설명 중 핵심 점수 규정 문구는 제거
            sub = re.sub(r"\s*\([^)]*(핵심|누락|오류|0점|점수)[^)]*\)", "", sub)
            if sub:
                elements.append(sub)
    return elements


def is_refusal(answer: str) -> bool:
    """E형 무응답/거절 판정."""
    if not isinstance(answer, str) or not answer.strip():
        return True
    lower = answer.lower()
    return any(pat.lower() in lower for pat in REFUSAL_PATTERNS)


# ---------------------------------------------------------------------------
# 채점
# ---------------------------------------------------------------------------
def build_mapping_lookup(mapping_df: pd.DataFrame | None) -> dict[str, dict[str, Any]]:
    """ID -> {doc_key, point_id, ...} lookup."""
    if mapping_df is None or mapping_df.empty:
        return {}
    lookup: dict[str, dict[str, Any]] = {}
    id_col = next((c for c in mapping_df.columns if c.strip().upper() == "ID"), None)
    if id_col is None:
        return {}
    for _, row in mapping_df.iterrows():
        qid = str(row[id_col]) if pd.notna(row[id_col]) else ""
        if not qid:
            continue
        lookup[qid] = {c: row[c] for c in mapping_df.columns if c != id_col and pd.notna(row[c])}
    return lookup


def score_search(
    golden_row: pd.Series,
    response: dict[str, Any] | None,
    mapping_lookup: dict[str, dict[str, Any]],
) -> tuple[str, bool]:
    """
    검색 채점. 반환: (hit_top1 | hit_top5 | miss, chunk_strict_match)
    """
    qid = str(golden_row.get("ID", ""))
    source_text = str(golden_row.get("근거 출처", ""))
    golden_url = extract_url(source_text)
    norm_golden_url = normalize_url(golden_url)

    hits = (response or {}).get("hits", []) or []
    if not hits:
        return "miss", False

    norm_hit_urls = [normalize_url(str(h.get("source_url", ""))) for h in hits]
    chunk_ids = [str(h.get("chunk_id", "")) for h in hits]

    map_info = mapping_lookup.get(qid, {})
    golden_doc_key = str(map_info.get("doc_key", "")) if map_info else ""

    # chunk 엄격 일치는 mapping이 있을 때만 의미 있음
    chunk_strict = False
    if golden_doc_key:
        golden_point = str(map_info.get("point_id", ""))
        for idx, h in enumerate(hits):
            if str(h.get("doc_key", "")) == golden_doc_key:
                if golden_point and str(h.get("chunk_id", "")) == golden_point:
                    chunk_strict = True
                    # chunk_id 일치 시 1위로 간주할 수 있도록 위치 기록
                    return ("hit_top1" if idx == 0 else "hit_top5"), chunk_strict

    # URL 일치 판정
    if norm_golden_url:
        for idx, norm_url in enumerate(norm_hit_urls):
            if norm_url and norm_url == norm_golden_url:
                if golden_doc_key:
                    # mapping이 있으면 doc_key도 일치해야 함
                    if str(hits[idx].get("doc_key", "")) != golden_doc_key:
                        continue
                return ("hit_top1" if idx == 0 else "hit_top5"), chunk_strict

    # mapping 기준 fallback: doc_key 일치만으로도 hit 처리
    if golden_doc_key:
        for idx, h in enumerate(hits):
            if str(h.get("doc_key", "")) == golden_doc_key:
                return ("hit_top1" if idx == 0 else "hit_top5"), chunk_strict

    return "miss", chunk_strict


def score_generation(golden_row: pd.Series, response: dict[str, Any] | None) -> tuple[str, list[str]]:
    """
    생성 채점. 반환: (pass | partial | fail, 누락 요소 목록)
    """
    answer_field = str(golden_row.get("정답 (필수 포함 요소)", ""))
    answer = str((response or {}).get("answer", ""))

    required = parse_required_elements(answer_field)
    if not required:
        # 필수 요소가 명시되지 않은 경우 정답 필드 전체를 정규화하여 포함 여부 확인
        gold_norm = normalize_text(answer_field)
        ans_norm = normalize_text(answer)
        return ("pass" if gold_norm in ans_norm else "fail"), []

    norm_answer = normalize_text(answer)
    missing: list[str] = []
    for elem in required:
        norm_elem = normalize_text(elem)
        if norm_elem and norm_elem not in norm_answer:
            missing.append(elem)

    if not missing:
        return "pass", []
    if len(missing) == len(required):
        return "fail", missing
    return "partial", missing


def score_e_type(golden_row: pd.Series, response: dict[str, Any] | None) -> tuple[str, bool]:
    """
    E형 전용 채점. 반환: (pass | fail, 환각 여부)
    거절/부재 응답이면 pass, 구체적 답변이면 fail(환각).
    """
    answer = str((response or {}).get("answer", ""))
    if is_refusal(answer):
        return "pass", False
    return "fail", True


def determine_failure_tag(
    qtype: str,
    search_score: str,
    gen_score: str,
    e_hallucination: bool,
) -> str:
    if qtype.startswith("E"):
        return "E형 환각" if e_hallucination else ""
    if gen_score == "fail":
        if search_score == "miss":
            return "검색 실패 기인"
        return "생성 실패"
    return ""


# ---------------------------------------------------------------------------
# 문항 ID 접미 그룹
# ---------------------------------------------------------------------------
def source_suffix(qid: str, golden_row: pd.Series) -> str:
    """
    원천별(@접미) 집계용 그룹.
    ID에 @가 있으면 @ 뒤, '원천' 컬럼이 있으면 사용, 아니면 unknown.
    """
    if isinstance(qid, str) and "@" in qid:
        return qid.split("@", 1)[1]
    if "원천" in golden_row and pd.notna(golden_row["원천"]):
        return str(golden_row["원천"])
    return "unknown"


# ---------------------------------------------------------------------------
# 인입 누락 의심 문서
# ---------------------------------------------------------------------------
def detect_missing_sources(
    golden_df: pd.DataFrame,
    responses: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    골든셋 근거 출처의 문서가 로그 hits 전체에서 한 번도 나타나지 않은 문서 목록.
    """
    all_hit_urls: set[str] = set()
    all_hit_doc_keys: set[str] = set()
    for resp in responses.values():
        for h in resp.get("hits", []) or []:
            all_hit_urls.add(normalize_url(str(h.get("source_url", ""))))
            dk = str(h.get("doc_key", ""))
            if dk:
                all_hit_doc_keys.add(dk)

    doc_counter: Counter = Counter()
    doc_id_map: dict[str, str] = {}

    for _, row in golden_df.iterrows():
        qid = str(row.get("ID", ""))
        source_text = str(row.get("근거 출처", ""))
        url = extract_url(source_text)
        norm_url = normalize_url(url)

        # 문서 식별자: URL이 있으면 URL, 없으면 source_text 첫 80자
        doc_key = norm_url if norm_url else source_text.strip()[:80]
        doc_counter[doc_key] += 1
        doc_id_map.setdefault(doc_key, qid)

    missing: list[dict[str, Any]] = []
    for doc_key, count in doc_counter.items():
        if doc_key not in all_hit_urls and doc_key not in all_hit_doc_keys:
            missing.append(
                {
                    "문서_식별자": doc_key,
                    "해당_문항수": count,
                    "예시_문항ID": doc_id_map.get(doc_key, ""),
                }
            )

    missing.sort(key=lambda x: x["해당_문항수"], reverse=True)
    return missing


# ---------------------------------------------------------------------------
# 집계
# ---------------------------------------------------------------------------
def summarize(results_df: pd.DataFrame) -> pd.DataFrame:
    """전체/유형별/원천별 요약 DataFrame 생성."""
    rows: list[dict[str, Any]] = []

    def _group_metrics(sub: pd.DataFrame, group_name: str) -> dict[str, Any]:
        total = len(sub)
        if total == 0:
            return {"그룹": group_name, "문항수": 0}

        non_e = sub[~sub["유형"].astype(str).str.startswith("E")]
        e_sub = sub[sub["유형"].astype(str).str.startswith("E")]
        e_total = len(e_sub)
        e_hallucination = int(e_sub["E형_환각"].sum()) if e_total else 0

        # E형 전용 그룹: 검색/생성 지표는 의미 없음
        if total > 0 and total == e_total:
            return {
                "그룹": group_name,
                "문항수": total,
                "검색_top1_율": None,
                "검색_top5_율": None,
                "검색_miss_율": None,
                "생성_pass_율": None,
                "생성_partial_율": None,
                "생성_fail_율": None,
                "E형_문항수": e_total,
                "E형_환각_수": e_hallucination,
            }

        search_total = len(non_e) if len(non_e) else 1
        hit_top1 = (non_e["검색"] == "hit_top1").sum()
        hit_top5 = (non_e["검색"].isin(["hit_top1", "hit_top5"])).sum()

        gen_total = len(non_e) if len(non_e) else 1
        gen_pass = (non_e["생성"] == "pass").sum()
        gen_partial = (non_e["생성"] == "partial").sum()
        gen_fail = (non_e["생성"] == "fail").sum()

        return {
            "그룹": group_name,
            "문항수": total,
            "검색_top1_율": round(hit_top1 / search_total, 4),
            "검색_top5_율": round(hit_top5 / search_total, 4),
            "검색_miss_율": round((search_total - hit_top5) / search_total, 4),
            "생성_pass_율": round(gen_pass / gen_total, 4),
            "생성_partial_율": round(gen_partial / gen_total, 4),
            "생성_fail_율": round(gen_fail / gen_total, 4),
            "E형_문항수": e_total,
            "E형_환각_수": e_hallucination,
        }

    rows.append(_group_metrics(results_df, "전체"))

    # 유형별 (A~G)
    for qtype, sub in sorted(results_df.groupby("유형")):
        rows.append(_group_metrics(sub, f"유형_{qtype}"))

    # 원천별(@접미)
    for suffix, sub in sorted(results_df.groupby("원천_접미")):
        rows.append(_group_metrics(sub, f"원천_{suffix}"))

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 입출력
# ---------------------------------------------------------------------------
def load_golden(path: str) -> pd.DataFrame:
    df = pd.read_excel(path, dtype=str)
    # 컬럼명 표준화
    df.columns = [c.strip() for c in df.columns]
    missing = [c for c in GOLDEN_REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"골든셋에 필수 컬럼이 없습니다: {missing}")
    # ID 공백 제거
    df["ID"] = df["ID"].astype(str).str.strip()
    df["유형"] = df["유형"].astype(str).str.strip()
    return df


def load_log(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    responses: dict[str, dict[str, Any]] = {}
    for resp in data.get("responses", []):
        qid = str(resp.get("id", "")).strip()
        if qid:
            responses[qid] = resp
    return {"meta": data.get("meta", {}), "responses": responses}


def load_mapping(path: str | None) -> pd.DataFrame | None:
    if not path:
        return None
    df = pd.read_excel(path, dtype=str)
    df.columns = [c.strip() for c in df.columns]
    if "ID" not in [c.upper() for c in df.columns]:
        raise ValueError("매핑시트에 ID 컬럼이 필요합니다.")
    # ID 컬럼명 표준화
    for c in df.columns:
        if c.upper() == "ID":
            df.rename(columns={c: "ID"}, inplace=True)
            break
    df["ID"] = df["ID"].astype(str).str.strip()
    return df


def compute_scores(
    golden_df: pd.DataFrame,
    log_data: dict[str, Any],
    mapping_df: pd.DataFrame | None = None,
) -> pd.DataFrame:
    mapping_lookup = build_mapping_lookup(mapping_df)
    responses = log_data.get("responses", {})

    records: list[dict[str, Any]] = []
    for _, row in golden_df.iterrows():
        qid = str(row.get("ID", ""))
        qtype = str(row.get("유형", ""))
        response = responses.get(qid)

        if qtype.startswith("E"):
            search_score = "해당없음"
            chunk_strict = False
            gen_score, missing = "해당없음", []
            e_score, e_hallucination = score_e_type(row, response)
        else:
            search_score, chunk_strict = score_search(row, response, mapping_lookup)
            gen_score, missing = score_generation(row, response)
            e_score, e_hallucination = "해당없음", False

        failure_tag = determine_failure_tag(qtype, search_score, gen_score, e_hallucination)

        records.append(
            {
                "ID": qid,
                "유형": qtype,
                "질문": row.get("질문", ""),
                "원천_접미": source_suffix(qid, row),
                "검색": search_score,
                "chunk_엄격일치": chunk_strict,
                "생성": gen_score if not qtype.startswith("E") else e_score,
                "누락_요소": "; ".join(missing),
                "E형_환각": e_hallucination,
                "실패_태그": failure_tag,
            }
        )

    return pd.DataFrame(records)


def write_outputs(
    results_df: pd.DataFrame,
    summary_df: pd.DataFrame,
    missing_docs: list[dict[str, Any]],
    output_dir: Path,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    # JSON
    json_path = output_dir / "score_report.json"
    report = {
        "meta": {
            "total_items": len(results_df),
            "scored_at": pd.Timestamp.now().isoformat(),
        },
        "summary": summary_df.to_dict(orient="records"),
        "details": results_df.to_dict(orient="records"),
        "missing_source_suspicion": missing_docs,
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # Excel 4시트
    xlsx_path = output_dir / "score_report.xlsx"
    defects = results_df[results_df["실패_태그"].astype(str).str.strip() != ""].copy()
    missing_df = pd.DataFrame(missing_docs)

    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        summary_df.to_excel(writer, sheet_name="요약", index=False)
        results_df.to_excel(writer, sheet_name="문항별", index=False)
        defects.to_excel(writer, sheet_name="결함목록", index=False)
        (missing_df if not missing_df.empty else pd.DataFrame(columns=["문서_식별자", "해당_문항수", "예시_문항ID"])).to_excel(
            writer, sheet_name="인입누락의심", index=False
        )

    print(f"[저장 완료] {json_path}")
    print(f"[저장 완료] {xlsx_path}")


# ---------------------------------------------------------------------------
# 자가검증 (칼나리아)
# ---------------------------------------------------------------------------
def selftest() -> bool:
    """가상 골든셋/로그로 채점기 정합성 검증."""
    golden_data = [
        {
            "ID": "RC-A001",
            "유형": "A",
            "질문": "테스트 질문 A",
            "정답 (필수 포함 요소)": "정답입니다 / 필수: 1.1.0, 2026.01.23",
            "합격 기준": "근거 top-5 내 AND 필수 포함",
            "근거 출처": "RC-TEST-001 | https://example.com/guide.pdf",
            "근거 원문 발췌": "가이드 버전은 1.1.0입니다.",
        },
        {
            "ID": "RC-B001",
            "유형": "B",
            "질문": "테스트 질문 B",
            "정답 (필수 포함 요소)": "필수: 토큰 기반 인증, Secret Key",
            "합격 기준": "근거 top-5 내 AND 필수 포함",
            "근거 출처": "RC-TEST-002 | https://example.com/auth.pdf",
            "근거 원문 발췌": "토큰 기반 인증을 사용합니다.",
        },
        {
            "ID": "RC-E001",
            "유형": "E",
            "질문": "없는 내용 질문",
            "정답 (필수 포함 요소)": "(무응답 함정)",
            "합격 기준": "거절 응답",
            "근거 출처": "RC-TEST-003 | https://example.com/none.pdf",
            "근거 원문 발췌": "",
        },
    ]
    golden_df = pd.DataFrame(golden_data)

    correct_log = {
        "meta": {"run_date": "2026-01-01", "system_version": "test-correct"},
        "responses": [
            {
                "id": "RC-A001",
                "hits": [
                    {
                        "rank": 1,
                        "source_url": "https://example.com/guide.pdf",
                        "chunk_id": "c1",
                        "snippet": "가이드 버전은 1.1.0(2026.01.23)입니다.",
                    }
                ],
                "answer": "최신 버전은 1.1.0이며 2026.01.23에 발행되었습니다.",
            },
            {
                "id": "RC-B001",
                "hits": [
                    {
                        "rank": 1,
                        "source_url": "https://www.example.com/auth.pdf",
                        "chunk_id": "c2",
                        "snippet": "토큰 기반 인증 사용.",
                    }
                ],
                "answer": "토큰 기반 인증(token based authentication)을 사용하며 Secret Key로 API를 호출합니다.",
            },
            {
                "id": "RC-E001",
                "hits": [],
                "answer": "해당 내용은 문서에 없어 확인할 수 없습니다.",
            },
        ],
    }

    wrong_log = {
        "meta": {"run_date": "2026-01-01", "system_version": "test-wrong"},
        "responses": [
            {
                "id": "RC-A001",
                "hits": [
                    {
                        "rank": 1,
                        "source_url": "https://other.com/wrong.pdf",
                        "chunk_id": "c9",
                        "snippet": "...",
                    }
                ],
                "answer": "잘 모르겠습니다.",
            },
            {
                "id": "RC-B001",
                "hits": [
                    {
                        "rank": 1,
                        "source_url": "https://other.com/wrong.pdf",
                        "chunk_id": "c2",
                        "snippet": "...",
                    }
                ],
                "answer": "ID/PW 기반 인증을 사용합니다.",
            },
            {
                "id": "RC-E001",
                "hits": [
                    {
                        "rank": 1,
                        "source_url": "https://example.com/none.pdf",
                        "chunk_id": "c3",
                        "snippet": "...",
                    }
                ],
                "answer": "E형 질문에 대해 구체적으로 답변을 생성합니다. 내용은 1234입니다.",
            },
        ],
    }

    print("=" * 60)
    print("[자가검증 모드] 가상 골든셋 3문항 × 2개 로그")
    print("=" * 60)

    results_correct = compute_scores(golden_df, {"responses": {r["id"]: r for r in correct_log["responses"]}})
    results_wrong = compute_scores(golden_df, {"responses": {r["id"]: r for r in wrong_log["responses"]}})

    print("\n[① 정답 로그 — 전부 pass 예상]")
    print(results_correct[["ID", "유형", "검색", "생성", "누락_요소", "E형_환각", "실패_태그"]].to_string(index=False))

    print("\n[② 오답 로그 — 전부 fail/환각 예상]")
    print(results_wrong[["ID", "유형", "검색", "생성", "누락_요소", "E형_환각", "실패_태그"]].to_string(index=False))

    # 통과 조건 검사
    checks: list[tuple[str, bool]] = []
    for _, r in results_correct.iterrows():
        ok = (r["검색"] in ("hit_top1", "hit_top5") or r["유형"].startswith("E")) and r["생성"] == "pass"
        checks.append((f"정답 {r['ID']}", ok))
    for _, r in results_wrong.iterrows():
        if r["유형"].startswith("E"):
            ok = r["E형_환각"] is True
        else:
            ok = r["검색"] == "miss" and r["생성"] == "fail"
        checks.append((f"오답 {r['ID']}", ok))

    print("\n[통과 여부]")
    all_pass = True
    for name, ok in checks:
        mark = "PASS" if ok else "FAIL"
        print(f"  {name}: {mark}")
        if not ok:
            all_pass = False

    print("\n" + "=" * 60)
    print(f"자가검증 결과: {'통과' if all_pass else '실패'}")
    print("=" * 60)
    return all_pass


# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="RAG 채점기 (STAGE3 실물 채점)")
    parser.add_argument("--golden", type=str, help="골든셋 엑셀 파일")
    parser.add_argument("--log", type=str, help="응답 로그 JSON 파일")
    parser.add_argument("--mapping", type=str, help="매핑 시트 엑셀 파일 (선택)")
    parser.add_argument("--selftest", action="store_true", help="자가검증 모드 실행")
    parser.add_argument("--outdir", type=str, default=".", help="출력 디렉토리 (기본: 현재 디렉토리)")
    args = parser.parse_args()

    if args.selftest:
        return 0 if selftest() else 1

    if not args.golden or not args.log:
        parser.print_help()
        print("\n오류: --golden 과 --log 는 필수입니다. (또는 --selftest 사용)")
        return 1

    golden_df = load_golden(args.golden)
    log_data = load_log(args.log)
    mapping_df = load_mapping(args.mapping)

    results_df = compute_scores(golden_df, log_data, mapping_df)
    summary_df = summarize(results_df)
    missing_docs = detect_missing_sources(golden_df, log_data.get("responses", {}))

    write_outputs(results_df, summary_df, missing_docs, Path(args.outdir))

    # 간단한 콘솔 요약
    print("\n[요약]")
    print(summary_df.to_string(index=False))
    if missing_docs:
        print(f"\n[인입 누락 의심 문서] {len(missing_docs)}건")
    return 0


if __name__ == "__main__":
    sys.exit(main())
