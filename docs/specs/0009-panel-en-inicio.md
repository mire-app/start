---
id: SPEC-0009
title: Panel en Inicio: evolución del patrimonio, resumen del mes y reparto por tipo
status: draft          # draft → approved (solo una persona) → implemented
summary: Inicio pasa a ser el panel: variación del patrimonio, gráfico de área de la evolución mensual (6 meses, 1 año, todo) en SVG propio accesible, resumen del mes con ingresos, gastos y ahorro y barras por categoría que llevan a Movimientos, y reparto por tipo de cuenta
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0006, SPEC-0007, SPEC-0010, SPEC-0011, SPEC-0015, SPEC-0016, SPEC-0020]
---

# SPEC-0009 · Panel en Inicio: evolución del patrimonio, resumen del mes y reparto por tipo

## Intención
Que al abrir Míre se vea **de un vistazo**:
- cuánto vale el patrimonio y cómo ha cambiado;
- cómo evoluciona mes a mes;
- en qué se va el dinero este mes.

Desde cada dato se llega a los movimientos que lo explican.

## Contexto
- `SPEC-0001` (draft): función 7, CA-09 (evolución mensual) y CA-10.
- `SPEC-0004`:
  - `netWorthAt`, `balanceAt` e `investmentValueAt`, que incluyen las cuentas archivadas;
  - `countsAsIncomeOrExpense`;
  - consultas en `src/db/repo/queries.ts`.
- `SPEC-0006`: Inicio, con el patrimonio, los grupos y las cuentas por tipo. Su CA-04 comprueba los importes `11.866,40 €`, `4.417,96 €`, `2.148,44 €` y `5.300,00 €`.
- `SPEC-0007`: categorías de dos niveles, iconos y `categoryLabel`.
- `SPEC-0015`: valores de URL de los filtros (`mes`, `tipo=gasto|ingreso`, `categoria=<id>|sin`); una categoría padre incluye a sus hijas.
- `SPEC-0016`: datos de ejemplo (patrimonio 1186640 a 2026-10-24). `SPEC-0010` y `SPEC-0011`: importación de `bbva-informe.xlsx`. `SPEC-0003`: tokens, `Amount`, movimiento y axe. `SPEC-0020`: tarjeta de sincronización en Inicio.
- **Decisiones del propietario** (2026-10-24):
  - el panel va **dentro de Inicio**, sin pestaña nueva;
  - evolución en un **gráfico de área** con selector de periodo;
  - resumen del mes en **barras horizontales** por categoría;
  - gráficos en **SVG propio**, sin librería.
- **Orden de implementación**: el último del backlog.

## Cambio (delta)
### 1. Orden de Inicio (`#/`)
1. **Patrimonio** (SPEC-0006), con una línea nueva debajo: «+X € (+Y %) desde fin de mes anterior».
   - Usa `Amount kind="balance"` y el color `positive` o `negative`.
   - Si no hay mes anterior con datos, la línea no aparece.
2. Tarjeta de sincronización (SPEC-0020), si procede.
3. **Evolución** (punto 2).
4. **Resumen del mes** (punto 3).
5. **Reparto por tipo** (punto 4).
6. Grupos y cuentas (SPEC-0006), sin cambios.

**Sin datos**: Inicio sigue mostrando solo el estado vacío de SPEC-0006.

**Importes por defecto**: el panel **no muestra** por defecto ningún importe de cuenta, grupo, tipo o patrimonio de los que muestra SPEC-0006. El valor de cada punto del gráfico solo aparece al enfocarlo, la tabla alternativa solo al pedirla y el reparto por tipo solo al desplegarlo (contenido **no renderizado** mientras está cerrado). Así las comprobaciones de texto de SPEC-0006 no encuentran duplicados.

### 2. Evolución del patrimonio
**Serie** (`src/domain/dashboard.ts`, puro):
- `netWorthSeries(accounts, movements, valuations, fromMonth, today)` → `{ month: 'AAAA-MM', cents }[]`;
- un punto por mes: `netWorthAt` en el **último día** del mes, salvo el mes en curso, que usa `today`;
- empieza en el mes más antiguo con datos (fecha de apertura, movimiento o valoración) o en `fromMonth` si es posterior.

**Periodo**: selector segmentado **«6 meses» / «1 año» / «Todo»**, con «1 año» por defecto, que se recuerda en `localStorage`. «6 meses» y «1 año» son los últimos 6 o 12 meses, incluido el actual.

**Gráfico** (`src/components/charts/AreaChart.tsx`, SVG):
- **Forma**:
  - área con línea en el token `accent` (esmeralda) y relleno degradado del mismo color;
  - eje Y con 3 marcas en formato compacto del idioma («5 k€»);
  - eje X con el mes abreviado («sept.», «oct.»);
  - `viewBox` adaptable al ancho y 200 px de alto.
- **Lectura punto a punto**:
  - cada punto es enfocable (`tabindex` itinerante, con flechas izquierda y derecha) y responde al puntero;
  - al enfocarlo se ve «octubre de 2026: 11.866,40 € (+49,3 %)», con la variación respecto al punto anterior.
- **Accesibilidad**:
  - el SVG lleva `role="img"` y un `aria-label` con el resumen («Patrimonio de septiembre de 2026 a octubre de 2026, de 7.948,44 € a 11.866,40 €»);
  - el botón **«Ver como tabla»** muestra una tabla con mes, patrimonio y variación.
- **Movimiento**: el área entra con una transición de 300 ms, salvo con `prefers-reduced-motion`.
- **Temas**: en claro y en oscuro usa solo tokens de SPEC-0003.
- **Un solo mes con datos**: en lugar del gráfico, «La evolución aparecerá cuando tengas datos de más de un mes».

### 3. Resumen del mes
**Selector de mes**: «‹ septiembre de 2026 ›», desde el mes más antiguo con movimientos hasta el actual. Por defecto se muestra el mes actual si tiene movimientos que cuentan; si no, el más reciente que los tenga.

**Cifras** (`monthlySummary(movements, categories, month)`, puro), solo con movimientos en los que `countsAsIncomeOrExpense` es verdadero:
- **Ingresos**: suma de los positivos;
- **Gastos**: suma de los negativos, en valor absoluto;
- **Ahorro**: ingresos − gastos, en `positive` o `negative`.

**Barras**: un conmutador **«Gastos» / «Ingresos»** (por defecto, Gastos) y una lista de barras horizontales.
- **Agrupación**: por **categoría padre**, sumando sus subcategorías, más «Sin categoría».
- **Orden**: de mayor a menor.
- **Cada fila**:
  - icono, nombre (`categoryLabel`) e importe (`Amount`);
  - porcentaje con un decimal;
  - una barra de ancho proporcional al mayor.
- **Enlace**: cada fila lleva a `#/movimientos?mes=AAAA-MM&tipo=gasto|ingreso&categoria=<id>|sin` (SPEC-0015).
- **Mes sin movimientos**: «Sin movimientos en <mes>».

**Fuera de las cifras**: los traspasos y las aportaciones externas no cuentan (SPEC-0001 CA-10, CA-20). Una nota lo dice: «No incluye traspasos entre tus cuentas ni aportaciones externas».

### 4. Reparto por tipo
- **Forma**: un desplegable **«Reparto por tipo»**, cerrado por defecto y sin renderizar mientras está cerrado.
- **Contenido**: una barra por tipo con saldo distinto de 0 (Corriente, Ahorro, Efectivo, Inversión), con importe y porcentaje del patrimonio, archivadas incluidas.
- **Totales negativos**: si algún tipo o el total es negativo, se muestran los importes sin barras ni porcentajes.

### 5. Datos y API del worker
- **Nuevos métodos** (`src/db/repo/queries.ts`, que llaman al dominio):
  - `dashboard.series({ period, today })`;
  - `dashboard.month({ month })` → `{ incomeCents, expenseCents, savingsCents, byCategory: { expense: [...], income: [...] }, months: string[] }`;
  - `dashboard.byType({ today })`.
- **Fecha de hoy**: llega del cliente (`today`), y así los tests la fijan con `page.clock`.
- **Rendimiento**: cada consulta carga los movimientos y valoraciones vivos una sola vez y calcula todos los meses en memoria.
- **Textos**: todos tienen clave en `es.json` y `en.json`, con formato de fechas y números del idioma activo.

## Fuera de alcance
- Presupuestos, previsiones, objetivos de ahorro y comparación entre años.
- Gráficos por cuenta o por grupo y rentabilidad de las inversiones.
- Exportar los gráficos.

## Criterios de aceptación
Los e2e fijan el reloj en `2026-10-24T12:00` con `page.clock`. Como máximo hay 2 ficheros e2e:
- `panel-ejemplo.spec.ts`, con los datos de ejemplo de SPEC-0016: CA-03, CA-05 y CA-07;
- `panel-bbva.spec.ts`, con `bbva-informe.xlsx` importado mediante SPEC-0010 con el traspaso de las filas 2 y 3 activado y la siembra de SPEC-0007: CA-04 y CA-06.

1. **CA-01** · Serie (Vitest, con los datos de ejemplo de SPEC-0016 y `today = 2026-10-24`):
   - con «Todo», da `[{ 2026-09, 794844 }, { 2026-10, 1186640 }]`;
   - con «6 meses», empieza igualmente en 2026-09, el primer mes con datos;
   - una cuenta archivada sigue contando.
2. **CA-02** · Resumen (Vitest):
   - con los datos de ejemplo, septiembre de 2026 da ingresos 200000, gastos 5156 y ahorro 194844, y los traspasos no cuentan;
   - con `bbva-informe.xlsx` y el traspaso de las filas 2 y 3 aceptado, septiembre da ingresos 201500 y gastos 67656;
   - por categoría de gastos: «Sin categoría» 62000 (91,6 %), «Transporte» 5156 (7,6 %) y «Ocio» 500 (0,7 %);
   - una aportación externa no cuenta como ingreso.
3. **CA-03** · Inicio con datos de ejemplo (e2e):
   - bajo el patrimonio aparece «+3.917,96 € (+49,3 %) desde fin de mes anterior»;
   - el gráfico tiene 2 puntos, y al enfocar el último y pulsar la flecha izquierda se lee «septiembre de 2026: 7.948,44 €»;
   - «Ver como tabla» muestra 2 filas;
   - «6 meses» y «Todo» mantienen 2 puntos, y el periodo elegido se conserva al recargar.
   - Cubre SPEC-0001 CA-09 (evolución mensual).
4. **CA-04** · Resumen del mes (e2e; las comprobaciones se hacen dentro de la región «Resumen del mes», porque el ahorro coincide aquí con el patrimonio):
   - el selector abre en septiembre de 2026 (octubre no tiene movimientos);
   - se ven Ingresos `2.015,00 €`, Gastos `676,56 €` y Ahorro `1.338,44 €`;
   - las barras de gastos son «Sin categoría», «Transporte» y «Ocio», en ese orden;
   - «Ingresos» muestra «Salarios, rentas y subsidios» y «Otros ingresos»;
   - «›» queda deshabilitado en octubre de 2026, que muestra «Sin movimientos en octubre de 2026».
   - Cubre SPEC-0001 CA-10.
5. **CA-05** · Reparto por tipo (e2e, datos de ejemplo): al desplegarlo se ven Corriente `2.148,44 €` (18,1 %), Ahorro `5.300,00 €` (44,7 %) e Inversión `4.417,96 €` (37,2 %), sin Efectivo. Cerrado, esos importes no están en el DOM.
6. **CA-06** · Enlace a Movimientos (e2e, a continuación de CA-04): pulsar «Transporte» lleva a `#/movimientos?mes=2026-09&tipo=gasto&categoria=<id de Transporte>`, con 1 movimiento, «GASOLINERA EJEMPLO».
7. **CA-07** · Sin regresión de Inicio (e2e): los CA-04 a CA-06 de SPEC-0006 pasan sin modificarse con el panel presente.
8. **CA-08** · `AreaChart` (Vitest de componente):
   - con 1 punto muestra el mensaje en lugar del gráfico;
   - con `prefers-reduced-motion` no hay transición;
   - con 3 puntos, las flechas recorren los puntos, y el `aria-label` del SVG resume el primero y el último.
9. **CA-09** · `src/i18n/keys.test.ts` pasa, y en inglés el periodo muestra «6 months», «1 year» y «All».
10. **CA-10** · axe sin infracciones en Inicio con el panel (con el reparto desplegado y con la tabla visible), en claro y en oscuro; sin scroll horizontal a 375 px.
11. **CA-11** · Los tests anteriores pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Valoraciones escasas**: el valor de un fondo solo cambia cuando se importa el PDF. Entre importaciones, la curva usa la última valoración más los movimientos posteriores (SPEC-0004). Es correcto, pero puede verse escalonada.
- **Redondeo de porcentajes**: con un decimal por fila, la suma puede no dar exactamente 100 %. Es aceptable y no se reparte el resto.
- **Duplicados de texto con SPEC-0006**: se evitan sin renderizar por defecto los importes que SPEC-0006 ya muestra (CA-05 y CA-07).

### Preguntas abiertas
- Ninguna para el propietario.
