---
id: SPEC-0002
title: Stack tecnológico y checks del proyecto
status: draft          # draft → approved (solo una persona) → implemented
summary: Esqueleto de la app (TypeScript, React, Vite, SQLite WASM, PWA, i18n) según ADR-0002, .arda/checks.sh y despliegue en GitHub Pages
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, ADR-0001, ADR-0002]
---

# SPEC-0002 · Stack tecnológico y checks del proyecto

## Intención
Decidir el stack de NÖM (ADR-0002) y dejar un **esqueleto mínimo que funcione**, sobre el que se construirán las specs de funcionalidad. El esqueleto debe:
- compilar y pasar lint, tipos y tests;
- desplegarse gratis en GitHub Pages;
- instalarse como PWA y funcionar sin conexión;
- estar en español e inglés;
- guardar datos en SQLite local de forma persistente.

También crea `.arda/checks.sh`, que ejecutan el hook de parada y el CI.

## Contexto
- `SPEC-0001` (approved): alcance del MVP. Esta spec cubre **CA-15** (idiomas y formato es-ES), **CA-17** (coste 0 €) y su parte de **CA-18**.
- `ADR-0001` (accepted): local-first con sincronización cifrada en GitHub. Su verificación pendiente de los límites de GitHub se hace en ADR-0002, en la sección «Verificación de límites de GitHub».
- `ADR-0002` (proposed): stack elegido y alternativas. **Se acepta a la vez que se aprueba esta spec.**
- `.arda/tools/arda_ci.py` (`checks`) y `.claude/hooks/arda_guard.py` (`stop-checks`): ejecutan `.arda/checks.sh` en el CI y al final de cada turno de Claude, con un límite de 600 s.
- `.github/workflows/arda-gate.yml` es un fichero del núcleo y no se edita. Solo prepara Python, así que `checks.sh` tiene que conseguir Node, pnpm y Chromium por su cuenta.
- `nom-finance/app` es **público** desde el 2026-10-24 y no tiene licencia, por decisión del propietario.
- El móvil principal del propietario es **Android (Chrome)**, el mismo motor que los e2e.
- **Spike** del 2026-10-24 (descartado, no se fusiona):
  - Montaje: `@sqlite.org/sqlite-wasm` 3.54.1 con el VFS `opfs-sahpool` dentro de un Web Worker, servido sin cabeceras COOP/COEP (`crossOriginIsolated = false`, sin `SharedArrayBuffer`).
  - Resultado: Chromium crea la base de datos, escribe en ella y **conserva los datos tras recargar y tras reiniciar el navegador**.
- Comprobado en Node 22: `Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR'})` da `1234,56 €`, sin separador de miles en 4 cifras. Con `useGrouping: 'always'` da `1.234,56 €`, con NBSP (U+00A0) antes de `€`.

## Cambio (delta)
### Ficheros nuevos (proyecto)
- **`package.json`**:
  - scripts `dev`, `build`, `preview`, `lint`, `format:check`, `typecheck`, `test` y `test:e2e`;
  - dependencias con **versión exacta**;
  - `packageManager: pnpm@<versión exacta>` y `engines.node: ">=22 <23"`.
  - `@playwright/test` se fija a la **misma versión que el Playwright preinstalado** en la sesión cloud (hoy 1.63.0), para reutilizar su Chromium.
- **`.npmrc`** con `save-exact=true`, **`.nvmrc`** con `22` y **`pnpm-lock.yaml`**.
- **Configuración**:
  - `tsconfig*.json` en `strict`;
  - `vite.config.ts` con `base: '/app/'`, vite-plugin-pwa y la configuración de Vitest;
  - `eslint.config.js` (typescript-eslint y reglas de hooks de React) y `.prettierrc`;
  - `playwright.config.ts`: solo Chromium, servidor `vite preview` en el puerto **4873** con `strictPort: true` y `reuseExistingServer: false`.
- **`index.html`**, que enlaza el manifiesto PWA.
- **`src/`**, el esqueleto mínimo:
  - **`main.tsx` y `App.tsx`**: una única pantalla «Inicio» con el nombre NÖM, un selector de idioma es/en y la prueba de almacenamiento. Sin router (ver ADR-0002).
  - **`i18n/`**: i18next y react-i18next con `es.json` y `en.json`.
    - Español por defecto.
    - El idioma elegido se guarda en `localStorage` (clave `nom.lang`); si no se puede leer, se usa español.
    - Al cambiar de idioma se actualiza `<html lang>`.
  - **`format/`**:
    - `formatEUR(n)`: `Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR', useGrouping:'always'})`.
    - `formatDate(isoDate)`: trata `YYYY-MM-DD` como fecha sin hora; `Intl.DateTimeFormat('es-ES', {day:'2-digit', month:'2-digit', year:'numeric', timeZone:'UTC'})`.
  - **`db/`**: un Web Worker con SQLite WASM y `opfs-sahpool`, y un cliente tipado mínimo con dos operaciones, *abrir* y *ejecutar consulta*.
    - Usa un fichero propio del esqueleto, `/nom-smoke.sqlite3`, con la tabla `smoke(id INTEGER PRIMARY KEY CHECK (id = 1), n INTEGER NOT NULL)`.
    - SPEC-0004 lo eliminará al crear la base de datos real.
    - Si la base de datos no se puede abrir porque otra pestaña la tiene en uso, la pantalla muestra el aviso traducido «NÖM ya está abierto en otra pestaña» en lugar de fallar.
  - **Prueba de almacenamiento**: un botón «Probar almacenamiento» suma 1 a `smoke.n` y la pantalla muestra el valor actual.
- **Manifiesto PWA**:
  - `name: "NÖM"`, `short_name: "NÖM"`, `start_url` y `scope` iguales a `/app/`, y `display: "standalone"`;
  - iconos provisionales PNG de 192 y 512 px (el definitivo llega con SPEC-0003).
  - El *precache* de Workbox incluye `**/*.{js,css,html,wasm,png,svg,webmanifest}` y el worker de SQLite.
- **`src/**/*.test.ts`**: unitarios de `format/`.
- **`e2e/`**: tests Playwright sobre la build servida por `vite preview` en `/app/`, cada uno con un contexto de navegador nuevo (OPFS vacío). Ver CA-05 a CA-08.
- **`.arda/checks.sh`**: ver CA-09.
- **`.github/workflows/deploy.yml`**:
  - se lanza con `push` a `main`;
  - permisos `contents: read`, `pages: write` e `id-token: write`, y `environment: github-pages`;
  - pasos: `actions/checkout`, `bash .arda/checks.sh` (que ya genera `dist/`, así que no se compila dos veces), `actions/configure-pages`, `actions/upload-pages-artifact` con `dist/` y `actions/deploy-pages`;
  - cada action fijada a su versión mayor vigente;
  - `concurrency: pages`.

### Ficheros modificados
- **`.gitignore`**: `node_modules/`, `dist/`, `coverage/`, `playwright-report/`, `test-results/` y `.cache/`.
- **`README.md`**: requisitos (Node 22) y comandos: `corepack pnpm install`, `corepack pnpm dev` y `bash .arda/checks.sh`.
- **`docs/project-context.md`**, en «Current state»:
  - stack decidido (ADR-0002);
  - SPEC-0001 y ADR-0001 pasan a `approved`/`accepted`;
  - existe `.arda/checks.sh` y cómo omite los turnos solo de documentación.
- **`docs/specs/index.md`**: regenerado.

### Acción manual del propietario (antes de fusionar el PR de implementación)
- En *Settings → Pages* de `nom-finance/app`, elegir *Source: GitHub Actions*. Si no se hace antes del primer push a `main`, el primer despliegue falla.

## Fuera de alcance
- Modelo de datos y esquema SQLite reales, e importación: SPEC-0004.
- Paleta, tipografía, librería de componentes e iconos definitivos: SPEC-0003.
- Sincronización con GitHub, formato del registro de operaciones y conflictos: SPEC-0008. Esta spec solo fija las tecnologías.
- Cifrado, custodia de la clave, gestión del token, CSP y RGPD: SPEC-0005.
- Coordinación entre varias pestañas, más allá del aviso: SPEC-0006/0008.
- Router y navegación entre pantallas: SPEC-0006.
- Gráficos del panel: SPEC-0009.
- e2e en Safari/WebKit y Firefox.
- Licencia del código: el propietario decide no poner ninguna por ahora.

## Criterios de aceptación
1. **CA-01** · Instalación reproducible.
   - `corepack pnpm install --frozen-lockfile` funciona desde cero.
   - `checks.sh` falla si alguna dependencia de `package.json` no tiene versión exacta (empieza por `^` o `~`, o es un rango).
2. **CA-02** · `lint`, `format:check` y `typecheck` terminan sin errores, con TypeScript en `strict`.
3. **CA-03** · `test` (Vitest) pasa y comprueba exactamente:
   - `formatEUR(1234.56) === "1.234,56 €"`;
   - `formatEUR(-5) === "-5,00 €"`;
   - `formatDate("2026-10-24") === "24/10/2026"`, con cualquier valor de `TZ` (el test se ejecuta con `TZ=Pacific/Kiritimati` y con `TZ=America/Los_Angeles`).
4. **CA-04** · `build` genera un `dist/` estático que funciona servido bajo `/app/`.
5. **CA-05** · e2e de idioma.
   - La pantalla de inicio carga en español y `<html lang="es">`.
   - El selector la cambia a inglés (`<html lang="en">`) y el idioma se mantiene tras recargar.
   - Cubre SPEC-0001 CA-15.
6. **CA-06** · e2e de persistencia: sin cabeceras COOP/COEP, la prueba de almacenamiento muestra `0`; tras un clic muestra `1`, y tras recargar sigue mostrando `1`.
7. **CA-07** · e2e sin conexión.
   - Tras una primera visita, con el contexto sin red (`setOffline(true)`), la app recarga.
   - Un clic en la prueba de almacenamiento incrementa el valor, lo que demuestra que el `.wasm` y el worker están en *precache*.
   - El manifiesto enlazado desde `index.html` tiene `name`, `start_url` y `scope` iguales a `/app/`, `display: standalone` e iconos de 192 y 512 px.
8. **CA-08** · e2e de dos pestañas: con la app abierta en una página, una segunda página del mismo contexto muestra el aviso «NÖM ya está abierto en otra pestaña», y la primera sigue funcionando.
9. **CA-09** · `.arda/checks.sh`:
   - **Modo de omisión**: si no estamos en CI (`CI` no vale `true`) y todos los cambios frente a `origin/main` (commits y árbol de trabajo) están bajo `docs/`, termina con éxito sin ejecutar nada. Si no puede calcular los cambios, ejecuta todo.
   - **Node**: si `node` falta o no es 22.x, descarga la versión de `.nvmrc` desde nodejs.org en `.cache/node` y la antepone al `PATH`. Ejecuta pnpm con `corepack pnpm`, sin `sudo` ni instalación global.
   - **Chromium**: ejecuta `playwright install chromium`, que no hace nada si ya está. Añade `--with-deps` solo si `sudo -n true` funciona.
   - **Pasos**: en este orden, y parando en el primer fallo: instalación, versiones exactas (CA-01), lint, formato, tipos, unitarios, build y e2e.
   - **Entornos**: funciona en la sesión cloud de Claude Code y en `arda-gate` de GitHub Actions.
   - **Tiempo**: en la sesión cloud, con las dependencias ya instaladas, termina en menos de 5 minutos.
10. **CA-10** · El check `arda-gate` del PR de implementación queda en verde; incluye el *secret scan* sobre `pnpm-lock.yaml`.
11. **CA-11** · Tras fusionar en `main`, `deploy.yml` publica la app en `https://nom-finance.github.io/app/`. El propietario la abre en su Android, la instala y la prueba de almacenamiento persiste.
12. **CA-12** · Servicios gratuitos. Los únicos servicios usados son GitHub Pages, GitHub Actions (repositorio público), el registro npm y las descargas de Node.js y de Chromium para Playwright, todos sin coste. Cubre SPEC-0001 CA-17.
13. **CA-13** · Ningún fichero contiene un token, una clave ni datos reales.
14. **CA-14** · `README.md` explica cómo instalar, arrancar y ejecutar los checks, y `docs/project-context.md` refleja el stack decidido.

## Riesgos y preguntas abiertas
### Riesgos
- **Coste del hook de parada**: si hay cambios de código, `checks.sh` completo corre al final de cada turno de Claude. Mitigación: modo de omisión para turnos solo de documentación, pocos e2e solo en Chromium, y límite de 5 minutos (CA-09).
- **Playwright preinstalado**: si la sesión cloud cambia de versión, `playwright install chromium` descargará la que corresponda. Funciona, pero es más lento.
- **Falso positivo del *secret scan***: el patrón `sk-…` de `arda_ci.py` no tiene límite de palabra y podría coincidir con un nombre de paquete en `pnpm-lock.yaml`. `arda_ci.py` es un fichero del núcleo y no se edita. Si ocurre, se avisa al propietario y se reporta a daeron-core.
- **Una sola conexión SQLite** con `opfs-sahpool`: el esqueleto solo avisa (CA-08). La coordinación real va en SPEC-0006/0008.
- **Safari iOS**: no está probado. Hoy no aplica, porque el móvil principal es Android.
- **Ruta base `/app/`**: si el repositorio cambia de nombre o se usa un dominio propio, cambia `base`.
- **Repositorio público**: cualquier secreto que se suba queda expuesto. El *secret scan* del CI y el hook `protect-secrets` lo mitigan.
- **Node 22**: su soporte termina en abril de 2027. Hay que migrar antes, con su propia spec.

### Preguntas abiertas
- Ninguna para el propietario. Licencia, móvil principal, política del hook y versión de Node ya están decididos (2026-10-24).
