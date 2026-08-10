#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
llm.py — 공통 LLM 클라이언트 (사양서 §3 모델 어댑터의 실행부)

- config.models.<role> {provider, model, api_key_env} 로 호출.
- provider: openai 호환(moonshot/openai/…) REST · anthropic REST.
- 키가 없고 ORCH_MOCK=1 이면 결정적 mock 백엔드 — 전 트랙 E2E 검증용.
  (mock 은 난수·시계 없이 입력의 해시로만 동작 — 재실행 시 동일 산출)
- 규칙 B: 세션 없음 — 매 호출이 독립 (대화 상태를 만들 방법 자체가 없다).
"""
import hashlib
import json
import os
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from olib import load_config


def N(s):
    return unicodedata.normalize("NFC", str(s)) if s is not None else ""


def is_mock():
    return os.environ.get("ORCH_MOCK") == "1"


def chat(role, system, user, cfg=None, max_tokens=4000):
    """단발 호출 — 반환: 응답 텍스트. 키 없으면 mock(ORCH_MOCK=1) 또는 예외."""
    cfg = cfg or load_config()
    m = cfg["models"].get(role)
    if is_mock():
        return _mock_chat(role, system, user)
    if not m:
        raise RuntimeError(f"config.models.{role} 미설정")
    provider = m.get("provider", "openai")
    if provider == "cli":
        # [v2 결정] 계정(구독) 기반 CLI 앙상블 — API 키 대신 구독 로그인된 CLI 호출
        return _cli(m, system, user)
    key = os.environ.get(m.get("api_key_env", ""), "")
    if not key:
        raise RuntimeError(f"{m.get('api_key_env')} 미설정 — 키를 넣거나 ORCH_MOCK=1 로 모의 실행")
    if provider == "anthropic":
        return _anthropic(m["model"], key, system, user, max_tokens)
    base = {"moonshot": "https://api.moonshot.ai/v1",
            "openai": "https://api.openai.com/v1"}.get(provider, m.get("base_url", ""))
    # K3 같은 추론 모델은 '생각'에도 이 예산을 쓴다 — 기본이 작으면 답이 잘리거나 빈 채로 옴
    return _openai_compat(base, m["model"], key, system, user,
                          m.get("max_tokens", max(max_tokens, 16384)),
                          temperature=m.get("temperature", 0.3))


def _cli(m, system, user):
    """구독 CLI 어댑터 — 예: {provider: cli, command: [claude, -p], model: ...}
    프롬프트는 stdin. 세션 없음(매 호출 독립) = 규칙 B 유지.
    [FIX-05] 과금 변수 구조적 차단: 자식 env에서 ANTHROPIC_API_KEY 제거."""
    import subprocess
    cmd = m.get("command") or ["claude", "-p"]
    if isinstance(cmd, str):
        cmd = cmd.split()
    if m.get("model"):
        cmd = cmd + ["--model", m["model"]]
    env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
    if os.environ.get("ANTHROPIC_API_KEY"):
        print("⚠ ANTHROPIC_API_KEY 감지 — 구독 과금 방지를 위해 자식 프로세스 env에서 제거하고 호출함 (FIX-05).")
    prompt = f"{system}\n\n---\n\n{user}"
    stdin_input = prompt
    if m.get("prompt_arg"):        # 일부 CLI(codex exec 등)는 프롬프트를 인자로 받음
        # [수리 2026-08-10] 대형 배치에서 argv가 OS 한계(ARG_MAX) 초과 → "Argument list too long".
        # codex exec는 인수 없이(또는 '-') stdin을 읽으므로, 큰 프롬프트는 stdin 폴백.
        if len(prompt.encode("utf-8")) > 100_000:
            cmd = cmd + ["-"]
        else:
            cmd = cmd + [prompt]
            stdin_input = ""
    try:
        p = subprocess.run(cmd, input=stdin_input,
                           capture_output=True, text=True, timeout=1200, env=env)
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"CLI 호출 타임아웃({cmd[0]}, 1200s) — 배치 축소 또는 구독 한도 확인 필요") from e
    if p.returncode != 0:
        raise RuntimeError(f"CLI 호출 실패({cmd[0]}): {p.stderr[:300]}")
    return p.stdout


def _post(url, headers, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")[:400]
        except Exception:
            pass
        raise RuntimeError(f"API {e.code} ({url.split('/')[2]}): {body}") from e


def _openai_compat(base, model, key, system, user, max_tokens, temperature=0.3):
    d = _post(f"{base}/chat/completions", {"Authorization": f"Bearer {key}"},
              {"model": model, "temperature": temperature, "max_tokens": max_tokens,
               "messages": [{"role": "system", "content": system},
                            {"role": "user", "content": user}]})
    ch = d["choices"][0]
    content = ch["message"].get("content") or ""
    fr = ch.get("finish_reason")
    if not content.strip():
        # 빈 응답은 침묵하지 말고 원인을 말한다 (추론 모델이 생각에 예산을 다 쓴 경우 등)
        raise RuntimeError(f"빈 응답 (finish_reason={fr}, max_tokens={max_tokens}) — "
                           "추론 예산 부족 의심: max_tokens 상향 필요")
    if fr == "length":
        # [P2-4] 잘린 응답을 성공으로 넘기면 extract_json이 완전한 객체만 골라 '부분 판정'이
        # 무단 유실된다 (배치 20건 중 15건만 반환 등). 유실보다 정지 — 체크포인트가 재개한다.
        raise RuntimeError(f"응답 절단 (finish_reason=length, max_tokens={max_tokens}) — "
                           "부분 데이터 유실 방지 정지: max_tokens 상향 또는 배치 축소 필요")
    return content


def _anthropic(model, key, system, user, max_tokens):
    d = _post("https://api.anthropic.com/v1/messages",
              {"x-api-key": key, "anthropic-version": "2023-06-01"},
              {"model": model, "max_tokens": max_tokens, "system": system,
               "messages": [{"role": "user", "content": user}]})
    if d.get("stop_reason") == "max_tokens":
        # [P2-4] 절단 응답 = 부분 유실 위험 — 성공 위장 금지
        raise RuntimeError(f"응답 절단 (stop_reason=max_tokens, max_tokens={max_tokens}) — "
                           "부분 데이터 유실 방지 정지: max_tokens 상향 또는 배치 축소 필요")
    return "".join(b.get("text", "") for b in d["content"])


def extract_json(text):
    """응답에서 JSON 추출 — 배열/객체/JSONL(줄당 객체)/코드펜스/전후 설명 모두 허용.
    실모델은 형식이 흔들린다: 배열 대신 JSONL, 코드펜스, 앞뒤 설명. 전부 흡수한다."""
    # 0) 코드펜스 안 내용부터 시도 — 설명문 사이의 ```json [] ``` (빈 배열 포함) 정확 인식
    for m in re.finditer(r"```(?:json)?\s*(.+?)```", text, re.S):
        try:
            return json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            continue
    raw = re.sub(r"```(?:json)?", "", text).strip()
    # 1) 정석: 첫 '[' ~ 마지막 ']' (배열)
    a, b = raw.find("["), raw.rfind("]")
    if a != -1 and b > a:
        try:
            return json.loads(raw[a:b + 1])
        except json.JSONDecodeError:
            pass
    # 2) JSONL / 여러 객체 나열: 개별 {...} 를 전부 파싱해 배열로
    objs = []
    for m in re.finditer(r"\{(?:[^{}]|\{[^{}]*\})*\}", raw, re.S):
        try:
            objs.append(json.loads(m.group(0)))
        except json.JSONDecodeError:
            continue
    if objs:
        return objs if len(objs) > 1 else objs[0]
    # 3) 단일 객체
    a, b = raw.find("{"), raw.rfind("}")
    if a != -1 and b > a:
        return json.loads(raw[a:b + 1])
    raise ValueError("응답에서 JSON을 찾지 못함: " + text[:200])


# ══════════════════ 결정적 MOCK 백엔드 ══════════════════
# 목적: 키 없이 파이프라인 전 트랙(생성→검수→판정→발행→채점)을 기계적으로 관통 검증.
# 원칙: 입력에서만 파생(해시 기반) — 같은 입력이면 언제나 같은 출력.

def _mock_chat(role, system, user):
    task = None
    for t in ("COVERAGE_UNITS", "COVERAGE_MERGE", "GOLDENSET_ITEMS", "JUDGE_VERDICTS", "ALLOCATION_PLAN"):
        if f"[TASK:{t}]" in system:
            task = t
            break
    if task == "COVERAGE_MERGE":
        # 결정적 병합: fact 정규화 중복 제거 후 그대로 반환
        d = json.loads(user)
        seen, out = set(), []
        for u in d["units"]:
            k = re.sub(r"\s+", "", N(u.get("fact", ""))).lower()
            if k and k not in seen:
                seen.add(k)
                out.append(u)
        return json.dumps(out, ensure_ascii=False)
    if "[TASK:COVERAGE_REVIEW]" in system:
        return json.dumps({"누락 의심": [], "변형 의심": [], "총평": "이상 없음 (모의 검수)"},
                          ensure_ascii=False)
    if task == "COVERAGE_UNITS":
        return _mock_coverage(user)
    if task == "GOLDENSET_ITEMS":
        return _mock_goldenset(user)
    if task == "JUDGE_VERDICTS":
        return _mock_judge(user)
    if task == "ALLOCATION_PLAN":
        return json.dumps({"plan": "단일 배치 B1 — 전 단위 직접 커버", "batches": ["B1"]},
                          ensure_ascii=False)
    return "MOCK: " + hashlib.sha256((system + user).encode()).hexdigest()[:16]


def _sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.다음됨함닙니다])\s+|\n+", N(text)) if len(s.strip()) >= 10]


def _mock_coverage(user):
    """입력: {product, chunks:[{doc,chunk_id,text}]} → 커버 단위 배열"""
    d = json.loads(user)
    units = []
    for ch in d["chunks"]:
        sents = _sentences(ch["text"])
        if not sents:
            continue
        fact = " ".join(sents[:2])
        title = sents[0][:30]
        units.append({
            "unit_id": f"{d['product']}-{N(ch['doc']).upper()[:6]}-{ch['chunk_id']:03d}",
            "type": "Doc", "title": title, "fact": fact,
            "source": ch.get("source", ch["doc"]), "chunk": ch["chunk_id"],
            "question_hint": f"{title} 은(는) 무엇인가?",
        })
    return json.dumps(units, ensure_ascii=False)


def _mock_goldenset(user):
    """입력: {product, prefix, start_no, units:[{unit_id,fact,...}], want_e} → 문항 배열"""
    d = json.loads(user)
    items = []
    no = d["start_no"]
    types = ["A", "G", "C", "F"]
    for i, u in enumerate(d["units"]):
        t = types[int(hashlib.sha256(u["unit_id"].encode()).hexdigest(), 16) % len(types)]
        fact_sent = _sentences(u["fact"])[0]
        # 필수 요소: fact 의 숫자·최장 단어 2개 (결정적)
        toks = re.findall(r"[\w가-힣.%]+", fact_sent)
        nums = [w for w in toks if re.search(r"\d", w)]
        longs = sorted((w for w in toks if len(w) >= 3), key=len, reverse=True)
        req = (nums[:2] + [w for w in longs if w not in nums])[:2] or toks[:1]
        items.append({
            "ID": f"{d['prefix']}-{t}{no:02d}", "유형": t,
            "출제 의도": f"{u['title'][:20]} 확인",
            "질문": f"{d.get('product_name', d['product'])}에서 {u['title'][:24]}에 대해 알려줘.",
            "정답": f"{u['fact']}\n필수: {', '.join(req)}",
            "근거 출처": f"{u['unit_id']} ; https://corpus.local/{u.get('source') or 'doc.md'} § {u['title'][:16]}",
            "합격 기준": "정답 필수 요소 포함 + 근거 출처 실재",
            "근거 원문 발췌": fact_sent,
        })
        no += 1
    if d.get("want_e"):
        items.append({
            "ID": f"{d['prefix']}-E{no:02d}", "유형": "E",
            "출제 의도": "부재 확인(자료에 없음)",
            "질문": f"{d.get('product_name', d['product'])}의 양자암호 전송 기능 설정법을 알려줘.",
            "정답": "자료에 없음 — 해당 기능은 코퍼스에 존재하지 않는다.",
            "근거 출처": "N/A (E형 — 부재 근거)",
            "합격 기준": "부재 인정(자료에 없음) 명시 — 창작/유사 대체 시 0점",
            "근거 원문 발췌": "",
        })
    return json.dumps(items, ensure_ascii=False)


def _mock_judge(user):
    """입력: {items:[{ID,질문,정답,...}], rubric} → 판정 배열 (결정적: 해시 기반 소수 불합격)"""
    d = json.loads(user)
    out = []
    for it in d["items"]:
        h = int(hashlib.sha256(N(it["ID"]).encode()).hexdigest(), 16)
        verdict = "합격" if h % 17 else "부분"     # ~6% 부분 판정 — 재검·대조 경로 검증용
        out.append({"ID": it["ID"], "판정": verdict,
                    "판정문": f"{it['ID']}: 정답 필수 요소 대조 — {verdict}. 근거 출처 실재 확인."})
    return json.dumps(out, ensure_ascii=False)
