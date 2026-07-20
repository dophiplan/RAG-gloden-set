"""핸드오프 관리 - kit/ 경로 참조"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common.log import log

KIT_DIR = Path(__file__).parent.parent / "kit"
JUDGE_PROMPT_FILE = KIT_DIR / "judge_prompt_2axis_표준.md"
THIRD_PROMPT_FILE = KIT_DIR / "3차_교차검토_프롬프트.md"


def get_product_dir(product: str) -> Path:
    return Path(__file__).parent.parent / "products" / product


def get_prompt_content(prompt_path: Path) -> str:
    """프롬프트 파일 내용 읽기"""
    if prompt_path.exists():
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    return f"[{prompt_path.name} 파일 없음 - kit/ 폴터 확인]"


def prepare_2axis_handoff(product: str) -> dict:
    """2축 핸드오프 준비"""
    from make_batches import make_batches
    
    product_dir = get_product_dir(product)
    handoff_dir = product_dir / "handoff"
    goldenset_path = product_dir / "goldenset_draft.xlsx"
    
    if not goldenset_path.exists():
        raise FileNotFoundError(f"goldenset_draft.xlsx 없음: {goldenset_path}")
    
    # 배치 분할
    result = make_batches(product, goldenset_path, handoff_dir, batch_size=15)
    
    # 프롬프트 내용 읽기
    judge_content = get_prompt_content(JUDGE_PROMPT_FILE)
    
    instruction = f"""
╔══════════════════════════════════════════════════════════════════╗
║  2축 검증 핸드오프 (헌법 §2.1: 생성과 다른 AI에 돌려라)        ║
╚══════════════════════════════════════════════════════════════════╝

[준비된 파일]
- 총 문항: {result['total_items']}건
- 배치 수: {result['batch_count']}개
- 위치: {handoff_dir}/

[Judge 프롬프트 (kit/{JUDGE_PROMPT_FILE.name})]
{judge_content[:1000]}...
[...중략...]

[실행 절차]
1. 새로운 AI 세션을 엽니다 (Claude 새 채팅 / GPT 등)
   ⚠️ 중요: 골든셋을 생성한 세션과 반드시 다른 세션이어야 함!

2. 위 Judge 프롬프트를 새 세션에 업로드/복사

3. 배치 파일을 순서대로 복사해 검증 요청:
   {', '.join(result['batch_files'][:3])}{'...' if len(result['batch_files']) > 3 else ''}

4. 각 배치 결과를 JSON으로 저장:
   - 저장 위치: {handoff_dir}/batchXX_results.json

5. 완료 후 수집:
   $ python tools/goldenset.py collect --product {product} --node 4_2axis_handoff
"""
    
    log(product, "4_2axis_handoff", goldenset_path.name,
        f"핸드오프 준비: {result['batch_count']}배치", "§2.1/HANDOFF")
    
    return {
        "status": "ready",
        "instruction": instruction,
        "batches": result['batch_files'],
        "handoff_dir": str(handoff_dir),
        "prompt_file": str(JUDGE_PROMPT_FILE)
    }


def collect_2axis_results(product: str) -> dict:
    """2축 결과 수집"""
    from collect_2axis import collect_2axis
    
    product_dir = get_product_dir(product)
    handoff_dir = product_dir / "handoff"
    jsonl_path = handoff_dir / "goldenset_2axis.jsonl"
    
    result = collect_2axis(product, handoff_dir, jsonl_path if jsonl_path.exists() else None)
    
    can_proceed = result['meta']['missing_count'] == 0
    
    if can_proceed:
        log(product, "4_2axis_handoff", "handoff/*.json",
            f"수집 완료: 타당 {result['meta']['by_verdict'].get('타당', 0)}건", "§2.1")
    else:
        log(product, "4_2axis_handoff", "handoff/*.json",
            f"누락 {result['meta']['missing_count']}건 재실행 필요", "§4.4")
    
    return {
        "status": "collected" if can_proceed else "incomplete",
        "by_verdict": result['meta']['by_verdict'],
        "missing_ids": result['meta']['missing_ids'],
        "can_proceed": can_proceed
    }


def prepare_3rd_handoff(product: str) -> dict:
    """3차 핸드오프 준비"""
    product_dir = get_product_dir(product)
    handoff_dir = product_dir / "handoff"
    judge_results = handoff_dir / "judge_results.json"
    
    if not judge_results.exists():
        raise FileNotFoundError("judge_results.json 없음. 2축 수집 먼저 실행.")
    
    with open(judge_results, 'r', encoding='utf-8') as f:
        judge_data = json.load(f)
    
    # 의심/반려 항목 추출
    review_items = (
        judge_data.get('verdict_details', {}).get('의심', []) +
        judge_data.get('verdict_details', {}).get('반려', [])
    )
    
    # 3차 프롬프트 읽기
    third_content = get_prompt_content(THIRD_PROMPT_FILE)
    
    # 입력 파일 생성
    third_input = {
        "meta": {"product": product, "total_items": len(review_items), "items": review_items},
        "for_review": []
    }
    
    jsonl_path = handoff_dir / "goldenset_2axis.jsonl"
    id_to_item = {}
    if jsonl_path.exists():
        with open(jsonl_path, 'r', encoding='utf-8') as f:
            for line in f:
                item = json.loads(line.strip())
                id_to_item[item['id']] = item
    
    for item_id in review_items:
        if item_id in id_to_item:
            third_input['for_review'].append({
                "id": item_id,
                "goldenset": id_to_item[item_id],
                "judge_result": next((r for r in judge_data.get('results', []) if r.get('id') == item_id), {})
            })
    
    third_input_path = handoff_dir / "3rd_review_input.json"
    with open(third_input_path, 'w', encoding='utf-8') as f:
        json.dump(third_input, f, ensure_ascii=False, indent=2)
    
    instruction = f"""
╔══════════════════════════════════════════════════════════════════╗
║  3차 교차검토 핸드오프 (헌법 §2.1: 2축과도 다른 AI 권장)        ║
╚══════════════════════════════════════════════════════════════════╝

[준비된 파일]
- 검토 대상: {len(review_items)}건
- 위치: {handoff_dir}/3rd_review_input.json

[3차 프롬프트 (kit/{THIRD_PROMPT_FILE.name})]
{third_content[:800]}...
[...중략...]

[실행 절차]
1. 또 다른 AI 세션 열기 (2축과도 다른 세션 권장)
2. 위 3차 프롬프트 업로드
3. 3rd_review_input.json 내용 복사해 분류 요청
4. 결과를 3rd_classification.json으로 저장
5. 완료 후 수집
"""
    
    log(product, "5_3rd_handoff", "judge_results.json",
        f"3차 준비: {len(review_items)}건", "§2.1/3차")
    
    return {
        "status": "ready",
        "instruction": instruction,
        "review_items": review_items,
        "input_file": str(third_input_path),
        "prompt_file": str(THIRD_PROMPT_FILE)
    }


def collect_3rd_results(product: str) -> dict:
    """3차 결과 수집"""
    product_dir = get_product_dir(product)
    handoff_dir = product_dir / "handoff"
    
    third_result_files = list(handoff_dir.glob("*3rd*.json"))
    if not third_result_files:
        raise FileNotFoundError("3차 결과 파일 없음")
    
    with open(third_result_files[0], 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    classification = data.get('classification', data.get('results', []))
    summary = {'A': [], 'B': [], 'C': [], 'reverse': []}
    
    for item in classification:
        cat = item.get('category', item.get('class', 'A'))
        item_id = item.get('id', 'unknown')
        if cat in summary:
            summary[cat].append(item_id)
        elif '역검출' in str(cat) or 'reverse' in str(cat).lower():
            summary['reverse'].append(item_id)
    
    confirm_items = summary['A'] + summary['reverse']
    
    log(product, "5_3rd_handoff", third_result_files[0].name,
        f"3차 완료: A {len(summary['A'])}/역검출 {len(summary['reverse'])} → 확정", "§2.4")
    
    return {
        "status": "collected",
        "classification": summary,
        "confirm_items": confirm_items,
        "confirm_count": len(confirm_items)
    }


if __name__ == '__main__':
    # 테스트
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--product', '-p', required=True)
    parser.add_argument('--prepare-2axis', action='store_true')
    parser.add_argument('--collect-2axis', action='store_true')
    args = parser.parse_args()
    
    if args.prepare_2axis:
        result = prepare_2axis_handoff(args.product)
        print(result['instruction'])
    elif args.collect_2axis:
        result = collect_2axis_results(args.product)
        print(json.dumps(result, ensure_ascii=False, indent=2))
