/* js/charts.js — AMRscape */
const Charts = (() => {

  const MECHS = [
    {id:'mechanism:beta_lactamase',   s:'β-Lac',  c:'#e05252'},
    {id:'mechanism:mbl',              s:'MBL',    c:'#e07a30'},
    {id:'mechanism:pbp_mod',          s:'PBP',    c:'#d4a017'},
    {id:'mechanism:van_glycopeptide', s:'Glyco',  c:'#7c5cbf'},
    {id:'mechanism:efflux_rnd',       s:'RND',    c:'#2a85c8'},
    {id:'mechanism:efflux_mfs',       s:'MFS',    c:'#1a9fb0'},
    {id:'mechanism:enz_inactivation', s:'Enzyme', c:'#2a9e5c'},
    {id:'mechanism:target_protection',s:'Target', c:'#c44f8a'},
    {id:'mechanism:membrane_perm',    s:'Porin',  c:'#7a8fa0'},
  ];

  const AWARE_C = {Access:'#2a9e5c', Watch:'#d4a017', Reserve:'#c0392b'};
  const MOB_C   = {mobile:'#9b59b6', chromosomal:'#27ae60', other:'#e67e22'};

  // Robust width/height — works before and after paint
  function dim(el, fallbackW=320, fallbackH=220){
    const r = el.getBoundingClientRect();
    return {
      W: r.width  > 10 ? r.width  : (el.parentElement?.getBoundingClientRect().width  || fallbackW),
      H: r.height > 10 ? r.height : fallbackH
    };
  }

  function cv(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  /* ── RADAR ── */
  function radar(el, counts, pColor){
    el.innerHTML = '';
    const {W, H} = dim(el, 300, 220);
    const cx = W/2, cy = H/2;
    const maxR = Math.min(W, H)/2 - 30;
    const n = MECHS.length;
    const ang = i => (i/n)*2*Math.PI - Math.PI/2;
    const pt  = (r, i) => [cx + r*Math.cos(ang(i)), cy + r*Math.sin(ang(i))];
    const maxV = Math.max(1, ...MECHS.map(m => counts[m.id]||0));

    const svg = d3.select(el).append('svg')
      .attr('width', W).attr('height', H);

    // Grid rings — subtle
    [0.25, 0.5, 0.75, 1].forEach(f => {
      svg.append('polygon')
        .attr('points', MECHS.map((_,i) => pt(maxR*f, i).join(',')).join(' '))
        .attr('fill', f===1 ? cv('--bg3') : 'none')
        .attr('stroke', cv('--border'))
        .attr('stroke-width', f===1 ? 1 : 0.5)
        .attr('opacity', 0.8);
    });

    // Spokes
    MECHS.forEach((_,i) => {
      const [ex,ey] = pt(maxR, i);
      svg.append('line')
        .attr('x1',cx).attr('y1',cy).attr('x2',ex).attr('y2',ey)
        .attr('stroke', cv('--border')).attr('stroke-width', 0.5).attr('opacity', 0.6);
    });

    // Filled area
    const pts = MECHS.map((m,i) => pt((counts[m.id]||0)/maxV*maxR, i));
    svg.append('polygon')
      .attr('points', pts.map(p=>p.join(',')).join(' '))
      .attr('fill', pColor).attr('fill-opacity', 0.12)
      .attr('stroke', pColor).attr('stroke-width', 2)
      .attr('stroke-linejoin', 'round')
      .style('opacity', 0)
      .transition().duration(600).style('opacity', 1);

    // Data dots
    MECHS.forEach((m,i) => {
      const v = counts[m.id]||0; if(!v) return;
      const [px,py] = pt(v/maxV*maxR, i);
      svg.append('circle')
        .attr('cx',px).attr('cy',py).attr('r', 4)
        .attr('fill', m.c)
        .attr('stroke', cv('--bg2')).attr('stroke-width', 1.5);
    });

    // Labels
    MECHS.forEach((m,i) => {
      const [lx,ly] = pt(maxR + 18, i);
      const active = (counts[m.id]||0) > 0;
      svg.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('fill', active ? m.c : cv('--faint'))
        .attr('font-size','9.5px')
        .attr('font-family',"'Plus Jakarta Sans',sans-serif")
        .attr('font-weight', active ? '600' : '400')
        .text(m.s);
    });
  }

  /* ── DONUT ── */
  function donut(el, data, centerVal, centerLbl){
    el.innerHTML = '';
    const {W, H} = dim(el, 150, 150);
    const r  = Math.min(W,H)/2 - 10;
    const ir = r * 0.6;
    const entries = data.filter(d => d.v > 0);
    if(!entries.length) return;

    const pie = d3.pie().value(d=>d.v).sort(null).padAngle(0.04);
    const arc = d3.arc().innerRadius(ir).outerRadius(r).cornerRadius(3);

    const svg = d3.select(el).append('svg').attr('width',W).attr('height',H);
    const g   = svg.append('g').attr('transform',`translate(${W/2},${H/2})`);

    g.selectAll('path').data(pie(entries)).join('path')
      .attr('d', arc)
      .attr('fill', d => d.data.c)
      .attr('stroke', cv('--bg2')).attr('stroke-width', 2)
      .style('opacity', 0)
      .transition().duration(500).delay((_,i)=>i*60).style('opacity', 1);

    if(centerVal !== undefined){
      g.append('text')
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('fill', cv('--text'))
        .attr('font-size','17px').attr('font-weight','700')
        .attr('font-family',"'Plus Jakarta Sans',sans-serif")
        .attr('dy', centerLbl ? '-5' : '0')
        .text(centerVal);
      if(centerLbl)
        g.append('text')
          .attr('text-anchor','middle').attr('y', 12)
          .attr('fill', cv('--muted')).attr('font-size','8px')
          .attr('font-family',"'Plus Jakarta Sans',sans-serif")
          .text(centerLbl.toUpperCase());
    }
  }

  /* ── STRIP ── */
  function strip(el, classes){
    el.innerHTML = '';
    const {W} = dim(el, 300, 54);
    const n = classes.length; if(!n) return;
    const cw = Math.max(14, (W-4)/n);
    const svg = d3.select(el).append('svg').attr('width',W).attr('height',54);

    classes.forEach((dc,i) => {
      const x = i*cw+2;
      const fc = dc.hit ? (AWARE_C[dc.aware]||'#888') : cv('--bg4');
      svg.append('rect')
        .attr('x',x+1).attr('y',4)
        .attr('width',cw-2).attr('height',20).attr('rx',3)
        .attr('fill', fc)
        .attr('stroke', dc.hit ? 'none' : cv('--border'))
        .attr('stroke-width', 0.5)
        .attr('opacity', dc.hit ? 0.9 : 0.5);
      if(cw >= 15)
        svg.append('text')
          .attr('x', x+cw/2).attr('y', 36)
          .attr('text-anchor','middle')
          .attr('fill', dc.hit ? fc : cv('--faint'))
          .attr('font-size','8px')
          .attr('font-family',"'Plus Jakarta Sans',sans-serif")
          .attr('font-weight', dc.hit ? '600' : '400')
          .text(dc.s || dc.n.slice(0,4));
    });
  }

  /* ── VENN ── */
  function venn(el, nA, nB, nAB, cA, cB){
    el.innerHTML = '';
    const {W, H} = dim(el, 260, 120);
    const cy=H/2, r=Math.min(H*.44,W*.25), sep=r*.55;
    const c1=W/2-sep*.75, c2=W/2+sep*.75;

    const svg = d3.select(el).append('svg').attr('width',W).attr('height',H);

    [{cx:c1,c:cA},{cx:c2,c:cB}].forEach(({cx,c}) => {
      svg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',r)
        .attr('fill',c).attr('fill-opacity',.12)
        .attr('stroke',c).attr('stroke-width',1.8).attr('stroke-opacity',.7);
    });

    [
      {x:c1-r*.38, v:nA-nAB, c:cA},
      {x:(c1+c2)/2, v:nAB,   c:'#7c5cbf'},
      {x:c2+r*.38, v:nB-nAB, c:cB},
    ].forEach(({x,v,c}) => {
      svg.append('text').attr('x',x).attr('y',cy)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('fill',c).attr('font-size','18px').attr('font-weight','700')
        .attr('font-family',"'Plus Jakarta Sans',sans-serif").text(v);
    });
  }

  /* ── TEI GAUGE ── */
  function teiGauge(el, tei){
    el.innerHTML = '';
    const {W, H} = dim(el, 180, 120);
    const cx=W/2, cy=H*.88;
    const r = Math.min(W*.42, H*.78);
    const sA=-Math.PI, eA=0;
    const valA = sA + (eA-sA)*(tei/100);
    const arc = d3.arc().innerRadius(r*.65).outerRadius(r).cornerRadius(2);

    const svg = d3.select(el).append('svg').attr('width',W).attr('height',H);

    // Track
    svg.append('path')
      .attr('transform',`translate(${cx},${cy})`)
      .attr('d', arc({startAngle:sA, endAngle:eA}))
      .attr('fill', cv('--bg4'));

    const gc = tei>70?'#c0392b': tei>40?'#d4a017':'#2a9e5c';

    // Fill with animation
    svg.append('path')
      .attr('transform',`translate(${cx},${cy})`)
      .attr('d', arc({startAngle:sA, endAngle:sA}))
      .attr('fill', gc)
      .transition().duration(900).ease(d3.easeCubicOut)
      .attrTween('d', ()=>{ const i=d3.interpolate(sA,valA); return t=>arc({startAngle:sA,endAngle:i(t)}); });

    svg.append('text').attr('x',cx).attr('y',cy-10)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('fill',gc).attr('font-size','26px').attr('font-weight','700')
      .attr('font-family',"'Plus Jakarta Sans',sans-serif").text(`${tei}%`);

    svg.append('text').attr('x',cx).attr('y',cy+6)
      .attr('text-anchor','middle').attr('fill',cv('--muted'))
      .attr('font-size','8px').attr('font-family',"'Plus Jakarta Sans',sans-serif")
      .attr('letter-spacing','.06em').text('ESCAPE INDEX');

    // Scale ends
    [[cx-r-1, '0'],[cx+r+1, '100%']].forEach(([x,t],i) => {
      svg.append('text').attr('x',x).attr('y',cy+4)
        .attr('text-anchor',i===0?'end':'start')
        .attr('fill',cv('--faint')).attr('font-size','7.5px').text(t);
    });
  }

  /* ── MECHANISM COMPARISON BARS ── */
  function mechBars(el, countsA, countsB, cA, cB){
    el.innerHTML = '';
    const maxV = Math.max(1, ...MECHS.flatMap(m=>[countsA[m.id]||0, countsB[m.id]||0]));
    const active = MECHS.filter(m=>(countsA[m.id]||0)+(countsB[m.id]||0)>0);

    active.forEach(m => {
      const vA=countsA[m.id]||0, vB=countsB[m.id]||0;
      const pA=Math.round(vA/maxV*100), pB=Math.round(vB/maxV*100);
      const row = document.createElement('div');
      row.className = 'mech-row';
      row.innerHTML = `
        <span class="mech-row-label" style="color:${m.c}">${m.s}</span>
        <div class="mbar-wrap mbar-left">
          <div class="mbar" style="width:${pA}%;background:${cA}"></div>
        </div>
        <span class="mbar-mid" style="background:${m.c}"></span>
        <div class="mbar-wrap mbar-right">
          <div class="mbar" style="width:${pB}%;background:${cB}"></div>
        </div>`;
      el.appendChild(row);
    });
  }

  function mechColor(id){ return (MECHS.find(m=>m.id===id)||{c:'#888'}).c; }

  return { radar, donut, strip, venn, teiGauge, mechBars, mechColor, MECHS, AWARE_C, MOB_C };
})();
