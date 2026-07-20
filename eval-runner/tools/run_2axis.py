#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_2axis.py — RC 골든셋 2축 판정 배치 자동 투입기
사용법:
  1) pip install requests
  2) 환경변수 설정 (아래 '설정' 참고)
  3) python run_2axis.py
동작:
  - inputs/ 폴더의 2axis_input_B02.json ~ B30.json을 순서대로 API에 투입
  - 배치마다 독립 호출(대화 공유 없음 = "새 창"과 동일 효과)
  - 응답에서 JSON 배열을 추출해 results/2axis_result_BNN.json 저장
  - 개수·id 자동 대조, 누락 시 해당 id만 재요청(최대 2회)
  - 이미 결과가 있는 배치는 건너뜀(중단 후 재실행 안전)
"""
import os, re, json, glob, time, sys
import requests

# ===================== 설정 =====================
# Kimi(Moonshot):  BASE_URL="https://api.moonshot.ai/v1"  MODEL은 콘솔에서 확인 (예: "kimi-k2-...")
# GPT(OpenAI):     BASE_URL="https://api.openai.com/v1"   MODEL 예: "gpt-4o"
BASE_URL = os.environ.get("A2_BASE_URL", "https://api.moonshot.ai/v1")
API_KEY  = os.environ.get("A2_API_KEY", "")           # 필수! 키 없으면 실행 불가
MODEL    = os.environ.get("A2_MODEL", "CHANGE_ME")    # 필수! 콘솔의 실제 모델명으로
INPUT_DIR  = "inputs"    # 2axis_input_B*.json 넣어둘 폴더
RESULT_DIR = "results"   # 결과 저장 폴더
PROMPT_FILE = "judge_prompt_2axis_표준.md"
REINFORCE = (
    '\n\n위 프롬프트의 "출력(JSON만)" 형식을 그대로 따라라. 각 문항마다 verdict와 checks 6항목을 '
    '포함한 JSON 배열 하나로만 답하라. 각 문항의 reason에는 그 문항의 구체 내용(수치·기능명·조건)을 '
    '반드시 인용하라 — 일반 문구 반복 금지. type=E 문항은 evidence_excerpt 필드가 실제로 null인지 '
    '눈으로 확인하고, null이 아니면 무조건 E형 fail·반려하라. 문항 수 = 판정 수.\n'
)
SLEEP_BETWEEN = 5   # 배치 간 대기(초) — 요금제 rate limit 보호
# ================================================

def die(msg):
    print(f"[중단] {msg}"); sys.exit(1)

def call_api(system_prompt, user_content):
    r = requests.post(
        f"{BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        json={"model": MODEL, "temperature": 1,
              "messages": [{"role": "system", "content": system_prompt},
                           {"role": "user", "content": user_content}]},
        timeout=600)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]

def extract_json_array(text):
    m = re.search(r"\[.*\]", text, re.S)
    if not m: raise ValueError("응답에서 JSON 배열을 찾지 못함")
    return json.loads(m.group(0))

def main():
    if not API_KEY: die("A2_API_KEY 환경변수가 비어 있다. API 키부터 준비해라.")
    if MODEL == "CHANGE_ME": die("A2_MODEL을 실제 모델명으로 바꿔라 (콘솔에서 확인).")
    if not os.path.exists(PROMPT_FILE): die(f"{PROMPT_FILE} 이 스크립트와 같은 폴더에 있어야 한다.")
    os.makedirs(RESULT_DIR, exist_ok=True)
    prompt = open(PROMPT_FILE, encoding="utf-8").read() + REINFORCE

    files = sorted(glob.glob(os.path.join(INPUT_DIR, "2axis_input_B*.json")))
    if not files: die(f"{INPUT_DIR}/ 에 입력 JSON이 없다.")
    print(f"입력 배치 {len(files)}개 발견")

    for f in files:
        bname = re.search(r"(B\d+)", os.path.basename(f)).group(1)
        out = os.path.join(RESULT_DIR, f"2axis_result_{bname}.json")
        if os.path.exists(out):
            print(f"[{bname}] 결과 존재 — 건너뜀"); continue
        batch = json.load(open(f, encoding="utf-8"))
        items = batch["items"]; want = {it["id"] for it in items}
        print(f"[{bname}] {len(items)}문항 투입...")

        results = []
        payload_items = items
        for attempt in range(3):  # 최초 1회 + 누락 재요청 2회
            content = json.dumps({"batch": bname, "count": len(payload_items),
                                  "items": payload_items}, ensure_ascii=False)
            try:
                raw = call_api(prompt, content)
                got = extract_json_array(raw)
            except Exception as e:
                print(f"  시도 {attempt+1} 실패: {e}"); time.sleep(10); continue
            have = {r.get("id") for r in results}
            results += [g for g in got if g.get("id") in want and g.get("id") not in have]
            missing = want - {r["id"] for r in results}
            if not missing:
                break
            print(f"  누락 {len(missing)}건 재요청...")
            payload_items = [it for it in items if it["id"] in missing]
            time.sleep(3)
        missing = want - {r["id"] for r in results}
        if missing:
            print(f"  [경고] {bname} 최종 누락 {len(missing)}건: {sorted(missing)[:5]} — 결과는 저장하되 검수에서 처리")
        json.dump(results, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"  저장: {out} ({len(results)}건)")
        time.sleep(SLEEP_BETWEEN)

    print("\n완료. results/ 폴더를 통째로 검수자(설계본부)에게 제출하라.")

if __name__ == "__main__":
    main()
