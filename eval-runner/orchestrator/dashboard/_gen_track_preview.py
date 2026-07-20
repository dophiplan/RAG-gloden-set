import json
from pathlib import Path
CAT = Path("/Users/nanheekim/eval-runner/orchestrator/catalog")
DASH = Path("/Users/nanheekim/eval-runner/orchestrator/dashboard"); DASH.mkdir(parents=True, exist_ok=True)
catalog = json.loads((CAT/"catalog.json").read_text())
data_js = json.dumps(catalog, ensure_ascii=False)

html = '''<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>파이프라인 트랙 — 트랙 메타/자료 툴팁 프리뷰</title>
<style>
:root{--ink:#12151f;--panel:#1a1f2e;--panel2:#161a27;--line:#2b3247;--tx:#dfe3ef;--tx2:#8e96b0;
--run:#3dd6b0;--human:#e879a8;--input:#d6b23d;--halt:#e85d6f;--doneC:#5a6486;
--mono:'Menlo','Consolas',monospace;--sans:-apple-system,'Apple SD Gothic Neo',sans-serif;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--ink);color:var(--tx);font-family:var(--sans);font-size:14px;line-height:1.5;padding:20px 0 60px;overflow-x:hidden}
.num{font-family:var(--mono)}
h1{font-size:15px;padding:0 24px 4px;font-weight:700}
.sub{font-size:12px;color:var(--tx2);padding:0 24px 18px}
.tabs{display:flex;gap:2px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:3px;margin:0 24px 22px;width:max-content}
.tabs button{background:none;border:0;color:var(--tx2);font:inherit;padding:5px 16px;border-radius:6px;cursor:pointer}
.tabs button.on{background:var(--panel);color:var(--tx);font-weight:700}
.track-title{font-size:11px;letter-spacing:.14em;color:var(--tx2);margin:0 24px 16px}
.track{display:flex;align-items:flex-start;overflow-x:auto;overflow-y:hidden;padding:0 24px 30px}
.stage{position:relative;flex:1;min-width:96px;text-align:center;cursor:pointer;padding-top:2px;border-radius:8px}
.stage::before{content:"";position:absolute;top:15px;left:-50%;width:100%;height:2px;background:var(--line);z-index:0}
.stage:first-child::before{display:none}
.node{position:relative;z-index:1;width:32px;height:32px;margin:0 auto;border-radius:50%;border:2px solid var(--line);
background:var(--panel);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:12px;color:var(--tx2)}
.stage.has .node{border-color:var(--doneC);color:var(--tx);background:#232a3d}
.stage.gate .node{border-color:var(--human);color:var(--human)}
.stage.empty .node{opacity:.5}
.s-name{margin-top:9px;font-size:12px;font-weight:500}
.s-cnt{font-size:10px;letter-spacing:.04em;margin-top:2px;color:var(--tx2)}
.s-cnt b{color:var(--run)}
.stage.active .s-name{color:var(--run)}
.stage.active .node{box-shadow:0 0 0 3px rgba(61,214,176,.25)}
/* 툴팁 — body에 붙는 공유 fixed 팝오버 (트랙 클리핑/스택 영향 안 받음) */
.tip{display:none;position:fixed;z-index:9999;width:360px;max-height:82vh;overflow-y:auto;text-align:left;
background:var(--panel);border:1px solid var(--line);border-radius:12px;
box-shadow:0 16px 44px rgba(0,0,0,.62);padding:0}
.tip.show{display:block}
.tip .th{padding:11px 14px;border-bottom:1px solid var(--line);font-weight:700;font-size:13px;display:flex;justify-content:space-between;align-items:center}
.gatechip{font-size:10px;color:var(--human);border:1px solid var(--human);border-radius:6px;padding:1px 7px}
.tip .tb{padding:12px 14px}
.tip .what{font-size:12px;color:var(--tx);line-height:1.65;margin-bottom:11px}
.io{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;font-size:11.5px;margin-bottom:11px}
.io .k{color:var(--tx2)}
.io .v{color:var(--tx)}
.io .tool{color:var(--run);font-family:var(--mono);font-size:11px}
.files{border-top:1px dashed var(--line);padding-top:9px}
.files .fh{font-size:10px;letter-spacing:.1em;color:var(--tx2);margin-bottom:6px}
.frow{display:flex;align-items:center;gap:7px;font-size:11.5px;padding:3px 0}
.frow .star{color:var(--input);width:10px}
.frow .fn{flex:1;font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.frow .dl{color:var(--run);text-decoration:none;font-size:11px;border:1px solid var(--line);border-radius:5px;padding:1px 7px}
.frow .sz{color:var(--tx2);font-family:var(--mono);font-size:10px}
.none{font-size:11.5px;color:var(--tx2);font-style:italic}
.legend{font-size:11px;color:var(--tx2);padding:0 24px}
.legend .star{color:var(--input)}
</style></head><body>
<h1>파이프라인 트랙 — 마우스오버 프리뷰</h1>
<div class="sub">각 단계에 마우스를 올리면 <b style="color:var(--tx)">이 트랙이 뭘 하는지</b> + <b style="color:var(--tx)">쓰는 파일 / 만드는 파일 / 도구</b> + <b style="color:var(--tx)">지금 보유한 파일(다운로드)</b>이 뜹니다. 데이터는 실제 catalog.json.</div>
<div class="tabs" id="tabs"></div>
<div class="track-title" id="tt"></div>
<div class="track" id="track"></div>
<div class="legend"><span class="star">★</span> = 정본(최신) · 회색 노드 = 아직 자료 없음(미도달)</div>
<script>
const CAT = ''' + data_js + ''';
let cur = "RV";
const el = s => document.createElement(s);
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function kb(n){return n>=1048576?(n/1048576).toFixed(1)+'MB':(n/1024).toFixed(1)+'KB'}
function render(){
  const tabs=document.getElementById('tabs'); tabs.innerHTML='';
  Object.keys(CAT.products).forEach(p=>{
    const b=el('button'); b.textContent=p+' ('+CAT.products[p].total_files+')';
    if(p===cur)b.className='on'; b.onclick=()=>{cur=p;render()}; tabs.appendChild(b);
  });
  document.getElementById('tt').textContent='파이프라인 트랙 — '+cur;
  const track=document.getElementById('track'); track.innerHTML='';
  CAT.products[cur].stages.forEach((s)=>{
    const has=s.file_count>0;
    const st=el('div'); st.className='stage '+(has?'has':'empty')+(s.gate?' gate':''); st.tabIndex=0;
    st.innerHTML=`
      <div class="node">${s.no}</div>
      <div class="s-name">${s.name}</div>
      <div class="s-cnt">${has?('<b>'+s.file_count+'</b>개 자료'):'—'}</div>`;
    st.addEventListener('mouseenter',()=>showTip(st,s));
    st.addEventListener('focusin',()=>showTip(st,s));
    st.addEventListener('mouseleave',scheduleHide);
    st.addEventListener('focusout',scheduleHide);
    track.appendChild(st);
  });
}
// ── 공유 fixed 팝오버 (body 직속 — 트랙 클리핑/스택 영향 없음, 받기 클릭 가능)
const tip=el('div'); tip.className='tip'; document.body.appendChild(tip);
let hideT=null;
tip.addEventListener('mouseenter',()=>clearTimeout(hideT));
tip.addEventListener('mouseleave',scheduleHide);
function tipHTML(s){
  const has=s.file_count>0;
  const files = has ? s.files.map(f=>`<div class="frow"><span class="star">${f.canonical?'★':''}</span><span class="fn" title="${esc(f.file)}">${esc(f.file)}</span><span class="sz">${kb(f.size)}</span><a class="dl" href="../data/${f.path?encodeURI(f.path):'#'}" download>받기</a></div>`).join('')
    : '<div class="none">아직 보유 자료 없음 — 이 단계 미도달</div>';
  return `<div class="th"><span>${s.no} ${esc(s.name)}</span>${s.gate?`<span class="gatechip">${esc(s.gate)} 게이트</span>`:''}</div>
    <div class="tb"><div class="what">${esc(s.what)}</div>
      <div class="io"><span class="k">쓰는 파일</span><span class="v">${s.consumes.map(esc).join(' · ')}</span>
        <span class="k">만드는 파일</span><span class="v">${s.produces.map(esc).join(' · ')}</span>
        <span class="k">도구</span><span class="v tool">${esc(s.tool)}</span></div>
      <div class="files"><div class="fh">보유 자료 ${s.file_count}</div>${files}</div></div>`;
}
function showTip(st,s){
  clearTimeout(hideT);
  tip.innerHTML=tipHTML(s); tip.classList.add('show');
  const r=st.querySelector('.node').getBoundingClientRect();
  const tw=tip.offsetWidth, th=tip.offsetHeight, vw=innerWidth, vh=innerHeight;
  let left=Math.max(8,Math.min(r.left+r.width/2-tw/2, vw-tw-8));
  let top=r.bottom+10; if(top+th>vh-8) top=Math.max(8, r.top-th-10);
  tip.style.left=left+'px'; tip.style.top=top+'px';
  document.querySelectorAll('.stage.active').forEach(e=>e.classList.remove('active'));
  st.classList.add('active');
}
function scheduleHide(){ hideT=setTimeout(()=>{ tip.classList.remove('show');
  document.querySelectorAll('.stage.active').forEach(e=>e.classList.remove('active')); },180); }
render();
</script></body></html>'''
out = DASH/"track_preview.html"
out.write_text(html)
print("생성:", out)
