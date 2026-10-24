---
name: refinar
description: A.R.D.A. phase 2 (Refinar). Use to write or improve a spec in docs/specs/ for NÖM and iterate on it with the inspector until it is ready to be decided. Never edits code and never approves.
---

# Refinar

Goal: a spec good enough for the owner to decide on it.

1. Create `docs/specs/NNNN-slug.md` from `docs/specs/_template.md` with `status: draft`, or update an existing **draft** spec. Never write `status: approved` (only a person can; hooks block it).
2. Fill every section (in Spanish): intent, context references, change (delta), out of scope, numbered verifiable acceptance criteria, risks and open questions. Set `test_changes: allowed` only if existing tests must change, and justify it.
3. If a decision with alternatives is involved (stack, architecture, data), write it as an ADR in `docs/decisions/` (template there, `status: proposed`) and reference it from the spec.
4. Ask `andreth` to review the spec (give it the path). Apply blocking findings and repeat until APROBADO or until what remains are owner decisions.
5. Put the open questions to the owner; never guess an answer.
6. Run `python3 .arda/tools/spec_index.py`, commit on a working branch (`spec/NNNN-slug`). Next step: `/decidir`.

Throwaway experiments are allowed only under `spikes/`; they are never merged. Their conclusions go into the spec.
