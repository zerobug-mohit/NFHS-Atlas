/* ============ NFHS Atlas — application logic ============ */
(function(){
"use strict";

/* ---------- indices ---------- */
const IND = DATA.indicators;          // [{i,name,cat,dir,unit}]
const NIND = IND.length;
const CATS = DATA.categories;
const dIndex = new Map();             // key -> district obj
DATA.districts.forEach(d=>dIndex.set(d.k,d));
const stateNames = Object.keys(DATA.states).sort();
const distSorted = DATA.districts.slice().sort((a,b)=>a.n.localeCompare(b.n));

const PALETTE = ['#1F5C66','#C2562B','#3A4C82','#7A5C2E'];

/* ---------- state ---------- */
const S = {
  level:'state', round:'v6', tab:'atlas',
  ind: IND.findIndex(x=>/Institutional births \(/.test(x.name)),
  zoomState:null,
  compare:[ {type:'national'} ],
  cmpCat:'Maternal and Child Health',
  profile:{type:'national'}
};
if(S.ind<0) S.ind=0;

/* ---------- helpers ---------- */
const meta=i=>IND[i];
function refData(ref){
  if(ref.type==='national') return {...DATA.national,label:'India',sub:'National'};
  if(ref.type==='state'){ const s=DATA.states[ref.id]; return {...s,label:ref.id,sub:'State · '+s.nd+' districts'}; }
  const d=dIndex.get(ref.id); if(!d) return {label:ref.id||'?',sub:'',v4:[],v5:[]}; return {...d,label:d.n,sub:d.s};
}
/* full display name: "District, State" for districts; plain name otherwise */
function gLabel(rd){ return (rd && rd.n!=null && rd.s!=null) ? (rd.n+', '+rd.s) : (rd?rd.label:''); }
function dirWord(dir){ return dir==='higher'?'· higher is better':dir==='lower'?'· lower is better':'· neutral'; }
function refKey(ref){ return ref.type+':'+(ref.id||''); }

/* ---------- round model ----------
   raw rounds:  v4, v5, v6
   change rounds: change (4→5, unweighted) | change56 (5→6, official) | change46 (4→6) */
const CHG_PAIR={ change:['v4','v5'], change56:['v5o','v6'], change46:['v4','v6'] };
function isChange(rk){ return rk==='change'||rk==='change56'||rk==='change46'; }
function isV6Round(rk){ return rk==='v6'||rk==='change56'||rk==='change46'; }
function changeKey(){ // change-basis used by the Change tab for the current round
  if(isChange(S.round)) return S.round;
  return {v4:'change', v5:'change', v6:'change56'}[S.round] || 'change';
}
function roundHint(rk){ return {v6:'NFHS-6',v5:'NFHS-5',v4:'NFHS-4',change:'Δ NFHS-4 → 5',change56:'Δ NFHS-5 → 6',change46:'Δ NFHS-4 → 6'}[rk]||rk; }
function rawVal(rd,i,roundKey){
  if(isChange(roundKey)){
    const p=CHG_PAIR[roundKey], fa=rd[p[0]], ta=rd[p[1]];
    if(!fa||!ta) return null;
    const a=ta[i], b=fa[i];
    return (a==null||b==null)?null:+(a-b).toFixed(1);
  }
  const a=rd[roundKey]; return a?a[i]:null;          // v6/v5o absent on districts -> null
}
function nationalVal(i,roundKey){ return rawVal(DATA.national,i,roundKey); }
function fmt(v,unit){
  if(v==null) return '—';
  if(unit==='ratio'||unit==='Rs') return Math.round(v).toLocaleString('en-IN');
  return (Math.round(v*10)/10).toString();
}
function fmtU(v,unit){ if(v==null) return '—'; return fmt(v,unit)+(unit==='%'?'%':unit==='Rs'?' Rs':''); }
function fmtDelta(v,unit){ if(v==null) return '—'; const s=v>0?'+':''; return s+fmt(v,unit); }

/* directional improvement value (positive = better) for a change round */
function improvement(rd,i,roundKey){
  roundKey = (roundKey&&isChange(roundKey)) ? roundKey : 'change';
  const p=CHG_PAIR[roundKey], fa=rd[p[0]], ta=rd[p[1]];
  if(!fa||!ta) return null;
  const a=ta[i], b=fa[i];
  if(a==null||b==null) return null;
  const raw=a-b;
  return meta(i).dir==='lower'? -raw : raw;   // neutral keeps raw sign
}

/* ---------- trend status (improving / stable / worsening) ---------- */
/* round to the indicator's display precision so only a true no-change reads as "stable" */
function roundUnit(v,unit){ const d=(unit==='ratio'||unit==='Rs')?0:1, f=Math.pow(10,d); return Math.round(v*f)/f; }
/* returns {state, raw, imp} where state ∈ up|flat|down (directional) or neuUp|neuFlat|neuDown (neutral) or na.
   "flat" (stable) is reserved for an exact no-change at display precision; any movement reads up/down. */
function trendOf(rd,i,roundKey){
  const m=meta(i), raw=rawVal(rd,i,roundKey), imp=improvement(rd,i,roundKey);
  if(raw==null||imp==null) return {state:'na'};
  if(m.dir==='neutral'){
    const r=roundUnit(raw,m.unit);
    if(r===0) return {state:'neuFlat',raw,imp};
    return {state: r>0?'neuUp':'neuDown', raw, imp};
  }
  const v=roundUnit(imp,m.unit);
  if(v>0) return {state:'up',   raw, imp};
  if(v<0) return {state:'down', raw, imp};
  return {state:'flat', raw, imp};
}
/* per-row "latest available" change basis for a geography+indicator */
function latestBasis(rd,i){
  const v6=rd.v6?rd.v6[i]:null, v5o=rd.v5o?rd.v5o[i]:null;
  if(v6!=null && v5o!=null) return {ck:'change56', lab:'5→6'};
  return {ck:'change', lab:'4→5'};
}
function trendBadge(rd,i,roundKey,opt){
  opt=opt||{}; const t=trendOf(rd,i,roundKey); const m=meta(i);
  if(t.state==='na') return '<span class="trend neu" title="no data">—</span>';
  const map={up:['up','improving'],down:['down','worsening'],flat:['flat','stable'],
    neuUp:['neu','rose'],neuDown:['neu','fell'],neuFlat:['neu','stable']};
  const cls=map[t.state][0], word=map[t.state][1];
  const arrowOverride = (t.state==='neuUp')?'▲':(t.state==='neuDown')?'▼':null;
  const delta = opt.showDelta? ' '+fmtDelta(t.raw,m.unit):'';
  const ar = arrowOverride? `<span class="ar" style="font-size:10px">${arrowOverride}</span>` : '<span class="ar"></span>';
  return `<span class="trend ${cls}" title="${word}${opt.basisLab?' ('+opt.basisLab+')':''}">${ar}${delta}</span>`;
}
/* tiny 3-point trajectory sparkline (NFHS-4 → 5 → 6) */
function sparkline(rd,i,w,h){
  w=w||58; h=h||16; const m=meta(i);
  const pts=[['v4',rd.v4?rd.v4[i]:null],['v5',(rd.v5o&&rd.v5o[i]!=null)?rd.v5o[i]:(rd.v5?rd.v5[i]:null)],['v6',rd.v6?rd.v6[i]:null]]
    .map((p,k)=>({k,v:p[1]})).filter(p=>p.v!=null);
  if(pts.length<2) return '';
  const vals=pts.map(p=>p.v), lo=Math.min(...vals), hi=Math.max(...vals), sp=(hi-lo)||1;
  const X=k=>3+(k/2)*(w-6), Y=v=>h-2-((v-lo)/sp)*(h-4);
  const last=trendOf(rd,i,latestBasis(rd,i).ck);
  const col=last.state==='up'?'var(--good)':last.state==='down'?'var(--bad)':last.state==='flat'?'var(--warn)':'var(--ink-3)';
  const d=pts.map((p,j)=>`${j?'L':'M'}${X(p.k).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
  const dots=pts.map(p=>`<circle cx="${X(p.k).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="1.7" fill="${col}"/>`).join('');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.6"/>${dots}</svg>`;
}
/* insight card builder; opts={ref, tip} → clickable drill-down + hover explanation */
function insightCard(label,valueHTML,tone,opts){
  opts=opts||{};
  const ref=opts.ref;
  const data = ref? ` data-rt="${esc(ref.type)}" data-ri="${esc(ref.id||'')}"` : '';
  const tip = opts.tip? ` title="${esc(opts.tip)}"` : '';
  return `<div class="insight ${tone||''}${ref?' clk':''}"${data}${tip}><div class="il">${esc(label)}</div><div class="iv">${valueHTML}</div></div>`;
}
function insightsBar(cards){ return `<div class="insights">${cards.join('')}</div>`; }
/* reusable legend snippet for trend arrows */
function trendLegendHTML(neutral){
  let h='<span class="lg"><span class="trend up"><span class="ar"></span></span> improving</span>'+
        '<span class="lg"><span class="trend down"><span class="ar"></span></span> worsening</span>'+
        '<span class="lg"><span class="trend flat"><span class="ar"></span></span> stable (no change)</span>';
  if(neutral) h+='<span class="lg"><span class="trend neu"><span class="ar"></span></span> neutral (no good/bad)</span>';
  return h;
}
function wireInsightDrill(container){
  container.querySelectorAll('.insight.clk').forEach(c=>c.onclick=()=>{
    const rt=c.dataset.rt, ri=c.dataset.ri;
    openProfile(rt==='national'?{type:'national'}:{type:rt,id:ri});
  });
}

/* unified rich hover tooltip for a geography on an indicator (all rounds + trend) */
function geoTipHTML(rd,i,roundKey){
  const m=meta(i);
  const v6=rd.v6?rd.v6[i]:null, v5=n5disp(rd,i), v4=(rd.v4?rd.v4[i]:null);
  let h=`<div class="tn">${esc(gLabel(rd))}</div><div class="ts">${esc(shorten(m.name,46))} ${dirWord(m.dir)}</div>`;
  if(v6!=null) h+=`<div class="row"><span>NFHS-6 (2023-24)</span><b>${fmtU(v6,m.unit)}</b></div>`;
  h+=`<div class="row"><span>NFHS-5 (2019-21)</span><b>${fmtU(v5,m.unit)}</b></div>`;
  h+=`<div class="row"><span>NFHS-4 (2015-16)</span><b>${fmtU(v4,m.unit)}</b></div>`;
  let ck,lab;
  if(roundKey&&isChange(roundKey)){ ck=roundKey; lab={change:'4→5',change56:'5→6',change46:'4→6'}[ck]; }
  else { const b=latestBasis(rd,i); ck=b.ck; lab=b.lab; }
  const t=trendOf(rd,i,ck);
  if(t.state!=='na'){
    const dcls=m.dir==='neutral'?'delta-zero':(t.state==='up'?'delta-pos':t.state==='down'?'delta-neg':'delta-zero');
    const word=m.dir==='neutral'?'net change':(t.state==='up'?'improving':t.state==='down'?'worsening':'stable');
    h+=`<div class="delta ${dcls}">Δ ${lab}: ${fmtDelta(t.raw,m.unit)} <span style="color:var(--ink-3)">· ${word}</span></div>`;
  }
  return h;
}
/* attach the rich tooltip to any element for (rd,i) */
function attachGeoTip(el,rd,i,roundKey){
  const html=geoTipHTML(rd,i,roundKey);
  el.addEventListener('mousemove',e=>showTip(e,html));
  el.addEventListener('mouseleave',hideTip);
}

/* ---------- color engine ---------- */
const interpGB = d3.interpolateRgbBasis(
  ['#9C3F1B','#C2562B','#E0A074','#ECE8DC','#8FC3BE','#0E7C7B','#0A5957']); // bad->good
const interpNeutralSeq = d3.interpolateRgb('#E6E9EF','#384C82');
const interpNeutralDiv = d3.interpolateRgbBasis(['#8A6A2E','#C9B27E','#ECE8DC','#9BB0D8','#3A4C82']);

function buildColor(values,i,roundKey){
  const m=meta(i), dir=m.dir;
  const vals=values.filter(v=>v!=null);
  if(!vals.length) return {color:()=>'#E4E6E0',legend:null};
  const lo=d3.min(vals),hi=d3.max(vals);
  if(isChange(roundKey)){
    if(dir==='neutral'){
      const ext=Math.max(Math.abs(lo),Math.abs(hi))||1;
      return {color:v=> v==null?'#E4E6E0':interpNeutralDiv((v/ext+1)/2),
        legend:{type:'div',center:0,lo:-ext,hi:ext,unit:m.unit,kind:'neutral',centerLab:'No change',loLab:fmt(-ext,m.unit),hiLab:'+'+fmt(ext,m.unit)}};
    }
    // directional improvement, centered 0
    const imps=vals.map((_,k)=>k); // placeholder
    const impVals=values.map(v=>v); // already improvement values passed in
    const ext=Math.max(Math.abs(d3.min(impVals.filter(x=>x!=null))),Math.abs(d3.max(impVals.filter(x=>x!=null))))||1;
    return {color:v=> v==null?'#E4E6E0':interpGB((Math.max(-1,Math.min(1,v/ext))+1)/2),
      legend:{type:'div',center:0,lo:-ext,hi:ext,unit:m.unit,kind:'gb',centerLab:'No change',loLab:'Worse',hiLab:'Better'}};
  }
  // raw round
  if(dir==='neutral'){
    const sc=d3.scaleLinear().domain([lo,hi]).range([0,1]);
    return {color:v=> v==null?'#E4E6E0':interpNeutralSeq(sc(v)),
      legend:{type:'seq',lo,hi,unit:m.unit,kind:'neutral',loLab:fmt(lo,m.unit),hiLab:fmt(hi,m.unit)}};
  }
  const center=nationalVal(i,roundKey);
  const spread=Math.max(Math.abs(hi-center),Math.abs(center-lo))||1;
  const toPerf=v=>{ let signed=v-center; if(dir==='lower') signed=-signed; return Math.max(-1,Math.min(1,signed/spread)); };
  return {color:v=> v==null?'#E4E6E0':interpGB((toPerf(v)+1)/2),
    legend:{type:'div',center,lo:center-spread,hi:center+spread,unit:m.unit,kind:'gb',
      centerLab:'Nat. avg '+fmt(center,m.unit),loLab:'Worse',hiLab:'Better'}};
}

/* ---------- visible geo set for current map ---------- */
function visibleGeos(){
  // returns [{ref, rd, val, imp}] for current level/zoom & round
  const roundKey=S.round, i=S.ind;
  let refs=[];
  if(S.level==='state' && !S.zoomState){
    refs=stateNames.map(n=>({type:'state',id:n}));
  } else {
    const st=S.zoomState;
    refs=DATA.districts.filter(d=>!st||d.s===st).map(d=>({type:'district',id:d.k}));
  }
  return refs.map(ref=>{const rd=refData(ref);
    return {ref,rd,val:rawVal(rd,i,roundKey),imp:improvement(rd,i,roundKey)};});
}

/* ===================== RENDER ROUTER ===================== */
function syncCmdbar(){
  // show only the controls that actually affect the active tab
  const fieldOf=id=>{const el=document.getElementById(id); return el?el.closest('.field'):null;};
  const set=(f,vis)=>{ if(f) f.style.display=vis?'':'none'; };
  const t=S.tab;
  set(fieldOf('level-seg'), t==='atlas'||t==='change');   // Compare uses chip picker; Profile has its own selector
  set(fieldOf('ind-select'), t!=='profile');              // Profile shows every indicator
  set(fieldOf('round-seg'),  t!=='profile');              // Profile is round-independent (all rounds in columns)
}
function render(){
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===S.tab));
  document.querySelectorAll('.view').forEach(v=>v.style.display=v.id==='view-'+S.tab?'':'none');
  syncCmdbar();
  if(S.tab==='atlas') renderAtlas();
  else if(S.tab==='compare') renderCompare();
  else if(S.tab==='change') renderChange();
  else if(S.tab==='profile') renderProfile();
}
function syncLevelSeg(){ document.querySelectorAll('#level-seg button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===S.level)); }
/* ---- view resets (geography/selection only; do not touch the chosen indicator or round) ---- */
function defaultLevel(){ return isV6Round(S.round)?'state':'district'; }
function resetMapView(rerender){
  S.zoomState=null; S.level=defaultLevel(); syncLevelSeg(); syncLevelLock(); if(rerender) rerender();
}
function resetAtlas(){ resetMapView(renderAtlas); toast('Map reset to all-India'); }
function resetChange(){ resetMapView(renderChange); toast('View reset to all-India'); }
function resetCompare(){
  S.compare=[{type:'national'}];
  S.cmpCat='Maternal and Child Health';
  const cc=document.getElementById('cmp-cat'); if(cc){ cc.value=S.cmpCat; syncCombo(cc); }
  renderCompare(); toast('Comparison reset to India');
}
function resetProfile(){ S.profile={type:'national'}; syncProfileSelect(); renderProfile(); toast('Profile reset to India'); }

/* ===================== ATLAS ===================== */
let projection, pathGen, mapSvg;
function renderAtlas(){
  const m=meta(S.ind);
  drawMap();
  drawLegend();
  drawRanks();
  drawAtlasInsights();
  document.getElementById('atlas-ind').innerHTML =
    esc(m.name)+dirTag(m.dir);
  document.getElementById('atlas-scope').textContent =
    S.zoomState ? ('Districts of '+S.zoomState)
    : S.level==='state' ? ('State view · '+Object.keys(DATA.states).length+' states/UTs') : ('District view · '+DATA.districts.length+' districts');
  const back=document.getElementById('map-back');
  back.classList.toggle('show', !!S.zoomState || (S.level==='district'&&false));
  back.firstChild.textContent = S.zoomState? '← All of India' : '';
}
function drawAtlasInsights(){
  const el=document.getElementById('atlas-insights'); if(!el) return;
  const m=meta(S.ind), i=S.ind;
  const geos=visibleGeos().filter(g=> isChange(S.round)? g.imp!=null : g.val!=null);
  if(!geos.length){ el.innerHTML=''; return; }
  const scopeWord = S.level==='state'&&!S.zoomState?'state/UT':'district';
  const natRaw = rawVal(DATA.national,i,S.round);
  const cards=[];
  if(isChange(S.round)){
    const lab={change:'NFHS-4 → 5',change56:'NFHS-5 → 6',change46:'NFHS-4 → 6'}[S.round];
    const up=geos.filter(g=>m.dir==='neutral'?g.val>0:g.imp>0).length;
    const dn=geos.filter(g=>m.dir==='neutral'?g.val<0:g.imp<0).length;
    const fl=geos.length-up-dn;
    const best=[...geos].sort((a,b)=>(m.dir==='neutral'?b.val-a.val:b.imp-a.imp))[0];
    const worst=[...geos].sort((a,b)=>(m.dir==='neutral'?a.val-b.val:a.imp-b.imp))[0];
    cards.push(insightCard('India · '+lab, `<span class="ibig ${cls(improvement(DATA.national,i,S.round),m.dir)}">${fmtDelta(natRaw,m.unit)}</span>`, '', {tip:'National-level change for this indicator on the '+lab+' basis'}));
    if(m.dir!=='neutral') cards.push(insightCard(scopeWord+'s improving', `<b>${up}</b> improving · <b>${fl}</b> stable · <b>${dn}</b> worsening <span style="white-space:nowrap">of ${geos.length}</span>`, up>=dn?'good':'bad', {tip:'Count of '+scopeWord+'s moving in a better / unchanged / worse direction'}));
    cards.push(insightCard('Biggest gain', `<b>${esc(gLabel(best.rd))}</b> ${fmtDelta(best.val,m.unit)}`, 'good', {ref:best.ref, tip:'Largest improvement — click to open its profile'}));
    cards.push(insightCard(m.dir==='neutral'?'Biggest drop':'Biggest decline', `<b>${esc(gLabel(worst.rd))}</b> ${fmtDelta(worst.val,m.unit)}`, 'bad', {ref:worst.ref, tip:'Largest decline — click to open its profile'}));
  } else {
    const sorted=[...geos].sort((a,b)=>b.val-a.val);
    const hi=sorted[0], loEl=sorted[sorted.length-1];
    const leader = m.dir==='lower'?loEl:hi, laggard = m.dir==='lower'?hi:loEl;
    const roundNm={v6:'NFHS-6',v5:'NFHS-5',v4:'NFHS-4'}[S.round];
    cards.push(insightCard('India · '+roundNm, `<span class="ibig">${fmtU(natRaw,m.unit)}</span>`, '', {tip:'National figure for this indicator ('+roundNm+')'}));
    if(m.dir!=='neutral'){
      cards.push(insightCard('Leads', `<b>${esc(gLabel(leader.rd))}</b> · ${fmtU(leader.val,m.unit)}`, 'good', {ref:leader.ref, tip:'Best performer — click to open its profile'}));
      cards.push(insightCard('Trails', `<b>${esc(gLabel(laggard.rd))}</b> · ${fmtU(laggard.val,m.unit)}`, 'bad', {ref:laggard.ref, tip:'Lowest performer — click to open its profile'}));
    } else {
      cards.push(insightCard('Highest', `<b>${esc(gLabel(hi.rd))}</b> · ${fmtU(hi.val,m.unit)}`, '', {ref:hi.ref, tip:'Highest value — click to open its profile'}));
      cards.push(insightCard('Lowest', `<b>${esc(gLabel(loEl.rd))}</b> · ${fmtU(loEl.val,m.unit)}`, '', {ref:loEl.ref, tip:'Lowest value — click to open its profile'}));
    }
    cards.push(insightCard('Spread', `<b>${fmtU(hi.val-loEl.val,m.unit)}</b> gap · ${geos.length} ${scopeWord}s`, 'warn', {tip:'Gap between the highest and lowest '+scopeWord}));
  }
  el.innerHTML=insightsBar(cards);
  wireInsightDrill(el);
}

// Fit a Mercator to feats using planar corner projection (immune to GeoJSON
// ring-winding issues that make d3.geoBounds report the whole globe).
function fitMercator(feats,w,h,pad){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  const scan=c=>{ if(typeof c[0]==='number'){ if(c[0]<x0)x0=c[0]; if(c[0]>x1)x1=c[0]; if(c[1]<y0)y0=c[1]; if(c[1]>y1)y1=c[1]; return; } c.forEach(scan); };
  feats.forEach(f=>scan(f.geometry.coordinates));
  const p=d3.geoMercator().scale(1).translate([0,0]);
  const corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(c=>p(c));
  const rx0=Math.min(...corners.map(q=>q[0])), rx1=Math.max(...corners.map(q=>q[0]));
  const ry0=Math.min(...corners.map(q=>q[1])), ry1=Math.max(...corners.map(q=>q[1]));
  const s=Math.min((w-pad)/(rx1-rx0),(h-pad)/(ry1-ry0));
  return p.scale(s).translate([(w-s*(rx0+rx1))/2,(h-s*(ry0+ry1))/2]);
}

function drawMap(){
  const box=document.getElementById('mapbox');
  const w=box.clientWidth, h=box.clientHeight;
  box.innerHTML='';
  const svg=d3.select(box).append('svg').attr('class','map-svg')
    .attr('viewBox',`0 0 ${w} ${h}`).attr('width',w).attr('height',h);
  mapSvg=svg;

  // choose features
  let feats, isState=false;
  if(S.level==='state' && !S.zoomState){ feats=GEO_S.features; isState=true; }
  else if(S.zoomState){ feats=GEO_D.features.filter(f=>f.properties.s===S.zoomState); }
  else { feats=GEO_D.features; }

  projection=fitMercator(feats,w,h,6);
  pathGen=d3.geoPath(projection);

  const geos=visibleGeos();
  const valBy=new Map(); geos.forEach(g=>valBy.set(refKey(g.ref), g));
  const colvals = isChange(S.round)
      ? geos.map(g=> meta(S.ind).dir==='neutral'? g.val : g.imp)
      : geos.map(g=>g.val);
  const C=buildColor(colvals,S.ind,S.round);
  S._color=C;

  const g=svg.append('g');
  g.selectAll('path.geo').data(feats).join('path')
    .attr('class','geo '+(isState?'state':'district'))
    .attr('data-gk',d=> isState?('state:'+d.properties.s):('district:'+d.properties.k))
    .attr('d',pathGen)
    .attr('fill',d=>{
      const key=isState?('state:'+d.properties.s):('district:'+d.properties.k);
      const gg=valBy.get(key);
      if(!gg) return '#E4E6E0';
      const cv = isChange(S.round) ? (meta(S.ind).dir==='neutral'? gg.val : gg.imp) : gg.val;
      return C.color(cv);
    })
    .on('mousemove',(e,d)=>showGeoTip(e,d,isState))
    .on('mouseenter',(e,d)=>{const k=isState?('state:'+d.properties.s):('district:'+d.properties.k); hlRank(k,true);})
    .on('mouseleave',(e,d)=>{hideTip(); const k=isState?('state:'+d.properties.s):('district:'+d.properties.k); hlRank(k,false);})
    .on('click',(e,d)=>{
      if(isState){ S.zoomState=d.properties.s; renderAtlas(); }
      else { openProfile({type:'district',id:d.properties.k}); }
    });

  // state boundary overlay on national district view
  if(!isState && !S.zoomState){
    g.append('path').datum({type:'FeatureCollection',features:GEO_S.features})
      .attr('class','state-line').attr('d',pathGen);
  }
}
/* cross-highlight: toggle highlight on the ranking row + map polygon for a key */
function hlRank(key,on){
  const row=document.querySelector(`#rank-scroll .rrow[data-gk="${cssEsc(key)}"]`);
  if(row){ row.classList.toggle('xhl',on); if(on) row.scrollIntoView({block:'nearest'}); }
}
function hlMap(key,on){
  const pth=document.querySelector(`#mapbox path[data-gk="${cssEsc(key)}"]`);
  if(pth) pth.classList.toggle('xhl',on);
}
function cssEsc(s){ return String(s).replace(/"/g,'\\"'); }

function showGeoTip(e,d,isState){
  const i=S.ind;
  let rd;
  if(isState){ rd=refData({type:'state',id:d.properties.s}); }
  else { rd=dIndex.get(d.properties.k); if(!rd){hideTip();return;} }
  showTip(e, geoTipHTML(rd,i,S.round));
}

function drawLegend(){
  const C=S._color, L=C&&C.legend, el=document.getElementById('legend');
  if(!L){ el.style.display='none'; return; } el.style.display='';
  const m=meta(S.ind);
  let bar='';
  const stops=[]; for(let k=0;k<=10;k++) stops.push(k/10);
  if(L.type==='div'){
    const grad=stops.map(t=>{
      const v=L.lo+(L.hi-L.lo)*t;
      const col = L.kind==='gb'? interpGB(t) : interpNeutralDiv(t);
      return col;
    });
    bar=`<div class="bar" style="background:linear-gradient(90deg,${grad.join(',')})"></div>`;
  } else {
    const grad=stops.map(t=> L.kind==='neutral'? interpNeutralSeq(t):interpGB(t));
    bar=`<div class="bar" style="background:linear-gradient(90deg,${grad.join(',')})"></div>`;
  }
  let scaleLab, sub, avg='';
  const roundName = S.round==='change'?'Δ NFHS-4 → NFHS-5':S.round==='change56'?'Δ NFHS-5 → NFHS-6':S.round==='change46'?'Δ NFHS-4 → NFHS-6':S.round==='v6'?'NFHS-6':S.round==='v5'?'NFHS-5':'NFHS-4';
  if(L.type==='div'){
    scaleLab=`<div class="scale-lab"><span>${L.loLab}</span><span>${L.hiLab}</span></div>`;
    sub = roundName;
    if(L.kind==='gb' && L.centerLab) avg=`<div class="avgmark"><i></i>${L.centerLab} (centre)</div>`;
    else if(L.kind==='neutral') avg=`<div class="avgmark"><span style="font-size:10px;color:var(--ink-3)">Neutral indicator — no good/bad direction</span></div>`;
  } else {
    scaleLab=`<div class="scale-lab"><span>${L.loLab}${unitSuffix(L.unit)}</span><span>${L.hiLab}${unitSuffix(L.unit)}</span></div>`;
    sub = roundName+' · '+(L.kind==='neutral'?'magnitude':'value');
    if(L.kind==='neutral') avg=`<div class="avgmark"><span style="font-size:10px;color:var(--ink-3)">Neutral indicator — shaded by value only</span></div>`;
  }
  const dirNote = isChange(S.round)
    ? '<span style="font-size:10px;color:var(--ink-3)">left = decline · right = improvement</span>'
    : (m.dir==='lower'?'<span style="font-size:10px;color:var(--ink-3)">left = better (lower) · right = worse (higher)</span>'
      : m.dir==='higher'?'<span style="font-size:10px;color:var(--ink-3)">left = worse (lower) · right = better (higher)</span>':'');
  const noData='<div class="ndkey" style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:10px;color:var(--ink-3)"><span style="width:13px;height:11px;border-radius:3px;background:#E4E6E0;display:inline-block;border:1px solid var(--line-2)"></span>no data</div>';
  el.innerHTML=`<div class="lt">${shorten(m.name,52)}</div><div class="ls">${sub}</div>${bar}${scaleLab}${dirNote?`<div style="margin-top:2px">${dirNote}</div>`:''}${avg}${noData}`;
}
function unitSuffix(u){return u==='%'?'%':u==='Rs'?'₹':'';}

function drawRanks(){
  const wrap=document.getElementById('rank-scroll');
  const m=meta(S.ind);
  const geos=visibleGeos().filter(g=> isChange(S.round)? g.imp!=null : g.val!=null);
  // ranking metric: change->improvement (or raw for neutral); raw-> performance (directional)
  const score=g=>{
    if(isChange(S.round)) return m.dir==='neutral'? g.val : g.imp;
    if(m.dir==='lower') return -g.val;
    if(m.dir==='neutral') return g.val;
    return g.val;
  };
  geos.sort((a,b)=>score(b)-score(a));
  const C=S._color;
  const N=Math.min(8,Math.floor(geos.length/2));
  const top=geos.slice(0,N), bot=geos.slice(-N).reverse();
  const valOf=g=> g.val;
  const colOf=g=> C.color(isChange(S.round)? (m.dir==='neutral'? g.val : g.imp):g.val);
  function rows(list,base){
    return list.map((g,k)=>{
      const nm=esc(gLabel(g.rd));
      const v=valOf(g);
      const disp = isChange(S.round)? fmtDelta(v,m.unit) : fmtU(v,m.unit);
      const dcls = isChange(S.round)? (g.imp>0?'delta-pos':g.imp<0?'delta-neg':'') : '';
      const tr = isChange(S.round)? '' : trendBadge(g.rd,S.ind,latestBasis(g.rd,S.ind).ck);
      const gk = refKey(g.ref);
      return `<div class="rrow" data-t="${g.ref.type}" data-id="${esc(g.ref.id)}" data-gk="${esc(gk)}">
        <div class="ri">${base+k+1}</div>
        <div><div class="rn">${nm}</div></div>
        <div class="rv ${dcls}">${tr}<span style="width:9px;height:9px;border-radius:2px;background:${colOf(g)};display:inline-block"></span>${disp}</div>
      </div>`;
    }).join('');
  }
  const topLab = isChange(S.round)?'Biggest improvers':(m.dir==='neutral'?'Highest values':'Best performers');
  const botLab = isChange(S.round)?'Biggest declines':(m.dir==='neutral'?'Lowest values':'Lowest performers');
  const legend = isChange(S.round)
    ? `<div class="viz-legend rank-legend"><span class="lg">value = Δ ${roundHint(S.round)}</span><span class="lg"><span class="delta-pos">green +</span> improvement · <span class="delta-neg">red −</span> decline</span><span class="lg"><span class="sw" style="background:linear-gradient(90deg,var(--bad),var(--neutral-mid),var(--good))"></span> colour = size of change</span></div>`
    : `<div class="viz-legend rank-legend">${m.dir==='neutral'?'<span class="lg">value = level (no good/bad direction)</span>':trendLegendHTML(false)+'<span class="lg" style="color:var(--ink-3)">arrow = latest movement</span>'}<span class="lg"><span class="sw" style="background:linear-gradient(90deg,var(--bad),var(--neutral-mid),var(--good))"></span> colour = vs national</span></div>`;
  wrap.innerHTML = legend +
                   `<div class="rank-grp">${topLab}</div>${rows(top,0)}`+
                   `<div class="rank-grp">${botLab}</div>${rows(bot,0)}`;
  const byKey=new Map(); geos.forEach(g=>byKey.set(refKey(g.ref),g));
  wrap.querySelectorAll('.rrow').forEach(r=>{
    const gk=r.dataset.gk, g=byKey.get(gk);
    if(g) attachGeoTip(r,g.rd,S.ind,S.round);                 // hover → full detail
    r.addEventListener('mouseenter',()=>hlMap(gk,true));        // cross-highlight map
    r.addEventListener('mouseleave',()=>hlMap(gk,false));
    r.onclick=()=>{ const t=r.dataset.t,id=r.dataset.id;
      if(t==='district') openProfile({type:'district',id});
      else if(t==='state'){ S.zoomState=id; renderAtlas(); } };
  });
}

/* ===================== COMPARE ===================== */
function n5disp(rd,i){ return (rd.v5o&&rd.v5o[i]!=null)?rd.v5o[i]:(rd.v5?rd.v5[i]:null); }
function renderCompare(){
  drawCompareChips();
  const m=meta(S.ind), i=S.ind, refs=S.compare;

  /* ---- insights ---- */
  const ins=document.getElementById('cmp-insights');
  const withVal=refs.map(r=>{const rd=refData(r); const v=rawVal(rd,i,S.round);
    return {r,rd,v,latest:trendOf(rd,i,latestBasis(rd,i).ck),lb:latestBasis(rd,i)};}).filter(x=>x.v!=null);
  if(withVal.length>=1 && !isChange(S.round)){
    const sorted=[...withVal].sort((a,b)=> m.dir==='lower'? a.v-b.v : b.v-a.v);
    const leader=sorted[0], tail=sorted[sorted.length-1];
    const gap=Math.abs(sorted[0].v - sorted[sorted.length-1].v);
    const movers=withVal.filter(x=>x.latest.imp!=null).sort((a,b)=>b.latest.imp-a.latest.imp);
    const cards=[insightCard('Focus indicator', `<b>${esc(shorten(m.name,46))}</b> · ${roundHint(S.round)}`,'',{tip:m.name+' '+dirWord(m.dir)})];
    if(m.dir!=='neutral'&&withVal.length>1) cards.push(insightCard('Leads', `<b>${esc(gLabel(leader.rd))}</b> · ${fmtU(leader.v,m.unit)}`,'good',{ref:leader.r,tip:'Best among selected — click to open its profile'}));
    if(m.dir!=='neutral'&&withVal.length>1) cards.push(insightCard('Trails', `<b>${esc(gLabel(tail.rd))}</b> · ${fmtU(tail.v,m.unit)}`,'bad',{ref:tail.r,tip:'Lowest among selected — click to open its profile'}));
    if(withVal.length>1) cards.push(insightCard('Spread', `<b>${fmtU(gap,m.unit)}</b> between ${withVal.length} selected`,'warn',{tip:'Gap between the best and lowest of the selected geographies'}));
    if(movers.length && m.dir!=='neutral') cards.push(insightCard('Fastest progress ('+movers[0].lb.lab+')', `<b>${esc(gLabel(movers[0].rd))}</b> ${fmtDelta(movers[0].latest.raw,m.unit)}`, movers[0].latest.imp>0?'good':'bad',{ref:movers[0].r,tip:'Largest recent improvement — click to open its profile'}));
    ins.innerHTML=insightsBar(cards); wireInsightDrill(ins);
  } else if(isChange(S.round) && withVal.length){
    const best=[...withVal].sort((a,b)=> (m.dir==='neutral'?b.v-a.v : (improvement(b.rd,i,S.round)||-1e9)-(improvement(a.rd,i,S.round)||-1e9)))[0];
    ins.innerHTML=insightsBar([insightCard('Focus indicator', `<b>${esc(shorten(m.name,46))}</b> · ${roundHint(S.round)}`,'',{tip:m.name+' '+dirWord(m.dir)}),
      insightCard('Largest move', `<b>${esc(gLabel(best.rd))}</b> ${fmtDelta(best.v,m.unit)}`, (improvement(best.rd,i,S.round)>0||m.dir==='neutral')?'good':'bad',{ref:best.r,tip:'Largest change among selected — click to open its profile'})]);
    wireInsightDrill(ins);
  } else ins.innerHTML='';

  /* ---- trajectory (slope) chart ---- */
  const focus=document.getElementById('cmp-focus');
  focus.innerHTML=`<div class="panel-h"><h2>Trajectory · ${esc(shorten(m.name,52))}</h2><span class="hint">NFHS-4 → 5 → 6 ${dirTag(m.dir)}</span></div>
    <div class="slope-wrap">${compareSlope(refs,i)}</div>
    <div class="slope-legend" id="cmp-slope-legend">${refs.map((r,k)=>{const rd=refData(r);
      return `<span class="sl" data-k="${k}" title="Click to open the profile for ${esc(gLabel(rd))}"><i style="background:${PALETTE[k%4]}"></i>${esc(gLabel(rd))}</span>`;}).join('')}</div>
    <div class="slope-cap"><b>How to read:</b> each coloured line traces one geography's value across NFHS-4 (2015-16) → NFHS-5 (2019-21) → NFHS-6 (2023-24). ${m.dir==='higher'?'Higher is better.':m.dir==='lower'?'Lower is better.':'Neutral indicator.'} Hover a point for exact values; click a point or label to open that geography's profile. District lines stop at NFHS-5 (no district-level NFHS-6).</div>`;
  wireSlope();

  /* ---- clean comparison matrix ---- */
  const tbl=document.getElementById('cmp-table-wrap');
  const inds=IND.map((x,k)=>({...x,i:k})).filter(x=>x.cat===S.cmpCat);
  const chg=isChange(S.round);
  const head=`<tr><th>Indicator · ${esc(S.cmpCat)}</th>${refs.map((r,k)=>{const rd=refData(r);
      return `<th title="${esc(gLabel(rd))}"><span class="swatch" style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${PALETTE[k%4]};margin-right:5px"></span>${esc(shorten(gLabel(rd),18))}</th>`;}).join('')}</tr>`;
  const body=inds.map(x=>{
    const cells=refs.map(r=>{const rd=refData(r); return {rd,v:rawVal(rd,x.i,S.round)};});
    let bestIdx=-1,bestScore=-Infinity;
    cells.forEach((c,k)=>{ if(c.v==null) return; let sc=x.dir==='lower'?-c.v:c.v; if(chg){ sc=improvement(c.rd,x.i,S.round); if(sc==null)sc=-Infinity; } if(x.dir==='neutral'&&!chg) sc=c.v; if(sc>bestScore){bestScore=sc;bestIdx=k;} });
    const tds=cells.map((c,k)=>{
      if(c.v==null) return `<td class="muted">—</td>`;
      const disp=chg?fmtDelta(c.v,x.unit):fmt(c.v,x.unit);
      const arrow = chg? '' : (x.dir!=='neutral'? ' '+trendBadge(c.rd,x.i,latestBasis(c.rd,x.i).ck) : '');
      const dcls = chg? (improvement(c.rd,x.i,S.round)>0?'delta-pos':improvement(c.rd,x.i,S.round)<0?'delta-neg':'') : '';
      return `<td class="${k===bestIdx?'bestcell2 cur':''} ${dcls}">${disp}${arrow}</td>`;
    }).join('');
    return `<tr><td class="nm">${esc(shorten(x.name,64))}${x.r6?'<span class="r6tag">6</span>':''}</td>${tds}</tr>`;
  }).join('');
  const matKey=`<div class="viz-legend box" style="margin-bottom:10px"><span class="lg">values = ${roundHint(S.round)}</span><span class="lg"><span class="sw" style="background:var(--accent-soft);border:1px solid var(--accent-2)"></span> best of selected</span>${chg?'<span class="lg"><span class="delta-pos">green +</span> improvement · <span class="delta-neg">red −</span> decline</span>':trendLegendHTML(true)}<span class="lg"><span class="r6tag" style="position:static">6</span> NFHS-6-only indicator</span></div>`;
  tbl.innerHTML=matKey+`<table class="dtbl"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/* build interactive slope SVG for the focus indicator across selected geographies */
function compareSlope(refs,i){
  const m=meta(i);
  const cols=[{k:'v4',lab:'NFHS-4'},{k:'v5',lab:'NFHS-5'},{k:'v6',lab:'NFHS-6'}];
  const series=refs.map((r,k)=>{const rd=refData(r);
    const pts=[ {c:0,v:rd.v4?rd.v4[i]:null}, {c:1,v:n5disp(rd,i)}, {c:2,v:rd.v6?rd.v6[i]:null} ].filter(p=>p.v!=null);
    return {k,label:gLabel(rd),color:PALETTE[k%4],pts};
  }).filter(s=>s.pts.length);
  const all=series.flatMap(s=>s.pts.map(p=>p.v));
  if(!all.length) return '<div style="color:var(--ink-3);font-size:12.5px;padding:20px 4px">No data for the selected geographies.</div>';
  let lo=Math.min(...all), hi=Math.max(...all); if(lo===hi){lo-=1;hi+=1;}
  const pad=(hi-lo)*0.12; lo-=pad; hi+=pad;
  const W=760,H=300, mL=46,mR=104,mT=14,mB=28;
  const X=c=> mL + (c/2)*(W-mL-mR);
  const Y=v=> mT + (1-(v-lo)/(hi-lo))*(H-mT-mB);
  // gridlines (4)
  let g='';
  for(let t=0;t<=4;t++){ const v=lo+(hi-lo)*t/4, y=Y(v);
    g+=`<line class="slope-grid" x1="${mL}" y1="${y.toFixed(1)}" x2="${W-mR}" y2="${y.toFixed(1)}"/>`+
       `<text x="${mL-7}" y="${(y+3).toFixed(1)}" text-anchor="end" class="slope-glab">${fmt(v,m.unit)}</text>`; }
  // x axis labels
  cols.forEach((c,k)=>{ g+=`<text x="${X(k).toFixed(1)}" y="${H-9}" text-anchor="middle" class="slope-glab" style="font-size:11px">${c.lab}</text>`; });
  // lines + dots + end labels
  let lines='';
  series.forEach(s=>{
    const d=s.pts.map((p,j)=>`${j?'L':'M'}${X(p.c).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
    lines+=`<path class="slope-line" data-k="${s.k}" d="${d}" stroke="${s.color}"/>`;
    s.pts.forEach(p=>{ lines+=`<circle class="slope-dot" data-k="${s.k}" data-geo="${esc(s.label)}" data-round="${cols[p.c].lab}" data-val="${fmtU(p.v,m.unit)}" cx="${X(p.c).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="4" fill="${s.color}"/>`; });
    const last=s.pts[s.pts.length-1];
    lines+=`<text class="slope-glab" data-k="${s.k}" x="${(X(last.c)+8).toFixed(1)}" y="${(Y(last.v)+3.5).toFixed(1)}" style="fill:${s.color};font-size:10.5px;font-weight:700">${esc(shorten(s.label,16))}</text>`;
  });
  return `<svg class="slope-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}${lines}</svg>`;
}
function wireSlope(){
  const focus=document.getElementById('cmp-focus');
  focus.querySelectorAll('.slope-dot').forEach(c=>{
    c.style.cursor='pointer';
    c.addEventListener('mousemove',e=>showTip(e,`<div class="tn">${c.dataset.geo}</div><div class="row"><span>${c.dataset.round}</span><b>${c.dataset.val}</b></div><div class="ts" style="margin-top:3px">click to open profile</div>`));
    c.addEventListener('mouseleave',hideTip);
    c.addEventListener('click',()=>{const ref=S.compare[+c.dataset.k]; if(ref) openProfile(ref);});
  });
  const leg=document.getElementById('cmp-slope-legend');
  if(leg) leg.querySelectorAll('.sl').forEach(s=>{
    const k=s.dataset.k;
    s.addEventListener('mouseenter',()=>{
      focus.querySelectorAll('.slope-line,.slope-dot,text[data-k]').forEach(el=>{ if(el.dataset.k!==k) el.style.opacity='.16'; });
      leg.querySelectorAll('.sl').forEach(x=>{ if(x!==s) x.classList.add('dim'); });});
    s.addEventListener('mouseleave',()=>{
      focus.querySelectorAll('.slope-line,.slope-dot,text[data-k]').forEach(el=>el.style.opacity='');
      leg.querySelectorAll('.sl').forEach(x=>x.classList.remove('dim'));});
    s.addEventListener('click',()=>{const ref=S.compare[+k]; if(ref) openProfile(ref);});
  });
}
function drawCompareChips(){
  const box=document.getElementById('cmp-chips');
  box.innerHTML=S.compare.map((r,k)=>{const rd=refData(r);
    const sub = r.type==='district'?'District' : r.type==='state'?rd.sub : 'National';
    return `<span class="geo-chip"><span class="dot" style="background:${PALETTE[k%4]}"></span>
      <b>${esc(gLabel(rd))}</b> <small>${esc(sub)}</small>
      <button data-k="${k}" aria-label="Remove">×</button></span>`;}).join('');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{S.compare.splice(+b.dataset.k,1); renderCompare();});
  document.getElementById('cmp-add-btn').disabled = S.compare.length>=4;
}

/* ===================== CHANGE ===================== */
function renderChange(){
  const m=meta(S.ind);
  const ck=changeKey();                 // change | change56 | change46
  const P=CHG_PAIR[ck];                 // [fromKey, toKey]
  const fromLab={v4:'NFHS-4',v5o:'NFHS-5',v5:'NFHS-5'}[P[0]], toLab={v5:'NFHS-5',v6:'NFHS-6'}[P[1]];
  const v6round=isV6Round(ck);          // 5→6 / 4→6 are state/UT level only
  const isState = v6round ? true : (S.level==='state'&&!S.zoomState);
  let refs;
  if(isState) refs=stateNames.map(n=>({type:'state',id:n}));
  else refs=DATA.districts.filter(d=>!S.zoomState||d.s===S.zoomState).map(d=>({type:'district',id:d.k}));
  const rows=refs.map(r=>{const rd=refData(r); return {r,rd,imp:improvement(rd,S.ind,ck),raw:rawVal(rd,S.ind,ck)};})
    .filter(x=>x.imp!=null);
  const improved=rows.filter(x=> m.dir==='neutral'? x.raw>0 : x.imp>0).length;
  const declined=rows.filter(x=> m.dir==='neutral'? x.raw<0 : x.imp<0).length;
  const stable=rows.length-improved-declined;
  const natFrom=DATA.national[P[0]][S.ind], natTo=DATA.national[P[1]][S.ind];
  const natImp=improvement(DATA.national,S.ind,ck), natRaw=rawVal(DATA.national,S.ind,ck);
  // insights
  const insEl=document.getElementById('chg-insights');
  if(insEl && rows.length){
    const byImp=[...rows].sort((a,b)=> (m.dir==='neutral'? b.raw-a.raw : b.imp-a.imp));
    const best=byImp[0], worst=byImp[byImp.length-1];
    const scopeWord=isState?'state/UT':'district';
    const cards=[
      insightCard('India '+fromLab+' → '+toLab, `<span class="ibig ${cls(natImp,m.dir)}">${fmtDelta(natRaw,m.unit)}</span> <span style="font-size:12px;color:var(--ink-3)">(${fmt(natFrom,m.unit)} → ${fmt(natTo,m.unit)})</span>`,''),
    ];
    if(m.dir!=='neutral') cards.push(insightCard('Direction of travel', `<b>${improved}</b> improving · <b>${stable}</b> stable · <b>${declined}</b> worsening`, improved>=declined?'good':'bad'));
    cards.push(insightCard('Top gain', `<b>${esc(best.rd.label)}</b> ${fmtDelta(best.raw,m.unit)}`,'good'));
    cards.push(insightCard(m.dir==='neutral'?'Largest fall':'Largest decline', `<b>${esc(worst.rd.label)}</b> ${fmtDelta(worst.raw,m.unit)}`,'bad'));
    insEl.innerHTML=insightsBar(cards);
  } else if(insEl) insEl.innerHTML='';
  document.getElementById('chg-kpi').innerHTML=`
    <div class="kpi"><div class="kl">India · ${fromLab}</div><div class="kv">${fmt(natFrom,m.unit)}</div><div class="kc">${unitWord(m.unit)}</div></div>
    <div class="kpi"><div class="kl">India · ${toLab}</div><div class="kv">${fmt(natTo,m.unit)}</div><div class="kc">${unitWord(m.unit)}</div></div>
    <div class="kpi"><div class="kl">National Δ</div><div class="kv ${cls(natImp,m.dir)}">${fmtDelta(natRaw,m.unit)}</div><div class="kc">${m.dir==='neutral'?'net change':(natImp>0?'improvement':'decline')}</div></div>
    <div class="kpi"><div class="kl">${isState?'States':'Districts'} ${m.dir==='neutral'?'rising / falling':'improved / declined'}</div><div class="kv" style="font-size:21px">${improved} <span style="color:var(--ink-3);font-size:15px">/ ${declined}</span></div><div class="kc">of ${rows.length} with data</div></div>`;

  const score=x=> m.dir==='neutral'? x.raw : x.imp;
  rows.sort((a,b)=>score(b)-score(a));
  const N=12;
  const top=rows.slice(0,N), bot=rows.slice(-N).reverse();
  const mk=(list)=>list.map(x=>{
    const nm=esc(gLabel(x.rd));
    const c=cls(x.imp,m.dir);
    const dotcls = m.dir==='neutral'?'neu':(x.imp>0?'up':x.imp<0?'down':'flat');
    const f=x.rd[P[0]][S.ind], t2=x.rd[P[1]][S.ind];
    const fromto = (f!=null&&t2!=null)?`<small style="color:var(--ink-3)">${fmt(f,m.unit)}→${fmt(t2,m.unit)}</small>`:'';
    return `<div class="arrow-row" data-t="${x.r.type}" data-id="${esc(x.r.id)}" data-gk="${esc(refKey(x.r))}">
      <div class="an"><span class="tdot ${dotcls}" style="margin-right:7px"></span>${nm} ${fromto}</div>
      <div class="ad ${c}">${fmtDelta(x.raw,m.unit)}</div></div>`;}).join('');
  document.getElementById('chg-up').innerHTML=mk(top);
  document.getElementById('chg-down').innerHTML=mk(bot);
  document.getElementById('chg-title').innerHTML=esc(m.name)+dirTag(m.dir);
  const eyebrow=document.querySelector('#view-change .eyebrow'); if(eyebrow) eyebrow.textContent=fromLab+' → '+toLab+' movement';
  document.getElementById('chg-scope').textContent=isState?('Across states/UTs'+(v6round?' · NFHS-6 has no district data':'')):(S.zoomState?('Districts of '+S.zoomState):('Across '+DATA.districts.length+' districts'));
  const cmap=new Map(rows.map(x=>[refKey(x.r),x.rd]));
  const cl=document.getElementById('chg-legend');
  if(cl) cl.innerHTML = `<span class="lg">value = Δ ${fromLab} → ${toLab}</span>`+
    (m.dir==='neutral'
      ? '<span class="lg"><span class="tdot neu"></span> rose</span><span class="lg"><span class="tdot neu"></span> fell</span><span class="lg">neutral indicator (no good/bad)</span>'
      : '<span class="lg"><span class="tdot up"></span> improving</span><span class="lg"><span class="tdot down"></span> worsening</span><span class="lg"><span class="tdot flat"></span> stable (no change)</span>')+
    '<span class="lg" style="color:var(--ink-3)">small text = from → to · click a row to open its profile</span>';
  document.querySelectorAll('#view-change .arrow-row').forEach(r=>{
    const rd=cmap.get(r.dataset.gk); if(rd) attachGeoTip(r,rd,S.ind,ck);   // hover → full detail
    r.onclick=()=>{
      if(r.dataset.t==='district') openProfile({type:'district',id:r.dataset.id});
      else if(r.dataset.t==='state'){ S.level='state'; S.zoomState=null; openProfile({type:'state',id:r.dataset.id}); }
    };
  });
}
function cls(imp,dir){ if(imp==null) return ''; if(dir==='neutral') return 'delta-zero'; return imp>0?'delta-pos':imp<0?'delta-neg':'delta-zero'; }
function unitWord(u){return u==='%'?'percent':u==='Rs'?'rupees':'ratio (F/1000 M)';}

/* ===================== PROFILE ===================== */
function openProfile(ref){ S.profile=ref; S.tab='profile'; syncProfileSelect(); render(); }
function renderProfile(){
  const rd=refData(S.profile);
  const head=document.getElementById('prof-head');
  const hasV6=!!(rd.v6 && rd.v6.some(x=>x!=null));
  function basisFor(i){
    const v6=rd.v6?rd.v6[i]:null, v5o=rd.v5o?rd.v5o[i]:null;
    if(v6!=null && v5o!=null) return {ck:'change56', lab:'5→6'};
    return {ck:'change', lab:'4→5'};
  }
  // headline counts on per-row latest basis
  let imp=0,dec=0,sta=0,tot=0;
  IND.forEach((mm,i)=>{const b=basisFor(i); const t=trendOf(rd,i,b.ck); if(t.state==='na')return; tot++;
    if(mm.dir==='neutral')return;
    if(t.state==='up')imp++; else if(t.state==='down')dec++; else sta++;});
  head.innerHTML=`<div><div class="eyebrow">${S.profile.type==='national'?'National profile':S.profile.type==='state'?'State / UT profile':'District profile'}${hasV6?' · latest change 5→6':' · change 4→5'}</div>
    <div class="pt">${esc(gLabel(rd))}</div><div class="ps">${esc(S.profile.type==='district'?'District':rd.sub)}${(S.profile.type!=='district'&&!hasV6)?' · no NFHS-6 data':''}</div></div>
    <div style="margin-left:auto;display:flex;gap:20px">
      <div><div class="eyebrow"><span class="tdot up"></span> Improving</div><div class="kv" style="font-size:22px;color:var(--good)">${imp}</div></div>
      <div><div class="eyebrow"><span class="tdot flat"></span> Stable</div><div class="kv" style="font-size:22px;color:var(--warn-d)">${sta}</div></div>
      <div><div class="eyebrow"><span class="tdot down"></span> Worsening</div><div class="kv" style="font-size:22px;color:var(--bad)">${dec}</div></div>
      <div><div class="eyebrow">Tracked</div><div class="kv" style="font-size:22px">${tot}</div></div>
    </div>`;

  // insight summary: standout improvement & decline (percentage-point indicators for comparability)
  const ins=document.getElementById('prof-insights');
  if(ins){
    const movers=IND.map((mm,i)=>({mm,i,b:basisFor(i)}))
      .map(o=>({...o, t:trendOf(rd,o.i,o.b.ck)}))
      .filter(o=>o.t.state!=='na' && o.mm.dir!=='neutral' && o.mm.unit==='%');
    const up=[...movers].sort((a,b)=>b.t.imp-a.t.imp)[0];
    const dn=[...movers].sort((a,b)=>a.t.imp-b.t.imp)[0];
    const cards=[];
    if(up&&up.t.imp>0) cards.push(insightCard('Standout gain ('+up.b.lab+')', `<b>${esc(shorten(up.mm.name,40))}</b> ${fmtDelta(up.t.raw,up.mm.unit)}`,'good'));
    if(dn&&dn.t.imp<0) cards.push(insightCard('Biggest concern ('+dn.b.lab+')', `<b>${esc(shorten(dn.mm.name,40))}</b> ${fmtDelta(dn.t.raw,dn.mm.unit)}`,'bad'));
    cards.push(insightCard('Coverage', `${tot} of ${IND.length} indicators have data for ${esc(rd.label)}${hasV6?'; NFHS-6 official figures shown':''}`,'warn'));
    ins.innerHTML = cards.length?insightsBar(cards):'';
  }
  const pl=document.getElementById('prof-legend');
  if(pl) pl.innerHTML = `<span class="lg">columns = round values</span>`+
    `<span class="lg"><span class="sw" style="background:var(--accent)"></span> NFHS-6 (official latest)</span>`+
    `<span class="lg"><b>Δ latest</b> & arrow: 5→6 if available, else 4→5</span>`+
    trendLegendHTML(true)+
    `<span class="lg"><svg width="34" height="13" style="vertical-align:middle"><path d="M2 10 L17 6 L32 2" fill="none" stroke="var(--good)" stroke-width="1.6"/></svg> 2015→24 trajectory</span>`;

  const body=document.getElementById('prof-body');
  body.innerHTML=CATS.map(cat=>{
    const inds=IND.map((x,i)=>({...x,i})).filter(x=>x.cat===cat);
    if(!inds.length) return '';
    const rows=inds.map(x=>{
      const v6=rd.v6?rd.v6[x.i]:null, v4=rd.v4[x.i], v5=n5disp(rd,x.i);
      const b=basisFor(x.i);
      // delta reconciles with displayed endpoints
      const chipRaw = v6!=null? ((v5!=null)?+(v6-v5).toFixed(1):null) : ((v5!=null&&v4!=null)?+(v5-v4).toFixed(1):null);
      const t=trendOf(rd,x.i,b.ck);
      const dcls = x.dir==='neutral'?'delta-zero':(t.state==='up'?'delta-pos':t.state==='down'?'delta-neg':'delta-zero');
      const curCls6 = v6!=null?'cur':'', curCls5 = v6==null?'cur':'';
      return `<tr class="clk" data-i="${x.i}">
        <td class="nm">${esc(x.name)}${x.r6?'<span class="r6tag">6</span>':''}</td>
        <td class="muted">${fmt(v4,x.unit)}</td>
        <td class="${curCls5}">${fmt(v5,x.unit)}</td>
        <td class="${curCls6}" style="${v6!=null?'color:var(--accent)':''}">${v6==null?'—':fmt(v6,x.unit)}</td>
        <td class="${dcls}">${fmtDelta(chipRaw,x.unit)}</td>
        <td class="tcell">${trendBadge(rd,x.i,b.ck,{basisLab:b.lab})}</td>
        <td class="tcell">${sparkline(rd,x.i)}</td>
      </tr>`;}).join('');
    return `<div class="cat-tbl"><h3>${esc(cat)}</h3>
      <table class="dtbl"><thead><tr>
        <th>Indicator</th><th>NFHS-4</th><th>NFHS-5</th><th>NFHS-6</th><th>Δ latest</th><th style="text-align:center">Trend</th><th style="text-align:center">2015→24</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
  body.querySelectorAll('tr.clk').forEach(tr=>{
    const i=+tr.dataset.i;
    attachGeoTip(tr,rd,i);                       // hover → all rounds + trend explanation
    tr.onclick=()=>{ S.ind=i; syncIndSelect(); S.tab='atlas'; render(); };
  });
}
function syncIndSelect(){ const s=document.getElementById('ind-select'); if(s){ s.value=String(S.ind); syncCombo(s); } }
function syncProfileSelect(){
  const t=document.getElementById('prof-type'), n=document.getElementById('prof-name');
  t.value=S.profile.type; syncCombo(t);
  buildProfileNames();
  if(S.profile.type==='state') n.value=S.profile.id;
  if(S.profile.type==='district') n.value=S.profile.id;
  syncCombo(n);
}
function buildProfileNames(){
  const t=document.getElementById('prof-type').value, n=document.getElementById('prof-name');
  if(t==='national'){ if(n.__combo) n.__combo.setVisible(false); else n.style.display='none'; return; }
  if(n.__combo) n.__combo.setVisible(true); else n.style.display='';
  if(t==='state') n.innerHTML=stateNames.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  else n.innerHTML=distSorted.map(d=>`<option value="${esc(d.k)}">${esc(d.n)} — ${esc(d.s)}</option>`).join('');
  syncCombo(n);
}

/* ===================== shared UI ===================== */
function dirTag(d){ const map={higher:['dir-h','↑ higher better'],lower:['dir-l','↓ lower better'],neutral:['dir-n','neutral']};
  const [c,t]=map[d]; return ` <span class="dirtag ${c}">${t}</span>`; }
function shorten(s,n){ return s.length>n? s.slice(0,n-1)+'…':s; }
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---------- searchable combobox (wraps a native <select>) ---------- */
function enhanceSelect(sel){
  if(sel.__combo) return sel.__combo;
  const wrap=document.createElement('div');
  wrap.className='combo'+(sel.classList.contains('ind-select')?' full':'');
  sel.parentNode.insertBefore(wrap,sel);
  wrap.appendChild(sel);
  const btn=document.createElement('button');
  btn.type='button'; btn.className='combo-btn';
  btn.innerHTML='<span class="cb-label"></span><span class="cb-caret">▾</span>';
  const pop=document.createElement('div'); pop.className='combo-pop';
  pop.innerHTML='<div class="combo-search-wrap"><input class="combo-search" type="text" placeholder="Search…" aria-label="Search options"></div><div class="combo-list" role="listbox"></div>';
  wrap.appendChild(btn); wrap.appendChild(pop);
  const labelEl=btn.querySelector('.cb-label');
  const search=pop.querySelector('.combo-search');
  const list=pop.querySelector('.combo-list');
  let activeIdx=-1, flat=[];
  function curLabel(){ const o=sel.options[sel.selectedIndex]; return o?o.textContent:''; }
  function sync(){ labelEl.textContent=curLabel(); }
  function buildList(q){
    q=(q||'').trim().toLowerCase(); list.innerHTML=''; flat=[];
    const groups=[];
    Array.from(sel.children).forEach(ch=>{
      if(ch.tagName==='OPTGROUP'){
        const opts=Array.from(ch.children).filter(o=>!q||o.textContent.toLowerCase().includes(q));
        if(opts.length) groups.push({label:ch.label,opts});
      } else if(ch.tagName==='OPTION'){
        if(!q||ch.textContent.toLowerCase().includes(q)){
          let g=groups.find(x=>x.label===null); if(!g){g={label:null,opts:[]};groups.push(g);} g.opts.push(ch);
        }
      }
    });
    if(!groups.length){ list.innerHTML='<div class="combo-empty">No matches</div>'; return; }
    groups.forEach(g=>{
      if(g.label){ const h=document.createElement('div'); h.className='combo-grp'; h.textContent=g.label; list.appendChild(h); }
      g.opts.forEach(o=>{
        const d=document.createElement('div');
        d.className='combo-opt'+(o.value===sel.value?' sel':'');
        d.textContent=o.textContent; d.dataset.val=o.value; d.setAttribute('role','option');
        d.onclick=()=>choose(o.value);
        list.appendChild(d); flat.push(d);
      });
    });
    activeIdx=flat.findIndex(d=>d.classList.contains('sel'));
    if(activeIdx<0 && flat.length) activeIdx=0; paintActive();
  }
  function paintActive(){ flat.forEach((d,k)=>d.classList.toggle('active',k===activeIdx));
    if(flat[activeIdx]) flat[activeIdx].scrollIntoView({block:'nearest'}); }
  function choose(val){ sel.value=val; sync(); close(); sel.dispatchEvent(new Event('change',{bubbles:true})); }
  function open(){ wrap.classList.add('open'); search.value=''; buildList(''); setTimeout(()=>search.focus(),0);
    document.addEventListener('mousedown',outside,true); }
  function close(){ wrap.classList.remove('open'); document.removeEventListener('mousedown',outside,true); }
  function outside(e){ if(!wrap.contains(e.target)) close(); }
  btn.onclick=()=>{ wrap.classList.contains('open')?close():open(); };
  search.oninput=()=>buildList(search.value);
  search.onkeydown=(e)=>{
    if(e.key==='ArrowDown'){e.preventDefault(); activeIdx=Math.min(flat.length-1,activeIdx+1); paintActive();}
    else if(e.key==='ArrowUp'){e.preventDefault(); activeIdx=Math.max(0,activeIdx-1); paintActive();}
    else if(e.key==='Enter'){e.preventDefault(); if(flat[activeIdx]) choose(flat[activeIdx].dataset.val);}
    else if(e.key==='Escape'){e.preventDefault(); close(); btn.focus();}
  };
  const api={sync,open,close,setVisible:(v)=>{wrap.style.display=v?'':'none';}};
  sel.__combo=api; sync(); return api;
}
function syncCombo(sel){ if(sel&&sel.__combo) sel.__combo.sync(); }

const tip=document.getElementById('tip');
function showTip(e,html){ tip.innerHTML=html; tip.classList.add('show');
  let x=e.clientX+14,y=e.clientY+14;
  const r=tip.getBoundingClientRect();
  if(x+r.width>innerWidth-8) x=e.clientX-r.width-14;
  if(y+r.height>innerHeight-8) y=e.clientY-r.height-14;
  tip.style.left=x+'px'; tip.style.top=y+'px'; }
function hideTip(){ tip.classList.remove('show'); }

/* ---------- indicator selector ---------- */
function buildIndSelect(){
  const sel=document.getElementById('ind-select');
  sel.innerHTML=CATS.map(cat=>{
    const opts=IND.map((x,i)=>({x,i})).filter(o=>o.x.cat===cat)
      .map(o=>`<option value="${o.i}" ${o.i===S.ind?'selected':''}>${esc(o.x.name)}</option>`).join('');
    return `<optgroup label="${esc(cat)}">${opts}</optgroup>`;
  }).join('');
}
function buildCmpCat(){
  document.getElementById('cmp-cat').innerHTML=CATS.map(c=>`<option ${c===S.cmpCat?'selected':''}>${esc(c)}</option>`).join('');
}

/* ---------- compare add controls ---------- */
function buildAddControls(){
  const lvl=document.getElementById('cmp-add-type'), nm=document.getElementById('cmp-add-name');
  function names(){
    const t=lvl.value;
    if(t==='national'){ if(nm.__combo) nm.__combo.setVisible(false); else nm.style.display='none'; return; }
    if(nm.__combo) nm.__combo.setVisible(true); else nm.style.display='';
    if(t==='state') nm.innerHTML=stateNames.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
    else nm.innerHTML=distSorted.map(d=>`<option value="${esc(d.k)}">${esc(d.n)} — ${esc(d.s)}</option>`).join('');
    syncCombo(nm);
  }
  lvl.onchange=names; names();
  document.getElementById('cmp-add-btn').onclick=()=>{
    if(S.compare.length>=4) return;
    const t=lvl.value; let ref;
    if(t==='national') ref={type:'national'};
    else ref={type:t,id:nm.value};
    if(S.compare.some(r=>refKey(r)===refKey(ref))) return;
    S.compare.push(ref); renderCompare();
  };
}

/* ===================== EXPORT (PPTX + XLSX) ===================== */
const BRAND={accent:'0E7E92',accent2:'16A6BE',navy:'123A5E',ink:'17212B',ink2:'52616D',ink3:'86909A',
  good:'0E7C7B',bad:'C2562B',line:'D6DEE3',surf:'FFFFFF',head:'CFE6EC',zebra:'F0F4F7',font:'Trebuchet MS'};
const CAVEAT='NFHS-4/5 state & national figures are unweighted means of district values; NFHS-6 figures are official IIPS factsheet estimates (population-weighted, state/UT & national only — no districts; Manipur not surveyed). Δ5→6 is official-vs-official; Δ4→6 mixes bases. Ladakh shares 2011-census geometry with J&K.';

function toast(msg,err){const t=document.getElementById('toast');t.textContent=msg;t.className='toast show'+(err?' err':'');
  clearTimeout(toast._t);toast._t=setTimeout(()=>t.className='toast',err?4600:2800);}
function roundLabel(){return {v6:'NFHS-6 (2023–24)',v5:'NFHS-5 (2019–21)',v4:'NFHS-4 (2015–16)',
  change:'Change · NFHS-4 → NFHS-5',change56:'Change · NFHS-5 → NFHS-6 (official)',change46:'Change · NFHS-4 → NFHS-6'}[S.round]||S.round;}
function scopeLabel(){ if(S.level==='state'&&!S.zoomState) return 'States / UTs';
  return S.zoomState? ('Districts of '+S.zoomState):'All districts'; }
function nowStr(){return new Date().toISOString().slice(0,10);}
function safeName(s){return String(s).replace(/[^\w]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64);}
function num(v){return v==null?null:+(+v).toFixed(1);}

/* geographies for the current level/zoom */
function currentRefs(){
  if(S.level==='state'&&!S.zoomState) return stateNames.map(n=>({type:'state',id:n}));
  return DATA.districts.filter(d=>!S.zoomState||d.s===S.zoomState).map(d=>({type:'district',id:d.k}));
}

/* rasterize the live atlas SVG to a PNG data URL */
function svgToPng(scale){
  return new Promise((res,rej)=>{
    const svg=document.querySelector('#mapbox svg');
    if(!svg){rej(new Error('map not rendered'));return;}
    const w=+svg.getAttribute('width')||1000, h=+svg.getAttribute('height')||600;
    const clone=svg.cloneNode(true);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const st=document.createElementNS('http://www.w3.org/2000/svg','style');
    st.textContent='path.district{stroke:#ffffff;stroke-width:.3px}path.state{stroke:#ffffff;stroke-width:.9px}path.state-line{fill:none;stroke:rgba(27,32,38,.55);stroke-width:.8px}';
    clone.insertBefore(st,clone.firstChild);
    const xml=new XMLSerializer().serializeToString(clone);
    const url='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(xml)));
    const img=new Image();
    img.onload=()=>{const sc=scale||2;const c=document.createElement('canvas');c.width=w*sc;c.height=h*sc;
      const ctx=c.getContext('2d');ctx.fillStyle='#FBFBFB';ctx.fillRect(0,0,c.width,c.height);
      ctx.drawImage(img,0,0,c.width,c.height);res({data:c.toDataURL('image/png'),w,h});};
    img.onerror=()=>rej(new Error('raster failed'));
    img.src=url;
  });
}

/* ---- PPTX shared builders (LAYOUT_WIDE = 13.33 x 7.5 in) ---- */
function pptDeck(){const p=new PptxGenJS();p.layout='LAYOUT_WIDE';p.defineSlideMaster({title:'M',background:{color:BRAND.surf}});return p;}
function titleSlide(p,subtitle,lines){
  const s=p.addSlide();s.background={color:BRAND.surf};
  s.addShape(p.ShapeType.rect,{x:0,y:0,w:'100%',h:1.5,fill:{color:BRAND.navy}});
  s.addText('NFHS Atlas',{x:0.6,y:0.35,w:12,h:0.6,fontFace:BRAND.font,fontSize:34,bold:true,color:'FFFFFF'});
  s.addText('India Health Explorer  ·  NFHS-4 (2015–16) · NFHS-5 (2019–21) · NFHS-6 (2023–24)',
    {x:0.62,y:1.0,w:12,h:0.35,fontFace:BRAND.font,fontSize:13,color:BRAND.head});
  s.addText(subtitle,{x:0.6,y:2.1,w:12.1,h:0.7,fontFace:BRAND.font,fontSize:24,bold:true,color:BRAND.ink});
  if(lines&&lines.length) s.addText(lines.map(t=>({text:t,options:{bullet:{code:'2022'},color:BRAND.ink2}})),
    {x:0.7,y:3.0,w:12,h:2.4,fontFace:BRAND.font,fontSize:14,lineSpacingMultiple:1.3});
  s.addText(CAVEAT,{x:0.6,y:6.5,w:12.1,h:0.5,fontFace:BRAND.font,fontSize:9.5,italic:true,color:BRAND.ink3});
  s.addText('Generated '+nowStr(),{x:0.6,y:7.0,w:6,h:0.25,fontFace:BRAND.font,fontSize:9.5,color:BRAND.ink3});
  return s;
}
function contentSlide(p,title,right){
  const s=p.addSlide();s.background={color:BRAND.surf};
  s.addShape(p.ShapeType.rect,{x:0,y:0,w:'100%',h:0.85,fill:{color:BRAND.navy}});
  s.addText(title,{x:0.6,y:0.16,w:9.5,h:0.5,fontFace:BRAND.font,fontSize:20,bold:true,color:'FFFFFF'});
  if(right) s.addText(right,{x:8.5,y:0.26,w:4.2,h:0.4,align:'right',fontFace:BRAND.font,fontSize:12,color:BRAND.head});
  s.addText(CAVEAT,{x:0.6,y:7.12,w:12.1,h:0.3,fontFace:BRAND.font,fontSize:8,italic:true,color:BRAND.ink3});
  return s;
}
function hCell(t,opt){return {text:String(t),options:Object.assign({bold:true,color:'FFFFFF',fill:{color:BRAND.accent},
  fontFace:BRAND.font,fontSize:11,align:'left',valign:'middle'},opt||{})};}
function cCell(t,opt){return {text:(t==null||t==='')?'—':String(t),options:Object.assign({fontFace:BRAND.font,fontSize:10.5,
  color:BRAND.ink,valign:'middle',align:'left'},opt||{})};}
function pptTable(s,p,rows,opt){
  s.addTable(rows,Object.assign({x:0.6,y:1.05,w:12.1,border:{type:'solid',pt:0.5,color:BRAND.line},
    fontFace:BRAND.font,valign:'middle',autoPage:true,autoPageRepeatHeader:true,
    autoPageLineWeight:-0.5,newSlideStartY:1.05},opt||{}));
}
function dispVal(v,unit){ return v==null?'—':fmt(v,unit)+(unit==='%'?'%':unit==='Rs'?' ₹':''); }
function dispDelta(v){ if(v==null)return '—'; return (v>0?'+':'')+(+v).toFixed(1); }

/* ===== ATLAS export ===== */
function atlasData(){
  const i=S.ind,m=meta(i);
  const refs=currentRefs();
  let rows=refs.map(r=>{const rd=refData(r);
    return {type:r.type,name:r.type==='state'?rd.label:rd.n,state:r.type==='district'?rd.s:'',
      v6:num(rd.v6?rd.v6[i]:null), v5:num(rd.v5[i]), v4:num(rd.v4[i]),
      val:num(rawVal(rd,i,S.round)), imp:improvement(rd,i,S.round)};});
  rows=rows.filter(x=> x.val!=null);
  const score=x=>{ if(isChange(S.round)) return (m.dir==='neutral'?x.val:x.imp);
    return m.dir==='lower'?-x.val:x.val; };
  rows.forEach(x=>x._s=score(x));
  rows.sort((a,b)=>(b._s==null?-1e9:b._s)-(a._s==null?-1e9:a._s));
  return {rows,m,i};
}
async function exportAtlasPPT(p){
  const {rows,m}=atlasData();
  const natView=num(rawVal(DATA.national,S.ind,S.round));
  titleSlide(p,'Atlas — '+m.name,[
    'Indicator category: '+m.cat,
    'View: '+roundLabel()+'  ·  '+scopeLabel(),
    'Direction: '+(m.dir==='higher'?'higher is better':m.dir==='lower'?'lower is better':'neutral (no good/bad direction)'),
    'India ('+roundLabel().split(' ·')[0].replace('Change','Δ')+'): '+(isChange(S.round)?dispDelta(natView):dispVal(natView,m.unit))]);
  // map slide
  try{const png=await svgToPng(2);const s=contentSlide(p,m.name,roundLabel());
    const maxW=8.6,maxH=5.8;let w=maxW,h=w*png.h/png.w; if(h>maxH){h=maxH;w=h*png.w/png.h;}
    s.addImage({data:png.data,x:0.6,y:1.1,w,h});
    s.addText([{text:'Performance map',options:{bold:true,fontSize:14,color:BRAND.ink}},
      {text:'\nColour = value oriented by indicator direction. Teal = better, orange = worse'+(isChange(S.round)?' improvement.':'.'),options:{fontSize:11,color:BRAND.ink2}},
      {text:'\n\nIndia: '+(isChange(S.round)?dispDelta(natView):dispVal(natView,m.unit)),options:{fontSize:12,color:BRAND.ink,bold:true}},
      {text:'\nGeographies shown: '+rows.length,options:{fontSize:11,color:BRAND.ink2}}],
      {x:9.5,y:1.2,w:3.2,h:4,fontFace:BRAND.font,valign:'top'});
  }catch(e){/* map not available; skip image slide */}
  // rankings slide — best & worst side by side
  const N=Math.min(10,Math.floor(rows.length/2));
  const top=rows.slice(0,N), bot=rows.slice(-N).reverse();
  const s2=contentSlide(p,'Rankings — '+m.name,roundLabel());
  const valFmt=x=> isChange(S.round)?dispDelta(x.val):dispVal(x.val,m.unit);
  const neutralRaw=m.dir==='neutral'&&!isChange(S.round);
  const head=[hCell('#',{align:'center'}),hCell(neutralRaw?'Highest':'Best'),hCell('Value',{align:'right'})];
  const headB=[hCell('#',{align:'center'}),hCell(neutralRaw?'Lowest':'Weakest'),hCell('Value',{align:'right'})];
  const mk=list=>list.map((x,k)=>[cCell(k+1,{align:'center',color:BRAND.ink3}),
    cCell(x.name+(x.state?', '+x.state:''),{}),
    cCell(valFmt(x),{align:'right',bold:true})]);
  s2.addTable([head,...mk(top)],{x:0.6,y:1.1,w:5.9,colW:[0.5,4.1,1.3],border:{type:'solid',pt:0.5,color:BRAND.line},
    fontFace:BRAND.font,valign:'middle',rowH:0.3,fill:{color:'FFFFFF'}});
  s2.addText('Best performers',{x:0.6,y:0.95,w:5.9,h:0.2,fontSize:10,bold:true,color:BRAND.good,fontFace:BRAND.font});
  s2.addTable([headB,...mk(bot)],{x:6.8,y:1.1,w:5.9,colW:[0.5,4.1,1.3],border:{type:'solid',pt:0.5,color:BRAND.line},
    fontFace:BRAND.font,valign:'middle',rowH:0.3,fill:{color:'FFFFFF'}});
  s2.addText('Weakest performers',{x:6.8,y:0.95,w:5.9,h:0.2,fontSize:10,bold:true,color:BRAND.bad,fontFace:BRAND.font});
}
function exportAtlasXLSX(wb){
  const {rows,m}=atlasData();
  const isState=rows[0]&&rows[0].type==='state';
  const viewCol=roundLabel();
  const base=isState?['Rank','State / UT']:['Rank','District','State / UT'];
  const header=[...base,'NFHS-6','NFHS-5','NFHS-4',viewCol,'Improvement (dir-adj)'];
  const aoa=[header];
  rows.forEach((x,k)=>{ const lead=isState?[k+1,x.name]:[k+1,x.name,x.state];
    aoa.push([...lead, x.v6, x.v5, x.v4, x.val, num(x.imp)]); });
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=(isState?[6,26]:[6,26,20]).concat([9,9,9,14,18]).map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb,ws,'Rankings');
  const meta=[['Indicator',m.name],['Category',m.cat],['Direction',m.dir],['Unit',m.unit],
    ['View',roundLabel()],['Scope',scopeLabel()],
    ['India NFHS-6',num(DATA.national.v6?DATA.national.v6[S.ind]:null)],
    ['India NFHS-5 (official)',num(DATA.national.v5o?DATA.national.v5o[S.ind]:null)],
    ['India NFHS-5 (unweighted)',num(DATA.national.v5[S.ind])],
    ['India NFHS-4 (unweighted)',num(DATA.national.v4[S.ind])],
    ['Generated',nowStr()],['Note',CAVEAT]];
  const wm=XLSX.utils.aoa_to_sheet(meta); wm['!cols']=[{wch:24},{wch:80}];
  XLSX.utils.book_append_sheet(wb,wm,'Indicator');
}

/* ===== COMPARE export ===== */
function exportComparePPT(p){
  const m=meta(S.ind), refs=S.compare;
  const geoLines=refs.map(r=>{const rd=refData(r);return rd.label+'  ('+rd.sub+')';});
  titleSlide(p,'Compare — '+refs.length+' geographies',[
    'Focus indicator: '+m.name, 'View: '+roundLabel(), 'Geographies: '+refs.map(r=>refData(r).label).join(', ')]);
  // focus bar chart
  const s=contentSlide(p,'Focus · '+m.name,roundLabel());
  const labels=refs.map(r=>refData(r).label);
  const vals=refs.map(r=>{const v=rawVal(refData(r),S.ind,S.round);return v==null?0:+(+v).toFixed(1);});
  s.addChart(p.ChartType.bar,[{name:m.name,labels,values:vals}],
    {x:0.6,y:1.1,w:12.1,h:5.6,barDir:'col',showValue:true,dataLabelFontFace:BRAND.font,dataLabelFontSize:11,
     chartColors:['1F5C66','C2562B','3A4C82','7A5C2E'],showLegend:false,
     catAxisLabelFontFace:BRAND.font,catAxisLabelFontSize:12,valAxisLabelFontFace:BRAND.font,
     valAxisLabelFontSize:10,valAxisTitle:m.unit==='%'?'percent':m.unit==='Rs'?'₹':'value',showTitle:false});
  // category table
  const inds=IND.map((x,i)=>({...x,i})).filter(x=>x.cat===S.cmpCat);
  const head=[hCell('Indicator · '+S.cmpCat),...refs.map(r=>hCell(refData(r).label,{align:'right'}))];
  const body=inds.map(x=>{
    const cells=refs.map(r=>rawVal(refData(r),x.i,S.round));
    return [cCell(x.name),...cells.map(c=>cCell(S.round==='change'?dispDelta(c):dispVal(c,x.unit),{align:'right'}))];
  });
  const s2=contentSlide(p,'Indicators · '+S.cmpCat,roundLabel());
  pptTable(s2,p,[head,...body],{colW:[6.1,...refs.map(()=>6/refs.length)],rowH:0.28,fontSize:10,fill:{color:'FFFFFF'}});
}
function exportCompareXLSX(wb){
  const refs=S.compare;
  const head=['Indicator','Category','Direction','Unit'];
  refs.forEach(r=>{const l=refData(r).label;head.push(l+' · N5',l+' · N4',l+' · Δ');});
  const aoa=[head];
  IND.forEach((x,i)=>{
    const row=[x.name,x.cat,x.dir,x.unit];
    refs.forEach(r=>{const rd=refData(r);const v5=num(rd.v5[i]),v4=num(rd.v4[i]);
      row.push(v5,v4,(v5!=null&&v4!=null)?+(v5-v4).toFixed(1):null);});
    aoa.push(row);
  });
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:52},{wch:24},{wch:10},{wch:7},...refs.flatMap(()=>[{wch:10},{wch:10},{wch:9}])];
  XLSX.utils.book_append_sheet(wb,ws,'Comparison');
  const g=[['Geography','Type','Detail','NFHS-5 (focus)','NFHS-4 (focus)']];
  refs.forEach(r=>{const rd=refData(r);g.push([rd.label,r.type,rd.sub,num(rd.v5[S.ind]),num(rd.v4[S.ind])]);});
  const wg=XLSX.utils.aoa_to_sheet(g);wg['!cols']=[{wch:24},{wch:10},{wch:24},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wb,wg,'Geographies');
}

/* ===== CHANGE export ===== */
function changeData(){
  const m=meta(S.ind);
  const ck=changeKey(), P=CHG_PAIR[ck];
  const v6round=isV6Round(ck);
  const refs = v6round ? stateNames.map(n=>({type:'state',id:n})) : currentRefs();
  const rows=refs.map(r=>{const rd=refData(r);
    return {type:r.type,name:r.type==='district'?rd.n:rd.label,state:r.type==='district'?rd.s:'',
      from:num(rd[P[0]]?rd[P[0]][S.ind]:null), to:num(rd[P[1]]?rd[P[1]][S.ind]:null),
      raw:num(rawVal(rd,S.ind,ck)), imp:improvement(rd,S.ind,ck)};})
    .filter(x=>x.imp!=null);
  const score=x=> m.dir==='neutral'? x.raw : x.imp;
  rows.sort((a,b)=>score(b)-score(a));
  const labs={change:['NFHS-4','NFHS-5'],change56:['NFHS-5','NFHS-6'],change46:['NFHS-4','NFHS-6']}[ck];
  return {rows,m,ck,labs};
}
function exportChangePPT(p){
  const {rows,m,labs}=changeData();
  const nFrom=num(rawVal(DATA.national,S.ind, CHG_PAIR[changeKey()][0]==='v5o'?'v5o':CHG_PAIR[changeKey()][0]));
  // simpler national from/to:
  const P=CHG_PAIR[changeKey()];
  const natFrom=num(DATA.national[P[0]][S.ind]), natTo=num(DATA.national[P[1]][S.ind]);
  const improved=rows.filter(x=>m.dir==='neutral'?x.raw>0:x.imp>0).length;
  const declined=rows.filter(x=>m.dir==='neutral'?x.raw<0:x.imp<0).length;
  titleSlide(p,'Change · '+m.name,[
    'View: '+labs[0]+' → '+labs[1]+' movement  ·  '+(isV6Round(changeKey())?'States / UTs (NFHS-6 has no districts)':scopeLabel()),
    'India: '+dispVal(natFrom,m.unit)+' → '+dispVal(natTo,m.unit)+'  (Δ '+dispDelta((natTo!=null&&natFrom!=null)?+(natTo-natFrom).toFixed(1):null)+')',
    (m.dir==='neutral'?'Rising':'Improved')+': '+improved+'   ·   '+(m.dir==='neutral'?'Falling':'Declined')+': '+declined+'   of '+rows.length]);
  const s=contentSlide(p,'Biggest movements · '+m.name, labs[0]+' → '+labs[1]);
  const N=Math.min(12,rows.length);
  const top=rows.slice(0,N);
  s.addChart(p.ChartType.bar,[{name:'Δ',labels:top.map(x=>x.name),values:top.map(x=>x.raw==null?0:x.raw)}],
    {x:0.6,y:1.1,w:12.1,h:5.7,barDir:'bar',showValue:true,dataLabelFontFace:BRAND.font,
     chartColors:['1F5C66'],showLegend:false,catAxisLabelFontFace:BRAND.font,catAxisLabelFontSize:10,
     valAxisLabelFontFace:BRAND.font,valAxisLabelFontSize:10,barGapWidthPct:40,showTitle:false});
  const s2=contentSlide(p,'Improvements & declines', labs[0]+' → '+labs[1]);
  const N2=Math.min(14,Math.floor(rows.length/2));
  const up=rows.slice(0,N2), down=rows.slice(-N2).reverse();
  const head=[hCell('#',{align:'center'}),hCell('Geography'),hCell('Δ',{align:'right'})];
  const mk=list=>list.map((x,k)=>[cCell(k+1,{align:'center',color:BRAND.ink3}),
    cCell(x.name+(x.state?', '+x.state:'')),cCell(dispDelta(x.raw),{align:'right',bold:true})]);
  s2.addText('Biggest improvements',{x:0.6,y:0.95,w:5.9,h:0.2,fontSize:10,bold:true,color:BRAND.good,fontFace:BRAND.font});
  s2.addTable([head,...mk(up)],{x:0.6,y:1.1,w:5.9,colW:[0.5,4.1,1.3],border:{type:'solid',pt:0.5,color:BRAND.line},fontFace:BRAND.font,rowH:0.26,fill:{color:'FFFFFF'}});
  s2.addText('Biggest declines',{x:6.8,y:0.95,w:5.9,h:0.2,fontSize:10,bold:true,color:BRAND.bad,fontFace:BRAND.font});
  s2.addTable([head,...mk(down)],{x:6.8,y:1.1,w:5.9,colW:[0.5,4.1,1.3],border:{type:'solid',pt:0.5,color:BRAND.line},fontFace:BRAND.font,rowH:0.26,fill:{color:'FFFFFF'}});
}
function exportChangeXLSX(wb){
  const {rows,m,labs}=changeData();
  const isState=rows[0]&&rows[0].type==='state';
  const base=isState?['Rank','State / UT']:['Rank','District','State / UT'];
  const head=[...base,labs[0],labs[1],'Change','Improvement (dir-adj)'];
  const aoa=[head];
  rows.forEach((x,k)=>{const lead=isState?[k+1,x.name]:[k+1,x.name,x.state]; aoa.push([...lead,x.from,x.to,x.raw,num(x.imp)]);});
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=(isState?[6,26]:[6,26,20]).concat([10,10,9,18]).map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb,ws,'Change');
  const P=CHG_PAIR[changeKey()]; const nF=num(DATA.national[P[0]][S.ind]),nT=num(DATA.national[P[1]][S.ind]);
  const summary=[['Indicator',m.name],['Category',m.cat],['Direction',m.dir],['Unit',m.unit],['View',labs[0]+' → '+labs[1]],['Scope',scopeLabel()],
    ['India '+labs[0],nF],['India '+labs[1],nT],['India Δ',(nT!=null&&nF!=null)?+(nT-nF).toFixed(1):null],
    ['Geographies with data',rows.length],['Generated',nowStr()],['Note',CAVEAT]];
  const wsum=XLSX.utils.aoa_to_sheet(summary);wsum['!cols']=[{wch:22},{wch:80}];
  XLSX.utils.book_append_sheet(wb,wsum,'Summary');
}

/* ===== PROFILE export ===== */
function profileData(){
  const rd=refData(S.profile);
  const rows=IND.map((x,i)=>{const v6=num(rd.v6?rd.v6[i]:null),v5=num(rd.v5[i]),v4=num(rd.v4[i]);
    return {name:x.name,cat:x.cat,dir:x.dir,unit:x.unit,r6:!!x.r6,v6,v5,v4,
      ch45:(v5!=null&&v4!=null)?+(v5-v4).toFixed(1):null,
      ch56:num(rawVal(rd,i,'change56')), imp56:improvement(rd,i,'change56'), imp45:improvement(rd,i,'change'),
      nat6:num(DATA.national.v6?DATA.national.v6[i]:null), nat5:num(DATA.national.v5[i])};});
  return {rd,rows};
}
function exportProfilePPT(p){
  const {rd,rows}=profileData();
  const hasV6=rows.some(x=>x.v6!=null);
  let imp=0,dec=0,tot=0;
  rows.forEach(x=>{const iv=hasV6?(x.imp56!=null?x.imp56:x.imp45):x.imp45; if(iv==null)return;tot++;if(x.dir!=='neutral'){iv>0?imp++:iv<0?dec++:0;}});
  titleSlide(p,'Profile — '+rd.label,[
    rd.sub, 'Indicators improved: '+imp+'   ·   declined: '+dec+'   ·   tracked: '+tot,
    hasV6?'Values shown for NFHS-6 / NFHS-5 / NFHS-4 where available.':'NFHS-6 not available for this geography; NFHS-5 / NFHS-4 shown.']);
  // movement chart: comparable percentage-point indicators; prefer 5→6 if v6 present else 4→5
  const useV6=hasV6;
  const movable=rows.filter(x=>x.dir!=='neutral'&&x.unit==='%'&&(useV6?x.imp56!=null:x.imp45!=null)).slice();
  movable.sort((a,b)=>(useV6?b.imp56-a.imp56:b.imp45-a.imp45));
  const up=movable.slice(0,8), down=movable.slice(-8).reverse();
  const picks=[...up,...down];
  const s=contentSlide(p,'Largest movements (percentage points) — '+rd.label, useV6?'NFHS-5 → 6':'NFHS-4 → 5');
  s.addChart(p.ChartType.bar,[{name:'Improvement (dir-adj, pp)',labels:picks.map(x=>shorten(x.name,46)),values:picks.map(x=>+( (useV6?x.imp56:x.imp45)||0 ).toFixed(1))}],
    {x:0.6,y:1.1,w:12.1,h:5.7,barDir:'bar',showValue:true,dataLabelFontFace:BRAND.font,dataLabelFontSize:9,
     chartColors:['1F5C66'],showLegend:false,catAxisLabelFontFace:BRAND.font,catAxisLabelFontSize:9,
     valAxisLabelFontFace:BRAND.font,valAxisLabelFontSize:10,barGapWidthPct:35,showTitle:false});
  // category tables (autoPage)
  const s2=contentSlide(p,'All indicators — '+rd.label,rd.sub);
  const head=[hCell('Indicator'),hCell('Category'),hCell('N6',{align:'right'}),hCell('N5',{align:'right'}),hCell('N4',{align:'right'}),hCell('Δ5→6',{align:'right'}),hCell('Δ4→5',{align:'right'})];
  const body=rows.map(x=>[cCell(x.name),cCell(x.cat,{color:BRAND.ink2,fontSize:9}),
    cCell(dispVal(x.v6,x.unit),{align:'right',color:BRAND.accent}),cCell(dispVal(x.v5,x.unit),{align:'right'}),cCell(dispVal(x.v4,x.unit),{align:'right'}),
    cCell(dispDelta(x.ch56),{align:'right',color:(x.imp56>0?BRAND.good:x.imp56<0?BRAND.bad:BRAND.ink2)}),
    cCell(dispDelta(x.ch45),{align:'right',color:(x.imp45>0?BRAND.good:x.imp45<0?BRAND.bad:BRAND.ink2)})]);
  pptTable(s2,p,[head,...body],{colW:[4.9,2.8,0.95,0.95,0.95,1.0,1.0],rowH:0.22,fontSize:9,fill:{color:'FFFFFF'}});
}
function exportProfileXLSX(wb){
  const {rd,rows}=profileData();
  const head=['Indicator','Category','Direction','Unit','NFHS-6','NFHS-5','NFHS-4','Δ 4→5','Δ 5→6','Improvement 5→6 (dir-adj)','National NFHS-6','National NFHS-5'];
  const aoa=[head];
  rows.forEach(x=>aoa.push([x.name,x.cat,x.dir,x.unit,x.v6,x.v5,x.v4,x.ch45,x.ch56,num(x.imp56),x.nat6,x.nat5]));
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:56},{wch:26},{wch:9},{wch:6},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:22},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb,ws,'Profile');
  const meta=[['Geography',rd.label],['Type',S.profile.type],['Detail',rd.sub],['Indicators',rows.length],
    ['Generated',nowStr()],['Note',CAVEAT]];
  const wm=XLSX.utils.aoa_to_sheet(meta);wm['!cols']=[{wch:18},{wch:80}];
  XLSX.utils.book_append_sheet(wb,wm,'About');
}

/* ---- dispatch ---- */
async function doExportPPTX(){
  const p=pptDeck();
  let fn='NFHS';
  if(S.tab==='atlas'){ await exportAtlasPPT(p); fn='NFHS-Atlas-'+roundTok()+'-'+safeName(meta(S.ind).name); }
  else if(S.tab==='compare'){ exportComparePPT(p); fn='NFHS-Compare-'+roundTok()+'-'+safeName(meta(S.ind).name); }
  else if(S.tab==='change'){ exportChangePPT(p); fn='NFHS-Change-'+roundTok()+'-'+safeName(meta(S.ind).name); }
  else { exportProfilePPT(p); fn='NFHS-Profile-'+safeName(refData(S.profile).label); }
  await p.writeFile({fileName:fn+'.pptx'});
}
function roundTok(){return {v6:'NFHS6',v5:'NFHS5',v4:'NFHS4',change:'chg45',change56:'chg56',change46:'chg46'}[S.round]||S.round;}
function doExportXLSX(){
  const wb=XLSX.utils.book_new();
  let fn='NFHS';
  if(S.tab==='atlas'){ exportAtlasXLSX(wb); fn='NFHS-Atlas-'+roundTok()+'-'+safeName(meta(S.ind).name); }
  else if(S.tab==='compare'){ exportCompareXLSX(wb); fn='NFHS-Compare-'+roundTok()+'-'+safeName(meta(S.ind).name); }
  else if(S.tab==='change'){ exportChangeXLSX(wb); fn='NFHS-Change-'+roundTok()+'-'+safeName(meta(S.ind).name); }
  else { exportProfileXLSX(wb); fn='NFHS-Profile-'+safeName(refData(S.profile).label); }
  XLSX.writeFile(wb,fn+'.xlsx');
}
async function runExport(kind,btn){
  if(btn.classList.contains('busy')) return;
  btn.classList.add('busy'); const orig=btn.innerHTML; btn.innerHTML='<span class="bx-i">…</span> Working…';
  try{
    if(kind==='pptx'){ await doExportPPTX(); toast('PowerPoint downloaded — '+tabName()+' tab'); }
    else { doExportXLSX(); toast('Excel downloaded — '+tabName()+' tab'); }
  }catch(e){ console.error(e); toast('Export failed: '+e.message,true); }
  finally{ btn.classList.remove('busy'); btn.innerHTML=orig; }
}
function tabName(){return {atlas:'Atlas',compare:'Compare',change:'Change',profile:'Profile'}[S.tab];}


function syncLevelLock(){
  // NFHS-6 rounds have no district data → lock to state level
  const lock=isV6Round(S.round);
  const distBtn=document.querySelector('#level-seg button[data-v="district"]');
  if(distBtn){ distBtn.disabled=lock; distBtn.style.opacity=lock?'.4':''; distBtn.style.cursor=lock?'not-allowed':''; distBtn.title=lock?'NFHS-6 is available at state/UT & national level only':''; }
  const note=document.getElementById('v6-note'); if(note) note.style.display=lock?'':'none';
}
function wire(){
  document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab; render();});
  document.querySelectorAll('#level-seg button').forEach(b=>b.onclick=()=>{
    if(b.disabled) return;
    S.level=b.dataset.v; S.zoomState=null;
    document.querySelectorAll('#level-seg button').forEach(x=>x.setAttribute('aria-pressed',x===b));
    render();});
  document.querySelectorAll('#round-seg button').forEach(b=>b.onclick=()=>{
    S.round=b.dataset.v;
    document.querySelectorAll('#round-seg button').forEach(x=>x.setAttribute('aria-pressed',x===b));
    if(isV6Round(S.round) && S.level!=='state'){ S.level='state'; S.zoomState=null;
      document.querySelectorAll('#level-seg button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v==='state'));
      toast('NFHS-6 is state/UT & national level only — switched to States/UTs'); }
    syncLevelLock();
    render();});
  document.getElementById('ind-select').onchange=e=>{S.ind=+e.target.value; render();};
  document.getElementById('cmp-cat').onchange=e=>{S.cmpCat=e.target.value; renderCompare();};
  document.getElementById('map-back').onclick=()=>{S.zoomState=null; renderAtlas();};
  document.getElementById('prof-type').onchange=()=>{const t=document.getElementById('prof-type').value;
    buildProfileNames();
    if(t==='national') S.profile={type:'national'};
    else S.profile={type:t,id:document.getElementById('prof-name').value};
    renderProfile();};
  document.getElementById('prof-name').onchange=()=>{const t=document.getElementById('prof-type').value;
    S.profile={type:t,id:document.getElementById('prof-name').value}; renderProfile();};
  let rt; addEventListener('resize',()=>{clearTimeout(rt); rt=setTimeout(()=>{if(S.tab==='atlas')drawMap();},180);});
  document.getElementById('exp-pptx').onclick=function(){ runExport('pptx',this); };
  document.getElementById('exp-xlsx').onclick=function(){ runExport('xlsx',this); };
  const rb=(id,fn)=>{const el=document.getElementById(id); if(el) el.onclick=fn;};
  rb('atlas-reset',resetAtlas); rb('chg-reset',resetChange); rb('cmp-reset',resetCompare); rb('prof-reset',resetProfile);
}

/* ---------- init ---------- */
document.getElementById('stat-d').textContent=DATA.districts.length;
document.getElementById('stat-s').textContent=Object.keys(DATA.states).length;
document.getElementById('stat-i').textContent=DATA.indicators.length;
buildIndSelect(); buildCmpCat();
['ind-select','cmp-cat','cmp-add-type','cmp-add-name','prof-type','prof-name']
  .forEach(id=>enhanceSelect(document.getElementById(id)));
buildAddControls(); buildProfileNames(); wire();
document.querySelectorAll('#level-seg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S.level));
document.querySelectorAll('#round-seg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S.round));
syncLevelLock();
render();
})();
