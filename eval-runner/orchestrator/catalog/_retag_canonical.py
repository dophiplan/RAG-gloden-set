import json, re
from pathlib import Path
from collections import defaultdict
CAT = Path("/Users/nanheekim/eval-runner/orchestrator/catalog")
m = json.loads((CAT/"manifest.json").read_text())

def parse(fn):
    """(base_lineage, version_tuple) — '_vX_Y[_Z]' 를 버전으로, 그 앞을 계열로."""
    n = re.sub(r'\.(xlsx|json|csv|md)$','', fn)
    mt = re.search(r'_v(\d+(?:_\d+)+)$', n) or re.search(r'_v(\d+(?:_\d+)+)', n)
    if mt:
        base = n[:mt.start()]
        ver = tuple(int(x) for x in mt.group(1).split('_'))
    else:
        base, ver = n, (0,)
    # '완료','최종' 등 꼬리 정규화
    base = re.sub(r'_(완료|최종|disposition반영)$','',base)
    return base, ver

# 계열 그룹 = product|stage|base
grp = defaultdict(list)
for r in m["files"]:
    if r["duplicate_of"]: 
        r["canonical"]=False; continue
    base, ver = parse(r["file"])
    r["_base"]=base; r["_ver"]=ver
    grp[f'{r["product"]}|{r["stage"]}|{base}'].append(r)

for g, items in grp.items():
    best = max(items, key=lambda r:r["_ver"])
    for r in items: r["canonical"]=(r is best)

for r in m["files"]:
    r.pop("_base",None); r.pop("_ver",None)
    r["group"]=f'{r["product"]}|{r["stage"]}|'+parse(r["file"])[0] if not r["duplicate_of"] else r["group"]

(CAT/"manifest.json").write_text(json.dumps(m,ensure_ascii=False,indent=2))

# 확인: RV 커버리지맵 계열별 정본
print("RV ③ 커버리지맵 정본 판정:")
for r in sorted([x for x in m["files"] if x["product"]=="RV" and x["stage"]=="③COVERAGE_MAP" and not x["duplicate_of"]], key=lambda x:x["file"]):
    print(f"   {'★정본' if r['canonical'] else '  이력'}  {r['file']}")
