---
name: actuar
description: A.R.D.A. phase 4 (Actuar). Use to implement the approved spec referenced by .arda/active-spec in NÖM, verify it, get the inspector's verdict and open the PR.
---

# Actuar

Precondition: `.arda/active-spec` points to a spec with `status: approved` (hooks enforce it). Work on branch `spec/NNNN-slug`, never on `main`.

1. Read the active spec and only the files it references. Plan briefly, mapping each acceptance criterion to concrete steps.
2. Implement in small steps. For each criterion, write the new tests first when the stack allows it. Do not modify existing tests unless the spec says `test_changes: allowed`.
3. Run deterministic checks: `.arda/checks.sh` (if it exists), tests and linters. Fix until green.
4. Commit your work on the branch, then save the diff for review: `git diff origin/main...HEAD > .arda/review.diff`. Ask `andreth` to review the diff against the active spec. If RECHAZADO, fix and repeat; after 3 rounds, ask the owner.
5. If anything outside the spec turns out to be needed: stop, explain it to the owner and go back to `/refinar` (the owner sets the spec back to `draft`).
6. Close the loop:
   - Mark the spec `status: implemented` (single edit from `approved`).
   - Update living specs and `docs/project-context.md` if the behaviour or the backlog changed.
   - Run `python3 .arda/tools/spec_index.py`.
   - At milestones, the owner may record learnings in `docs/learnings.md`.
7. Commit, push the branch and open a PR from the template with `Spec: SPEC-NNNN`. The owner merges.
