#!/bin/zsh
# 밤샘_재추출.sh — Kimi 표본 교차확인 → 확인되면 팀장님 데이터 전량 재추출 (3-AI 분담)
# 발주: 난희 2026-08-19 "확인되면 돌려야지" — 판정 기준: Kimi 표본에서도 '우리 지도가 놓친
# 진짜 사실' ≥ 300건이면 확인. 미달이면 여기서 멈추고 보고만.
set -u
cd "$(dirname "$0")/.."
LOG=results/_밤샘재추출.log
echo "=== 대기: Kimi 표본 완료 $(date '+%F %T')" >> $LOG

# 1) Kimi 표본 완주 대기
while pgrep -f "rebase_compare_extract.py CI --rate 20 --role judge" >/dev/null; do sleep 300; done
echo "Kimi 표본 종료 $(date '+%T')" >> $LOG

# 2) Kimi 결과 분류 → 판정
python3 - <<'PY' >> $LOG 2>&1
import json, re, sys, unicodedata
sys.path.insert(0,'tools')
import gen_coverage as gc, map_gapfill as mg
from olib import ledger_append
STRIP = re.compile(r"[^0-9A-Za-zぁ-ヿ一-鿿가-힣]")
def anorm(s): return STRIP.sub("", unicodedata.normalize("NFC", str(s or ""))).lower()
try:
    ck = json.load(open('results/_ckpt_coverage_CI_rebasecmp_judge.json'))['judge']
except Exception as e:
    print("판정 불가 — Kimi 체크포인트 없음:", e); raise SystemExit(1)
units_new = [u for u in ck['units'] if isinstance(u, dict)]
ours = mg.read_map(mg.latest_map('CI'))
our_facts = " § ".join(anorm(u['fact']) for u in ours)
our_corpus = anorm(" ".join(c['text'] for c in gc.load_corpus('CI')))
true_new = 0
for u in units_new:
    f = anorm(u.get('fact',''))
    if len(f) < 15 or f in our_facts: continue
    pos = [int(len(f)*p) for p in (0.2,0.5,0.8)]
    if sum(1 for p in pos if f[p:p+12] and f[p:p+12] in our_facts) >= 2: continue
    if f in our_corpus: true_new += 1
print(f"Kimi 표본: 추출 {len(units_new)} · 진짜 신규 {true_new}")
ledger_append("SCORING","REBASE_CROSSCHECK","script:밤샘_재추출",
              evidence={"Kimi 추출": len(units_new), "진짜 신규": true_new,
                        "판정": "확인" if true_new >= 300 else "미확인 — 전량 재추출 보류"}, product="CI")
raise SystemExit(0 if true_new >= 300 else 1)
PY
if [ $? -ne 0 ]; then
  echo "⏹ 교차확인 미달 — 전량 재추출 보류 (사람 보고)" >> $LOG
  exit 0
fi

# 3) 확인됨 → 전량 재추출 (rate 1 = 전량, 3분담, 주자별 재시도 루프)
echo "✅ 교차확인 통과 — 전량 재추출 시작 $(date '+%T')" >> $LOG
caffeinate -is -w $$ &
run_shard() {  # $1=조각 $2=role $3=이름
  for t in $(seq 1 30); do
    PYTHONUNBUFFERED=1 python3 tools/rebase_compare_extract.py CI --rate 1 --role $2 --shard $1 >> results/_재추출_$3.log 2>&1 && break
    echo "[$3] 시도 $t 중단 — 30분 후 재개" >> $LOG; sleep 1800
  done
  echo "[$3] 조각 $1 종료 $(date '+%T')" >> $LOG
}
run_shard 1/3 generator claude &
P1=$!
run_shard 2/3 judge kimi &
P2=$!
run_shard 3/3 reviewer codex &
P3=$!
wait $P1 $P2 $P3
echo "🏁 전량 재추출 3조각 종료 $(date '+%F %T') — 병합·지도v2는 사람 확인 후" >> $LOG
