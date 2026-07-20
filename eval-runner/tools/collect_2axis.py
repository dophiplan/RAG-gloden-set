"""2축 검증 결과 집계"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common.log import log, log_batch


def load_judge_results(handoff_dir: Path) -> list:
    results = []
    for json_file in sorted(handoff_dir.glob('*.json')):
        if json_file.name == 'judge_results.json':
            continue
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    results.extend(data)
                elif isinstance(data, dict):
                    results.append(data)
        except:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            results.append(json.loads(line))
            except:
                pass
    return results


def load_expected_ids(jsonl_path: Path) -> set:
    ids = set()
    if not jsonl_path.exists():
        return ids
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                try:
                    item = json.loads(line)
                    if 'id' in item:
                        ids.add(item['id'])
                except:
                    pass
    return ids


def collect_2axis(product: str, handoff_dir: Path, goldenset_jsonl_path: Path = None) -> dict:
    judge_results = load_judge_results(handoff_dir)
    
    result_ids = set()
    id_to_verdict = {}
    
    for result in judge_results:
        item_id = result.get('id')
        if item_id:
            result_ids.add(item_id)
            id_to_verdict[item_id] = result.get('verdict', 'unknown')
    
    expected_ids = load_expected_ids(goldenset_jsonl_path) if goldenset_jsonl_path else set()
    missing_ids = expected_ids - result_ids
    
    verdict_counts = {'타당': 0, '의심': 0, '반려': 0, 'unknown': 0}
    verdict_details = {'타당': [], '의심': [], '반려': [], 'unknown': []}
    
    for item_id in expected_ids:
        verdict = id_to_verdict.get(item_id, 'unknown')
        verdict_counts[verdict] = verdict_counts.get(verdict, 0) + 1
        verdict_details[verdict].append(item_id)
    
    result = {
        'meta': {
            'product': product,
            'total_expected': len(expected_ids),
            'total_received': len(result_ids),
            'by_verdict': {
                '타당': verdict_counts['타당'],
                '의심': verdict_counts['의심'],
                '반려': verdict_counts['반려']
            },
            'missing_ids': sorted(list(missing_ids)),
            'missing_count': len(missing_ids)
        },
        'verdict_details': verdict_details,
        'results': judge_results
    }
    
    output_path = handoff_dir / 'judge_results.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    log_entries = [
        (f"2축 집계: 타당 {verdict_counts['타당']}건", "DEC-010"),
        (f"2축 집계: 의심 {verdict_counts['의심']}건", "DEC-010"),
        (f"2축 집계: 반려 {verdict_counts['반려']}건", "DEC-010"),
    ]
    if missing_ids:
        log_entries.append((f"누락 ID {len(missing_ids)}건", "§4.4"))
    
    log_batch(product, '4_2axis_collect', 'handoff/*.json', log_entries)
    
    return result


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--product', '-p', required=True)
    parser.add_argument('--handoff-dir', '-d', required=True, type=Path)
    parser.add_argument('--goldenset-jsonl', '-g', type=Path)
    args = parser.parse_args()
    
    result = collect_2axis(args.product, args.handoff_dir, args.goldenset_jsonl)
    print(json.dumps(result['meta'], ensure_ascii=False, indent=2))
