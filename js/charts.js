/* js/charts.js */
const Charts = (() => {

  const MECHS = [
    {id:'mechanism:beta_lactamase',   s:'β-Lac',  c:'#f87171'},
    {id:'mechanism:mbl',              s:'MBL',    c:'#fb923c'},
    {id:'mechanism:pbp_mod',          s:'PBP',    c:'#fbbf24'},
    {id:'mechanism:van_glycopeptide', s:'Glyco',  c:'#a78bfa'},
    {id:'mechanism:efflux_rnd',       s:'RND',    c:'#38bdf8'},
    {id:'mechanism:efflux_mfs',       s:'MFS',    c:'#22d3ee'},
    {id:'mechanism:enz_inactivation', s:'Enzyme', c:'#4ade80'},
    {id:'mechanism:target_protection',s:'Target', c:'#f472b6'},
    {id:'mechanism:membrane_perm',    s:'Porin',  c:'#94a3b8'},
  ];

  const AWARE_C  = {Access:'#34d399', Watch:'#fbbf24', Reserve:'#f87171'};
  const MOB_C    = {mobile:'#e879f9', chromosomal:'#6ee7b7', other:'#fde68a'};

  function cv(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}

  /* ── RADAR ── */
  function radar(el, counts, pColor){
    el.innerHTML='';
    const W=el.clientWidth||320, H=el.clientHeight||220;
    const cx=W/2, cy=H/2, maxR=Math.min(W,H)/2-28;
    const n=MECHS.length, ang=i=>(i/n)*2*Math.PI-Math.PI/2;
    const pt=(r,i)=>[cx+r*Math.cos(ang(i)), cy+r*Math.sin(ang(i))];
    const maxV=Math.max(1,...MECHS.map(m=>counts[m.id]||0));
    const svg=d3.select(el).append('svg').attr('width',W).attr('height',H);

    // Grid rings
    [.25,.5,.75,1].forEach(f=>{
      svg.append('polygon')
        .attr('points',MECHS.map((_,i)=>pt(maxR*f,i).join(',')).join(' '))
        .attr('fill','none').attr('stroke',cv('--border'))
        .attr('stroke-width',f===1?1:.4).attr('opacity',.7);
    });
    // Spokes
    MECHS.forEach((_,i)=>{
      svg.append('line')
        .attr('x1',cx).attr('y1',cy).attr('x2',...pt(maxR,i))
        .attr('stroke',cv('--border')).attr('stroke-width',.4).attr('opacity',.5);
    });
    // Filled polygon
    const pts=MECHS.map((m,i)=>pt((counts[m.id]||0)/maxV*maxR,i));
    svg.append('polygon')
      .attr('points',pts.map(p=>p.join(',')).join(' '))
      .attr('fill',pColor+'22').attr('stroke',pColor)
      .attr('stroke-width',2).attr('stroke-linejoin','round')
      .style('opacity',0).transition().duration(550).style('opacity',1);
    // Dots
    MECHS.forEach((m,i)=>{
      const v=counts[m.id]||0; if(!v)return;
      const [px,py]=pt(v/maxV*maxR,i);
      svg.append('circle').attr('cx',px).attr('cy',py).attr('r',4)
        .attr('fill',m.c).attr('stroke',cv('--bg2')).attr('stroke-width',1.5);
    });
    // Labels
    MECHS.forEach((m,i)=>{
      const [lx,ly]=pt(maxR+17,i), active=counts[m.id]>0;
      svg.append('text').attr('x',lx).attr('y',ly)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('fill',active?m.c:cv('--faint'))
        .attr('font-size','9.5px').attr('font-family','Instrument Sans, sans-serif')
        .attr('font-weight',active?'600':'400').text(m.s);
    });
  }

  /* ── DONUT (AWARE or generic) ── */
  function donut(el, data, centerVal, centerLbl){
    // data: [{k, v}]
    el.innerHTML='';
    const W=el.clientWidth||150, H=el.clientHeight||140;
    const r=Math.min(W,H)/2-8, ir=r*.6;
    const entries=data.filter(d=>d.v>0);
    if(!entries.length)return;
    const pie=d3.pie().value(d=>d.v).sort(null).padAngle(.03);
    const arc=d3.arc().innerRadius(ir).outerRadius(r).cornerRadius(2);
    const svg=d3.select(el).append('svg').attr('width',W).attr('height',H);
    const g=svg.append('g').attr('transform',`translate(${W/2},${H/2})`);
    g.selectAll('path').data(pie(entries)).join('path')
      .attr('d',arc).attr('fill',d=>d.data.c)
      .attr('stroke',cv('--bg2')).attr('stroke-width',1.5)
      .style('opacity',0).transition().duration(500).delay((_,i)=>i*70).style('opacity',1);
    if(centerVal!==undefined){
      g.append('text').attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('fill',cv('--text')).attr('font-size','16px')
        .attr('font-weight','700').attr('font-family','Syne, sans-serif')
        .attr('dy',centerLbl?'-4':'0').text(centerVal);
      if(centerLbl)
        g.append('text').attr('text-anchor','middle').attr('y',12)
          .attr('fill',cv('--muted')).attr('font-size','8px')
          .attr('font-family','Instrument Sans, sans-serif').text(centerLbl);
    }
  }

  /* ── DRUG STRIP ── */
  function strip(el, classes){
    el.innerHTML='';
    const W=el.clientWidth||320, H=54;
    const n=classes.length; if(!n)return;
    const cw=Math.max(12,(W-4)/n), ch=18;
    const svg=d3.select(el).append('svg').attr('width',W).attr('height',H);
    classes.forEach((dc,i)=>{
      const x=i*cw+2;
      svg.append('rect').attr('x',x+1).attr('y',2)
        .attr('width',cw-2).attr('height',ch).attr('rx',3)
        .attr('fill',dc.hit?AWARE_C[dc.aware]||'#888':cv('--bg4'))
        .attr('stroke',dc.hit?'none':cv('--border'))
        .attr('stroke-width',.5).attr('opacity',dc.hit?.85:.4);
      if(cw>=14)
        svg.append('text').attr('x',x+cw/2).attr('y',30)
          .attr('text-anchor','middle')
          .attr('fill',dc.hit?AWARE_C[dc.aware]:cv('--faint'))
          .attr('font-size','8px').attr('font-family','Instrument Sans,sans-serif')
          .attr('font-weight',dc.hit?'600':'400').text(dc.short||dc.name.slice(0,4));
    });
  }

  /* ── VENN ── */
  function venn(el, nA, nB, nAB, cA, cB){
    el.innerHTML='';
    const W=el.clientWidth||240, H=el.clientHeight||110;
    const cy=H/2, r=Math.min(H*.44,W*.26), sep=r*.55;
    const c1=W/2-sep*.75, c2=W/2+sep*.75;
    const svg=d3.select(el).append('svg').attr('width',W).attr('height',H);
    [{cx:c1,c:cA},{cx:c2,c:cB}].forEach(({cx,c})=>{
      svg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',r)
        .attr('fill',c).attr('fill-opacity',.15)
        .attr('stroke',c).attr('stroke-width',1.6).attr('stroke-opacity',.7);
    });
    [
      {x:c1-r*.35, v:nA-nAB, c:cA},
      {x:(c1+c2)/2, v:nAB,   c:'#a78bfa'},
      {x:c2+r*.35, v:nB-nAB, c:cB},
    ].forEach(({x,v,c})=>{
      svg.append('text').attr('x',x).attr('y',cy)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('fill',c).attr('font-size','16px').attr('font-weight','800')
        .attr('font-family','Syne, sans-serif').text(v);
    });
  }

  /* ── TEI GAUGE ── */
  function teiGauge(el, tei){
    // tei: 0-100
    el.innerHTML='';
    const W=el.clientWidth||160, H=el.clientHeight||110;
    const cx=W/2, cy=H*.85;
    const r=Math.min(W*.4,H*.75);
    const startA=-Math.PI, endA=0;
    const valA=startA+(endA-startA)*(tei/100);

    const svg=d3.select(el).append('svg').attr('width',W).attr('height',H);
    const arc=d3.arc().innerRadius(r*.65).outerRadius(r).cornerRadius(2);

    // Background arc
    svg.append('path')
      .attr('transform',`translate(${cx},${cy})`)
      .attr('d',arc({startAngle:startA,endAngle:endA}))
      .attr('fill',cv('--bg4'));

    // Colored fill
    const gaugeColor=tei>70?'#f87171':tei>40?'#fbbf24':'#34d399';
    svg.append('path')
      .attr('transform',`translate(${cx},${cy})`)
      .attr('d',arc({startAngle:startA,endAngle:startA}))
      .attr('fill',gaugeColor)
      .transition().duration(800).ease(d3.easeCubicOut)
      .attrTween('d',()=>{
        const i=d3.interpolate(startA,valA);
        return t=>arc({startAngle:startA,endAngle:i(t)});
      });

    // Value
    svg.append('text').attr('x',cx).attr('y',cy-8)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('fill',gaugeColor).attr('font-size','28px').attr('font-weight','800')
      .attr('font-family','Syne, sans-serif').text(`${tei}%`);

    svg.append('text').attr('x',cx).attr('y',cy+8)
      .attr('text-anchor','middle').attr('fill',cv('--muted'))
      .attr('font-size','8.5px').attr('font-family','Instrument Sans, sans-serif')
      .text('ESCAPE INDEX');

    // Scale labels
    svg.append('text').attr('x',cx-r-2).attr('y',cy+4)
      .attr('text-anchor','end').attr('fill',cv('--muted')).attr('font-size','8px').text('0%');
    svg.append('text').attr('x',cx+r+2).attr('y',cy+4)
      .attr('text-anchor','start').attr('fill',cv('--muted')).attr('font-size','8px').text('100%');
  }

  /* ── MECHANISM COMPARISON BARS ── */
  function mechBars(el, countsA, countsB, cA, cB){
    el.innerHTML='';
    const maxV=Math.max(1,...MECHS.flatMap(m=>[countsA[m.id]||0,countsB[m.id]||0]));
    MECHS.forEach(m=>{
      const vA=countsA[m.id]||0, vB=countsB[m.id]||0;
      if(!vA && !vB)return;
      const row=document.createElement('div');
      row.className='mech-row';
      const pctA=Math.round(vA/maxV*100), pctB=Math.round(vB/maxV*100);
      row.innerHTML=`
        <span class="mech-row-label" style="color:${m.c}">${m.s}</span>
        <div style="display:flex;align-items:center;justify-content:flex-end">
          <div class="mech-bar-left" style="background:${cA};width:${pctA}%;max-width:100%;opacity:.8"></div>
        </div>
        <div class="mech-dot-mid" style="background:${m.c}"></div>
        <div>
          <div class="mech-bar-right" style="background:${cB};width:${pctB}%;max-width:100%;opacity:.8"></div>
        </div>`;
      el.appendChild(row);
    });
  }

  function mechColor(id){return(MECHS.find(m=>m.id===id)||{c:'#888'}).c}

  return {radar, donut, strip, venn, teiGauge, mechBars, mechColor, MECHS, AWARE_C, MOB_C};
})();
