---
id: SPEC-0015
title: Movimientos: lista, filtros, detalle, edición y traspasos
status: draft          # draft → approved (solo una persona) → implemented
summary: Lista global de movimientos con filtros (cuenta, mes, tipo, categoría, texto), detalle con edición avisada de datos importados, borrado, vincular y desvincular traspasos y marcar aportación externa
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0007, SPEC-0010, SPEC-0011, SPEC-0016, SPEC-0018, ADR-0002]
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
- `SPEC-0016` y `SPEC-0006`: router, regla de transiciones, datos de ejemplo, navegación, el marcador de `#/movimientos` (que esta spec sustituye) y el enlace «Ver todos». **Se implementan antes.**
- `SPEC-0005`: `SecurityGate` conserva la ruta al desbloquear (SPEC-0016).
- `SPEC-0003`: `Amount`, componentes, tokens y axe. `SPEC-0011`: margen de ±3 días para sugerir traspasos.
- Categorías: hasta SPEC-0007 la lista de categorías puede estar vacía. El filtro y el campo de categoría funcionan con las que existan. Esta spec crea el selector común `CategoryPicker`, que reutilizan SPEC-0010, SPEC-0007 y SPEC-0018 sin cambiar su contrato.

## Cambio (delta)
### 1. Lista (`#/movimientos`)
- **Ruta**: esta spec sustituye el marcador de `#/movimientos` y añade `#/movimientos/:id` (sección 2, nivel 2).
- **Orden y agrupación**: todos los movimientos vivos, ordenados con `ORDER BY date DESC, created_at DESC, id DESC` (estable para paginar). Se agrupan por día, con cabecera `dd/mm/aaaa`.
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
  | Tipo | ingreso (`kind='regular'` e importe > 0), gasto (`regular` e importe < 0), traspaso (`transfer`), aportación externa (`external`) |
  | Categoría | todas, sin categoría, o una (una categoría con subcategorías incluye los movimientos de estas) |
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
  - origen: «Importado el dd/mm/aaaa (formato)», con el lote y su `source`. Etiquetas de formato: `bbva_report` «BBVA», `myinvestor_movements` «MyInvestor (movimientos)», `myinvestor_pdf` «MyInvestor (cartera)», `generic_csv` «CSV», `generic_xlsx` «Excel» y `demo` «Datos de ejemplo»;
  - categoría del banco (`source_category`), si existe;
  - si es un traspaso: la **contrapartida**, con enlace.
- **Editar** (`Dialog`):
  - **campos libres**: concepto, nota y categoría (con `CategoryPicker`);
  - **campos del banco**: importe, fecha y cuenta. El aviso aparece **la primera vez que se modifica uno de ellos** en el diálogo: «Este dato viene del extracto. Si lo cambias, ya no coincidirá con tu banco».
  - **Huella**: `fingerprint` **nunca cambia al editar**, sea cual sea el campo. Así, al reimportar el mismo extracto, la fila original se sigue detectando como duplicada y no se duplica.
  - Cambiar a negativo el importe de una **aportación externa** da `external_requires_positive`, con el mensaje «Quita antes la marca de aportación externa».
  - Si el movimiento es un traspaso, cambiar el importe o la cuenta lo **desvincula** antes, con un aviso.
  - El importe no puede ser 0.
- **Aportación externa**: interruptor visible solo en movimientos de **entrada** que no son traspaso. Llama a `setKind('external' | 'regular')`.
- **Traspaso**:
  - **«Vincular como traspaso»** abre una lista de **candidatos**: movimientos vivos de **otra cuenta**, con importe **opuesto e igual**, `|Δfecha| ≤ 3 días`, que no son traspaso ni aportación externa. Se ordenan por menor `Δfecha`. Al elegir uno se llama a `linkTransfer`.
  - Si no hay candidatos: «No hay movimientos que encajen (importe opuesto en otra cuenta, ±3 días)».
  - **«Desvincular traspaso»** llama a `unlinkTransfer`; ambos vuelven a `regular`.
- **Borrar**: confirmación «¿Borrar este movimiento?»; borrado lógico. Si es un traspaso, se desvincula primero y la contrapartida queda `regular`. Después vuelve a la lista con la transición `back`.

### 3. Repositorios nuevos (SPEC-0004, en `src/db/repo/`)
- `listMovements(db, { accountId?, month?, types?: ('income'|'expense'|'transfer'|'external')[], categoryId? | 'none', q?, limit, offset })` → `{ rows, total, incomeCents, expenseCents }`, con la traducción de tipos de la tabla de filtros.
- `getMovement(db, id)`, con su lote y su contrapartida.
- `transferCandidates(db, movementId)`.
- `updateMovement`, que ahora desvincula al cambiar importe o cuenta de un traspaso.
- `deleteMovement`, que ahora desvincula antes de borrar.

### Selector de categoría `CategoryPicker` (`src/components/CategoryPicker.tsx`)
- **Forma**: combobox accesible (patrón ARIA *combobox* con lista emergente), con:
  - **búsqueda** por nombre (con `normalizeText`);
  - **grupos** por categoría, con su icono si lo tiene;
  - la opción **«Sin categoría»** primero;
  - se puede elegir tanto una categoría como una subcategoría.
- **Contrato estable**, en el que se apoyan los tests de esta spec y de SPEC-0010:
  - rol `combobox`, con el nombre accesible que recibe (por defecto «Categoría» / «Category»);
  - el valor elegido se muestra como texto visible: «Categoría › Subcategoría», «Categoría» o «Sin categoría»;
  - `onChange(categoryId | null)`.
- **Nombre visible**: la función `categoryLabel(category)` devuelve `name`. SPEC-0007 la amplía con las traducciones de la lista inicial, sin cambiar el contrato.
- **Datos**: `categories.list` (API del worker; SPEC-0010 lo amplía si hace falta).

## Fuera de alcance
- **Alta manual** de movimientos: descartada (solo importación).
- Categorizar varios a la vez: SPEC-0007. Reglas: SPEC-0018.
- Gestión de categorías: SPEC-0007. Importación: SPEC-0010.
- Exportar la lista filtrada: la exportación completa es de SPEC-0013.

## Criterios de aceptación
Los e2e parten de la seguridad configurada y de los datos de ejemplo de SPEC-0016.

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
   - un importe 0 no se permite;
   - (Vitest) tras editar importe, fecha, concepto y cuenta, `fingerprint` es idéntico, y reimportar con SPEC-0011 el fichero de origen marca esa fila como duplicada;
   - (Vitest) cambiar a negativo el importe de un movimiento `external` da `external_requires_positive`.
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
10. **CA-10** · `CategoryPicker` (Vitest de componente, con categorías simuladas):
    - escribir «combu» deja solo «Transporte › Combustible»;
    - con el teclado se llega a una opción y se elige con `Enter`;
    - «Sin categoría» es la primera opción;
    - el valor elegido se ve como texto («Transporte › Combustible») y `onChange` recibe su id.
11. **CA-11** · Los e2e de todas las specs anteriores (SPEC-0002 a SPEC-0006, SPEC-0013, SPEC-0014 y SPEC-0016) pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Editar datos del banco** no rompe la detección de duplicados, porque la huella no cambia, pero el movimiento deja de coincidir con el banco (avisado).
- **Borrar y reimportar**: un movimiento borrado vuelve a importarse si se reimporta su extracto, porque su huella ya no está viva. Es coherente («lo borré, el banco lo tiene») y queda anotado.
- **Rendimiento del filtro de texto** (`normalizeText` en SQL): se usa una columna normalizada calculada en JS al insertar y al editar, si las pruebas muestran lentitud con miles de filas.

### Preguntas abiertas
- Ninguna para el propietario.
