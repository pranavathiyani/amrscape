# Contributing to AMRscape

Thanks for your interest in contributing! AMRscape is a research tool built on open data — contributions of all kinds are welcome.

## Ways to contribute

- 🐛 **Report bugs** — open an issue with the bug report template
- 💡 **Suggest features** — open an issue with the feature request template
- 🧬 **Add AMR genes** — extend the CARD seed data in `scripts/build_graph.py`
- 🎨 **Improve the UI** — PRs welcome for layout, accessibility, mobile support
- 📖 **Fix docs** — typos, clarifications, better examples

## Development setup

```bash
git clone https://github.com/pranavathiyani/amrscape.git
cd amrscape
pip install -r scripts/requirements.txt
python scripts/build_graph.py --seed-only
python -m http.server 8080
```

## Submitting a PR

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Test locally with `python -m http.server 8080`
5. Commit with a clear message: `git commit -m "feat: add VIM-1 to P. aeruginosa"`
6. Push and open a PR against `main`

## Adding genes — guidelines

When adding to `GENES` in `scripts/build_graph.py`:
- Use the correct ARO accession from [CARD](https://card.mcmaster.ca)
- Verify the UniProt ID is for the canonical protein
- Include a clear, accurate description (1–2 sentences)
- Specify `mobilization` accurately: `chromosomal`, `plasmid`, `transposon`, `integron/plasmid`, etc.
- Only include ESKAPE pathogens in `pathogen_ids`

## Code style

- Vanilla JS (no frameworks) for `js/`
- D3 v7 for charts
- CSS variables for all colors — never hardcode hex values
- Keep functions small and named clearly

## Questions?

Open an issue or reach out via [pranavathiyani.github.io](https://pranavathiyani.github.io).
