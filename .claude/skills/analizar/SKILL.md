---
name: analizar
description: A.R.D.A. phase 1 (Analizar). Use at the start of any piece of work in NÖM to capture the intent and gather context from the knowledge index before writing a spec. Never edits code.
---

# Analizar

Goal: understand **what** is wanted and **what we already know**, cheaply.

1. Restate the intent in 1–3 lines (Spanish). If it is ambiguous, ask the owner; do not assume.
2. Read `docs/specs/index.md` and `docs/project-context.md`. Open only the specs and ADRs that are relevant.
3. If code, dependencies or several areas are involved, delegate to `balan` with one precise question.
4. Report to the owner (Spanish):
   - **Intención**
   - **Contexto** (IDs and paths)
   - **Preguntas abiertas**
   - **Propuesta:** new spec `SPEC-NNNN` (next free number) and slug, or which existing draft spec to update.
5. Do not edit code. Next step: `/refinar`.
