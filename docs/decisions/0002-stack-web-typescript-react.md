---
id: ADR-0002
title: Stack web TypeScript + React con SQLite WASM y PWA en GitHub Pages
status: proposed       # proposed → accepted (solo una persona) → superseded
summary: SPA estática TypeScript/React/Vite como PWA en GitHub Pages; SQLite WASM (opfs-sahpool) en un worker; registro de operaciones cifrado con WebCrypto hacia GitHub mediante token de grano fino
---

# ADR-0002 · Stack web TypeScript + React con SQLite WASM y PWA en GitHub Pages

## Contexto
SPEC-0001 y ADR-0001 exigen:
- una web responsive, instalable y que funcione sin conexión;
- una base de datos local en cada dispositivo;
- sincronización cifrada con un repositorio privado de GitHub;
- español e inglés, y coste 0 €.

Claude escribe el código y el propietario revisa los PR, así que prima un stack muy conocido, tipado y con buen tooling. El repositorio `nom-finance/app` es público y la web se publica en GitHub Pages, que solo sirve ficheros estáticos y no permite configurar cabeceras HTTP (sin COOP/COEP).

## Decisión
| Ámbito | Elección |
|---|---|
| Lenguaje | **TypeScript** en modo `strict`. |
| UI | **React**, como SPA estática (sin servidor ni SSR). |
| Build y servidor de desarrollo | **Vite**. |
| Gestor de paquetes y runtime | **pnpm**, fijado en `packageManager` y ejecutado con `corepack pnpm`, sin instalación global. **Node.js 22 LTS**, fijado en `.nvmrc` y `engines`; es la versión preinstalada en las sesiones cloud y trae corepack. Pasar a otra LTS antes de abril de 2027 requiere su propia spec. |
| Navegación | **React Router** con rutas *hash* (`/#/…`), compatible con GitHub Pages sin reescrituras. Se añade cuando haya más de una pantalla (SPEC-0006); el esqueleto no lo incluye. |
| Base de datos local | **SQLite WASM oficial** (`@sqlite.org/sqlite-wasm`) con el VFS **`opfs-sahpool`** dentro de un **Web Worker**. Este VFS no necesita aislamiento *cross-origin* ni `SharedArrayBuffer` (validado con un *spike*, ver SPEC-0002). |
| Sincronización | **Registro de operaciones propio**: cada dispositivo sube lotes de operaciones cifrados como ficheros al repositorio de datos. El diseño de fusión y conflictos se hace en SPEC-0008. |
| Cifrado | **WebCrypto** nativo (AES-GCM). La derivación y custodia de la clave se deciden en SPEC-0005. |
| Acceso a GitHub | `fetch` nativo contra la **API REST de GitHub**, con un **token de grano fino** limitado al repositorio de datos (permiso Contents: lectura y escritura). Lo introduce el propietario una vez por dispositivo. Sin backend ni OAuth. |
| PWA | **vite-plugin-pwa** (Workbox): manifiesto, instalación y *precache* para funcionar sin conexión. |
| i18n | **i18next + react-i18next** (es, en). Importes y fechas con `Intl` (es-ES por defecto). |
| Calidad | **ESLint** (typescript-eslint y reglas de hooks de React) y **Prettier**. |
| Tests | **Vitest** para unitarios y **Playwright** (Chromium) para e2e contra la build de producción. |
| Alojamiento | **GitHub Pages**, publicado por GitHub Actions al fusionar en `main`. |
| Versiones | Exactas en `package.json`, con *lockfile* versionado. |

## Verificación de límites de GitHub (pendiente desde SPEC-0001 y ADR-0001)
Según la documentación pública de GitHub consultada en 2026-10, cada límite se compara con el uso previsto:

| Límite | Valor | Uso previsto de NÖM |
|---|---|---|
| API REST con token (también de grano fino) | 5.000 peticiones/h | Sincronizar cada 5 min son ~12 ciclos/h de pocas peticiones: muy por debajo. |
| Contents API | Lectura directa hasta 1 MB por fichero; ficheros mayores con la API Git (blobs, hasta 100 MB) | Los lotes cifrados de operaciones se diseñarán por debajo de 1 MB (SPEC-0008). |
| Tamaño del repositorio | Recomendado < 1 GB | Un uso personal genera KB al día; se compactará (SPEC-0008). |
| GitHub Pages | Sitio ≤ 1 GB; ancho de banda orientativo de 100 GB/mes | La app pesa unos pocos MB y la usa una persona. |
| GitHub Actions | Gratis en repositorios públicos con runners estándar | Despliegue y CI de `nom-finance/app`. El repositorio de datos no usa Actions. |

Conclusión: el uso previsto encaja en el plan gratuito. SPEC-0008 vuelve a comprobar estos límites contra la documentación vigente al diseñar el formato de sincronización.

## Alternativas consideradas
| Alternativa | Por qué no |
|---|---|
| Svelte o Vue | Válidas, pero con un ecosistema menor; el propietario prefiere React. |
| Next.js, Remix | Aportan SSR y servidor, que aquí no hacen falta; la exportación estática añade complejidad. |
| IndexedDB + Dexie | Más simple, pero los informes del panel (agregados por mes y categoría) se escriben mejor en SQL. |
| PGlite (Postgres WASM) | Más pesado y menos maduro en OPFS que SQLite. |
| wa-sqlite | Válido, pero el paquete oficial de SQLite tiene soporte de primera parte para `opfs-sahpool`. |
| VFS `opfs` de SQLite | Necesita COOP/COEP (aislamiento *cross-origin*), que GitHub Pages no permite. |
| CRDT (Automerge, Yjs) | Dependencia grande y documentos más voluminosos en git; el propietario prefiere un registro de operaciones propio. |
| Cloudflare Pages, Netlify, Vercel | Viables y gratuitos; el propietario prefiere GitHub Pages con el repositorio público. |
| OAuth con GitHub y un Worker | Exige un backend; el token de grano fino basta para un único usuario. |
| npm | Válido; pnpm es más rápido y estricto con las dependencias. |
| Jest | Vitest se integra con Vite sin configuración extra. |

## Consecuencias
- **+** Coste 0 €, sin servidor que mantener; todo se ejecuta en el navegador.
- **+** Stack muy conocido: Claude lo maneja bien y es fácil de revisar.
- **−** `opfs-sahpool` admite **una sola conexión**: dos pestañas de NÖM abiertas a la vez necesitan coordinación (p. ej. Web Locks y una sola pestaña activa). Se resuelve en SPEC-0006/0008.
- **−** OPFS en Safari (iOS) no se ha probado; los e2e solo cubren Chromium.
- **−** El token vive en el navegador: un XSS lo expondría. Se mitiga en SPEC-0005 (CSP, caducidad, alcance mínimo).
- **−** El repositorio público expone código y specs, nunca datos.
- El componente de gráficos se decide en SPEC-0009 y la librería de componentes UI en SPEC-0003.
