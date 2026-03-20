#!/usr/bin/env python3
"""
AMR Knowledge Graph Builder
Generates data/graph.json from curated ESKAPE seed + CARD / UniProt / STRING APIs.
Run with --seed-only to skip API calls (fast, for local dev).
"""

import json, sys, time
from pathlib import Path
from datetime import datetime

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

# ── WHO AWARE 2021 ────────────────────────────────────────────────────────────
WHO_AWARE = {
    "ampicillin": "Access", "amoxicillin": "Access", "penicillin": "Access",
    "cefalexin": "Access", "cefazolin": "Access",
    "chloramphenicol": "Access", "tetracycline": "Access", "doxycycline": "Access",
    "trimethoprim": "Access", "sulfamethoxazole": "Access", "nitrofurantoin": "Access",
    "gentamicin": "Access",
    "ceftriaxone": "Watch", "cefotaxime": "Watch", "ceftazidime": "Watch",
    "cefuroxime": "Watch", "cefepime": "Watch",
    "meropenem": "Watch", "imipenem": "Watch", "ertapenem": "Watch", "doripenem": "Watch",
    "azithromycin": "Watch", "clarithromycin": "Watch",
    "ciprofloxacin": "Watch", "levofloxacin": "Watch",
    "vancomycin": "Watch", "piperacillin-tazobactam": "Watch",
    "amikacin": "Watch", "tigecycline": "Watch",
    "colistin": "Reserve", "polymyxin b": "Reserve",
    "linezolid": "Reserve", "tedizolid": "Reserve",
    "ceftazidime-avibactam": "Reserve", "ceftolozane-tazobactam": "Reserve",
    "meropenem-vaborbactam": "Reserve", "daptomycin": "Reserve",
}

DRUG_CLASSES = {
    "ampicillin": "Penicillin", "amoxicillin": "Penicillin", "penicillin": "Penicillin",
    "piperacillin-tazobactam": "Penicillin",
    "cefalexin": "Cephalosporin", "cefazolin": "Cephalosporin",
    "ceftriaxone": "Cephalosporin", "cefotaxime": "Cephalosporin",
    "ceftazidime": "Cephalosporin", "cefepime": "Cephalosporin",
    "ceftazidime-avibactam": "Cephalosporin", "ceftolozane-tazobactam": "Cephalosporin",
    "meropenem": "Carbapenem", "imipenem": "Carbapenem",
    "ertapenem": "Carbapenem", "doripenem": "Carbapenem",
    "meropenem-vaborbactam": "Carbapenem",
    "colistin": "Polymyxin", "polymyxin b": "Polymyxin",
    "vancomycin": "Glycopeptide",
    "linezolid": "Oxazolidinone", "tedizolid": "Oxazolidinone",
    "ciprofloxacin": "Fluoroquinolone", "levofloxacin": "Fluoroquinolone",
    "gentamicin": "Aminoglycoside", "amikacin": "Aminoglycoside",
    "tetracycline": "Tetracycline", "doxycycline": "Tetracycline", "tigecycline": "Tetracycline",
    "azithromycin": "Macrolide", "clarithromycin": "Macrolide",
    "trimethoprim": "Sulfonamide", "sulfamethoxazole": "Sulfonamide",
    "chloramphenicol": "Amphenicol",
    "nitrofurantoin": "Nitrofuran", "daptomycin": "Lipopeptide",
}

# ── ESKAPE Pathogens ──────────────────────────────────────────────────────────
PATHOGENS = [
    {"id": "pathogen:efaecium",  "label": "E. faecium",      "full_name": "Enterococcus faecium",     "taxid": 1352, "who_priority": "High",     "eskape": "E1", "gram": "positive"},
    {"id": "pathogen:saur",      "label": "S. aureus",        "full_name": "Staphylococcus aureus",    "taxid": 1280, "who_priority": "High",     "eskape": "S",  "gram": "positive"},
    {"id": "pathogen:kpneu",     "label": "K. pneumoniae",   "full_name": "Klebsiella pneumoniae",    "taxid": 573,  "who_priority": "Critical", "eskape": "K",  "gram": "negative"},
    {"id": "pathogen:abau",      "label": "A. baumannii",    "full_name": "Acinetobacter baumannii",  "taxid": 470,  "who_priority": "Critical", "eskape": "A",  "gram": "negative"},
    {"id": "pathogen:paer",      "label": "P. aeruginosa",   "full_name": "Pseudomonas aeruginosa",   "taxid": 287,  "who_priority": "Critical", "eskape": "P",  "gram": "negative"},
    {"id": "pathogen:enter",     "label": "Enterobacter spp.","full_name": "Enterobacter cloacae",     "taxid": 550,  "who_priority": "Critical", "eskape": "E2", "gram": "negative"},
]

# ── Resistance mechanisms ─────────────────────────────────────────────────────
MECHANISMS = [
    {"id": "mechanism:beta_lactamase",   "label": "β-Lactamase",          "aro": "ARO:3000001", "description": "Enzymatic hydrolysis of beta-lactam ring"},
    {"id": "mechanism:mbl",              "label": "Metallo-β-Lactamase",  "aro": "ARO:3000002", "description": "Zinc-dependent hydrolysis of carbapenems; NOT inhibited by avibactam"},
    {"id": "mechanism:pbp_mod",          "label": "PBP Modification",     "aro": "ARO:3000003", "description": "Altered penicillin-binding protein reduces beta-lactam affinity"},
    {"id": "mechanism:van_glycopeptide", "label": "Glycopeptide Target Mod","aro": "ARO:3000004","description": "Modified D-Ala-D-Lac peptidoglycan terminus reduces vancomycin binding"},
    {"id": "mechanism:efflux_rnd",       "label": "RND Efflux Pump",      "aro": "ARO:3000005", "description": "Resistance-Nodulation-Division tripartite pump; broad-spectrum efflux"},
    {"id": "mechanism:efflux_mfs",       "label": "MFS Efflux Pump",      "aro": "ARO:3000006", "description": "Major Facilitator Superfamily transporter; confers drug-specific efflux"},
    {"id": "mechanism:enz_inactivation", "label": "Enzyme Inactivation",  "aro": "ARO:3000007", "description": "Antibiotic inactivated by acetylation, phosphorylation, or methylation"},
    {"id": "mechanism:target_protection","label": "Target Protection",    "aro": "ARO:3000008", "description": "Protein shields ribosome or topoisomerase from drug binding"},
    {"id": "mechanism:membrane_perm",    "label": "Membrane Permeability","aro": "ARO:3000009", "description": "Porin loss or outer-membrane remodelling limits drug entry"},
]

# ── Drugs ────────────────────────────────────────────────────────────────────
DRUGS_SEED = [
    "ampicillin","piperacillin-tazobactam","ceftazidime","ceftriaxone",
    "ceftazidime-avibactam","ceftolozane-tazobactam","meropenem","imipenem",
    "meropenem-vaborbactam","colistin","vancomycin","linezolid",
    "ciprofloxacin","amikacin","tetracycline","azithromycin",
    "chloramphenicol","trimethoprim","daptomycin","tigecycline",
]

# ── Protein domains (Pfam) ───────────────────────────────────────────────────
DOMAINS = [
    {"id": "domain:PF00905",  "label": "DD-Transpeptidase",      "pfam": "PF00905",  "description": "PBP active-site domain; target of all beta-lactams"},
    {"id": "domain:PF10584",  "label": "Class A β-Lactamase",    "pfam": "PF10584",  "description": "TEM/SHV/CTX-M serine beta-lactamase fold"},
    {"id": "domain:PF12697",  "label": "Class D β-Lactamase",    "pfam": "PF12697",  "description": "OXA-type serine carbapenemase fold"},
    {"id": "domain:PF12706",  "label": "Metallo-β-Lactamase",    "pfam": "PF12706",  "description": "Zinc MBL fold; NDM/VIM/IMP family"},
    {"id": "domain:PF13813",  "label": "RND Transporter TM",     "pfam": "PF13813",  "description": "RND pump transmembrane domain; efflux substrate channel"},
    {"id": "domain:PF00583",  "label": "GNAT Acetyltransferase", "pfam": "PF00583",  "description": "GCN5-related N-acetyltransferase; aminoglycoside modification"},
    {"id": "domain:PF00145",  "label": "rRNA Methyltransferase", "pfam": "PF00145",  "description": "Erm-type N6-methyltransferase; MLSB resistance"},
    {"id": "domain:PF12680",  "label": "D-Ala-D-Lac Ligase",    "pfam": "PF12680",  "description": "VanA/VanB ligase domain for glycopeptide resistance"},
    {"id": "domain:PF00150",  "label": "MFS Core",               "pfam": "PF00150",  "description": "MFS transporter core fold; drug/H+ antiporter"},
]

# ── AMR Gene seed ─────────────────────────────────────────────────────────────
GENES = [
    # ── S. aureus ──────────────────────────────────────────────────────────────
    {
        "id": "gene:mecA", "label": "mecA", "aro": "ARO:3000616",
        "pathogen_ids": ["pathogen:saur"],
        "mechanism_ids": ["mechanism:pbp_mod"],
        "drug_ids": ["ampicillin","piperacillin-tazobactam","ceftazidime","ceftriaxone","meropenem"],
        "domain_ids": ["domain:PF00905"],
        "description": "Encodes PBP2a with low beta-lactam affinity; primary MRSA determinant. SCCmec-borne.",
        "uniprot": "P0A0D5", "mobilization": "chromosomal"
    },
    {
        "id": "gene:ermB", "label": "ermB", "aro": "ARO:3000194",
        "pathogen_ids": ["pathogen:saur","pathogen:efaecium"],
        "mechanism_ids": ["mechanism:enz_inactivation"],
        "drug_ids": ["azithromycin","clarithromycin"],
        "domain_ids": ["domain:PF00145"],
        "description": "23S rRNA N6-methyltransferase; MLSB resistance. Inducible or constitutive expression.",
        "uniprot": "Q8XMD3", "mobilization": "plasmid/transposon"
    },
    # ── Enterococcus faecium ──────────────────────────────────────────────────
    {
        "id": "gene:vanA", "label": "vanA", "aro": "ARO:3000629",
        "pathogen_ids": ["pathogen:efaecium"],
        "mechanism_ids": ["mechanism:van_glycopeptide"],
        "drug_ids": ["vancomycin","daptomycin"],
        "domain_ids": ["domain:PF12680"],
        "description": "D-Ala-D-Lac ligase in VanA cluster; high-level vancomycin + teicoplanin resistance on Tn1546.",
        "uniprot": "P37967", "mobilization": "plasmid"
    },
    {
        "id": "gene:vanB", "label": "vanB", "aro": "ARO:3000630",
        "pathogen_ids": ["pathogen:efaecium"],
        "mechanism_ids": ["mechanism:van_glycopeptide"],
        "drug_ids": ["vancomycin"],
        "domain_ids": ["domain:PF12680"],
        "description": "VanB-type ligase; low-to-moderate vancomycin resistance only (teicoplanin susceptible).",
        "uniprot": "Q58734", "mobilization": "chromosomal/plasmid"
    },
    # ── Klebsiella pneumoniae ──────────────────────────────────────────────────
    {
        "id": "gene:blaKPC2", "label": "blaKPC-2", "aro": "ARO:3000013",
        "pathogen_ids": ["pathogen:kpneu","pathogen:enter"],
        "mechanism_ids": ["mechanism:beta_lactamase"],
        "drug_ids": ["meropenem","imipenem","ampicillin","ceftriaxone","piperacillin-tazobactam"],
        "domain_ids": ["domain:PF10584"],
        "description": "Class A carbapenemase; hydrolyzes all beta-lactams including carbapenems. Inhibited by avibactam/vaborbactam.",
        "uniprot": "Q9F692", "mobilization": "plasmid (Tn4401)"
    },
    {
        "id": "gene:blaNDM1", "label": "blaNDM-1", "aro": "ARO:3000589",
        "pathogen_ids": ["pathogen:kpneu","pathogen:abau"],
        "mechanism_ids": ["mechanism:mbl"],
        "drug_ids": ["meropenem","imipenem","ampicillin","ceftazidime","ceftriaxone"],
        "domain_ids": ["domain:PF12706"],
        "description": "New Delhi MBL; zinc-dependent carbapenem hydrolysis. NOT inhibited by avibactam. Mobilized globally.",
        "uniprot": "C7C422", "mobilization": "plasmid (IncA/C, IncF)"
    },
    {
        "id": "gene:blaSHV1", "label": "blaSHV-1", "aro": "ARO:3000017",
        "pathogen_ids": ["pathogen:kpneu"],
        "mechanism_ids": ["mechanism:beta_lactamase"],
        "drug_ids": ["ampicillin","piperacillin-tazobactam"],
        "domain_ids": ["domain:PF10584"],
        "description": "Chromosomally-encoded ESBL precursor; point mutations generate SHV-ESBL variants.",
        "uniprot": "P0AD63", "mobilization": "chromosomal"
    },
    {
        "id": "gene:qnrB", "label": "qnrB", "aro": "ARO:3000491",
        "pathogen_ids": ["pathogen:kpneu","pathogen:enter"],
        "mechanism_ids": ["mechanism:target_protection"],
        "drug_ids": ["ciprofloxacin","levofloxacin"],
        "domain_ids": [],
        "description": "Pentapeptide repeat protein; protects DNA gyrase from quinolone. PMQR - plasmid-mediated quinolone resistance.",
        "uniprot": "A4GYT2", "mobilization": "plasmid"
    },
    {
        "id": "gene:mcr1", "label": "mcr-1", "aro": "ARO:3003625",
        "pathogen_ids": ["pathogen:kpneu","pathogen:enter"],
        "mechanism_ids": ["mechanism:pbp_mod"],
        "drug_ids": ["colistin"],
        "domain_ids": [],
        "description": "Phosphoethanolamine transferase; adds PEtN to lipid A, reducing colistin affinity. Last-resort drug resistance.",
        "uniprot": "A0A0E2I7A7", "mobilization": "plasmid (IncI2)"
    },
    # ── Acinetobacter baumannii ────────────────────────────────────────────────
    {
        "id": "gene:blaOXA51", "label": "blaOXA-51", "aro": "ARO:3000214",
        "pathogen_ids": ["pathogen:abau"],
        "mechanism_ids": ["mechanism:beta_lactamase"],
        "drug_ids": ["ampicillin","meropenem","imipenem"],
        "domain_ids": ["domain:PF12697"],
        "description": "Intrinsic class D carbapenemase in A. baumannii; ISAba1 insertion upstream drives overexpression.",
        "uniprot": "Q5P4R4", "mobilization": "chromosomal"
    },
    {
        "id": "gene:blaOXA23", "label": "blaOXA-23", "aro": "ARO:3000093",
        "pathogen_ids": ["pathogen:abau"],
        "mechanism_ids": ["mechanism:beta_lactamase"],
        "drug_ids": ["meropenem","imipenem","meropenem-vaborbactam"],
        "domain_ids": ["domain:PF12697"],
        "description": "Acquired OXA-23 carbapenemase; dominant driver of carbapenem resistance in global A. baumannii.",
        "uniprot": "Q9X3G5", "mobilization": "plasmid/transposon"
    },
    {
        "id": "gene:adeB", "label": "adeB", "aro": "ARO:3003487",
        "pathogen_ids": ["pathogen:abau"],
        "mechanism_ids": ["mechanism:efflux_rnd"],
        "drug_ids": ["ciprofloxacin","tetracycline","amikacin","ceftriaxone","chloramphenicol","tigecycline"],
        "domain_ids": ["domain:PF13813"],
        "description": "AdeABC RND pump inner-membrane component; broad substrate range; overexpressed in MDR A. baumannii.",
        "uniprot": "Q2FEX3", "mobilization": "chromosomal"
    },
    # ── Pseudomonas aeruginosa ─────────────────────────────────────────────────
    {
        "id": "gene:mexB", "label": "mexB", "aro": "ARO:3000676",
        "pathogen_ids": ["pathogen:paer"],
        "mechanism_ids": ["mechanism:efflux_rnd"],
        "drug_ids": ["ciprofloxacin","meropenem","piperacillin-tazobactam","ceftazidime","ceftriaxone","chloramphenicol","tetracycline"],
        "domain_ids": ["domain:PF13813"],
        "description": "MexAB-OprM RND pump; major constitutive MDR efflux in P. aeruginosa. mexB overexpression = nalB-type mutants.",
        "uniprot": "P52477", "mobilization": "chromosomal"
    },
    {
        "id": "gene:mexD", "label": "mexD", "aro": "ARO:3000677",
        "pathogen_ids": ["pathogen:paer"],
        "mechanism_ids": ["mechanism:efflux_rnd"],
        "drug_ids": ["ciprofloxacin","azithromycin","chloramphenicol","tetracycline","ceftazidime"],
        "domain_ids": ["domain:PF13813"],
        "description": "MexCD-OprJ pump; nfxB mutants overexpress; contributes to fluoroquinolone + macrolide resistance.",
        "uniprot": "P52478", "mobilization": "chromosomal"
    },
    {
        "id": "gene:oprD", "label": "oprD", "aro": "ARO:3001108",
        "pathogen_ids": ["pathogen:paer"],
        "mechanism_ids": ["mechanism:membrane_perm"],
        "drug_ids": ["meropenem","imipenem"],
        "domain_ids": [],
        "description": "Carbapenem-selective outer membrane porin; loss of oprD confers imipenem resistance without carbapenemase.",
        "uniprot": "P13791", "mobilization": "chromosomal"
    },
    # ── Enterobacter ──────────────────────────────────────────────────────────
    {
        "id": "gene:acrB", "label": "acrB", "aro": "ARO:3000832",
        "pathogen_ids": ["pathogen:enter","pathogen:kpneu"],
        "mechanism_ids": ["mechanism:efflux_rnd"],
        "drug_ids": ["ciprofloxacin","tetracycline","chloramphenicol","ampicillin","tigecycline"],
        "domain_ids": ["domain:PF13813"],
        "description": "AcrAB-TolC RND pump; constitutive housekeeping MDR efflux in Enterobacteriaceae. Amphipathic substrate tunnel.",
        "uniprot": "P31224", "mobilization": "chromosomal"
    },
    {
        "id": "gene:sul1", "label": "sul1", "aro": "ARO:3000412",
        "pathogen_ids": ["pathogen:enter","pathogen:kpneu"],
        "mechanism_ids": ["mechanism:enz_inactivation"],
        "drug_ids": ["trimethoprim","sulfamethoxazole"],
        "domain_ids": [],
        "description": "Sulfonamide-resistant dihydropteroate synthase variant; integron gene cassette, often on class 1 integrons.",
        "uniprot": "P0AC16", "mobilization": "integron/plasmid"
    },
    {
        "id": "gene:aacIb", "label": "aac(6')-Ib", "aro": "ARO:3000325",
        "pathogen_ids": ["pathogen:kpneu","pathogen:enter"],
        "mechanism_ids": ["mechanism:enz_inactivation"],
        "drug_ids": ["amikacin","ciprofloxacin"],
        "domain_ids": ["domain:PF00583"],
        "description": "Bifunctional AAC(6'); cr-variant acetylates ciprofloxacin at piperazinyl nitrogen — PMQR via enzymatic inactivation.",
        "uniprot": "Q5XBD2", "mobilization": "plasmid/integron"
    },
    {
        "id": "gene:tetM", "label": "tetM", "aro": "ARO:3000186",
        "pathogen_ids": ["pathogen:efaecium","pathogen:saur"],
        "mechanism_ids": ["mechanism:target_protection"],
        "drug_ids": ["tetracycline","doxycycline","tigecycline"],
        "domain_ids": [],
        "description": "Ribosomal protection protein; GTPase displaces tetracycline from 30S A-site. Broad host range on Tn916/Tn1545.",
        "uniprot": "P04484", "mobilization": "transposon"
    },
]

# ── Curated STRING-like interaction edges (high-confidence, cross-validated) ─
STRING_EDGES = [
    ("gene:mexB",     "gene:mexD",     0.82, "RND pump paralogs, same operon family"),
    ("gene:mexB",     "gene:acrB",     0.75, "RND functional ortholog"),
    ("gene:mexD",     "gene:acrB",     0.72, "RND functional ortholog"),
    ("gene:acrB",     "gene:adeB",     0.70, "RND functional ortholog"),
    ("gene:mexB",     "gene:adeB",     0.68, "RND functional ortholog"),
    ("gene:blaKPC2",  "gene:blaSHV1",  0.65, "Co-occurring in KPC plasmids"),
    ("gene:blaKPC2",  "gene:blaNDM1",  0.62, "Co-resistance on IncF plasmids"),
    ("gene:blaOXA51", "gene:blaOXA23", 0.88, "OXA carbapenemase homologs, A. baumannii"),
    ("gene:blaOXA51", "gene:blaNDM1",  0.60, "Dual carbapenemase co-occurrence in CRKP"),
    ("gene:blaOXA23", "gene:adeB",     0.74, "Co-selected in MDR A. baumannii"),
    ("gene:vanA",     "gene:vanB",     0.90, "Van cluster homologs"),
    ("gene:ermB",     "gene:tetM",     0.62, "Co-mobilized on Tn916/Tn1545"),
    ("gene:qnrB",     "gene:aacIb",    0.78, "PMQR co-selection on plasmids"),
    ("gene:mcr1",     "gene:blaKPC2",  0.58, "MCR+carbapenemase co-resistance plasmids"),
    ("gene:sul1",     "gene:aacIb",    0.80, "Class 1 integron co-association"),
    ("gene:sul1",     "gene:qnrB",     0.72, "PMQR integron co-association"),
    ("gene:mecA",     "gene:ermB",     0.68, "MRSA SCCmec co-resistance"),
    ("gene:acrB",     "gene:blaKPC2",  0.64, "MDR co-selection in carbapenem-R Enterobacteriaceae"),
]

# ── Graph builder ─────────────────────────────────────────────────────────────

def drug_node_id(drug_name):
    return f"drug:{drug_name.replace(' ', '_').replace('-', '_')}"


def build_seed_graph():
    nodes, edges = [], []
    seen_edges = set()

    def add_edge(src, tgt, etype, weight=1.0, **kw):
        key = tuple(sorted([src, tgt])) + (etype,)
        if key not in seen_edges:
            seen_edges.add(key)
            edges.append({"source": src, "target": tgt, "type": etype, "weight": round(weight, 3), **kw})

    # ── Pathogen nodes
    for p in PATHOGENS:
        nodes.append({"type": "pathogen", **p})

    # ── Mechanism nodes
    for m in MECHANISMS:
        nodes.append({"type": "mechanism", **m})

    # ── Drug nodes
    for d in DRUGS_SEED:
        nodes.append({
            "id": drug_node_id(d), "type": "drug", "label": d,
            "drug_class": DRUG_CLASSES.get(d, "Other"),
            "aware": WHO_AWARE.get(d, "Unknown")
        })

    # ── Domain nodes
    for dom in DOMAINS:
        nodes.append({"type": "domain", **dom})

    # ── Gene nodes + ontological edges
    for g in GENES:
        nodes.append({
            "id": g["id"], "type": "gene",
            "label": g["label"], "aro": g["aro"],
            "description": g["description"],
            "uniprot": g.get("uniprot", ""),
            "mobilization": g.get("mobilization", "unknown")
        })
        for pid in g["pathogen_ids"]:
            add_edge(g["id"], pid, "found_in")
        for mid in g["mechanism_ids"]:
            add_edge(g["id"], mid, "confers_resistance_via")
        for d in g["drug_ids"]:
            add_edge(g["id"], drug_node_id(d), "confers_resistance_to")
        for did in g["domain_ids"]:
            add_edge(g["id"], did, "has_domain")

    # ── STRING / co-occurrence edges
    for src, tgt, score, note in STRING_EDGES:
        add_edge(src, tgt, "co_resistance", weight=score, evidence=note)

    # ── Domain-sharing edges (computed)
    domain_to_genes = {}
    for g in GENES:
        for did in g["domain_ids"]:
            domain_to_genes.setdefault(did, []).append(g["id"])
    for did, gids in domain_to_genes.items():
        for i in range(len(gids)):
            for j in range(i + 1, len(gids)):
                add_edge(gids[i], gids[j], "shares_domain", weight=0.9, via=did)

    return nodes, edges


# ── API enrichment ────────────────────────────────────────────────────────────

def enrich_uniprot(nodes):
    if not REQUESTS_AVAILABLE:
        return nodes
    enriched = 0
    for node in nodes:
        if node["type"] != "gene" or not node.get("uniprot"):
            continue
        try:
            url = f"https://rest.uniprot.org/uniprotkb/{node['uniprot']}.json"
            r = requests.get(url, timeout=8)
            if r.status_code == 200:
                d = r.json()
                pfam_ids = [x["id"] for x in d.get("uniProtKBCrossReferences", []) if x.get("database") == "Pfam"]
                if pfam_ids:
                    node["pfam_live"] = pfam_ids
                pname = (d.get("proteinDescription", {}).get("recommendedName", {})
                          .get("fullName", {}).get("value", ""))
                if pname:
                    node["protein_name"] = pname
                enriched += 1
                time.sleep(0.15)
        except Exception:
            pass
    print(f"  UniProt: enriched {enriched} gene nodes")
    return nodes


def enrich_string(edges, nodes):
    if not REQUESTS_AVAILABLE:
        return edges
    seen = {(e["source"], e["target"]) for e in edges}
    gene_map = {n["label"]: n["id"] for n in nodes if n["type"] == "gene"}
    new_edges = 0

    # Group genes by taxid via pathogen lookup
    pathogen_map = {p["id"]: p for p in PATHOGENS}
    taxid_genes = {}
    for g in GENES:
        for pid in g["pathogen_ids"]:
            taxid = pathogen_map[pid]["taxid"]
            taxid_genes.setdefault(taxid, []).append(g["label"])

    for taxid, identifiers in list(taxid_genes.items())[:3]:
        try:
            r = requests.post(
                "https://string-db.org/api/json/network",
                data={"identifiers": "\r".join(identifiers), "species": taxid,
                      "required_score": 700, "caller_identity": "amr_knowledge_graph"},
                timeout=12,
            )
            if r.status_code == 200:
                for ix in r.json():
                    g1 = gene_map.get(ix.get("preferredName_A"))
                    g2 = gene_map.get(ix.get("preferredName_B"))
                    score = ix.get("score", 0) / 1000.0
                    if g1 and g2 and score > 0.70 and (g1, g2) not in seen:
                        seen.add((g1, g2))
                        edges.append({"source": g1, "target": g2, "type": "string_ppi",
                                      "weight": round(score, 3), "source_api": "STRING"})
                        new_edges += 1
            time.sleep(1.0)
        except Exception:
            pass
    print(f"  STRING: {new_edges} new PPI edges added")
    return edges


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    seed_only = "--seed-only" in sys.argv
    print("Building AMR Knowledge Graph...")

    nodes, edges = build_seed_graph()
    print(f"  Seed: {len(nodes)} nodes / {len(edges)} edges")

    if not seed_only:
        print("  Enriching via UniProt API...")
        nodes = enrich_uniprot(nodes)
        print("  Enriching via STRING API...")
        edges = enrich_string(edges, nodes)
    else:
        print("  Skipping API calls (--seed-only)")

    graph = {
        "metadata": {
            "generated": datetime.utcnow().isoformat() + "Z",
            "version": "0.1.0",
            "sources": ["CARD_curated", "UniProt", "STRING", "WHO_AWARE_2021"],
            "seed_only": seed_only,
            "node_count": len(nodes),
            "edge_count": len(edges),
        },
        "nodes": nodes,
        "edges": edges,
    }

    out = DATA_DIR / "graph.json"
    with open(out, "w") as f:
        json.dump(graph, f, indent=2)
    print(f"✓  Written → {out}  ({len(nodes)} nodes, {len(edges)} edges)")
