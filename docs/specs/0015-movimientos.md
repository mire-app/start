---
id: SPEC-0015
title: Movimientos: lista, filtros, detalle, edición y traspasos
status: draft          # draft → approved (solo una persona) → implemented
summary: Lista global de movimientos con filtros (cuenta, mes, tipo, categoría, texto), detalle con edición avisada de datos importados, borrado, vincular y desvincular traspasos y marcar aportación externa
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0006, SPEC-0011]
---

# SPEC-0015 · Movimientos: lista, filtros, detalle, edición y traspasos

## Intención
Ver y corregir **todos los movimientos importados** en un solo sitio:
- encontrarlos con filtros;
- corregir conceptos, notas, tipo o datos del banco (con aviso);
- borrarlos;
- **vincular traspasos** y marcar **aportaciones externas** que la importación no haya resuelto.

## Contexto
- `SPEC-0001` (draft): funciones 2 y 3, CA-02 (editar y borrar, sin alta manual), CA-03 y CA-20.
- **Decisiones del propietario** (2026-10-24):
  - **solo importación**: no hay alta manual;
  - los importados se pueden **editar con aviso** (importe, fecha y cuenta) y borrar con confirmación;
  - lista global con filtros;
  - vincular traspasos desde el detalle;
  - interruptor de aportación externa.
- `SPEC-0004`: repositorios (`updateMovement`, `deleteMovement`, `linkTransfer`, `unlinkTransfer` y `setKind`).
- `SPEC-0006`: rutas `#/movimientos`, navegación, transiciones, datos de ejemplo y enlace «Ver todos» desde la cuenta. **Se implementa antes.**
- `SPEC-0003`: `Amount`, componentes, tokens y axe. `SPEC-0011`: margen de ±3 días para sugerir traspasos.
- Categorías: hasta SPEC-0007 la lista de categorías puede estar vacía. El filtro y el campo de categoría funcionan con las que existan.

## Cambio (delta)
### 1. Lista (`#/movimientos`)
- **Orden y agrupación**: todos los movimientos vivos, por fecha descendente y, en la misma fecha, por orden de creación descendente. Se agrupan por día, con cabecera `dd/mm/aaaa`.
- **Cada fila**:
  - concepto, cuenta y categoría (si la tiene);
  - `Amount` según el tipo: ingreso, gasto, traspaso (`transfer`, en `muted`) o aportación externa (`income`, con la marca «Aportación externa»);
  - un icono de traspaso (`swap_horiz`) si es un traspaso.
  - La fila entera es un enlace al detalle `#/movimientos/:id`.
- **Carga**: por páginas de 100 movimientos, con «Cargar más» al final. No hay *scroll* infinito, porque es más accesible.
- **Filtros**, en una barra plegable en móvil:

  | Filtro | Opciones |
  |---|---|
  | Cuenta | todas o una |
  | Mes | `AAAA-MM`, todos por defecto |
  | Tipo | ingreso, gasto, traspaso, aportación externa |
  | Categoría | todas, sin categoría, o una |
  | Texto | busca en el concepto y la nota, sin distinguir mayúsculas ni tildes (`normalizeText`) |

  - Los filtros se reflejan en la URL (`#/movimientos?cuenta=…&mes=…&tipo=…&categoria=…&q=…`), de modo que «Ver todos» desde una cuenta (SPEC-0006) llega ya filtrado.
  - **Contador**: «N movimientos», con la suma de ingresos y la de gastos del resultado filtrado. Los traspasos y aportaciones no cuentan (`countsAsIncomeOrExpense`).
- **Estado vacío**:
  - sin datos: «Aún no hay movimientos. Importa un extracto.», con botón a `#/importar`;
  - con filtros: «Ningún movimiento coincide», con «Quitar filtros».

### 2. Detalle (`#/movimientos/:id`)
- **Datos que se muestran**:
  - fecha y fecha valor;
  - importe, cuenta, concepto, nota y categoría;
  - tipo;
  - origen: «Importado el dd/mm/aaaa (formato)», con el lote y su `source`;
  - categoría del banco (`source_category`), si existe;
  - si es un traspaso: la **contrapartida**, con enlace.
- **Editar** (`Dialog`):
  - **campos libres**: concepto, nota y categoría;
  - **campos del banco**: importe, fecha y cuenta. Se editan tras el aviso «Este dato viene del extracto. Si lo cambias, no coincidirá con tu banco y podría no detectarse como duplicado al reimportar».
    - Si el movimiento es un traspaso, cambiar el importe o la cuenta lo **desvincula** antes, con un aviso.
    - El importe no puede ser 0.
- **Aportación externa**: interruptor visible solo en movimientos de **entrada** que no son traspaso. Llama a `setKind('external' | 'regular')`.
- **Traspaso**:
  - **«Vincular como traspaso»** abre una lista de **candidatos**: movimientos vivos de **otra cuenta**, con importe **opuesto e igual**, `|Δfecha| ≤ 3 días`, que no son traspaso ni aportación externa. Se ordenan por menor `Δfecha`. Al elegir uno se llama a `linkTransfer`.
  - Si no hay candidatos: «No hay movimientos que encajen (importe opuesto en otra cuenta, ±3 días)».
  - **«Desvincular traspaso»** llama a `unlinkTransfer`; ambos vuelven a `regular`.
- **Borrar**: confirmación «¿Borrar este movimiento?»; borrado lógico. Si es un traspaso, se desvincula primero y la contrapartida queda `regular`. Después vuelve a la lista con la transición `back`.

### 3. Repositorios nuevos (SPEC-0004, en `src/db/repo/`)
- `listMovements(db, { accountId?, month?, kinds?, categoryId? | 'none', q?, limit, offset })` → `{ rows, total, incomeCents, expenseCents }`.
- `getMovement(db, id)`, con su lote y su contrapartida.
- `transferCandidates(db, movementId)`.
- `updateMovement`, que ahora desvincula al cambiar importe o cuenta de un traspaso.
- `deleteMovement`, que ahora desvincula antes de borrar.

## Fuera de alcance
- **Alta manual** de movimientos: descartada (solo importación).
- Edición masiva, por ejemplo categorizar varios a la vez: en SPEC-0007 con las reglas.
- Gestión de categorías y reglas: SPEC-0007. Importación: SPEC-0010.
- Exportar la lista filtrada: la exportación completa es de SPEC-0013.

## Criterios de aceptación
Los e2e parten de la seguridad configurada y de los datos de ejemplo de SPEC-0006.

1. **CA-01** · Lista:
   - `#/movimientos` muestra los **6** movimientos de ejemplo agrupados por día (el más reciente, 16/09/2026);
   - el contador dice «6 movimientos», con ingresos `2.000,00 €` y gastos `51,56 €`, porque los traspasos no cuentan.
2. **CA-02** · Filtros:
   - con `cuenta = Cuenta Ejemplo` hay 4;
   - con `tipo = traspaso` hay **4** (−300, +300, −500 y +500);
   - con `q = gasolinera` hay 1;
   - la URL refleja los filtros y, al recargar (desbloqueando), se mantienen;
   - «Ver todos» desde el detalle de «Ahorro Ejemplo» (SPEC-0006) llega con `cuenta` ya puesto.
3. **CA-03** · Editar:
   - cambiar la nota de «GASOLINERA EJEMPLO» se guarda sin aviso;
   - cambiar su importe a −60,00 € muestra el aviso y, al aceptar, el saldo de «Cuenta Ejemplo» en Inicio pasa a `2.140,00 €`;
   - un importe 0 no se permite.
   - Cubre SPEC-0001 CA-02.
4. **CA-04** · Traspasos:
   - en «TRASPASO A AHORRO», «Desvincular traspaso» deja ambos lados `regular`; ahora cuentan como gasto e ingreso en el contador;
   - en el mismo movimiento, «Vincular como traspaso» ofrece como **único** candidato «TRASPASO DESDE CUENTA» (+300,00 € en «Ahorro Ejemplo», mismo día); al elegirlo vuelven a ser traspaso;
   - el patrimonio no cambia en ningún momento (`11.866,40 €`).
   - Cubre SPEC-0001 CA-03.
5. **CA-05** · Aportación externa:
   - en «NÓMINA EJEMPLO», el interruptor la marca como aportación externa: el contador de ingresos pasa a `0,00 €`, la fila muestra la marca y el patrimonio no cambia;
   - el interruptor no aparece en «GASOLINERA EJEMPLO» (salida) ni en los traspasos.
   - Cubre SPEC-0001 CA-20.
6. **CA-06** · Borrar:
   - borrar «APORTACIÓN FONDO» (−500 €, traspaso) pide confirmación;
   - al confirmar, «APORTACIÓN» (+500 € en el fondo) queda `regular`, y «Cuenta Ejemplo» sube a `2.648,44 €`.
7. **CA-07** · Repositorios (Vitest, en memoria):
   - `listMovements` con cada filtro y con combinaciones devuelve `total` y sumas correctas;
   - `q` sin tildes encuentra «NÓMINA»;
   - `transferCandidates` excluye la misma cuenta, `Δfecha > 3`, los importes no opuestos y los ya vinculados.
8. **CA-08** · Carga por páginas:
   - (Vitest, repositorio) con 250 movimientos sintéticos, `listMovements` con `limit 100` y `offset 200` da 50 filas y `total = 250`;
   - (Vitest, componente con Testing Library y jsdom) con 100 de 250 cargados, la lista muestra «Cargar más», y al pulsarlo pide `offset 100`.
   - No hay e2e de paginación, porque sin alta manual no se pueden crear más de 100 movimientos desde la interfaz.
9. **CA-09** · axe (SPEC-0003) sin infracciones en la lista, los filtros desplegados, el detalle, el diálogo de edición y el de candidatos, en claro y en oscuro; sin scroll horizontal a 375 px.
10. **CA-10** · Los e2e de SPEC-0002 a SPEC-0006 pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Editar datos del banco** rompe la detección de duplicados al reimportar. Está avisado en la interfaz, y deshacer el lote (SPEC-0011) sigue siendo la vía limpia.
- **Rendimiento del filtro de texto** (`normalizeText` en SQL): se usa una columna normalizada calculada en JS al insertar y al editar, si las pruebas muestran lentitud con miles de filas.

### Preguntas abiertas
- Ninguna para el propietario.
