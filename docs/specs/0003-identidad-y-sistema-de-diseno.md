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
- los tokens de color, tipografía, espaciado y movimiento;
- el logotipo, los iconos y los componentes base;
- una guía de estilo dentro de la app que se verifica sola: contraste WCAG 2.2 AA y accesibilidad automática.

## Contexto
- `SPEC-0001` (draft): visión y MVP. Riesgo «alcance vs. plan Claude Pro»; CA-14 sin scroll horizontal a 375 px.
- `SPEC-0002` (draft): esqueleto TypeScript/React/Vite/PWA. Esta spec se implementa **después** y sustituye sus iconos provisionales.
- `ADR-0002` (accepted): stack. `ADR-0003` (proposed): librerías del sistema de diseño. **Se acepta junto con esta spec.**
- `docs/brand.md`: identidad verbal (nombre, lema, historia, tono de voz, ejemplos de textos).
- **Renombrado 2026-10-24**: «NÖM» ya existía como app de pagos QR para restaurantes. El propietario adopta **Míre** y renombra el repositorio a `mire-app/start`. ADR-0001 y ADR-0002 conservan el nombre antiguo como registro histórico.
- Decisiones del propietario en la sesión de Analizar del 2026-10-24, tras ver propuestas visuales:
  - paleta «Noche y esmeralda» (más azul que verde);
  - Sora como tipografía;
  - logotipo «Bold equilibrada» e icono «Noche clásica»;
  - favicon «M con macrón»;
  - Material Symbols Rounded;
  - gastos en coral suave;
  - transición «deslizamiento direccional»;
  - movimiento sereno y funcional, que siempre respeta «reducir movimiento».

## Cambio (delta)
### 1. Identidad
- `docs/brand.md` (nuevo, del proyecto): fuente de verdad del nombre, lema, tono de voz y textos de ejemplo.
- `docs/project-context.md`: sección «Product» con Míre, repositorio, URL y paleta; backlog con SPEC-0003 renombrada.
- Grafía:
  - «Míre» en los textos de interfaz (es/en);
  - «MĪRE» solo en el logotipo;
  - `mire` en el código, las claves y los ficheros.

### 2. Tokens de color (`src/design/tokens.css` y `src/design/tokens.ts`)
Variables CSS sobre `:root` (tema claro) y `[data-theme="dark"]` (tema oscuro), y el mismo mapa en TypeScript para los tests.

| Token | Uso | Claro | Oscuro |
|---|---|---|---|
| `bg` | Fondo de la app | `#F8FAFC` | `#0B132B` |
| `surface` | Tarjetas, listas, diálogos | `#FFFFFF` | `#131D3D` |
| `text` | Texto principal | `#0B132B` | `#E8ECF5` |
| `muted` | Texto secundario | `#4A5570` | `#A3AECA` |
| `line` | Separadores decorativos | `#DDE3EC` | `#253256` |
| `border-input` | Borde de campos y controles | `#7C879E` | `#6576A0` |
| `top` / `on-top` | Barra superior / su texto | `#0B132B` / `#F8FAFC` | `#131D3D` / `#E8ECF5` |
| `brand` / `on-brand` | Botón principal / su texto | `#0B132B` / `#F8FAFC` | `#E8ECF5` / `#0B132B` |
| `accent` | Enlaces y botón secundario | `#2B4C9B` | `#8DA9F0` |
| `positive` | Ingresos y crecimiento (texto) | `#047857` | `#34D399` |
| `negative` | Gastos y errores (texto), coral suave | `#B4483C` | `#F29B8F` |
| `gold` | Valor y metas (texto) | `#7A5D10` | `#E5C158` |
| `gold-fill` | Barras de meta y destellos de valor | `#E5C158` | `#E5C158` |
| `emerald-fill` | Rellenos y macrón del logotipo en oscuro | `#10B981` | `#10B981` |
| `focus` | Anillo de foco | `#047857` | `#34D399` |
| `track` | Pista de barras de progreso | `#E4E9F1` | `#253256` |
| `chart-1…6` | Escala de gráficas (de claro a intenso) | `#A7E8CF #7FDDB9 #4FCF9F #10B981 #0E9F6E #047857` | `#14503F #176A52 #1A8565 #10B981 #34D399 #6EE7B7` |

Reglas:
- **Mínimos de contraste**:
  - `text`, `muted`, `accent`, `positive`, `negative`, `gold` y `on-*` alcanzan ≥ 4,5:1 sobre `bg` y `surface` (y `on-*` sobre su fondo);
  - `border-input` y `focus` alcanzan ≥ 3:1 sobre `bg` y `surface`.
- **Rellenos**: `#10B981` y `#E5C158` no se usan nunca como color de texto en tema claro, solo como relleno.
- **Rojo**: no se usa rojo intenso; los errores usan `negative` acompañado de un icono.

### 3. Importes (componente `Amount`)
| Caso | Signo | Color | Ejemplo |
|---|---|---|---|
| Ingreso | `+` | `positive` | `+2.350,00 €` |
| Gasto | `−` (U+2212) | `negative` | `−84,20 €` |
| Traspaso | sin signo | `muted` | `500,00 €` |
| Saldo o patrimonio | signo solo si es negativo | `text` | `48.215,30 €` |

- El formato usa `formatEUR` de SPEC-0002, con cifras tabulares (`font-variant-numeric: tabular-nums`).
- El signo nunca depende solo del color (WCAG 1.4.1).

### 4. Tipografía
- **Sora** autoalojada (Fontsource, OFL), en pesos 400, 500, 600 y 700, incluida en el *precache* de la PWA.
- Pila de respaldo: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Escala en px: `12 / 14 / 16 (base) / 20 / 24 / 32 / 40`; interlineado 1,5 en texto y 1,2 en titulares.
- Importes y tablas con `tabular-nums`.

### 5. Espaciado, forma y elevación
- **Espaciado**: rejilla de 4 px (`4, 8, 12, 16, 24, 32, 48`); margen lateral mínimo de 16 px en móvil.
- **Radios**: 8 px en controles y 12 px en tarjetas y diálogos.
- **Sombras**: una sola, suave, reservada a diálogos y menús. Las tarjetas se separan con borde (`line`).

### 6. Logotipo e iconos (`src/brand/` y `public/`)
- **Logotipo «Bold equilibrada»**:
  - MĪRE en Sora Bold, interletraje +0,02 em, macrón rectangular centrado sobre la I (ancho 0,52 em, grosor 0,09 em);
  - macrón `#047857` sobre fondo claro y `#10B981` sobre oscuro;
  - **vectorizado** en SVG, con letras convertidas a trazados y sin depender de la fuente;
  - versiones `logo-light.svg` y `logo-dark.svg`;
  - espacio de respeto igual a la altura de la M y ancho mínimo de 64 px.
- **Icono de app «Noche clásica»**: fondo `#0B132B`, palabra MĪRE en `#F8FAFC` y macrón `#10B981`.
  - PNG de 192 y 512 px, con la palabra dentro de la zona segura del 80 %.
  - Versión `maskable` de 512 px con la palabra en el 66 % central, para las máscaras redondas de Android.
- **Favicon**: «M con macrón» (M `#F8FAFC` y barra `#10B981` sobre `#0B132B`), en SVG y PNG de 32 px. Solo para tamaños ≤ 32 px.
- **Iconos de interfaz**: Material Symbols **Rounded**, peso 400, relleno 0, tamaños 20 y 24 px, importados como SVG individuales y con color `currentColor`.
  - Los iconos decorativos llevan `aria-hidden`.
  - Los botones que solo tienen icono llevan `aria-label` traducido.

### 7. Temas
- Tres modos: **Sistema** (por defecto, según `prefers-color-scheme`), **Claro** y **Oscuro**.
- El selector va en la pantalla de inicio, junto al de idioma, y la elección se guarda en `localStorage` (`mire.theme`).
- Un script en línea dentro de `index.html` aplica `data-theme` antes del primer pintado, para que no haya destello de tema equivocado.
- `<meta name="theme-color">` sigue al tema (`#0B132B` en ambos, porque la barra superior es Deep Night).

### 8. Movimiento
- **Tokens**:
  - duraciones `fast 150 ms`, `base 250 ms` y `slow 350 ms`;
  - curva `cubic-bezier(.2,.7,.2,1)`.
- **Deslizamiento direccional** entre pantallas principales, con View Transitions:
  - la barra superior queda fija;
  - la pantalla nueva entra desde el lado hacia el que se navega (adelante = desde la derecha);
  - la anterior sale por el lado contrario con fundido, en `base` 250 ms;
  - el título de la barra cambia con un fundido en `fast`.
  - Se implementa como la utilidad `navigate(direction, update)` en `src/design/motion.ts`, que usarán las specs con navegación (SPEC-0006).
- **Componentes**: diálogos, menús y avisos entran y salen en `fast` (Motion o las animaciones de Radix).
- **Reducir movimiento**: con `prefers-reduced-motion: reduce` no hay desplazamientos; el cambio es un fundido de ≤ 100 ms o instantáneo.
- **Sin soporte de View Transitions**: el cambio es instantáneo.

### 9. Componentes base (`src/ui/`, shadcn/ui adaptado a los tokens)
- Controles: `Button` (principal, secundario, fantasma; tamaños 36 y 44 px), `Input`, `Select`, `Switch`, `Tabs`.
- Superposiciones y contenedores: `Dialog`, `DropdownMenu`, `Tooltip`, `Toast`, `Card`.
- Datos: `Badge`, `Progress` (con `gold-fill`), `Table`.
- Propios de Míre: `TopBar` (logotipo + título + acciones) y `Amount` (punto 3).
- Objetivos táctiles de ≥ 44 × 44 px en móvil y foco visible con anillo `focus` de 2 px.

### 10. Guía de estilo (`estilo.html`)
- Segunda entrada de Vite, servida en `/start/estilo.html` y sin enlace desde la interfaz. No necesita router.
- Muestra todos los tokens con su valor y contraste calculado, la escala tipográfica, el logotipo y los iconos, todos los componentes y sus estados, ejemplos de `Amount` y una demo del deslizamiento direccional entre dos paneles.
- Todos sus textos están en es/en (i18n de SPEC-0002).

### 11. Pantalla de inicio de SPEC-0002
- Pasa a usar `TopBar` con el logotipo, los tokens, Sora y los selectores de idioma y tema.
- Sus iconos y manifiesto pasan a los definitivos de esta spec (nombre «Míre», `theme_color` y `background_color` `#0B132B`).

## Fuera de alcance
- Nombres de los módulos de la app (Core, Gems, Flow, Future Equity): se deciden en las specs de cada función, traducidos a cada idioma.
- Pantallas de funcionalidad (cuentas, movimientos, importación, panel): SPEC-0006 a SPEC-0009.
- Librería de gráficas: SPEC-0009. Aquí solo se fija la escala `chart-1…6`.
- Otras transiciones (escalonado, cifras vivas, expansión de tarjeta): descartadas por el propietario.
- Registro de marca (EUIPO u OEPM) y web de presentación.
- Mantener actualizados ADR-0001 y ADR-0002: conservan «NÖM» como registro histórico.

## Criterios de aceptación
1. **CA-01** · Contraste de tokens, con un test unitario (Vitest) que calcula el contraste WCAG desde `tokens.ts` en ambos temas:
   - ≥ 4,5:1 para `text`, `muted`, `accent`, `positive`, `negative` y `gold` sobre `bg` y `surface`;
   - ≥ 4,5:1 para `on-top` sobre `top` y `on-brand` sobre `brand`;
   - ≥ 3:1 para `border-input` y `focus` sobre `bg` y `surface`.
2. **CA-02** · `tokens.css` y `tokens.ts` tienen los mismos valores que la tabla del punto 2; un test los compara.
3. **CA-03** · `Amount` da exactamente:
   - `+2.350,00 €` con clase de color `positive`;
   - `−84,20 €` con `negative`, usando U+2212 y NBSP antes de `€`;
   - traspaso `500,00 €` con `muted`;
   - saldo negativo `−1.000,00 €` con `text`.
   El test se hace con Testing Library.
4. **CA-04** · e2e: la guía de estilo y la pantalla de inicio **no tienen infracciones** de `@axe-core/playwright` (reglas WCAG 2.2 A y AA) en tema claro ni en oscuro.
5. **CA-05** · Temas en e2e:
   - sin preferencia guardada, el tema sigue a `prefers-color-scheme` (emulado claro y oscuro);
   - al elegir «Oscuro» se aplica `data-theme="dark"` y se mantiene tras recargar;
   - no hay destello: `data-theme` ya está puesto en `DOMContentLoaded`.
6. **CA-06** · e2e sin conexión: tras la primera visita, la pantalla de inicio sin red muestra Sora (`document.fonts.check('16px Sora')` es verdadero), y no hay peticiones a `fonts.googleapis.com` ni a `fonts.gstatic.com` en ningún momento.
7. **CA-07** · Iconos y logotipo:
   - el manifiesto declara los iconos de 192 y 512 px, uno con `purpose: "maskable"`, `name: "Míre"` y `theme_color: "#0B132B"`;
   - `index.html` enlaza el favicon SVG y su PNG de 32 px;
   - los SVG del logotipo no contienen `<text>`, solo trazados.
8. **CA-08** · Movimiento en e2e:
   - en la demo de la guía de estilo, con `reducedMotion: 'no-preference'`, `navigate('forward')` usa `document.startViewTransition`;
   - con `reducedMotion: 'reduce'` no se aplica ninguna animación de desplazamiento (no hay `transform` en los pseudoelementos de la transición).
9. **CA-09** · La pantalla de inicio y la guía de estilo no tienen scroll horizontal a 375 px de ancho. Cubre SPEC-0001 CA-14.
10. **CA-10** · Los textos de la guía de estilo y de la pantalla de inicio existen en `es.json` y `en.json`; un test falla si una clave falta en un idioma.
11. **CA-11** · Los botones de solo icono tienen `aria-label`, y los objetivos táctiles miden ≥ 44 × 44 px en el viewport móvil (comprobado en e2e para `TopBar` y los selectores).
12. **CA-12** · `docs/brand.md` y `docs/project-context.md` reflejan el nombre, la grafía, el repositorio y la paleta de esta spec. No quedan apariciones de «NÖM» ni de `nom` como identificador en `src/`, `index.html`, `estilo.html` ni `public/`.
13. **CA-13** · El propietario valida visualmente, en su Android, el logotipo, el icono instalado, el favicon y los dos temas.

## Riesgos y preguntas abiertas
### Riesgos
- **Connotación en inglés**: *mire* significa «fango» (*mired in debt*). El propietario lo asume; la tilde y el macrón guían la pronunciación «mí-re».
- **Marca registrada**: una búsqueda web rápida no encontró ninguna app de finanzas llamada «Mire» (sí *Mirah*, de ahorro). Antes de un lanzamiento público conviene una búsqueda en EUIPO u OEPM. Es una acción del propietario.
- **Logotipo vectorizado**: convertir Sora a trazados requiere herramienta (p. ej. `opentype.js` en un script de build o en un *spike*). Si no es fiable, se dibuja el SVG a mano a partir de las métricas de Sora.
- **Coste de shadcn/ui**: los componentes copiados se mantienen a mano. Mitigación: solo los del punto 9.
- **View Transitions** no está en Firefox ni en todos los WebKit; allí no hay animación (aceptado).
- **Tamaño de la PWA**: Sora en cuatro pesos, Motion e iconos. Mitigación: usar subconjunto latino de la fuente e importar los iconos uno a uno.
- **Alcance**: la spec es amplia. Si `/actuar` no cabe en una sesión de Claude Pro, se puede partir en dos: tokens, tipografía y temas por un lado; logotipo, componentes y guía por otro. Requeriría volver a Refinar.

### Preguntas abiertas
- Ninguna para el propietario; todas las decisiones de diseño están tomadas (2026-10-24).
