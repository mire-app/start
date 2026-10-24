# NÖM

**Next Optimal Money** — *Sabiduría financiera personal para proveer a tu futuro.*

Este repositorio trabaja con la metodología **A.R.D.A.** — ver [`docs/guide.md`](docs/guide.md).

## Desarrollo

Requisitos: **Node.js 22** (ver `.nvmrc`). pnpm se ejecuta con corepack, que viene con Node; no hace falta instalarlo.

```bash
corepack pnpm install      # instalar dependencias
corepack pnpm dev          # servidor de desarrollo en http://localhost:5173/start/
bash .arda/checks.sh       # todos los checks: lint, formato, tipos, tests, build y e2e
```

Stack (ADR-0002): TypeScript, React y Vite; SQLite WASM (`opfs-sahpool`) en un Web Worker; PWA publicada en GitHub Pages bajo `/start/`; i18n es/en; Vitest y Playwright (Chromium).
