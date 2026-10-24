---
id: SPEC-0009
title: Panel en Inicio: evolución del patrimonio, resumen del mes y reparto por tipo
status: draft          # draft → approved (solo una persona) → implemented
summary: Inicio pasa a ser el panel: variación del patrimonio, gráfico de área de la evolución mensual (6 meses, 1 año, todo) en SVG propio accesible, resumen del mes con ingresos, gastos y ahorrado y barras por categoría que llevan a Movimientos, y reparto por tipo de cuenta desplegable
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0002, SPEC-0003, SPEC-0004, SPEC-0006, SPEC-0007, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0015, SPEC-0016, SPEC-0020, ADR-0002]
---

# SPEC-0009 · Panel en Inicio: evolución del patrimonio, resumen del mes y reparto por tipo

## Intención
Que al abrir Míre se vea **de un vistazo**:
- cuánto vale el patrimonio y cómo ha cambiado;
- cómo evoluciona mes a mes;
- en qué se va el dinero cada mes.

Desde cada dato se llega a los movimientos que lo explican.

## Contexto
- `SPEC-0001` (draft): función 7, CA-09 (evolución mensual y desglose por tipo), CA-10 y CA-16.
- `SPEC-0003`: tokens de color y sus reglas de contraste, `Progress`, `Amount`, movimiento (`fast`, `base`, `slow`) y axe.
  - Las gráficas de esta spec deben llevar etiquetas o bordes, sin depender del contraste de `chart-*`.
- `SPEC-0002`: `formatEUR` (`useGrouping: 'always'`) e i18n. `ADR-0002`: delega en esta spec la forma de dibujar los gráficos.
- `SPEC-0004`:
  - `netWorthAt`, `balanceAt` e `investmentValueAt`, que incluyen las cuentas archivadas;
  - `countsAsIncomeOrExpense`;
  - redondeo alejándose de cero;
  - consultas en `src/db/repo/queries.ts`.
- `SPEC-0006`: Inicio, con la región «Patrimonio», los grupos y las cuentas por tipo.
- `SPEC-0007`: categorías de dos niveles, iconos y `categoryLabel`.
- `SPEC-0015`: valores de URL de los filtros (`mes`, `tipo=gasto|ingreso`, `categoria=<id>|sin`); una categoría padre incluye a sus hijas.
- `SPEC-0016`: datos de ejemplo, con un patrimonio de 1186640 a 2026-10-24.
- `SPEC-0010` y `SPEC-0011`: importación de `bbva-informe.xlsx`.
- `SPEC-0013`: el borrado elimina las claves `mire.*` del almacenamiento local.
- `SPEC-0020`: tarjeta de sincronización en Inicio.
- **Decisiones del propietario** (2026-10-24):
  - el panel va **dentro de Inicio**, sin pestaña nueva;
  - evolución en un **gráfico de área** con selector de periodo;
  - resumen del mes en **barras horizontales** por categoría;
  - gráficos **sin librería**: el área en SVG propio y las barras en HTML y CSS.
- **Orden de implementación**: el último del backlog.

## Cambio (delta)
### 1. Orden de Inicio (`#/`)
1. Región **«Patrimonio»** (SPEC-0006), con una línea nueva: «<variación> desde fin de mes anterior».
   - La variación usa `Amount kind="income"` si es ≥ 0 (con «+», también en «+0,00 €») y `kind="expense"` si es negativa.
   - Le sigue el porcentaje entre paréntesis, con un decimal, `signDisplay: 'exceptZero'` y el espacio duro del idioma (`+49,3 %`).
   - Si el patrimonio a fin del mes anterior es ≤ 0, solo se muestra el importe.
   - Si no hay mes anterior con datos, la línea no aparece.
2. Tarjeta de sincronización (SPEC-0020), si procede.
3. **Evolución** (punto 2).
4. **Resumen del mes** (punto 3).
5. **Reparto por tipo** (punto 4).
6. Grupos y cuentas (SPEC-0006), sin cambios.

**Sin datos**: Inicio sigue mostrando solo el estado vacío de SPEC-0006.

**Textos que no se repiten con SPEC-0006**:
- las secciones del panel son regiones con nombre (`<section aria-labelledby>`), con los encabezados «Evolución», «Resumen del mes» y «Reparto por tipo». No contienen «Patrimonio» ni «Ahorro», y en inglés no contienen «Net worth» ni «Savings»;
- la cifra del mes se llama **«Ahorrado»**;
- por defecto no se renderiza ningún importe de cuenta, grupo o tipo: el valor de un punto del gráfico solo aparece al enfocarlo o señalarlo, la tabla alternativa al pedirla, y el reparto por tipo al desplegarlo.

**Recalcular**: el cliente de la base de datos (`src/db/client.ts`) emite `dataChanged` tras cada llamada marcada como escritura en el mapa de la API (SPEC-0004) y cuando el worker avisa de que terminó una fusión (SPEC-0008). Inicio vuelve a pedir el panel al montarse y con ese evento.

### 2. Evolución del patrimonio
**Serie** (`src/domain/dashboard.ts`, puro): `netWorthSeries(accounts, movements, valuations, fromMonth, today)` → `{ month: 'AAAA-MM', cents }[]`.
- Un punto por mes: `netWorthAt` en el **último día** del mes, salvo el mes en curso, que usa `today`.
- Empieza en el mes más antiguo con datos (apertura, movimiento o valoración), o en `fromMonth` si es posterior.

**Periodo**:
- grupo de botones de opción (`radiogroup`) **«6 meses» / «1 año» / «Todo»**, con «1 año» por defecto;
- se guarda en `localStorage` con la clave `mire.panel.periodo`;
- «6 meses» y «1 año» son los últimos 6 o 12 meses, incluido el actual.

**Gráfico** (`src/components/charts/AreaChart.tsx`, SVG en un `<figure>` dentro de la región «Evolución»; el encabezado de la región es su único título visible):
- **Colores**, solo tokens de SPEC-0003, iguales en claro y en oscuro:
  - la línea, de 2 px, en `positive` (≥ 4,5:1);
  - el relleno, decorativo, en `chart-1` al 40 %;
  - la rejilla en `line` y las etiquetas de los ejes en `muted`;
  - los puntos son círculos de 6 px en `positive` con borde `surface`;
  - el foco usa un anillo `focus`.
- **Ejes**:
  - el eje Y va de `min(0, mínimo)` a `máximo`, con 3 marcas redondeadas y la línea del 0 en `border-input` si hay valores negativos. El formato es compacto del idioma (`Intl.NumberFormat` con `notation: 'compact'`, seguido de «€»);
  - el eje X lleva el mes abreviado del idioma;
  - el `viewBox` se adapta al ancho, con 200 px de alto.
- **Estructura accesible**:
  - el SVG tiene `role="group"`, `aria-roledescription="gráfico"` y `aria-label` «Evolución: de septiembre de 2026 a octubre de 2026, de 7.948,44 € a 11.866,40 €»;
  - cada punto es un `<g role="img">` con `aria-label` «septiembre de 2026: 7.948,44 € (+49,3 %)», donde la variación es respecto al anterior;
  - `tabindex` itinerante: solo el último punto es tabulable. Las flechas izquierda y derecha y Home/End lo mueven;
  - **ningún punto está enfocado por defecto**.
- **Etiqueta visible**: el punto enfocado o el más cercano al puntero (zona de impacto de al menos 24 px de ancho) muestra su texto en un `Tooltip` (`top` / `on-top`).
- **«Ver como tabla»**: botón con `aria-expanded`. Al pulsarlo se monta una tabla con mes, patrimonio y variación.
- **Movimiento**: el área entra con una transición `slow` (350 ms), salvo si se pide reducir movimiento. La detección es la de `navigate` de SPEC-0003, extraída a `prefersReducedMotion()` en `src/design/motion.ts` sin cambiar su comportamiento.
- **Un solo mes con datos**: en lugar del gráfico, «La evolución aparecerá cuando tengas datos de más de un mes».

### 3. Resumen del mes
**Meses disponibles**: desde el mes más antiguo con algún movimiento que **cuenta** (`countsAsIncomeOrExpense`) hasta el mes actual.
- Por defecto se muestra el mes actual si tiene movimientos que cuentan; si no, el más reciente que los tenga.
- Si no hay ninguno (p. ej. solo se ha importado la cartera en PDF), la sección muestra «Aún no hay ingresos ni gastos», sin selector.

**Selector**:
- botones **«Mes anterior»** y **«Mes siguiente»** (deshabilitados en los extremos), con el mes en una región `aria-live="polite"`;
- el mes elegido se guarda en `sessionStorage` (`mire.panel.mes`), así que se conserva al volver de Movimientos. No es un dato sensible y caduca con la pestaña; aun así, el borrado de SPEC-0013 también lo elimina.

**Cifras** (`monthlySummary(movements, categories, month)`, puro), solo con los movimientos que cuentan:

| Cifra | Cálculo | `Amount` | Ejemplo |
|---|---|---|---|
| **Ingresos** | suma de los positivos | `income` | `+2.015,00 €` |
| **Gastos** | suma de los negativos, en valor absoluto | `expense` | `−676,56 €` |
| **Ahorrado** | ingresos − gastos | `income` si ≥ 0, `expense` si < 0 | — |

**Barras** (HTML y CSS):
- **Selector**: un `radiogroup` **«Gastos» / «Ingresos»**, con Gastos por defecto.
- **Agrupación y orden**: por **categoría padre**, sumando sus subcategorías, más «Sin categoría»; de mayor a menor.
- **Cada fila**:
  - el icono, el nombre (`categoryLabel`) y el importe (`Amount kind="balance"`, sin signo);
  - el porcentaje como texto, con un decimal;
  - una barra con el patrón `Progress` de SPEC-0003: pista `track`, relleno `chart-4`, borde `border-input` de 1 px y ancho proporcional a la fila mayor.
- **Enlace**: cada fila lleva a `#/movimientos?mes=AAAA-MM&tipo=gasto|ingreso&categoria=<id>|sin` (SPEC-0015).
- **Mes sin movimientos que cuentan**: «Sin movimientos en <mes>».

**Nota**: «No incluye traspasos entre tus cuentas ni aportaciones externas» (SPEC-0001 CA-10 y CA-20).

### 4. Reparto por tipo
- **Forma**: un *disclosure* controlado.
  - El botón **«Reparto por tipo»** lleva `aria-expanded` y `aria-controls`.
  - Su contenido solo se monta al abrirlo: no se usa `<details>`.
  - Está cerrado por defecto.
- **Contenido**: una barra (`Progress`) por tipo con saldo distinto de 0 (Corriente, Ahorro, Efectivo, Inversión), con importe y porcentaje del patrimonio, archivadas incluidas.
- **Totales negativos o cero**: si algún tipo es negativo o el total es ≤ 0, se muestran los importes sin barras ni porcentajes.

### 5. Datos y API del worker
**Métodos nuevos** (`src/db/repo/queries.ts`, que llaman al dominio):
- `dashboard.series({ period, today })` → `{ month, cents }[]`;
- `dashboard.month({ month?, today })` → `{ month, months: string[], incomeCents, expenseCents, savedCents, byCategory: { expense: Row[], income: Row[] } }`.
  - `month` es el mes resuelto (el pedido, o el de por defecto si no se pasa), o `null` si `months` está vacío.
  - `Row = { categoryId: string | null, cents: number, sharePermille: number }`.
- `dashboard.byType({ today })` → `{ type, cents, sharePermille }[]`.

**Porcentajes**: los calcula el dominio en milésimas enteras, redondeando alejándose de cero (como SPEC-0004). Por ejemplo, 916 se muestra como «91,6 %».

**Fecha de hoy**: llega del cliente como `AAAA-MM-DD` en hora local. Así los e2e la controlan con `page.clock`, aunque el reloj no afecte al worker.

**Rendimiento**: cada consulta carga una sola vez los movimientos y las valoraciones vivos y calcula todos los meses en memoria.

**Textos**: todos tienen clave en `es.json` y `en.json`, con el formato de fechas y números del idioma activo.

## Fuera de alcance
- Presupuestos, previsiones, objetivos de ahorro y comparación entre años.
- Gráficos por cuenta o por grupo, y rentabilidad de las inversiones.
- Exportar los gráficos.

## Criterios de aceptación
**Condiciones de los e2e**:
- `page.clock.install({ time: new Date('2026-10-24T12:00:00') })`, en hora local;
- cada CA arranca en un contexto nuevo, así que `mire.panel.*` empieza vacío; la excepción es CA-06, que continúa en el contexto de CA-04;
- las comprobaciones de texto se acotan a la región de cada CA, con `toContainText` y espacios normalizados (los importes y porcentajes llevan espacio duro).

**Ficheros e2e** (como máximo 3):
- `panel-ejemplo.spec.ts`, con los datos de ejemplo de SPEC-0016: CA-03 y CA-05;
- `panel-bbva.spec.ts`, con `bbva-informe.xlsx` importado mediante SPEC-0010 (traspaso de las filas 2 y 3 activado y siembra de SPEC-0007): CA-04 y CA-06;
- `panel-a11y.spec.ts`: CA-10, con los datos de ejemplo.

1. **CA-01** · Serie (Vitest), con los datos de ejemplo de SPEC-0016:
   - con «Todo» y `today = 2026-10-24`, da `[{ 2026-09, 794844 }, { 2026-10, 1186640 }]`;
   - con `today = 2026-10-23` (la valoración del 24 aún no cuenta), da `[{ 2026-09, 794844 }, { 2026-10, 794844 }]`;
   - con «6 meses», empieza igualmente en 2026-09; con `fromMonth = 2026-10`, solo da octubre;
   - una cuenta archivada sigue contando.
2. **CA-02** · Resumen y casos límite (Vitest):
   - **datos de ejemplo**: septiembre de 2026 da ingresos 200000, gastos 5156 y ahorrado 194844. Los traspasos no cuentan;
   - **`bbva-informe.xlsx`**, con el traspaso de las filas 2 y 3 aceptado y las categorías sugeridas aplicadas:
     - septiembre da ingresos 201500 y gastos 67656;
     - gastos por categoría: «Sin categoría» 62000 (916 ‰), «Transporte» 5156 (76 ‰) y «Ocio» 500 (7 ‰);
   - una aportación externa no cuenta como ingreso;
   - con solo valoraciones (PDF), `months` está vacío;
   - con el patrimonio del mes anterior en 0, la variación no lleva porcentaje;
   - con un tipo negativo, `byType` no se muestra en barras (componente).
3. **CA-03** · Inicio con datos de ejemplo (e2e):
   - la región «Patrimonio» dice «+3.917,96 € (+49,3 %) desde fin de mes anterior»;
   - en «Evolución», el SVG tiene 2 puntos con rol `img`;
   - al tabular hasta el último y pulsar la flecha izquierda, el `Tooltip` dice «septiembre de 2026: 7.948,44 €»;
   - «Ver como tabla» muestra 2 filas;
   - con «6 meses» siguen 2 puntos, y el periodo elegido se conserva al recargar.
   - Cubre SPEC-0001 CA-09 (evolución mensual).
4. **CA-04** · Resumen del mes (e2e, dentro de la región «Resumen del mes»):
   - abre en septiembre de 2026, porque octubre no tiene movimientos;
   - muestra Ingresos `+2.015,00 €`, Gastos `−676,56 €` y Ahorrado `+1.338,44 €`;
   - las barras de gastos son «Sin categoría», «Transporte» y «Ocio», en ese orden, con «91,6 %»;
   - «Ingresos» muestra «Salarios, rentas y subsidios» y «Otros ingresos»;
   - «Mes siguiente» lleva a octubre de 2026, que muestra «Sin movimientos en octubre de 2026», y allí el botón queda deshabilitado.
   - Cubre SPEC-0001 CA-10.
5. **CA-05** · Reparto por tipo (e2e, datos de ejemplo):
   - cerrado, la sección no contiene importes;
   - abierto, muestra Corriente `2.148,44 €` (18,1 %), Ahorro `5.300,00 €` (44,7 %) e Inversión `4.417,96 €` (37,2 %), sin Efectivo.
   - Cubre SPEC-0001 CA-09 (reparto por tipo).
6. **CA-06** · Enlace a Movimientos (e2e, a continuación de CA-04):
   - en septiembre, pulsar «Transporte» lleva a `#/movimientos?mes=2026-09&tipo=gasto&categoria=<id de Transporte>`, con 1 movimiento, «GASOLINERA EJEMPLO»;
   - al volver con «atrás», «Resumen del mes» sigue en septiembre;
   - «Sin categoría» lleva a `…&tipo=gasto&categoria=sin`, con 2 movimientos, y en «Ingresos», «Salarios, rentas y subsidios» lleva a `…&tipo=ingreso&categoria=<id>`, con 1.
7. **CA-07** · `AreaChart` (Vitest de componente):
   - con 1 punto muestra el mensaje en lugar del gráfico;
   - con `prefersReducedMotion()` simulado a verdadero no hay transición;
   - con 3 puntos, las flechas y Home/End recorren los puntos;
   - el `aria-label` del SVG resume el primero y el último;
   - con valores negativos aparece la línea del 0.
8. **CA-08** · Textos (Vitest de componente en inglés): el periodo muestra «6 months», «1 year» y «All», y la cifra del mes, «Saved». `src/i18n/keys.test.ts` pasa.
9. **CA-09** · Borrado y recálculo (Vitest):
   - tras el borrado de SPEC-0013 no quedan `mire.panel.periodo` (localStorage) ni `mire.panel.mes` (sessionStorage);
   - el cliente emite `dataChanged` tras una llamada marcada como escritura en el mapa de la API y tras el mensaje de fusión del worker (SPEC-0008), y no lo emite tras una lectura.
10. **CA-10** · axe sin infracciones en Inicio con el panel (con un punto enfocado, la tabla visible y el reparto desplegado), en claro y en oscuro; sin scroll horizontal a 375 px. Cubre SPEC-0001 CA-16.
11. **CA-11** · Sin regresiones:
    - los e2e de SPEC-0006 (CA-04 a CA-06), SPEC-0010 (CA-01) y SPEC-0020 (CA-02), que comprueban importes en Inicio, pasan sin modificarse con el panel presente;
    - los demás tests anteriores también pasan;
    - `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Valoraciones escasas**: el valor de un fondo solo cambia al importar el PDF. Entre importaciones, la curva usa la última valoración más los movimientos posteriores (SPEC-0004). Es correcto, pero puede verse escalonada.
- **Redondeo de porcentajes**: con un decimal por fila, la suma puede no dar exactamente 100 %. Es aceptable, y no se reparte el resto.
- **Más contenido antes de las cuentas**: los e2e de SPEC-0006 deben localizar por rol, nombre y región, no por posición. Así lo pide SPEC-0006.
- **Abreviaturas de meses y formato compacto**: dependen de los datos CLDR del navegador. Los tests no las fijan como texto.

### Preguntas abiertas
- Ninguna para el propietario.
