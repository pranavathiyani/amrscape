<div align="center">

# 🦠 AMRscape

### Interactive ESKAPE Resistome Comparison Explorer

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=flat-square&logo=github)](https://pranavathiyani.github.io/amrscape/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Data: CARD](https://img.shields.io/badge/Data-CARD%202025-orange?style=flat-square)](https://card.mcmaster.ca)
[![WHO AWARE](https://img.shields.io/badge/WHO-AWARE%202025-red?style=flat-square)](https://www.who.int/publications/i/item/B09489)
[![Co-developed with Claude](https://img.shields.io/badge/Co--developed%20with-Claude%20💙-blueviolet?style=flat-square)](https://claude.ai)

**Compare antibiotic resistance profiles across ESKAPE pathogens — side by side, in your browser.**

[🔬 Live Demo](https://pranavathiyani.github.io/amrscape/) · [🐛 Report a Bug](https://github.com/pranavathiyani/amrscape/issues/new?template=bug_report.md) · [💡 Request a Feature](https://github.com/pranavathiyani/amrscape/issues/new?template=feature_request.md)

</div>

---

## What is AMRscape?

AMRscape is a static, open-source web tool for **side-by-side comparison of antibiotic resistance gene (ARG) profiles** across ESKAPE pathogens (*Enterococcus faecium*, *Staphylococcus aureus*, *Klebsiella pneumoniae*, *Acinetobacter baumannii*, *Pseudomonas aeruginosa*, *Enterobacter* spp.).

Built entirely on publicly available databases. No server. No login. No data upload required.

---

## Features

| Feature | Description |
|---------|-------------|
| **Dual-panel comparison** | Pick any two ESKAPE pathogens and compare resistance profiles side by side |
| **Mechanism radar** | Spider chart showing which resistance mechanisms dominate each pathogen |
| **WHO AWARE donut** | Breakdown of affected drugs by Access / Watch / Reserve tier |
| **Drug class heatmap** | One-row strip showing which drug classes are defeated |
| **Mobilization pie** | Fraction of ARGs that are mobile (plasmid/transposon) vs chromosomal |
| **Venn ARG overlap** | Visual count of shared vs unique resistance genes |
| **★ Therapeutic Escape Index (TEI)** | Novel metric — % of drug classes simultaneously defeated in a co-infection scenario |
| **Mechanism burden comparison** | Mirrored bar chart comparing mechanism usage between pathogens |
| **Risk indicators** | HGT transfer risk, last-resort drug exposure alerts |
| **Gene cards** | Full ARG details — mechanism, drug chips, CARD + UniProt links, mobilization |
| **Shareable URLs** | Every comparison is bookmarkable via `?l=...&r=...` query params |
| **Dark / Light mode** | Toggleable, persisted in localStorage |
| **Citation box** | Plain text / BibTeX / RIS ready-to-copy citations |

---

## Data Sources

| Source | What we use | Version |
|--------|-------------|---------|
| [CARD](https://card.mcmaster.ca) | ARO accessions, gene names, resistance mechanisms | 2025 |
| [UniProt REST API](https://rest.uniprot.org) | Pfam domain annotations, protein names | Live API |
| [STRING](https://string-db.org) | Protein–protein interaction scores (≥0.70) | Live API |
| [WHO AWARE](https://www.who.int/publications/i/item/B09489) | Access / Watch / Reserve classification | 2025 |
| [WHO Priority Pathogens](https://www.who.int/publications/i/item/9789240093461) | Critical / High priority labels | 2024 |

> ★ **Therapeutic Escape Index (TEI)** is a novel metric developed for AMRscape. It calculates the percentage of WHO-classified drug classes where a co-infection scenario has no shared susceptibility between two pathogens.

---

## Quickstart (local)

```bash
git clone https://github.com/pranavathiyani/amrscape.git
cd amrscape

# Build graph (seed only — fast, no API calls)
pip install -r scripts/requirements.txt
python scripts/build_graph.py --seed-only

# Serve locally
python -m http.server 8080
# → open http://localhost:8080
```

---

## Project Structure

```
amrscape/
├── index.html               # Single-page app
├── css/style.css            # All styles (light + dark themes)
├── js/
│   ├── app.js               # App logic, data loading, comparisons
│   └── charts.js            # D3 chart components
├── data/
│   └── graph.json           # Knowledge graph (63 nodes, 151 edges)
├── scripts/
│   ├── build_graph.py       # Data pipeline — CARD + UniProt + STRING
│   └── requirements.txt
└── .github/workflows/
    └── build.yml            # CI: weekly rebuild + GitHub Pages deploy
```

---

## graph.json Schema

```jsonc
{
  "metadata": { "node_count": 63, "edge_count": 151, "generated": "ISO8601Z" },
  "nodes": [
    {
      "id": "gene:mecA", "type": "gene",
      "label": "mecA", "aro": "ARO:3000616",
      "uniprot": "P0A0D5", "mobilization": "chromosomal"
    }
    // types: gene | mechanism | drug | pathogen | domain
  ],
  "edges": [
    { "source": "gene:mecA", "target": "mechanism:pbp_mod",
      "type": "confers_resistance_via", "weight": 1.0 }
    // types: found_in | confers_resistance_via | confers_resistance_to
    //        has_domain | co_resistance | shares_domain
  ]
}
```

---

## Extending AMRscape

### Add a new gene
Edit the `GENES` list in `scripts/build_graph.py`:
```python
{
    "id": "gene:blaVIM1",
    "label": "blaVIM-1",
    "aro": "ARO:3000156",
    "pathogen_ids": ["pathogen:paer"],
    "mechanism_ids": ["mechanism:mbl"],
    "drug_ids": ["meropenem", "imipenem"],
    "domain_ids": ["domain:PF12706"],
    "description": "VIM-1 metallo-beta-lactamase...",
    "uniprot": "Q9WZR6",
    "mobilization": "plasmid (integron)"
},
```

### Rebuild the graph
```bash
# Seed only (instant)
python scripts/build_graph.py --seed-only

# With live API enrichment
python scripts/build_graph.py
```

---

## Roadmap

- [ ] Upload hAMRonization TSV — visualize your own resistome data
- [ ] CARD prevalence data integration (strain-level %)
- [ ] iModulon expression layer (AMR iModulons from iModulonDB 2.0)
- [ ] AlphaFold structure links per gene
- [ ] Keyword search / jump-to-node
- [ ] Export filtered subgraph as JSON/CSV

---

## Citation

```
Pranavathiyani G. AMRscape: Interactive ESKAPE Resistome Comparison Explorer.
2025. Available at: https://pranavathiyani.github.io/amrscape/
```

---

## Credits

Built entirely on openly and publicly available databases.
Co-developed with [Claude](https://claude.ai) 💙

**Author:** [Pranavathiyani G](https://pranavathiyani.github.io)
Assistant Professor (Research), SASTRA Deemed to be University
Bioinformatics · AMR · Multi-omics · AI/ML Drug Discovery

---

<div align="center">
<sub>🦠 AMRscape · ESKAPE Resistome Explorer · MIT License</sub>
</div>
