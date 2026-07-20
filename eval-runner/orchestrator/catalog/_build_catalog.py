import os, re, json, hashlib, shutil, unicodedata, zipfile
from pathlib import Path
from collections import defaultdict

ROOT = Path("/Users/nanheekim/eval-runner/orchestrator")
DATA = ROOT / "data"
CAT  = ROOT / "catalog"
def nfc(s): return unicodedata.normalize('NFC', s)

STAGE_DIR = {
 "①CORPUS_AUDIT":"01_corpus_audit","②TERRAIN":"02_terrain","③COVERAGE_MAP":"03_coverage_map",
 "④GOLDENSET_BATCH":"04_goldenset_batch","⑤UNIFIED_LEDGER":"05_unified_ledger",
 "⑥CALIBRATION":"06_calibration","⑦STAGE2":"07_stage2","⑧SCORING":"08_scoring",
 "⑨MAINTENANCE":"09_maintenance","?기타":"99_misc"}

def detect_product(fn, path):
    n, p = nfc(fn), nfc(path)
    if "/products/RM/" in p or n.startswith("RM_"): return "RM"
    if "/products/HR/" in p or "인사팀" in n: return "HR"
    if n.startswith("RC") or "RC_" in n or "/RC " in p or "RC 골든셋" in p: return "RC"
    if n.startswith("RV") or "RV_" in n or "/RV" in p: return "RV"
    if "/tools/score_out" in p or "RC_RAG" in n: return "RC"
    if ("/tools/inputs" in p or "/tools/results" in p) and "2axis" in n: return "RC"
    if "CANARY" in n or n=="3rd_input.json": return "RC"
    return "?"

def detect_stage(fn, path):
    n, p = nfc(fn), nfc(path)
    if "질문셋" in n or "제품명보강" in n or "응답로그" in n or "score_report" in n or "성적표" in n or "1차평가" in n or "/score_out" in p: return "⑧SCORING"
    if "커버리지맵" in n: return "③COVERAGE_MAP"
    if "본판정" in n or ("판정대장" in n): return "⑦STAGE2"
    if "캘리브레이션" in n or "판정30" in n or "블라인드" in n or "대조표" in n or "judge" in n.lower() or "2axis" in n or "/2축" in p or "CANARY" in n: return "⑥CALIBRATION"
    if "통합STAGE" in n or "통합_STAGE" in n or "STAGE1_통합" in n or ("통합" in n and "대장" in n) or "최종합본" in n: return "⑤UNIFIED_LEDGER"
    if "사람확정" in n: return "④GOLDENSET_BATCH"
    if "골든셋" in n and (re.search(r'B\d', n) or "파일럿" in n or "마감" in n or "문항" in n or "SPEC" in n or "MANUAL" in n or "TERMS" in n or "NOTICE" in n or "BROCHURE" in n or "WEB" in n): return "④GOLDENSET_BATCH"
    if "골든셋" in n: return "⑤UNIFIED_LEDGER"
    if "corpus" in n.lower() or "코퍼스" in n: return "①CORPUS_AUDIT"
    if "terrain" in n.lower(): return "②TERRAIN"
    if "3rd_input" in n or "3차입력" in n: return "⑥CALIBRATION"
    return "?기타"

def ver_of(n):
    m = re.search(r'v\d+[._]\d+', nfc(n))
    return m.group().replace('.','_') if m else ""
def group_key(n, prod, stage):
    g = re.sub(r'v\d+[._]\d+','', nfc(n))       # drop version
    g = re.sub(r'_?완료|_?disposition반영|_?최종','', g)
    return f"{prod}|{stage}|{g}"

# ── 1) files*.zip 풀어서 임시 폴더에 배치
EX = Path("/tmp/rv_zip_ex"); EX.mkdir(exist_ok=True)
zsrc = Path("/Users/nanheekim/Downloads/RV_골든셋")
for z in sorted(zsrc.glob("files*.zip")):
    zf = zipfile.ZipFile(z)
    for info in zf.infolist():
        if info.filename.startswith('__MACOSX') or info.filename.endswith('/'): continue
        try: name = nfc(info.filename.encode('cp437').decode('utf-8'))
        except: name = nfc(info.filename)
        (EX/name).write_bytes(zf.read(info))

SOURCES = [
    Path("/Users/nanheekim/Downloads/RV_골든셋"),
    Path("/Users/nanheekim/Downloads/RV 커버리지맵 "),
    Path("/Users/nanheekim/eval-runner/tools"),
    Path("/Users/nanheekim/eval-runner/products"),
    EX,
]
EXT_OK = ('.xlsx','.json','.csv','.md')   # zip/py/pyc 제외, 프롬프트 md는 포함
def want(fn):
    n=nfc(fn)
    if n.startswith('.') or n.endswith(('.pyc','.py','.zip')): return False
    if n.endswith('.md') and not ('프롬프트' in n or 'diff' in n or '요약보고' in n): return False
    return n.lower().endswith(EXT_OK)

seen_hash = {}   # hash -> first dest rel
records = []
for src in SOURCES:
    if not src.exists(): continue
    for root,dirs,files in os.walk(src):
        dirs[:]=[d for d in dirs if not d.startswith('.') and d!='__pycache__' and d!='옛날문서']
        for fn in files:
            if not want(fn): continue
            fp = Path(root)/fn
            try: raw = fp.read_bytes()
            except: continue
            h = hashlib.sha256(raw).hexdigest()
            prod = detect_product(fn, str(fp))
            stage = detect_stage(fn, str(fp))
            sd = STAGE_DIR[stage]
            destdir = DATA/prod/sd
            destdir.mkdir(parents=True, exist_ok=True)
            dest = destdir/nfc(fn)
            dup = h in seen_hash
            if not dup:
                if not dest.exists(): dest.write_bytes(raw)
                seen_hash[h]=str(dest.relative_to(DATA))
            records.append({
                "file": nfc(fn), "product": prod, "stage": stage, "stage_dir": sd,
                "version": ver_of(fn), "size": len(raw), "sha256": h,
                "group": group_key(fn, prod, stage), "duplicate_of": seen_hash[h] if dup else None,
                "src": nfc(str(fp)), "dest": None if dup else str(dest.relative_to(DATA)),
            })

# ── 정본(정본=그룹내 최고버전) 태깅
bygroup = defaultdict(list)
for r in records:
    if not r["duplicate_of"]: bygroup[r["group"]].append(r)
for g, items in bygroup.items():
    best = max(items, key=lambda r:(r["version"], r["file"]))
    for r in items: r["canonical"] = (r is best)
for r in records:
    if r["duplicate_of"]: r["canonical"]=False
    r.setdefault("canonical", False)

manifest = {"generated_stage":"G0", "root":"orchestrator/data", "count":len(records), "files":records}
(CAT/"manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

# 요약
print(f"복사 완료: {len([r for r in records if r['dest']])}개 (중복 {len([r for r in records if r['duplicate_of']])}개 스킵)\n")
grid=defaultdict(lambda: defaultdict(int))
canon=defaultdict(lambda: defaultdict(list))
for r in records:
    grid[r["product"]][r["stage"]]+=1
    if r["canonical"]: canon[r["product"]][r["stage"]].append(r["file"])
for prod in ["RV","RC","RM","HR","?"]:
    if prod not in grid: continue
    print(f"━━ {prod} ━━")
    for st in sorted(grid[prod]):
        cs=canon[prod].get(st,[])
        print(f"  {st}: {grid[prod][st]}개" + (f"  ▶정본: {', '.join(cs[:3])}" if cs else ""))
    print()
