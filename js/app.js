/* js/app.js */
const App = (() => {

  const PC = {
    'pathogen:efaecium':'#f59e0b','pathogen:saur':'#f87171',
    'pathogen:kpneu':'#38bdf8',  'pathogen:abau':'#fb923c',
    'pathogen:paer':'#4ade80',   'pathogen:enter':'#c084fc',
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

  /* ── Theme ── */
  function initTheme(){
    const t=localStorage.getItem('amrscape-theme')||'dark';
    document.documentElement.setAttribute('data-theme',t);
  }
  function toggleTheme(){
    const n=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',n);
    localStorage.setItem('amrscape-theme',n);
    setTimeout(()=>renderAll(leftId,rightId),50);
  }

  /* ── Data helpers ── */
  function edgesFrom(id, type){
    return G.edges.filter(e=>(e.source.id||e.source)===id && e.type===type);
  }
  function edgesTo(id, type){
    return G.edges.filter(e=>(e.target.id||e.target)===id && e.type===type);
  }

  /* ── Build profile ── */
  function profile(pathId){
    const p=byId.get(pathId);
    const geneIds=edgesTo(pathId,'found_in').map(e=>e.source.id||e.source);
    const genes=geneIds.map(id=>byId.get(id)).filter(Boolean);

    const geneDetails=genes.map(g=>{
      const mechs=edgesFrom(g.id,'confers_resistance_via').map(e=>byId.get(e.target.id||e.target)).filter(Boolean);
      const drugs=edgesFrom(g.id,'confers_resistance_to').map(e=>byId.get(e.target.id||e.target)).filter(Boolean);
      return {g, mechs, drugs};
    });

    // Mechanism counts
    const mechCounts={};
    geneDetails.forEach(({mechs})=>mechs.forEach(m=>{mechCounts[m.id]=(mechCounts[m.id]||0)+1}));

    // AWARE counts (unique drugs)
    const seenD=new Set();
    const awareCounts={Access:0,Watch:0,Reserve:0};
    geneDetails.forEach(({drugs})=>drugs.forEach(d=>{
      if(!seenD.has(d.id)){seenD.add(d.id);if(awareCounts[d.aware]!==undefined)awareCounts[d.aware]++;}
    }));

    // Mob counts
    const mobCounts={};
    genes.forEach(g2=>{
      const mob=g2.mobilization||'unknown';
      mobCounts[mob]=(mobCounts[mob]||0)+1;
    });

    // Drug class hit map
    const dcHit=new Map(DC_ORDER.map(d=>[d.n,{...d,hit:false,aware:null,tier:99}]));
    geneDetails.forEach(({drugs})=>drugs.forEach(d=>{
      const dc=dcHit.get(d.drug_class);
      if(dc){dc.hit=true;const t=TIER[d.aware]??3;if(t<dc.tier){dc.tier=t;dc.aware=d.aware;}}
    }));
    const dcArr=[...dcHit.values()];

    // Transfer risk
    const mobile=genes.filter(g2=>g2.mobilization&&!g2.mobilization.startsWith('chromosomal'));
    const mobFrac=genes.length?mobile.length/genes.length:0;
    const coE=G.edges.filter(e=>e.type==='co_resistance'&&(geneIds.includes(e.source.id||e.source)||geneIds.includes(e.target.id||e.target)));
    const transferRisk=Math.min(100,Math.round(mobFrac*70+Math.min(coE.length,5)*6));

    return {p, genes, geneDetails, mechCounts, awareCounts, mobCounts, dcArr, transferRisk,
      reserveCount:awareCounts.Reserve, geneLabels:new Set(genes.map(g2=>g2.label))};
  }

  /* ── Compare ── */
  function compare(pA, pB){
    const inter=[...pA.geneLabels].filter(l=>pB.geneLabels.has(l));
    const onlyA=[...pA.geneLabels].filter(l=>!pB.geneLabels.has(l));
    const onlyB=[...pB.geneLabels].filter(l=>!pA.geneLabels.has(l));
    const union=new Set([...pA.geneLabels,...pB.geneLabels]);
    const jaccard=union.size?inter.length/union.size:0;

    const sharedDetails=pA.geneDetails.filter(({g})=>pB.geneLabels.has(g.label));
    const mobileShared=sharedDetails.filter(({g})=>{
      const gB=pB.genes.find(g2=>g2.label===g.label);
      return g.mobilization&&!g.mobilization.startsWith('chromosomal')&&
             gB?.mobilization&&!gB.mobilization.startsWith('chromosomal');
    });

    // Therapeutic Escape Index (novel metric)
    // For each drug class: if BOTH pathogens have resistance → "escaped" class
    const escapeCount=DC_ORDER.filter(dc=>{
      const hA=pA.dcArr.find(d=>d.n===dc.n)?.hit;
      const hB=pB.dcArr.find(d=>d.n===dc.n)?.hit;
      return hA&&hB;
    }).length;
    const tei=Math.round(escapeCount/DC_ORDER.length*100);

    return {inter, onlyA, onlyB, union, jaccard, sharedDetails, mobileShared, tei, escapeCount};
  }

  /* ── Render panel ── */
  function renderPanel(side, pathId){
    const prof=profile(pathId);
    const col=PC[pathId]||'#888';

    document.getElementById(`sel-accent-${side}`).style.background=col;

    // Meta
    const mt=document.getElementById(`ptop-${side}`);
    const risk=riskLabel(prof.transferRisk);
    let h=`<div class="ptop-name" style="color:${col}">${prof.p.full_name||prof.p.label}</div><div class="ptop-badges">`;
    if(prof.p.who_priority)h+=`<span class="badge b-${prof.p.who_priority.toLowerCase()}">${prof.p.who_priority} Priority</span>`;
    if(prof.p.gram)h+=`<span class="badge b-${prof.p.gram==='positive'?'pos':'neg'}">Gram ${prof.p.gram}</span>`;
    h+=`<span class="badge b-args">${prof.genes.length} ARGs</span>`;
    h+=`<span class="badge b-risk-${risk.k}">Transfer Risk: ${risk.l}</span>`;
    if(prof.reserveCount)h+=`<span class="badge b-reserve">⚠ ${prof.reserveCount} Reserve</span>`;
    h+=`</div>`;
    mt.innerHTML=h;

    // Charts
    Charts.radar(document.getElementById(`radar-${side}`),prof.mechCounts,col);

    const awareData=Object.entries(Charts.AWARE_C).map(([k,c])=>({k,v:prof.awareCounts[k]||0,c}));
    const totalDrugs=awareData.reduce((s,d)=>s+d.v,0);
    Charts.donut(document.getElementById(`donut-${side}`),awareData,totalDrugs,'drugs');

    const mobBin=binMob(prof.mobCounts);
    Charts.donut(document.getElementById(`pie-${side}`),[
      {k:'mobile',v:mobBin.mobile,c:Charts.MOB_C.mobile},
      {k:'chrom', v:mobBin.chrom, c:Charts.MOB_C.chromosomal},
      {k:'other', v:mobBin.other, c:Charts.MOB_C.other},
    ],`${mobBin.mobilePct}%`,'mobile');

    Charts.strip(document.getElementById(`strip-${side}`),prof.dcArr);

    return prof;
  }

  /* ── Render comparison ── */
  function renderCompare(pA, pB){
    const comp=compare(pA,pB);
    const cA=PC[pA.p.id]||'#888', cB=PC[pB.p.id]||'#888';
    const jPct=Math.round(comp.jaccard*100);

    // Header sim bar
    animCount('sim-pct',jPct,'%');
    document.getElementById('sim-fill').style.width=`${jPct}%`;

    // Summary strip
    animCount('sc-jaccard .sc-val',jPct,'%');
    animCount('sc-shared .sc-val',comp.inter.length,'');
    animCount('sc-tei .sc-val',comp.tei,'%');
    animCount('sc-hgt .sc-val',comp.mobileShared.length,'');
    const maxRes=Math.max(pA.reserveCount,pB.reserveCount);
    document.querySelector('#sc-reserve .sc-val').textContent=maxRes||'0';
    colorScTei(comp.tei);

    // Sub
    document.getElementById('cmp-sub').textContent=
      `${pA.p.label} vs ${pB.p.label} — ${jaccardDesc(comp.jaccard)}`;

    // Venn
    Charts.venn(document.getElementById('venn-box'),
      pA.genes.length, pB.genes.length, comp.inter.length, cA, cB);
    document.getElementById('venn-legend').innerHTML=
      `<span style="color:${cA}">${pA.p.label} only: ${comp.onlyA.length}</span>
       <span style="color:#a78bfa">shared: ${comp.inter.length}</span>
       <span style="color:${cB}">only ${pB.p.label}: ${comp.onlyB.length}</span>`;

    // TEI gauge
    Charts.teiGauge(document.getElementById('tei-box'),comp.tei);
    document.getElementById('tei-note').textContent=teiDesc(comp.tei,comp.escapeCount);

    // Mechanism bars
    Charts.mechBars(document.getElementById('mech-cmp'),pA.mechCounts,pB.mechCounts,cA,cB);

    // Alerts
    const alertEl=document.getElementById('risk-alerts');
    let ah='';
    if(comp.mobileShared.length){
      ah+=`<div class="alert alert-hgt"><span class="alert-title">⚠ HGT Transfer Risk</span>
        ${comp.mobileShared.length} shared mobile ARG${comp.mobileShared.length>1?'s':''}: 
        <em>${comp.mobileShared.map(d=>d.g.label).join(', ')}</em>. 
        Co-infection enables horizontal gene transfer.
      </div>`;
    }
    if(maxRes>0){
      ah+=`<div class="alert alert-res"><span class="alert-title">🔴 Last-resort Drug Exposure</span>
        Up to ${maxRes} Reserve-tier drug class${maxRes>1?'es':''} compromised — limited treatment options remain.
      </div>`;
    }
    if(comp.tei>60){
      ah+=`<div class="alert alert-res"><span class="alert-title">★ High Therapeutic Escape</span>
        ${comp.tei}% of drug classes are rendered ineffective against both pathogens simultaneously.
      </div>`;
    }
    if(!ah){
      ah=`<div class="alert alert-ok"><span class="alert-title">✓ Manageable Resistance Profile</span>
        No shared mobile ARGs detected. Reserve-tier drugs retain efficacy against at least one pathogen.
      </div>`;
    }
    alertEl.innerHTML=ah;
  }

  /* ── Render gene cards ── */
  function renderGenes(pA, pB){
    const comp=compare(pA,pB);
    const cA=PC[pA.p.id]||'#888', cB=PC[pB.p.id]||'#888';

    document.getElementById('gch-left').innerHTML=
      `<span style="color:${cA}">◉</span> ${pA.p.label} <small>(${comp.onlyA.length} unique)</small>`;
    document.getElementById('gch-right').innerHTML=
      `<span style="color:${cB}">◉</span> ${pB.p.label} <small>(${comp.onlyB.length} unique)</small>`;
    document.getElementById('genes-legend').innerHTML=
      `<span><span class="gl-dot" style="background:${cA}"></span>${pA.p.label}</span>
       <span><span class="gl-dot" style="background:#a78bfa"></span>Shared</span>
       <span><span class="gl-dot" style="background:${cB}"></span>${pB.p.label}</span>`;

    // Sort by AWARE tier (worst first)
    const sortGD=gd=>[...gd].sort((a,b)=>{
      const at=Math.min(...a.drugs.map(d=>TIER[d.aware]??3));
      const bt=Math.min(...b.drugs.map(d=>TIER[d.aware]??3));
      return at!==bt?at-bt:a.g.label.localeCompare(b.g.label);
    });

    const uniqueA=pA.geneDetails.filter(({g})=>!pB.geneLabels.has(g.label));
    const uniqueB=pB.geneDetails.filter(({g})=>!pA.geneLabels.has(g.label));

    function fillCol(colId, geneDetails, delay=0){
      const col=document.getElementById(colId);
      // keep header
      const hdr=col.querySelector('.gcol-header');
      col.innerHTML=''; col.appendChild(hdr);
      sortGD(geneDetails).forEach(({g,mechs,drugs},i)=>{
        const card=makeCard(g,mechs,drugs,delay+i*30);
        col.appendChild(card);
      });
    }

    fillCol('gcol-left', uniqueA);
    fillCol('gcol-shared', comp.sharedDetails, 20);
    fillCol('gcol-right', uniqueB);
  }

  function makeCard(g, mechs, drugs, delay=0){
    const mec=mechs[0], mc=mec?Charts.mechColor(mec.id):'#888';
    const dedupDrugs=[...new Map(drugs.map(d=>[d.id,d])).values()]
      .sort((a,b)=>(TIER[a.aware]??3)-(TIER[b.aware]??3)).slice(0,5);
    const aroNum=(g.aro||'').replace('ARO:','');
    const mobCls=mobClass(g.mobilization);

    const el=document.createElement('div');
    el.className='gcard';
    el.style.cssText=`border-left-color:${mc};animation-delay:${delay}ms`;
    el.innerHTML=`
      <div class="gcard-top">
        <span class="gcard-name">${g.label}</span>
        <span class="mbadge mb-${mobCls}">${mobShort(g.mobilization)}</span>
      </div>
      <div class="gcard-aro">${g.aro||''}</div>
      <div class="gcard-mech">
        <span class="mdot" style="background:${mc}"></span>
        ${mechs.map(m=>m.label).join(', ')||'—'}
      </div>
      <div class="gcard-drugs">${dedupDrugs.map(d=>`<span class="dchip dc-${d.aware[0].toLowerCase()}">${d.label}</span>`).join('')}</div>
      <div class="gcard-links">
        ${aroNum?`<a class="elink" href="https://card.mcmaster.ca/aro/${aroNum}" target="_blank" rel="noopener">CARD ↗</a>`:''}
        ${g.uniprot?`<a class="elink" href="https://www.uniprot.org/uniprot/${g.uniprot}" target="_blank" rel="noopener">UniProt ↗</a>`:''}
      </div>`;
    return el;
  }

  /* ── Full render ── */
  function renderAll(lId, rId){
    leftId=lId; rightId=rId;
    const pA=renderPanel('left',lId);
    const pB=renderPanel('right',rId);
    renderCompare(pA,pB);
    renderGenes(pA,pB);
    const footMeta=document.getElementById('foot-meta');
    if(footMeta)footMeta.textContent=
      `Graph: ${G.metadata.node_count} nodes · ${G.metadata.edge_count} edges · ${G.metadata.generated?.slice(0,10)}`;
  }

  /* ── Helpers ── */
  function binMob(mobCounts){
    let mobile=0, chrom=0;
    Object.entries(mobCounts).forEach(([k,v])=>{
      if(k.startsWith('chromosomal'))chrom+=v;
      else mobile+=v;
    });
    const total=mobile+chrom;
    return {mobile,chrom,other:0,mobilePct:total?Math.round(mobile/total*100):0};
  }
  function mobClass(mob){
    if(!mob||mob==='unknown')return 'oth';
    if(mob.startsWith('chromosomal'))return 'chr';
    return 'mob';
  }
  function mobShort(mob){
    if(!mob||mob==='unknown')return 'unk';
    if(mob.startsWith('chromosomal'))return 'chromo';
    return 'mobile';
  }
  function riskLabel(s){
    if(s>=75)return{l:'Critical',k:'c'};
    if(s>=50)return{l:'High',k:'h'};
    if(s>=25)return{l:'Medium',k:'m'};
    return{l:'Low',k:'l'};
  }
  function jaccardDesc(j){
    if(j>=.7)return'Highly similar resistomes';
    if(j>=.4)return'Moderately overlapping';
    if(j>=.2)return'Some shared resistance';
    if(j>0)return'Largely distinct';
    return'No shared ARGs';
  }
  function teiDesc(tei, n){
    return `${n} of ${DC_ORDER.length} drug classes are simultaneously defeated in both pathogens. `+
      (tei>60?'Co-infection is extremely difficult to treat with standard regimens.':
       tei>30?'Empirical therapy for co-infection requires careful drug selection.':
       'Sufficient drug class diversity remains for co-infection management.');
  }
  function colorScTei(tei){
    const el=document.querySelector('#sc-tei .sc-val');
    if(!el)return;
    el.style.color=tei>60?'#f87171':tei>30?'#fbbf24':'#34d399';
  }
  function animCount(sel, target, suffix){
    const el=typeof sel==='string'?document.querySelector(`#${sel}`)||document.querySelector(`.${sel}`):sel;
    if(!el)return;
    let frame=0,frames=28;
    const tick=()=>{
      frame++;
      el.textContent=Math.round(target*d3.easeCubicOut(frame/frames))+suffix;
      if(frame<frames)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function randomPair(){
    const ids=G.nodes.filter(n=>n.type==='pathogen').map(n=>n.id);
    const s=[...ids].sort(()=>Math.random()-.5);
    return[s[0],s[1]];
  }

  /* ── Init ── */
  async function init(){
    initTheme();
    try{
      const res=await fetch('data/graph.json');
      G=await res.json();
      byId=new Map(G.nodes.map(n=>[n.id,n]));

      const m=G.metadata;
      document.getElementById('hdr-stats').textContent=
        `${m.node_count} nodes · ${m.edge_count} edges`;
      document.getElementById('foot-meta').textContent=
        `Built ${m.generated?.slice(0,10)}`;

      // Populate dropdowns
      const pathogens=G.nodes.filter(n=>n.type==='pathogen').sort((a,b)=>a.label.localeCompare(b.label));
      ['dd-left','dd-right'].forEach(id=>{
        const sel=document.getElementById(id);
        sel.innerHTML=pathogens.map(p=>`<option value="${p.id}">${p.full_name||p.label}</option>`).join('');
      });

      // Random pair
      const[a,b]=randomPair();
      document.getElementById('dd-left').value=a;
      document.getElementById('dd-right').value=b;
      renderAll(a,b);

      // Events
      document.getElementById('dd-left').addEventListener('change',e=>renderAll(e.target.value,rightId));
      document.getElementById('dd-right').addEventListener('change',e=>renderAll(leftId,e.target.value));
      document.getElementById('theme-btn').addEventListener('click',toggleTheme);

      let rt;
      window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>renderAll(leftId,rightId),180)});

    }catch(e){
      console.error('AMRscape error',e);
      document.getElementById('hdr-stats').textContent='⚠ data/graph.json not found';
    }
  }

  return{init};
})();

window.addEventListener('DOMContentLoaded',App.init);
