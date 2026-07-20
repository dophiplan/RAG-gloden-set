import json
from pathlib import Path
from collections import defaultdict
CAT = Path("/Users/nanheekim/eval-runner/orchestrator/catalog")
manifest = json.loads((CAT/"manifest.json").read_text())
meta = json.loads((CAT/"stage_meta.json").read_text())

byprod = defaultdict(lambda: defaultdict(list))
for r in manifest["files"]:
    if r["duplicate_of"]: continue
    byprod[r["product"]][r["stage"]].append(r)

catalog = {"products": {}}
for prod in ["RV","RC","RM","HR"]:
    if prod not in byprod: continue
    stages=[]
    for sm in meta["stages"]:
        files=sorted(byprod[prod].get(sm["key"],[]), key=lambda r:(not r["canonical"], r["file"]))
        stages.append({
            "no": sm["no"], "name": sm["name"], "gate": sm["gate"],
            "what": sm["what"], "consumes": sm["consumes"], "produces": sm["produces"], "tool": sm["tool"],
            "file_count": len(files),
            "files": [{"file":f["file"],"version":f["version"],"canonical":f["canonical"],
                       "size":f["size"],"path":f["dest"]} for f in files]
        })
    catalog["products"][prod]={"stages":stages,
        "total_files": sum(s["file_count"] for s in stages)}
(CAT/"catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2))

# 요약: 트랙 툴팁 미리보기 (RV 예시)
print("catalog.json 생성 · 제품별 파일수:",
      {p: catalog["products"][p]["total_files"] for p in catalog["products"]})
print("\n【 마우스오버 툴팁 미리보기 — RV ⑧ 실물 채점 】")
rv8=[s for s in catalog["products"]["RV"]["stages"] if s["no"]=="⑧"][0]
print("트랙:", rv8["no"], rv8["name"], f"(게이트: {rv8['gate']})")
print("하는 일:", rv8["what"])
print("쓰는 파일:", " / ".join(rv8["consumes"]))
print("만드는 파일:", " / ".join(rv8["produces"]))
print("도구:", rv8["tool"])
print("보유 파일:")
for f in rv8["files"]:
    print(f"   {'★' if f['canonical'] else '·'} {f['file']} ({f['size']:,}B)")
