# Índice de conocimiento

> Generado por `.arda/tools/spec_index.py`. No editar a mano: ejecutar `python3 .arda/tools/spec_index.py`.

## Specs

| ID | Título | Estado | Resumen | Fichero |
|---|---|---|---|---|
| SPEC-0001 | Visión de producto y MVP | approved | Visión TO-BE de NÖM, alcance del MVP individual local-first con sincronización cifrada en GitHub, y fases posteriores | [0001-vision-producto-mvp.md](0001-vision-producto-mvp.md) |
| SPEC-0002 | Stack tecnológico y checks del proyecto | draft | Esqueleto de la app (TypeScript, React, Vite, SQLite WASM, PWA, i18n) según ADR-0002, .arda/checks.sh y despliegue en GitHub Pages | [0002-stack-tecnologico.md](0002-stack-tecnologico.md) |

## Decisiones (ADR)

| ID | Título | Estado | Resumen | Fichero |
|---|---|---|---|---|
| ADR-0001 | Almacenamiento local-first con sincronización cifrada en GitHub | accepted | Base de datos local por dispositivo y copia maestra cifrada en un repositorio privado de GitHub separado, sincronizada cada 5 min | [0001-almacenamiento-local-first-github-cifrado.md](../decisions/0001-almacenamiento-local-first-github-cifrado.md) |
| ADR-0002 | Stack web TypeScript + React con SQLite WASM y PWA en GitHub Pages | proposed | SPA estática TypeScript/React/Vite como PWA en GitHub Pages; SQLite WASM (opfs-sahpool) en un worker; registro de operaciones cifrado con WebCrypto hacia GitHub mediante token de grano fino | [0002-stack-web-typescript-react.md](../decisions/0002-stack-web-typescript-react.md) |
