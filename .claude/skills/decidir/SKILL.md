---
name: decidir
description: A.R.D.A. phase 3 (Decidir). Use when a spec of NÖM is ready for the owner's decision. Presents it, explains how to approve it and, once approved, activates it for implementation.
---

# Decidir

Only a person decides. Your job is to make the decision easy and to activate it afterwards.

1. Present the spec to the owner in Spanish: intent, scope and out of scope, acceptance criteria, risks, open questions and `andreth`'s verdict.
2. Explain how to approve: the owner changes `status: draft` to `status: approved` in the spec and commits it on the working branch (GitHub web editor or local git). Agents cannot do it: hooks block it. Likewise, an ADR is accepted by the owner (`status: accepted`).
3. If the owner says "not yet" or asks for changes: go back to `/refinar`.
4. When the owner confirms: `git pull`, check the spec now says `status: approved`, write its path into `.arda/active-spec`, commit.
5. Recommend starting a **new session** for `/actuar`: the approved spec is the only context needed (saves usage limits).
