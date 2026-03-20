/* js/app.js — AMRscape */
const App = (() => {

  const PC = {
    'pathogen:efaecium':'#e8960a','pathogen:saur':'#c0392b',
    'pathogen:kpneu':'#2980b9',  'pathogen:abau':'#d35400',
    'pathogen:paer':'#27ae60',   'pathogen:enter':'#8e44ad',
  };

  const DC_ORDER = [
    {n:'Penicillin',s:'Pen'},{n:'Cephalosporin',s:'Ceph'},{n:'Carbapenem',s:'Carb'},
    {n:'Polymyxin',s:'Poly'},{n:'Glycopeptide',s:'Glyco'},{n:'Oxazolidinone',s:'Oxaz'},
    {n:'Fluoroquinolone',s:'FQ'},{n:'Aminoglycoside',s:'AG'},{n:'Tetracycline',s:'Tet'},
    {n:'Macrolide',s:'Mac'},{n:'Sulfonamide',s:'Sulf'},{n:'Amphenicol',s:'Amph'},
    {n:'Lipopeptide',s:'Lip'},{n:'Nitrofuran',s:'Nit'},
  ];

  const TIER = {Reserve:0, Watch:1, Access:2};
  let G=null, byId=null, leftId=null, rightId=null;

  const $ = id => document.getElementById(id);
  const setText = (id, val) => { const el=$(id); if(el) el.textContent=val; };

  /* ── Theme — default LIGHT ── */
  function initTheme(){
    // Always default light unless user explicitly chose dark
    const saved = localStorage.getItem('amrscape-theme');
    const theme = (saved === 'dark') ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if(!saved) localStorage.setItem('amrscape-theme','light');
  }
  function toggleTheme(){
    const n = document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', n);
    localStorage.setItem('amrscape-theme', n);
    // re-render after theme CSS transitions settle
    setTimeout(() => renderAll(leftId, rightId), 80);
  }

  /* ── Data helpers ── */
  function edgesFrom(id, type){ return G.edges.filter(e=>(e.source.id||e.source)===id && e.type===type); }
  function edgesTo(id,   type){ return G.edges.filter(e=>(e.target.id||e.target)===id && e.type===type); }

  /* ── Build profile for one pathogen ── */
  function buildProfile(pathId){
    const p = byId.get(pathId);
    const geneIds = edgesTo(pathId,'found_in').map(e=>e.source.id||e.source);
    const genes   = geneIds.map(id=>byId.get(id)).filter(Boolean);

    const geneDetails = genes.map(g => {
      const mechs = edgesFrom(g.id,'confers_resistance_via').map(e=>byId.get(e.target.id||e.target)).filter(Boolean);
      const drugs = edgesFrom(g.id,'confers_resistance_to').map(e=>byId.get(e.target.id||e.target)).filter(Boolean);
      return {g, mechs, drugs};
    });

    const mechCounts = {};
    geneDetails.forEach(({mechs})=>mechs.forEach(m=>{ mechCounts[m.id]=(mechCounts[m.id]||0)+1; }));

    const seenD = new Set(), awareCounts={Access:0,Watch:0,Reserve:0};
    geneDetails.forEach(({drugs})=>drugs.forEach(d=>{
      if(!seenD.has(d.id)){ seenD.add(d.id); if(d.aware in awareCounts) awareCounts[d.aware]++; }
    }));

    const mobCounts={};
    genes.forEach(g=>{ const m=g.mobilization||'unknown'; mobCounts[m]=(mobCounts[m]||0)+1; });

    const dcMap = new Map(DC_ORDER.map(d=>[d.n,{...d,hit:false,aware:null,tier:99}]));
    geneDetails.forEach(({drugs})=>drugs.forEach(d=>{
      const dc=dcMap.get(d.drug_class);
      if(dc){ dc.hit=true; const t=TIER[d.aware]??3; if(t<dc.tier){dc.tier=t; dc.aware=d.aware||'Access';} }
    }));

    const mobile   = genes.filter(g=>g.mobilization&&!g.mobilization.startsWith('chromosomal'));
    const mobFrac  = genes.length ? mobile.length/genes.length : 0;
    const coEdges  = G.edges.filter(e=>e.type==='co_resistance'&&(geneIds.includes(e.source.id||e.source)||geneIds.includes(e.target.id||e.target)));
    const transferRisk = Math.min(100,Math.round(mobFrac*70+Math.min(coEdges.length,5)*6));

    return { p, genes, geneDetails, mechCounts, awareCounts, mobCounts,
             dcArr:[...dcMap.values()], transferRisk,
             reserveCount:awareCounts.Reserve,
             geneLabels:new Set(genes.map(g=>g.label)) };
  }

  /* ── Compare two profiles ── */
  function buildCompare(pA, pB){
    const inter  = [...pA.geneLabels].filter(l=>pB.geneLabels.has(l));
    const onlyA  = [...pA.geneLabels].filter(l=>!pB.geneLabels.has(l));
    const onlyB  = [...pB.geneLabels].filter(l=>!pA.geneLabels.has(l));
    const uSize  = new Set([...pA.geneLabels,...pB.geneLabels]).size;
    const jaccard = uSize ? inter.length/uSize : 0;

    const sharedDetails = pA.geneDetails.filter(({g})=>pB.geneLabels.has(g.label));
    const mobileShared  = sharedDetails.filter(({g})=>{
      const gB = pB.genes.find(g2=>g2.label===g.label);
      return g.mobilization&&!g.mobilization.startsWith('chromosomal')&&
             gB?.mobilization&&!gB.mobilization.startsWith('chromosomal');
    });

    const escapeCount = DC_ORDER.filter(dc=>
      pA.dcArr.find(d=>d.n===dc.n)?.hit && pB.dcArr.find(d=>d.n===dc.n)?.hit
    ).length;
    const tei = Math.round(escapeCount/DC_ORDER.length*100);

    return {inter, onlyA, onlyB, jaccard, sharedDetails, mobileShared, tei, escapeCount};
  }

  /* ── Helpers ── */
  function binMob(mc){
    let mobile=0,chrom=0;
    Object.entries(mc).forEach(([k,v])=>{ if(k.startsWith('chromosomal')) chrom+=v; else mobile+=v; });
    const total=mobile+chrom;
    return {mobile,chrom,other:0,pct:total?Math.round(mobile/total*100):0};
  }
  function mobClass(m){ if(!m||m==='unknown') return 'oth'; if(m.startsWith('chromosomal')) return 'chr'; return 'mob'; }
  function mobShort(m){ if(!m||m==='unknown') return 'unk'; if(m.startsWith('chromosomal')) return 'chromo'; return 'mobile'; }
  function riskLabel(s){ if(s>=75)return{l:'Critical',k:'c'}; if(s>=50)return{l:'High',k:'h'}; if(s>=25)return{l:'Medium',k:'m'}; return{l:'Low',k:'l'}; }
  function jDesc(j){ if(j>=.7)return'Highly similar resistomes'; if(j>=.4)return'Moderately overlapping'; if(j>=.2)return'Some shared resistance'; if(j>0)return'Largely distinct'; return'No shared ARGs'; }

  /* ── Render panel ── */
  function renderPanel(side, pathId){
    const prof = buildProfile(pathId);
    const col  = PC[pathId]||'#555';

    const ab=$(`sel-accent-${side}`); if(ab) ab.style.background=col;

    const mt=$(`ptop-${side}`);
    if(mt){
      const risk=riskLabel(prof.transferRisk);
      let h=`<div class="ptop-name" style="color:${col}">${prof.p.full_name||prof.p.label}</div><div class="ptop-badges">`;
      if(prof.p.who_priority) h+=`<span class="badge b-${prof.p.who_priority.toLowerCase()}">${prof.p.who_priority} Priority</span>`;
      if(prof.p.gram)         h+=`<span class="badge b-${prof.p.gram==='positive'?'pos':'neg'}">Gram ${prof.p.gram}</span>`;
      h+=`<span class="badge b-args">${prof.genes.length} ARGs</span>`;
      h+=`<span class="badge b-risk-${risk.k}">Transfer Risk: ${risk.l}</span>`;
      if(prof.reserveCount)   h+=`<span class="badge b-reserve">⚠ ${prof.reserveCount} Reserve</span>`;
      h+=`</div>`;
      mt.innerHTML=h;
    }

    const radarEl=$(`radar-${side}`), donutEl=$(`donut-${side}`), pieEl=$(`pie-${side}`), stripEl=$(`strip-${side}`);

    if(radarEl) Charts.radar(radarEl, prof.mechCounts, col);

    if(donutEl){
      const total=Object.values(prof.awareCounts).reduce((s,v)=>s+v,0);
      Charts.donut(donutEl,
        Object.entries(Charts.AWARE_C).map(([k,c])=>({k,v:prof.awareCounts[k]||0,c})),
        total,'drugs');
    }

    if(pieEl){
      const mb=binMob(prof.mobCounts);
      Charts.donut(pieEl,[
        {k:'mobile',v:mb.mobile,c:Charts.MOB_C.mobile},
        {k:'chrom', v:mb.chrom, c:Charts.MOB_C.chromosomal},
        {k:'other', v:mb.other, c:Charts.MOB_C.other},
      ],`${mb.pct}%`,'mobile');
    }

    if(stripEl) Charts.strip(stripEl, prof.dcArr);

    return prof;
  }

  /* ── Render comparison ── */
  function renderCompare(pA, pB){
    const comp=buildCompare(pA,pB);
    const cA=PC[pA.p.id]||'#555', cB=PC[pB.p.id]||'#555';
    const jPct=Math.round(comp.jaccard*100);

    const sf=$('sim-fill'); if(sf) sf.style.width=`${jPct}%`;
    const sp=$('sim-pct');  if(sp) sp.textContent=`${jPct}%`;

    // Summary strip values
    const strip={
      'sc-jaccard':[jPct,'%'],
      'sc-shared':[comp.inter.length,''],
      'sc-tei':[comp.tei,'%'],
      'sc-hgt':[comp.mobileShared.length,''],
      'sc-reserve':[Math.max(pA.reserveCount,pB.reserveCount),''],
    };
    Object.entries(strip).forEach(([id,[val,suf]])=>{
      const el=$(id); if(!el) return;
      const sv=el.querySelector('.sc-val');
      if(sv){
        sv.textContent=val+suf;
        if(id==='sc-tei') sv.style.color=comp.tei>60?'#c0392b':comp.tei>30?'#d4a017':'#27ae60';
      }
    });

    const cs=$('cmp-sub'); if(cs) cs.textContent=`${pA.p.label} vs ${pB.p.label} — ${jDesc(comp.jaccard)}`;

    const vb=$('venn-box'); if(vb) Charts.venn(vb,pA.genes.length,pB.genes.length,comp.inter.length,cA,cB);
    const vl=$('venn-legend');
    if(vl) vl.innerHTML=
      `<span style="color:${cA}">${pA.p.label}: ${comp.onlyA.length}</span>
       <span style="color:#7c5cbf">shared: ${comp.inter.length}</span>
       <span style="color:${cB}">${pB.p.label}: ${comp.onlyB.length}</span>`;

    const tb=$('tei-box'); if(tb) Charts.teiGauge(tb,comp.tei);
    const tn=$('tei-note');
    if(tn) tn.textContent=`${comp.escapeCount}/${DC_ORDER.length} drug classes simultaneously escaped. `+
      (comp.tei>60?'Co-infection is extremely difficult to treat with standard regimens.':
       comp.tei>30?'Empirical therapy requires careful drug selection.':
       'Sufficient drug class diversity remains for co-infection management.');

    const mc=$('mech-cmp'); if(mc) Charts.mechBars(mc,pA.mechCounts,pB.mechCounts,cA,cB);

    const al=$('risk-alerts');
    if(al){
      let ah='';
      if(comp.mobileShared.length)
        ah+=`<div class="alert alert-hgt"><span class="alert-title">⚠ HGT Transfer Risk</span>${comp.mobileShared.length} shared mobile ARG${comp.mobileShared.length>1?'s':''}: <em>${comp.mobileShared.map(d=>d.g.label).join(', ')}</em>. Co-infection enables horizontal gene transfer.</div>`;
      if(Math.max(pA.reserveCount,pB.reserveCount)>0)
        ah+=`<div class="alert alert-res"><span class="alert-title">🔴 Last-resort Exposure</span>Reserve-tier drug classes compromised — limited treatment options remain.</div>`;
      if(comp.tei>60)
        ah+=`<div class="alert alert-res"><span class="alert-title">★ High Therapeutic Escape</span>${comp.tei}% of drug classes defeated against both pathogens simultaneously.</div>`;
      if(!ah)
        ah=`<div class="alert alert-ok"><span class="alert-title">✓ Manageable Profile</span>No shared mobile ARGs. Reserve-tier drugs retain efficacy in at least one pathogen.</div>`;
      al.innerHTML=ah;
    }
  }

  /* ── Gene card ── */
  function makeCard(g, mechs, drugs, delay=0){
    const mec=mechs[0], mc=mec?Charts.mechColor(mec.id):'#888';
    const dedup=[...new Map(drugs.map(d=>[d.id,d])).values()]
      .sort((a,b)=>(TIER[a.aware]??3)-(TIER[b.aware]??3)).slice(0,5);
    const aroNum=(g.aro||'').replace('ARO:','');
    const el=document.createElement('div');
    el.className='gcard';
    el.style.cssText=`border-left-color:${mc};animation-delay:${delay}ms`;
    el.innerHTML=`
      <div class="gcard-top">
        <span class="gcard-name">${g.label}</span>
        <span class="mbadge mb-${mobClass(g.mobilization)}">${mobShort(g.mobilization)}</span>
      </div>
      <div class="gcard-aro">${g.aro||''}</div>
      <div class="gcard-mech"><span class="mdot" style="background:${mc}"></span>${mechs.map(m=>m.label).join(', ')||'—'}</div>
      <div class="gcard-drugs">${dedup.map(d=>`<span class="dchip dc-${(d.aware||'Access')[0].toLowerCase()}">${d.label}</span>`).join('')}</div>
      <div class="gcard-links">
        ${aroNum?`<a class="elink" href="https://card.mcmaster.ca/aro/${aroNum}" target="_blank" rel="noopener">CARD ↗</a>`:''}
        ${g.uniprot?`<a class="elink" href="https://www.uniprot.org/uniprot/${g.uniprot}" target="_blank" rel="noopener">UniProt ↗</a>`:''}
      </div>`;
    return el;
  }

  /* ── Render gene columns ── */
  function renderGenes(pA, pB){
    const comp=buildCompare(pA,pB);
    const cA=PC[pA.p.id]||'#555', cB=PC[pB.p.id]||'#555';

    const gl=$('genes-legend');
    if(gl) gl.innerHTML=
      `<span><span class="gl-dot" style="background:${cA}"></span>${pA.p.label}</span>
       <span><span class="gl-dot" style="background:#7c5cbf"></span>Shared</span>
       <span><span class="gl-dot" style="background:${cB}"></span>${pB.p.label}</span>`;

    const sortGD=gd=>[...gd].sort((a,b)=>{
      const at=Math.min(...(a.drugs.length?a.drugs.map(d=>TIER[d.aware]??3):[99]));
      const bt=Math.min(...(b.drugs.length?b.drugs.map(d=>TIER[d.aware]??3):[99]));
      return at!==bt?at-bt:a.g.label.localeCompare(b.g.label);
    });

    function fillCol(colId, headerHTML, headerCls, geneDetails){
      const col=$(colId); if(!col) return;
      col.innerHTML=`<div class="gcol-header ${headerCls||''}">${headerHTML}</div>`;
      sortGD(geneDetails).forEach(({g,mechs,drugs},i)=>{
        col.appendChild(makeCard(g,mechs,drugs,i*20));
      });
    }

    const uniqueA=pA.geneDetails.filter(({g})=>!pB.geneLabels.has(g.label));
    const uniqueB=pB.geneDetails.filter(({g})=>!pA.geneLabels.has(g.label));

    fillCol('gcol-left',   `<span style="color:${cA}">◉</span> ${pA.p.label} <small>(${comp.onlyA.length} unique)</small>`,'', uniqueA);
    fillCol('gcol-shared', '⬡ Shared ARGs','gcol-header-shared', comp.sharedDetails);
    fillCol('gcol-right',  `<span style="color:${cB}">◉</span> ${pB.p.label} <small>(${comp.onlyB.length} unique)</small>`,'', uniqueB);
  }

  function randomPair(){
    const ids=G.nodes.filter(n=>n.type==='pathogen').map(n=>n.id);
    const s=[...ids].sort(()=>Math.random()-.5);
    return [s[0], s[1]];
  }

  /* ── Welcome overlay ── */
  function initWelcome(){
    const overlay = $('welcome-overlay');
    if(!overlay) return;
    const seen = localStorage.getItem('amrscape-welcomed');
    if(seen){ overlay.style.display = 'none'; return; }

    const btn = $('welcome-btn'), cb = $('welcome-skip-cb');
    if(btn) btn.addEventListener('click', ()=>{
      if(cb && cb.checked) localStorage.setItem('amrscape-welcomed','1');
      overlay.style.display = 'none';
    });
    // Also close on backdrop click
    overlay.addEventListener('click', e=>{
      if(e.target === overlay) overlay.style.display = 'none';
    });
  }

  /* ── Shareable URL ── */
  function updateURL(lId, rId){
    const url=new URL(window.location.href);
    url.searchParams.set('l', lId);
    url.searchParams.set('r', rId);
    window.history.replaceState(null,'',url.toString());
  }

  function pairFromURL(){
    const p=new URLSearchParams(window.location.search);
    const l=p.get('l'), r=p.get('r');
    return (l&&r) ? [l,r] : null;
  }

  function initShareBtn(){
    const btn=$('share-btn'), toast=$('share-toast');
    if(!btn||!toast) return;
    btn.addEventListener('click',()=>{
      navigator.clipboard.writeText(window.location.href).then(()=>{
        toast.classList.add('show');
        setTimeout(()=>toast.classList.remove('show'),2500);
      }).catch(()=>{
        // Fallback for non-https
        prompt('Copy this link:', window.location.href);
      });
    });
  }

  /* ── Citation ── */
  const CITATIONS = {
    plain: `Pranavathiyani G. AMRscape: Interactive ESKAPE Resistome Comparison Explorer. 2025. Available at: https://pranavathiyani.github.io/amrscape/`,
    bibtex: `@misc{amrscape2025,
  author    = {Pranavathiyani G},
  title     = {{AMRscape}: Interactive {ESKAPE} Resistome Comparison Explorer},
  year      = {2025},
  howpublished = {\url{https://pranavathiyani.github.io/amrscape/}},
  url       = {https://pranavathiyani.github.io/amrscape/}
}`,
    ris: `TY  - COMP
AU  - Pranavathiyani G
TI  - AMRscape: Interactive ESKAPE Resistome Comparison Explorer
PY  - 2025
UR  - https://pranavathiyani.github.io/amrscape/
UR  - https://pranavathiyani.github.io/amrscape/
ER  -`
  };

  function initCitation(){
    const textEl=$('citation-text'), copyBtn=$('copy-citation');
    const tabs=document.querySelectorAll('.ctab');
    let fmt='plain';

    function setFmt(f){
      fmt=f;
      tabs.forEach(t=>t.classList.toggle('active',t.dataset.fmt===f));
      if(textEl) textEl.textContent=CITATIONS[f]||'';
    }

    setFmt('plain');
    tabs.forEach(t=>t.addEventListener('click',()=>setFmt(t.dataset.fmt)));

    if(copyBtn) copyBtn.addEventListener('click',()=>{
      navigator.clipboard.writeText(CITATIONS[fmt]||'').then(()=>{
        copyBtn.textContent='Copied ✓';
        setTimeout(()=>{ copyBtn.textContent='Copy'; },2000);
      });
    });
  }

  /* ── Render override — also updates URL ── */
  function renderAll(lId, rId){
    leftId=lId; rightId=rId;
    updateURL(lId, rId);
    try{
      const pA=renderPanel('left', lId);
      const pB=renderPanel('right',rId);
      renderCompare(pA,pB);
      renderGenes(pA,pB);
      const fm=$('foot-meta'); if(fm) fm.textContent=`${G.metadata.node_count} nodes · ${G.metadata.edge_count} edges · ${G.metadata.generated?.slice(0,10)}`;
    } catch(err){
      console.error('AMRscape renderAll error:', err);
    }
  }

  /* ── Init ── */
  async function init(){
    initTheme();
    initWelcome();
    try{
      const res=await fetch('./data/graph.json');
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      G=await res.json();
      byId=new Map(G.nodes.map(n=>[n.id,n]));

      const hs=$('hdr-stats'); if(hs) hs.textContent=`${G.metadata.node_count} nodes · ${G.metadata.edge_count} edges`;

      // Populate dropdowns
      const pathogens=G.nodes.filter(n=>n.type==='pathogen').sort((a,b)=>a.label.localeCompare(b.label));
      ['dd-left','dd-right'].forEach(id=>{
        const sel=$(id); if(!sel) return;
        sel.innerHTML=pathogens.map(p=>`<option value="${p.id}">${p.full_name||p.label}</option>`).join('');
      });

      // Use URL params if present, else random pair
      const urlPair=pairFromURL();
      const [a,b]=urlPair && G.nodes.find(n=>n.id===urlPair[0]) ? urlPair : randomPair();
      const ddL=$('dd-left'), ddR=$('dd-right');
      if(ddL) ddL.value=a;
      if(ddR) ddR.value=b;

      // Double rAF — wait for full paint
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{ renderAll(a,b); });
      });

      // Dropdown events
      if(ddL) ddL.addEventListener('change', e=>renderAll(e.target.value, rightId));
      if(ddR) ddR.addEventListener('change', e=>renderAll(leftId, e.target.value));

      // Theme
      const tb=$('theme-btn'); if(tb) tb.addEventListener('click', toggleTheme);

      // Share & citation
      initShareBtn();
      initCitation();

      // Resize
      let rt;
      window.addEventListener('resize',()=>{
        clearTimeout(rt);
        rt=setTimeout(()=>{ if(leftId&&rightId) renderAll(leftId,rightId); },200);
      });

      // Easter egg 🥚
      const egg=$('easter-egg'), eggOverlay=$('egg-overlay'), eggClose=$('egg-close');
      const crackEl=$('egg-crack'), revealEl=$('egg-reveal');
      if(egg && eggOverlay){
        egg.addEventListener('click',()=>{
          eggOverlay.classList.add('active');
          if(crackEl){ crackEl.classList.add('cracking'); }
          setTimeout(()=>{
            if(crackEl) crackEl.style.display='none';
            if(revealEl) revealEl.classList.add('visible');
          },480);
        });
        eggOverlay.addEventListener('click',e=>{ if(e.target===eggOverlay) closeEgg(); });
        if(eggClose) eggClose.addEventListener('click', closeEgg);
      }
      function closeEgg(){
        eggOverlay.classList.remove('active');
        setTimeout(()=>{
          if(crackEl){ crackEl.classList.remove('cracking'); crackEl.style.display=''; }
          if(revealEl) revealEl.classList.remove('visible');
        },300);
      }

    } catch(err){
      console.error('AMRscape init error:', err);
      const hs=$('hdr-stats'); if(hs) hs.textContent='⚠ Could not load data/graph.json';
    }
  }

  return { init };
})();

window.addEventListener('DOMContentLoaded', App.init);
