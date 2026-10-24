---
id: SPEC-0003
title: Identidad de marca y sistema de diseño
status: draft          # draft → approved (solo una persona) → implemented
summary: Renombrado a Míre, tokens de color (Noche y esmeralda, claro/oscuro, WCAG AA), Sora autoalojada, logotipo MĪRE, iconos, movimiento y guía de estilo verificable
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0002, ADR-0002, ADR-0003]
---

# SPEC-0003 · Identidad de marca y sistema de diseño

## Intención
Dar a la app su identidad definitiva, **Míre**, y un sistema de diseño único sobre el que se construyan todas las pantallas. Ese sistema reúne:
- tokens de color, tipografía, espaciado y movimiento;
- logotipo e iconos;
- componentes base;
- una guía de estilo dentro de la app que se verifica sola: contraste WCAG 2.2 AA y accesibilidad automática.

## Contexto
- `SPEC-0001` (draft por el renombrado): visión y MVP. Esta spec cubre su **CA-16** (sin scroll horizontal a 375 px) en las pantallas que crea.
- `SPEC-0002` (draft por el renombrado): esqueleto TypeScript/React/Vite/PWA. Esta spec se implementa **después**.
  - Rehace su pantalla de inicio y su manifiesto.
  - Respeta su **contrato de localizadores de e2e**, de modo que sus tests no se modifican.
- `ADR-0002` (accepted): stack.
- `ADR-0003` (proposed): librerías del sistema de diseño. **Se acepta junto con esta spec.**
- `docs/brand.md`: identidad verbal (nombre, lema, historia, tono de voz, ejemplos de textos).
- **Renombrado 2026-10-24**: «NÖM» ya existía como app de pagos QR para restaurantes. El propietario adopta **Míre** y renombra el repositorio a `mire-app/start`. ADR-0001 y ADR-0002 conservan el nombre antiguo como registro histórico.
- **Decisiones del propietario** (sesión de Analizar del 2026-10-24, tras ver propuestas visuales):
  - paleta «Noche y esmeralda», con más azul que verde;
  - Sora como tipografía;
  - logotipo «Bold equilibrada», icono «Noche clásica» y favicon «M con macrón»;
  - Material Symbols Rounded;
  - gastos en coral suave;
  - transición «deslizamiento direccional»;
  - movimiento sereno y funcional, que siempre respeta «reducir movimiento».
- **Spike de logotipo** (2026-10-24, descartado):
  - `opentype.js` lee `sora-latin-700-normal.woff` de `@fontsource/sora`;
  - genera un SVG de MĪRE solo con trazados, sin `<text>`;
  - el resultado se renderiza correctamente en Chromium.
- Versiones estables consultadas en npm el 2026-10-24, como referencia; se fijan exactas al implementar:

  | Paquete | Versión |
  |---|---|
  | `tailwindcss` y `@tailwindcss/vite` | 4.3.3 |
  | `@fontsource/sora` | 5.3.0 |
  | `@material-symbols/svg-400` | 0.48.1 |
  | `vite-plugin-svgr` | 5.2.0 |
  | `motion` | 14.6.0 |

## Cambio (delta)
### 1. Identidad
- **`docs/brand.md`** (nuevo, del proyecto): fuente de verdad de nombre, lema, tono de voz y textos de ejemplo.
- **`docs/project-context.md`**: sección «Product» con Míre, repositorio, URL y paleta, y backlog con SPEC-0003 renombrada.
- **`README.md`**: título «Míre», enlace a `docs/brand.md` y a la web.
- **Grafía**:
  - «Míre» en los textos de interfaz (es/en);
  - «MĪRE» solo en el logotipo;
  - `mire` en código, claves y ficheros.

### 2. Tokens de color (`src/design/tokens.css` y `src/design/tokens.ts`)
Son variables CSS sobre `:root` (tema claro) y `[data-theme="dark"]` (oscuro), expuestas como utilidades de Tailwind (`bg-surface`, `text-positive`…). `tokens.ts` contiene el mismo mapa para los tests.

| Token | Uso | Claro | Oscuro |
|---|---|---|---|
| `bg` | Fondo de la app | `#F8FAFC` | `#0B132B` |
| `surface` | Tarjetas, listas, diálogos, avisos | `#FFFFFF` | `#131D3D` |
| `text` | Texto principal | `#0B132B` | `#E8ECF5` |
| `muted` | Texto secundario | `#4A5570` | `#A3AECA` |
| `line` | Separadores decorativos y borde de tarjetas | `#DDE3EC` | `#253256` |
| `border-input` | Borde de campos, controles y barras de progreso | `#7C879E` | `#6576A0` |
| `top` / `on-top` | Barra superior y tooltip / su texto | `#0B132B` / `#F8FAFC` | `#131D3D` / `#E8ECF5` |
| `brand` / `on-brand` | Botón principal / su texto | `#0B132B` / `#F8FAFC` | `#E8ECF5` / `#0B132B` |
| `accent` | Enlaces; texto y borde del botón secundario (sin relleno) | `#2B4C9B` | `#8DA9F0` |
| `positive` | Ingresos y crecimiento (texto) | `#047857` | `#34D399` |
| `negative` | Gastos y errores (texto), coral suave | `#B4483C` | `#F29B8F` |
| `gold` | Valor y metas (texto) | `#7A5D10` | `#E5C158` |
| `gold-fill` | Relleno de barras de meta | `#E5C158` | `#E5C158` |
| `emerald-fill` | Rellenos; macrón del logotipo en oscuro | `#10B981` | `#10B981` |
| `focus` | Anillo de foco | `#047857` | `#34D399` |
| `track` | Pista de barras de progreso | `#E4E9F1` | `#253256` |
| `chart-1…6` | Escala de gráficas (de claro a intenso) | `#A7E8CF #7FDDB9 #4FCF9F #10B981 #0E9F6E #047857` | `#14503F #176A52 #1A8565 #10B981 #34D399 #6EE7B7` |

#### Reglas de contraste
- `text`, `muted`, `accent`, `positive`, `negative`, `gold` y cada `on-*` sobre su fondo: **≥ 4,5:1** sobre `bg` y `surface`.
- `border-input` y `focus`: **≥ 3:1**.
- `#10B981` y `#E5C158` **nunca** se usan como color de texto en tema claro.

#### Reglas de componentes y estados
- **Elementos gráficos** (WCAG 1.4.11):
  - `Progress` siempre lleva borde `border-input` de 1 px y su valor en texto (p. ej. «68 %»);
  - las gráficas de SPEC-0009 deberán llevar etiquetas o bordes, sin depender del contraste de `chart-*`.
- **Estados**:
  - *hover* de `brand` y `accent`: `color-mix(in srgb, <token> 88%, <on-token o bg>)`;
  - *deshabilitado*: opacidad 0,5 y `cursor: not-allowed` (exento de contraste según WCAG).
- **`Badge`**: variantes `neutral` (`text` sobre `track`), `positive`, `negative` y `gold`. Las tres últimas usan el texto de su token sobre `surface`, con borde del mismo token.
- **`Toast`**: `surface` con borde `line` y texto `text`; un icono y el color `negative` o `positive` indican el tipo.
- **`Tooltip`**: `top` / `on-top`.
- **Rojo**: no se usa rojo intenso; los errores usan `negative` con icono.

### 3. Importes: componente `Amount` (`src/ui/amount.tsx`)
API: `<Amount value={number} kind="income" | "expense" | "transfer" | "balance" />`. Renderiza un `<span data-kind="…">`.

| `kind` | Signo | Color | Ejemplo |
|---|---|---|---|
| `income` | `+` | `positive` | `+2.350,00 €` |
| `expense` | `−` (U+2212) | `negative` | `−84,20 €` (recibe `value` positivo o negativo y muestra el valor absoluto) |
| `transfer` | sin signo | `muted` | `500,00 €` |
| `balance` | `−` solo si es negativo | `text` | `48.215,30 €` / `−1.000,00 €` |

- El formato usa `formatEUR` de SPEC-0002, con `tabular-nums`.
- El signo nunca depende solo del color (WCAG 1.4.1).

### 4. Tipografía
- **Sora autoalojada** con `@fontsource/sora`: ficheros **estáticos** de **subconjunto latino**, pesos 400, 500, 600 y 700, importados como `@fontsource/sora/latin-<peso>.css`.
  - Los `.woff2` entran en el *precache* (glob de SPEC-0002, que ya incluye `woff2`).
  - Pila de respaldo: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- **Escala** (px): `12 / 14 / 16 (base) / 20 / 24 / 32 / 40`.
- **Interlineado**: 1,5 en texto y 1,2 en titulares.
- **Cifras**: importes y tablas con `tabular-nums`.

### 5. Espaciado, forma y elevación
- **Espaciado**: rejilla de 4 px (`4, 8, 12, 16, 24, 32, 48`); margen lateral mínimo de 16 px en móvil.
- **Radios**: 8 px en controles y 12 px en tarjetas y diálogos.
- **Sombras**: una sola sombra suave, solo en diálogos y menús. Las tarjetas se separan con borde `line`.

### 6. Logotipo e iconos
#### Logotipo «Bold equilibrada»
- MĪRE en Sora Bold, interletraje +0,02 em.
- Macrón rectangular centrado sobre la I: ancho 0,52 em y grosor 0,09 em. En `#047857` sobre fondo claro y `#10B981` sobre oscuro.
- Lo genera **`tools/build-logo.mjs`** (Node + `opentype.js` como `devDependency`) a partir de `@fontsource/sora/files/sora-latin-700-normal.woff`.
  - Escribe `src/brand/logo-light.svg`, `src/brand/logo-dark.svg` y `src/brand/logo-on-top.svg` (para la barra superior), solo con trazados.
  - Los SVG generados **se versionan**; el script se ejecuta a mano (`pnpm build:logo`), no en cada build.
- Espacio de respeto igual a la altura de la M; ancho mínimo de 64 px.

#### Icono de app «Noche clásica»
- Fondo `#0B132B`, palabra MĪRE en `#F8FAFC` y macrón `#10B981`.
- `public/icons/icon-192.png` e `icon-512.png`, con la palabra dentro del 80 % central.
- `icon-maskable-512.png`, con la palabra en el 66 % central, para las máscaras redondas de Android.
- Los genera el mismo script, rasterizando con Playwright (Chromium ya disponible).

#### Favicon «M con macrón»
- M `#F8FAFC` y barra `#10B981` sobre `#0B132B`.
- `public/favicon.svg` y `public/favicon-32.png`, generados por el mismo script.
- Solo para tamaños ≤ 32 px.

#### Iconos de interfaz
- **Material Symbols Rounded** de `@material-symbols/svg-400` (estilo `rounded`, relleno 0).
- Se importan como componentes React con `vite-plugin-svgr`, uno a uno (`…/rounded/<nombre>.svg?react`).
- Tamaños de 20 y 24 px, con color `currentColor`.
- Los iconos decorativos llevan `aria-hidden`; los botones de solo icono llevan `aria-label` traducido.

### 7. Temas
- **Modos**: Sistema (por defecto, según `prefers-color-scheme`), Claro y Oscuro.
- **Selector**: un `<select>` nativo con nombre accesible «Tema» / «Theme», en el cuerpo de la pantalla de inicio, junto al de idioma de SPEC-0002. No va en `TopBar`.
- **Persistencia**: la elección se guarda en `localStorage` con la clave `mire.theme`.
- **Sin destello**: un script en línea al inicio de `<head>`, en **`index.html` y `estilo.html`**, aplica `data-theme` antes del primer pintado.
- **Barra del navegador**: `<meta name="theme-color" content="#0B132B">` es **fijo** en ambos temas.

### 8. Movimiento
- **Tokens** (`src/design/motion.ts` y variables CSS):
  - duraciones: `fast` 150 ms, `base` 250 ms y `slow` 350 ms;
  - curva: `cubic-bezier(.2,.7,.2,1)`.
- **Deslizamiento direccional** entre pantallas principales: utilidad `navigate(direction: 'forward' | 'back', update: () => void)` en `src/design/motion.ts`.
  - Si hay `document.startViewTransition` y no se pide reducir movimiento, envuelve `update` en una View Transition.
  - Las clases `vt-forward` y `vt-back` en `<html>` eligen la animación CSS. Se ponen antes de llamar a `startViewTransition` y se retiran cuando termina (`transition.finished`). La pantalla nueva entra desde el lado hacia el que se navega (adelante = desde la derecha) y la anterior sale por el contrario con fundido, en `base`.
  - La barra superior tiene `view-transition-name: topbar` y queda fija; su título cambia con un fundido en `fast`.
  - Si se pide reducir movimiento, o no hay soporte, llama a `update` directamente, sin animación.
  - La usarán las specs con navegación (SPEC-0006).
- **Diálogos, menús y avisos**: entran y salen con **Motion** en `fast` (fundido y escala 0,98 → 1). Con reducir movimiento, solo hay fundido.

### 9. Componentes base (`src/ui/`, shadcn/ui adaptado a los tokens)
Se importan con el alias `@/` → `src/`, configurado en `tsconfig` y en `vite.config.ts`.
- **Controles**:
  - `Button`, con variantes `primary` (`brand`), `secondary` (borde y texto `accent`) y `ghost`, y alturas de 36 y 44 px;
  - `Input`, `Switch` y `Tabs`;
  - `Select` como **`<select>` nativo** con estilo, que se ve bien en el selector del sistema en Android y cumple el contrato de SPEC-0002.
- **Superposiciones**: `Dialog`, `DropdownMenu`, `Tooltip` y `Toast`.
- **Contenido**: `Card`, `Badge`, `Progress` (relleno `gold-fill`) y `Table`.
- **Propios de Míre**: `TopBar` (logotipo, título y acciones) y `Amount`.
- **Dependencias Radix**, según los componentes: `@radix-ui/react-dialog`, `-dropdown-menu`, `-tooltip`, `-toast`, `-switch`, `-tabs`, `-progress` y `-slot`.
- **Utilidades**: `class-variance-authority`, `clsx`, `tailwind-merge` y `motion`.
- Objetivos táctiles de ≥ 44 × 44 px en móvil, y foco visible con anillo `focus` de 2 px.

### 10. Guía de estilo (`estilo.html`)
- **Entrada propia de Vite**: `build.rollupOptions.input = { main: 'index.html', estilo: 'estilo.html' }`, con entrada `src/estilo/main.tsx`.
  - Inicializa la misma i18n (es/en) y el mismo tema.
  - Se sirve en `/start/estilo.html`, sin enlace desde la interfaz.
- **Service worker**: `navigateFallbackDenylist: [/estilo\.html$/]` en vite-plugin-pwa, para que el *fallback* de navegación no sirva `index.html` en su lugar.
- **Contenido**:
  - todos los tokens con su valor y el contraste calculado;
  - la escala tipográfica, el logotipo y los iconos;
  - todos los componentes con sus estados;
  - ejemplos de `Amount`;
  - una demo del deslizamiento direccional entre dos paneles, con botones «Siguiente» y «Anterior».

### 11. Pantalla de inicio de SPEC-0002
- Pasa a usar `TopBar` con el logotipo, los tokens y Sora. Su cuerpo contiene el selector de idioma, el de tema y la prueba de almacenamiento.
- Conserva **todos** los roles, nombres accesibles y `data-testid` del contrato de SPEC-0002.
- **Manifiesto definitivo**:
  - `name` y `short_name` «Míre»;
  - `theme_color` y `background_color` `#0B132B`;
  - iconos del punto 6.

### 12. Configuración y tests
- **`vite.config.ts`**:
  - plugins `@tailwindcss/vite` y `vite-plugin-svgr`;
  - la segunda entrada y el *denylist* del punto 10;
  - el alias `@/`.
- **`package.json`**: script `build:logo`, más las dependencias de los puntos 4, 6 y 9.
  - `devDependencies`: `opentype.js`, `@testing-library/react`, `jsdom` y `@axe-core/playwright`.
- **Vitest**:
  - `include` pasa a `src/**/*.test.{ts,tsx}`;
  - los tests `.tsx` declaran `// @vitest-environment jsdom`; los `.ts` siguen en el entorno `node`.
- **e2e nuevos** en `e2e/design/`, con un **presupuesto de 8 ficheros de test como máximo**. Las variantes parametrizadas (página × tema) cuentan dentro de su fichero. El límite real es el tiempo de CA-14.
- **`tsconfig`** incluye los tipos `vite-plugin-svgr/client` para las importaciones `?react`.
- **`tools/`** queda cubierto por ESLint, Prettier y `typecheck` (JS con `checkJs`).

## Fuera de alcance
- Nombres de los módulos de la app (Core, Gems, Flow, Future Equity): se deciden en las specs de cada función, traducidos a cada idioma.
- Pantallas de funcionalidad (cuentas, movimientos, importación, panel): SPEC-0006 a SPEC-0009.
- Librería de gráficas: SPEC-0009. Aquí solo se fija la escala `chart-1…6`.
- Otras transiciones (escalonado, cifras vivas, expansión de tarjeta): descartadas por el propietario.
- Registro de marca (EUIPO u OEPM) y web de presentación.
- ADR-0001 y ADR-0002 conservan «NÖM» como registro histórico.
- Ficheros del núcleo daeron que aún dicen NÖM: `CLAUDE.md`, `docs/guide.md`, `.arda/manifest.yaml` (`name`, `slug`) y `.claude/**`. No se editan desde aquí. Se actualizan regenerando la estructura con daeron-core, a cargo del propietario.

## Criterios de aceptación
1. **CA-01** · Un test unitario (Vitest) calcula el contraste WCAG desde `tokens.ts` en ambos temas y comprueba:
   - ≥ 4,5:1 para `text`, `muted`, `accent`, `positive`, `negative` y `gold` sobre `bg` y `surface`;
   - ≥ 4,5:1 para `on-top` sobre `top` y para `on-brand` sobre `brand`;
   - ≥ 3:1 para `border-input` y `focus` sobre `bg` y `surface`.
2. **CA-02** · `tokens.css` y `tokens.ts` tienen los mismos valores que la tabla del punto 2; un test analiza `tokens.css` y los compara.
3. **CA-03** · `Amount` (Testing Library, jsdom) muestra exactamente estos textos y `data-kind`:

   | Props | Texto | `data-kind` |
   |---|---|---|
   | `value=2350, kind="income"` | `+2.350,00 €` | `income` |
   | `value=-84.2, kind="expense"` | `−84,20 €` | `expense` |
   | `value=500, kind="transfer"` | `500,00 €` | `transfer` |
   | `value=-1000, kind="balance"` | `−1.000,00 €` | `balance` |

   En la tabla, ` ` es NBSP y `−` es U+2212. Cada `data-kind` lleva aplicada la clase del token de su color (`text-positive`, `text-negative`, `text-muted`, `text-text`).
4. **CA-04** · e2e: la guía de estilo y la pantalla de inicio no tienen infracciones de `@axe-core/playwright` (etiquetas `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`), ni en tema claro ni en oscuro.
5. **CA-05** · e2e de tema, en la pantalla de inicio y en la guía de estilo:
   - sin preferencia guardada, `data-theme` sigue a `prefers-color-scheme`, emulado claro y oscuro;
   - al elegir «Oscuro» en el selector «Tema» se aplica `data-theme="dark"`, y se mantiene tras recargar;
   - `data-theme` ya está puesto en el evento `DOMContentLoaded`.
6. **CA-06** · e2e de fuente sin conexión:
   - tras la primera visita y sin red, `await document.fonts.load('600 16px Sora')` devuelve al menos una `FontFace` con `status === 'loaded'`;
   - la petición del `.woff2` sale del propio origen (`/start/`);
   - en toda la prueba no hay peticiones a `fonts.googleapis.com` ni a `fonts.gstatic.com`.
7. **CA-07** · Iconos y logotipo:
   - el manifiesto declara `name: "Míre"`, `theme_color: "#0B132B"` y los iconos de 192 y 512 px, uno con `purpose: "maskable"`;
   - `index.html` enlaza `favicon.svg` y `favicon-32.png`;
   - los SVG de `src/brand/` no contienen `<text>`.
8. **CA-08** · e2e de movimiento en la demo de la guía de estilo, con un espía instalado con `page.addInitScript` que envuelve `document.startViewTransition` y cuenta las llamadas:
   - con `reducedMotion: 'no-preference'`, pulsar «Siguiente» llama una vez a `startViewTransition`, y el espía registra que `<html>` tenía la clase `vt-forward` en el momento de la llamada;
   - con `reducedMotion: 'reduce'`, no la llama, y el panel cambia igualmente.
9. **CA-09** · La pantalla de inicio y la guía de estilo no tienen scroll horizontal a 375 px (`scrollWidth <= clientWidth`). Cubre SPEC-0001 CA-16.
10. **CA-10** · Los textos de la guía de estilo y de la pantalla de inicio existen en `es.json` y `en.json`; un test falla si una clave falta en un idioma.
11. **CA-11** · Los botones de solo icono tienen `aria-label`, y los controles de `TopBar` y los selectores miden ≥ 44 × 44 px en el viewport móvil (e2e).
12. **CA-12** · Los e2e de SPEC-0002 (CA-05 a CA-08 de esa spec) pasan **sin modificar ningún fichero** de `e2e/` creado por SPEC-0002.
13. **CA-13** · `git grep -nE "NÖM|\bnom\b"` no encuentra nada en `src/`, `e2e/`, `public/`, `index.html`, `estilo.html`, `README.md` ni `docs/brand.md`. En `docs/project-context.md` solo aparece en líneas que contienen «formerly» o «historical» (las referencias históricas al nombre y al repositorio anteriores): `git grep -nE "NÖM|\bnom\b" docs/project-context.md | grep -viE "formerly|historical"` no devuelve nada.
14. **CA-14** · `.arda/checks.sh` completo sigue terminando en menos de 5 minutos en la sesión cloud (SPEC-0002 CA-09).
15. **CA-15** · El propietario valida visualmente, en su Android, el logotipo, el icono instalado, el favicon y los dos temas.

## Riesgos y preguntas abiertas
### Riesgos
- **Connotación en inglés**: *mire* significa «fango» (*mired in debt*). El propietario lo asume; la tilde y el macrón guían la pronunciación «mí-re».
- **Marca registrada**: una búsqueda web rápida no encontró ninguna app de finanzas llamada «Mire» (sí *Mirah*, de ahorro). Antes de un lanzamiento público conviene una búsqueda en EUIPO u OEPM; es una acción del propietario.
- **Script en línea del tema**: chocará con la CSP de SPEC-0005. Mitigación: SPEC-0005 permitirá ese script por su hash (`'sha256-…'`), en `index.html` y en `estilo.html`.
- **Mantenimiento de shadcn/ui**: los componentes copiados se mantienen a mano. Mitigación: solo los del punto 9.
- **View Transitions**: no está en Firefox ni en todos los WebKit; allí no hay animación (aceptado).
- **Tamaño de la PWA**: Sora en cuatro pesos, Motion e iconos. Mitigación: subconjunto latino, iconos uno a uno y Motion solo donde se usa.
- **Tiempo de los checks**: axe en 2 páginas × 2 temas, más tema, fuente y movimiento. Mitigación: presupuesto de 8 e2e nuevos y CA-14.
- **Alcance**: la spec es amplia. Si `/actuar` no cabe en una sesión de Claude Pro, se parte en dos (tokens, tipografía y temas por un lado; logotipo, componentes y guía por otro). Requeriría volver a Refinar.

### Preguntas abiertas
- Ninguna para el propietario: todas las decisiones de diseño están tomadas (2026-10-24).
