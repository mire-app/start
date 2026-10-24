# Míre

*La sabiduría de cuidar lo tuyo.* Gestión de tus finanzas personales, local y bajo tu propio control.

- Web: <https://mire-app.github.io/start/> (guía de estilo: <https://mire-app.github.io/start/estilo.html>).
- Identidad de marca y tono de voz: [`docs/brand.md`](docs/brand.md).

Este repositorio trabaja con la metodología **A.R.D.A.** — ver [`docs/guide.md`](docs/guide.md).

## Desarrollo

Requisitos: **Node.js 22** (ver `.nvmrc`). pnpm se ejecuta con corepack, que viene con Node; no hace falta instalarlo.

```bash
corepack pnpm install      # instalar dependencias
corepack pnpm dev          # servidor de desarrollo en http://localhost:5173/start/
bash .arda/checks.sh       # todos los checks: lint, formato, tipos, tests, build y e2e
corepack pnpm build:logo   # regenerar logotipo, iconos y favicon (se versionan)
```

Stack (ADR-0002): TypeScript, React y Vite; SQLite WASM (`opfs-sahpool`) en un Web Worker; PWA publicada en GitHub Pages bajo `/start/`; i18n es/en; Vitest y Playwright (Chromium).

Sistema de diseño (SPEC-0003, ADR-0003): Tailwind CSS con tokens en `src/design/`, componentes shadcn/ui en `src/ui/`, Sora autoalojada, Material Symbols Rounded y Motion.
