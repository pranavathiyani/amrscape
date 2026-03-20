# 🧬 AMRscape – ESKAPE Explorer

An open-source, static-hosted knowledge graph explorer for Antimicrobial Resistance (AMR) across ESKAPE pathogens. Integrates curated data from CARD, UniProt (Pfam), STRING, and WHO AWARE 2021.

**Live demo:** `https://<your-github-username>.github.io/amrscape/`

---

## What it shows

| View | Description |
|------|-------------|
| **Network** | Force-directed graph — genes, mechanisms, drugs, pathogens, protein domains as nodes; resistance, co-occurrence, domain-sharing as edges |
| **Resistance Matrix** | Gene × Drug heatmap, colored by resistance mechanism; rows grouped by pathogen, columns by WHO AWARE tier |
| **Sankey Flow** | AMR information flow: Pathogen → Gene → Mechanism → Drug Class → AWARE Tier |

### Node types
| Shape | Type | Source |
|-------|------|--------|
| ⭐ Star | Pathogen (ESKAPE) | WHO Priority Pathogen List |
| ◆ Diamond | Resistance mechanism | CARD ARO ontology |
| ■ Square | Drug (AWARE-colored) | WHO AWARE 2021 |
| ● Circle (cyan) | AMR gene | CARD |
| ● Circle (purple) | Pfam domain | UniProt |

### Edge types
| Color | Type | Meaning |
|-------|------|---------|
| Red dashed | `found_in` | Gene detected in pathogen |
| Amber solid | `confers_resistance_via` | Gene → mechanism link |
| Green solid | `confers_resistance_to` | Gene → drug resistance |
| Purple dotted | `has_domain` | Gene carries Pfam domain |
| Red solid | `co_resistance` | High-confidence co-selection evidence |
| Gray dotted | `shares_domain` | Two genes share a Pfam domain |

---

## Data sources

| Source | What we use | URL |
|--------|-------------|-----|
| **CARD** | ARO accessions, gene names, descriptions | https://card.mcmaster.ca |
| **UniProt REST API** | Pfam domain cross-references, protein names | https://rest.uniprot.org |
| **STRING** | Protein–protein interaction scores (≥0.7) | https://string-db.org |
| **WHO AWARE 2021** | Access / Watch / Reserve classification | hardcoded from WHO publication |
| **WHO Priority Pathogens 2024** | Critical / High priority labels | hardcoded |

---

## Repo structure

```
amrscape/
├── .github/
│   └── workflows/
│       └── build.yml          # CI: build graph.json + deploy to gh-pages
├── scripts/
│   ├── build_graph.py         # Pipeline: seed + CARD/UniProt/STRING enrichment
│   └── requirements.txt
├── data/
│   └── graph.json             # Generated graph (committed as fallback)
├── js/
│   ├── app.js                 # State, filters, info panel, routing
│   ├── force.js               # D3 force-directed view
│   ├── bipartite.js           # Gene × Drug resistance matrix
│   └── sankey.js              # Sankey flow (d3-sankey)
├── css/
│   └── style.css              # Dark scientific theme
├── index.html                 # Single-page app
└── README.md
```

---

## Quick start (local dev)

```bash
git clone https://github.com/<you>/amrscape
cd amrscape

# Install Python deps
pip install -r scripts/requirements.txt

# Build graph with live API calls (needs internet)
python scripts/build_graph.py

# Or use curated seed only (no network, instant)
python scripts/build_graph.py --seed-only

# Serve locally
python -m http.server 8080
# → open http://localhost:8080
```

---

## GitHub Pages deployment

1. Push to `main` branch
2. Go to **Settings → Pages → Source**: select `GitHub Actions`
3. The `build.yml` workflow triggers automatically on push and weekly (Monday 02:00 UTC)
4. Your explorer will be live at `https://<username>.github.io/<repo-name>/`

### Manual trigger
Go to **Actions → Build AMRscape → Run workflow**  
Check "seed only" to skip API calls for a fast rebuild.

---

## Extending the graph

### Add more genes
Edit `GENES` list in `scripts/build_graph.py`:
```python
{
    "id": "gene:blaVIM1",  # must be unique
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

### Add CARD prevalence data
Uncomment and extend `try_enrich_card()` in `build_graph.py` to pull live prevalence stats from `https://card.mcmaster.ca/latest/prevalence`.

### Add more views
Create `js/myview.js`, add `<div id="view-myview">` in `index.html`, call `MyView.init/update` from `app.js`.

---

## graph.json schema

```jsonc
{
  "metadata": {
    "generated": "2025-01-01T00:00:00Z",
    "version": "0.1.0",
    "node_count": 63,
    "edge_count": 151
  },
  "nodes": [
    {
      "id": "gene:mecA",          // unique node ID
      "type": "gene",             // gene | mechanism | drug | pathogen | domain
      "label": "mecA",
      "aro": "ARO:3000616",       // CARD ARO accession
      "uniprot": "P0A0D5",
      "description": "...",
      "mobilization": "chromosomal"
    }
    // type=drug nodes also have: aware, drug_class
    // type=pathogen nodes also have: full_name, who_priority, gram, taxid
    // type=domain nodes also have: pfam, description
  ],
  "edges": [
    {
      "source": "gene:mecA",
      "target": "mechanism:pbp_mod",
      "type": "confers_resistance_via",
      "weight": 1.0
    }
  ]
}
```

---

## Roadmap

- [ ] CARD prevalence table integration (strain-level prevalence %)
- [ ] iModulon expression layer (AMR iModulons from iModulonDB 2.0)
- [ ] AlphaFold structure links per gene
- [ ] NCBI HMM domain annotation (Release 19)
- [ ] Keyword search / jump-to-node
- [ ] Export filtered subgraph as JSON/CSV
- [ ] Mobile-responsive layout

---

## Citation & data licenses

- **CARD** data is available under [CC BY 4.0](https://card.mcmaster.ca/about)
- **UniProt** data is available under [CC BY 4.0](https://www.uniprot.org/help/license)
- **STRING** data is available under [CC BY 4.0](https://string-db.org/cgi/access)
- **WHO AWARE** classification: WHO AWaRe antibiotic list (2021)

---

*Built with D3.js v7 · d3-sankey · pure static HTML · GitHub Actions · no backend required*
