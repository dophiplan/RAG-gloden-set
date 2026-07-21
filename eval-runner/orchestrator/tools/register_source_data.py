#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
register_source_data.py — [T18] 원문 데이터 해시 등재 (사람 명령)

응답로그·질문셋 '원본'의 sha256을 catalog/manifest_원문데이터.json 에 등재한다.
등재된 파일은 채점·발행 전 대조되며 불일치 = 정지 — 이번 개명 치환 사고 같은
원문 변조를 다음엔 기계가 잡는다 (규칙 B′의 데이터 확장).

사용: python3 tools/register_source_data.py <파일|글롭...> --actor 난희
예:   python3 tools/register_source_data.py 'data/RC/08_scoring/*.json' --actor 난희
주의: 생성 산출물(질문셋 발행본 xlsx 등 매회 재생성되는 파일)은 등재하지 말 것.
"""
import argparse
import glob
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from olib import ROOT, ledger_append
from scoring import source_hash_gate


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+", help="파일 경로 또는 글롭 (orchestrator 기준 상대)")
    ap.add_argument("--actor", default="난희")
    a = ap.parse_args()
    files = []
    for pat in a.paths:
        hits = glob.glob(str(ROOT / pat)) if not Path(pat).is_absolute() else glob.glob(pat)
        files += [Path(h) for h in hits if Path(h).is_file()]
    if not files:
        sys.exit("대상 파일 없음")
    bad, newly = source_hash_gate(files, register_new=True)
    if bad:
        print("⚠ 이미 등재된 파일과 불일치 — 등재값은 유지됨 (변조 의심, 원장 확인):")
        for b in bad:
            print("  ", b)
    if newly:
        ledger_append("MAINTENANCE", "SOURCE_DATA_REGISTERED", f"사람:{a.actor}",
                      evidence={"등재": newly, "건수": len(newly),
                                "성격": "T18 원문 해시 초기 등재 — 이후 변조 시 채점·발행 정지"})
    print(f"등재 {len(newly)}건 · 기존 {len(files)-len(newly)-len(bad)}건 · 불일치 {len(bad)}건")


if __name__ == "__main__":
    main()
