---
id: SPEC-0007
title: Categorías: lista inicial, gestión, equivalencias del banco y recategorización
status: draft          # draft → approved (solo una persona) → implemented
summary: Lista inicial de dos niveles basada en BBVA con iconos y equivalencias sembradas, pantalla de categorías (crear, renombrar, icono, borrar moviendo movimientos), equivalencias editables con las categorías del banco, selector común y categorización múltiple en Movimientos
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0008, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0015, SPEC-0016, SPEC-0018]
---

# SPEC-0007 · Categorías: lista inicial, gestión, equivalencias del banco y recategorización

## Intención
Que cada movimiento tenga una categoría útil **con el mínimo trabajo**:
- una lista inicial de dos niveles parecida a la de BBVA;
- las categorías del banco se convierten solas en categorías de Míre;
- el usuario ajusta la lista y recategoriza varios movimientos a la vez.

Las reglas por concepto son de SPEC-0018.

## Contexto
- `SPEC-0001` (draft): función 5 y CA-08 (categorías; las reglas, en SPEC-0018).
- `SPEC-0004`:
  - tabla `category` (`parent_id`, `system_key`, `name`, `icon`, `archived_at`) con el trigger `category_depth`;
  - tabla `category_map` (`source`, `source_category`, `category_id`);
  - `movement.category_id` y `movement.source_category`;
  - `upsertCategoryMap`.
- `SPEC-0011`:
  - `sourceCategory` con el formato `Categoría›Subcategoría`, sin espacios alrededor de `›`;
  - sugerencia por `category_map` con `suggestedBy = 'bank'`.
  - Fichero `bbva-informe.xlsx`, con estas categorías: `Salarios, rentas y subsidios›Nómina`, `No categorizable›No asociable a gasto o ingreso` (filas 2, 7 y 8), `No categorizable›Autotransferencia recibida` (fila 3), `Transporte›Combustible`, `Ocio›Bares y restaurantes` (filas 5 y 6) y `Otros ingresos›Ingresos varios`.
- `SPEC-0010`:
  - selector de categoría en la revisión;
  - `categories.list`;
  - test de paridad `src/i18n/keys.test.ts`.
- `SPEC-0015`: lista de movimientos con filtro de categoría y `listMovements`, y campo de categoría en el diálogo de edición.
- `SPEC-0005`: configuración inicial. `SPEC-0013`: borrado total y exportación (`categorias.csv`). `SPEC-0016`: router y Ajustes. `SPEC-0006`: barra inferior.
- **Decisiones del propietario** (2026-10-24):
  - lista inicial basada en la de BBVA;
  - las categorías neutras de BBVA («No categorizable › …») **no se crean**, y esos movimientos quedan sin categoría;
  - un icono por categoría;
  - al borrar una categoría con movimientos, se elige otra o se dejan sin categoría;
  - categorización con selección múltiple;
  - reglas en SPEC-0018.
- **Orden de implementación**: después de SPEC-0010, SPEC-0019 y SPEC-0017.

## Cambio (delta)
### 1. Lista inicial (`src/db/seed/categories.ts`)
- **Contenido**:
  - 10 categorías y 41 subcategorías (tabla siguiente);
  - cada una con un **id fijo** (constante UUID en el fichero, igual en todos los dispositivos) y un `system_key`;
  - `name` en español;
  - `icon` en las categorías; las subcategorías lo tienen NULL y heredan el del padre.

| Categoría (`system_key`, icono) | Subcategorías |
|---|---|
| Salarios, rentas y subsidios / Salary and benefits (`income`, `payments`) | Nómina / Payroll · Pensión / Pension · Prestaciones y subsidios / Benefits · Alquileres cobrados / Rent received |
| Otros ingresos / Other income (`other_income`, `savings`) | Ingresos varios / Miscellaneous income · Devoluciones y reembolsos / Refunds · Intereses y dividendos / Interest and dividends |
| Vivienda / Home (`home`, `house`) | Alquiler o hipoteca / Rent or mortgage · Comunidad / Community fees · Luz y gas / Electricity and gas · Agua / Water · Internet y telefonía / Internet and phone · Mantenimiento y reformas / Repairs and improvements |
| Compras / Shopping (`shopping`, `shopping_cart`) | Alimentación / Groceries · Ropa y calzado / Clothing and shoes · Electrónica / Electronics · Hogar y decoración / Home and decor · Otras compras / Other shopping |
| Transporte / Transport (`transport`, `directions_car`) | Combustible / Fuel · Transporte público / Public transport · Taxi y VTC / Taxi and ride-hailing · Aparcamiento y peajes / Parking and tolls · Mantenimiento del vehículo / Vehicle maintenance |
| Ocio / Leisure (`leisure`, `celebration`) | Bares y restaurantes / Bars and restaurants · Viajes y alojamiento / Travel and lodging · Espectáculos y cultura / Shows and culture · Suscripciones / Subscriptions · Deporte / Sport |
| Salud y educación / Health and education (`health`, `health_and_safety`) | Farmacia / Pharmacy · Médicos y dentista / Doctors and dentist · Educación y formación / Education and training |
| Seguros / Insurance (`insurance`, `shield`) | Seguro del hogar / Home insurance · Seguro del vehículo / Vehicle insurance · Seguro de salud / Health insurance · Seguro de vida / Life insurance |
| Impuestos y comisiones / Taxes and fees (`taxes`, `account_balance`) | Impuestos / Taxes · Comisiones bancarias / Bank fees · Multas y sanciones / Fines |
| Otros gastos / Other expenses (`other_expenses`, `more_horiz`) | Gastos varios / Miscellaneous expenses · Retirada de efectivo / Cash withdrawal · Regalos y donaciones / Gifts and donations |

- **`system_key` de las subcategorías**: `<padre>.<n>`, con `n` desde 1 en el orden de la tabla. Por ejemplo, `shopping.1` es Alimentación.
- **Nombres en inglés**: los de la tabla, en `en.json` bajo `categories.<system_key>`. Los españoles van en `es.json`.
- **Equivalencias sembradas**: una `category_map` por subcategoría, con `source = 'bbva_report'`, `source_category = '<Categoría>›<Subcategoría>'` (nombres españoles de la tabla) y su id fijo.
  - Las cinco categorías del fichero de BBVA que no son neutras quedan así enlazadas.
  - No se siembra nada para `No categorizable›…`.

### 2. Siembra (`categories.seedDefaults`)
- **Qué hace**: inserta la lista inicial y sus equivalencias, en una transacción, **solo si la tabla `category` no tiene ninguna fila** (tampoco borradas). Si tiene alguna, no hace nada.
- **Cuándo**: la llama la app al terminar la **configuración inicial** de la seguridad (SPEC-0005), también tras el borrado total y la nueva configuración (SPEC-0013).
- **Sin migración nueva**: `db-version` sigue siendo 1, y los tests en Node que usan `migrate` no ven la lista.
- **Restricción para SPEC-0008**: un segundo dispositivo que se une a un repositorio de datos **no** siembra; recibe las categorías por la sincronización. Los ids fijos evitan duplicados si dos dispositivos llegan a sembrar.

### 3. Nombre visible
- Si la categoría tiene `system_key`, se muestra la traducción `categories.<system_key>` del idioma activo.
- Si no lo tiene, se muestra `name`.
- **Renombrar** guarda el nuevo `name` y pone `system_key = NULL`. Desde entonces se muestra igual en los dos idiomas.
- **Orden**: por nombre visible, con `localeCompare` del idioma activo.
- **Exportación** (SPEC-0013): usa `name`, así que las categorías sin renombrar salen en español. Es aceptable.

### 4. Pantalla Categorías (`#/ajustes/categorias`)
- **Acceso**: entrada **«Categorías» / «Categories»** en el menú de `TopBar` y enlace en Ajustes. Se comporta como `#/ajustes`:
  - sin barra inferior en el móvil (SPEC-0006: «salvo `#/ajustes` y sus subrutas»);
  - transición `forward` al entrar y `back` al volver.
- **Lista**: las categorías con su icono, cada una desplegable con sus subcategorías.
  - Cada fila muestra el nombre visible y el número de movimientos vivos (los de sus subcategorías incluidos en el padre).
  - Botones **«Nueva categoría»** y, en cada categoría, **«Nueva subcategoría»**.
- **Crear y editar** (`Dialog`):
  - **«Nombre»**: obligatorio, hasta 40 caracteres;
  - **«Icono»**, solo en categorías: rejilla de iconos;
  - **nombres repetidos**: no puede haber dos con el mismo nombre visible (con `normalizeText`) bajo el mismo padre, o entre las categorías. Si lo hay, el error es `category_name_taken`, con el mensaje «Ya existe una categoría con ese nombre».
- **Iconos disponibles**: 32 de Material Symbols Rounded, importados como SVG. Son los 10 de la tabla y además:
  - `restaurant`, `local_cafe`, `flight`, `school`, `pets`, `child_care`, `fitness_center`, `sports_esports`;
  - `movie`, `checkroom`, `devices`, `bolt`, `water_drop`, `wifi`, `phone_iphone`, `local_gas_station`;
  - `train`, `redeem`, `volunteer_activism`, `work`, `receipt_long`, `medical_services`.

  Un icono fuera de la lista da `invalid_icon`.
- **Borrar** (borrado lógico):
  - **Diálogo**: «¿Borrar «X»?». Si la categoría tiene subcategorías: «También se borrarán sus N subcategorías».
  - **Si tiene movimientos** (contando sus subcategorías): «Tiene M movimientos», con la opción **«Moverlos a»** (selector, por defecto) o **«Dejarlos sin categoría»**.
  - **Destino**: no puede ser la categoría que se borra ni una de sus subcategorías; si lo es, el error es `category_move_target_invalid`.
  - **Al confirmar**, en una transacción:
    1. los movimientos pasan al destino o a NULL;
    2. las equivalencias que apuntaban a lo borrado pasan al destino, o se borran si se dejan sin categoría;
    3. se borran la categoría y sus subcategorías.
  - SPEC-0018 amplía este diálogo con las reglas afectadas.
- **Fuera de la pantalla**: mover una subcategoría a otro padre y archivar categorías (`archived_at` queda sin uso).

### 5. Categorías del banco (sección de `#/ajustes/categorias`)
- **Lista**: cada par `(origen, categoría del banco)` que aparece en movimientos vivos.
  - Cada fila muestra:
    - el texto del banco, con `›` entre los dos niveles;
    - el origen (las etiquetas de formato de SPEC-0015);
    - cuántos movimientos tiene y cuántos están sin categoría;
    - su equivalencia actual: una categoría o «Sin categoría».
  - Orden: por número de movimientos, de mayor a menor.
- **Cambiar la equivalencia**: con el selector común (punto 6).
  - Una categoría llama a `upsertCategoryMap`. «Sin categoría» borra la equivalencia (borrado lógico).
  - Casilla **«Aplicar también a los K movimientos sin categoría con esta categoría del banco»**, desmarcada por defecto. Solo cambia los que **no tienen** categoría; nunca toca los ya categorizados.
  - Sin la casilla, el cambio solo afecta a las importaciones futuras.

### 6. Selector común `CategoryPicker` (`src/components/CategoryPicker.tsx`)
- **Forma**: combobox accesible (patrón ARIA *combobox* con lista), con:
  - búsqueda por nombre visible (con `normalizeText`);
  - grupos por categoría, con iconos;
  - la opción **«Sin categoría»** primero;
  - se puede elegir una categoría o una subcategoría.
- **Dónde se usa**:
  - revisión de importación (SPEC-0010);
  - diálogo de edición del movimiento (SPEC-0015);
  - categorización múltiple (punto 7);
  - destino al borrar;
  - equivalencias;
  - reglas (SPEC-0018).
- **Sustituye** a los selectores simples de SPEC-0010 y SPEC-0015 y conserva su etiqueta accesible («Categoría» / «Category»).

### 7. Categorización múltiple en Movimientos (`#/movimientos`, SPEC-0015)
- **Modo selección**: botón **«Seleccionar»** en la cabecera de la lista.
  - Cada fila muestra una casilla, etiquetada con fecha, concepto e importe, y pulsar la fila la marca en vez de abrir el detalle.
  - **«Cancelar»** o `Esc` salen del modo.
- **Barra de acción** (fija; en el móvil, encima de la barra inferior): «N seleccionados», **«Categorizar»** y **«Cancelar»**.
  - Si el filtro tiene más resultados que los cargados, aparece el enlace **«Seleccionar los T que cumplen el filtro»**.
- **«Categorizar»**: abre `CategoryPicker`. Al elegir, se llama a `movements.setCategory`, en una transacción.
  - Aviso (`Toast`): «N movimientos categorizados», con **«Deshacer»** durante 10 s. «Deshacer» llama a `movements.restoreCategories` con lo que devolvió `setCategory`.
  - La lista se refresca con el filtro actual.

### 8. API del worker y repositorios (`src/db/repo/categories.ts`)
**Categorías**:
- `categories.seedDefaults()`;
- `categories.list()` → `{ id, parentId, systemKey, name, icon, movementCount }[]`, solo las vivas (amplía el de SPEC-0010);
- `categories.create({ parentId?, name, icon? })` y `categories.update(id, { name?, icon? })`.
  - Errores: `category_name_taken`, `category_name_empty`, `invalid_icon` y `category_depth`.
  - La unicidad se comprueba en la página con los nombres visibles. El worker compara `name` y `system_key` de los hermanos, con `normalizeText`.
- `categories.delete(id, { moveTo: string | null })`; error `category_move_target_invalid`.

**Equivalencias**:
- `categoryMap.observed()` → `{ source, sourceCategory, movementCount, uncategorizedCount, categoryId: string | null }[]`;
- `categoryMap.set(source, sourceCategory, categoryId | null, { applyToUncategorized })` → `{ updated }`.

**Movimientos**:
- `movements.setCategory(target: { ids: string[] } | { filter: ListFilter }, categoryId | null)` → `{ previous: { id, categoryId }[] }`. `ListFilter` son los filtros de `listMovements` (SPEC-0015).
- `movements.restoreCategories(previous)`.

**Textos**: todos tienen clave en `es.json` y `en.json`.

## Fuera de alcance
- Reglas por concepto: SPEC-0018.
- Mover subcategorías de padre, archivar categorías, colores por categoría y presupuestos.
- Equivalencias sembradas para otros orígenes distintos de BBVA.

## Criterios de aceptación
Los e2e parten de la seguridad configurada y sin datos. Como máximo hay 3 ficheros e2e:
- `categorias.spec.ts`: CA-02, CA-03, CA-05, CA-06 y CA-07, encadenados;
- `categorias-gestion.spec.ts`: CA-04;
- `categorias-a11y.spec.ts`: CA-11.

1. **CA-01** · Siembra (Vitest, Node, SQLite en memoria tras `migrate`):
   - `seedDefaults` crea 10 categorías y 41 subcategorías con los ids, `system_key` e iconos de `src/db/seed/categories.ts`;
   - crea 41 equivalencias `bbva_report`, entre ellas `Transporte›Combustible → transport.1` y `Ocio›Bares y restaurantes → leisure.1`, y ninguna para `No categorizable›…`;
   - una segunda llamada no hace nada;
   - con una categoría ya creada (aunque esté borrada), no hace nada.
2. **CA-02** · Siembra al configurar (e2e):
   - tras configurar la seguridad, Categorías muestra las 10 categorías y Diagnóstico sigue mostrando `db-version` = 1;
   - en inglés aparecen «Shopping» y «Groceries».
3. **CA-03** · Importar con equivalencias (e2e, a continuación):
   - al importar `bbva-informe.xlsx` (SPEC-0010), la revisión preselecciona categoría en las filas 1, 4, 5, 6 y 9, y «Sin categoría» en las 2, 3, 7 y 8;
   - tras importar, Movimientos con el filtro «Sin categoría» muestra 4.
   - Cubre SPEC-0001 CA-08 (categorías).
4. **CA-04** · Gestión (e2e, contexto nuevo):
   - crear «Mascotas» con el icono `pets` y la subcategoría «Veterinario» las muestra en la lista;
   - crear «compras» da «Ya existe una categoría con ese nombre»;
   - renombrar «Compras» a «Supermercado y compras» muestra ese nombre también en inglés.
5. **CA-05** · Categorización múltiple (e2e, a continuación de CA-03):
   - con el filtro «Sin categoría», seleccionar las filas de 500,00 y 120,00 y categorizarlas como «Otros gastos › Gastos varios» muestra «2 movimientos categorizados», y el filtro muestra 2;
   - «Deshacer» vuelve a dejar 4.
6. **CA-06** · Equivalencias (e2e, a continuación):
   - «Categorías del banco» muestra `No categorizable›No asociable a gasto o ingreso` con 3 movimientos, 3 sin categoría y «Sin categoría»;
   - asignarle «Otros gastos › Gastos varios» con «Aplicar también a los 3 movimientos» deja el filtro «Sin categoría» en 1 y «Gastos varios» en 3.
7. **CA-07** · Borrar moviendo (e2e, a continuación):
   - borrar «Ocio» avisa de sus 5 subcategorías y de 2 movimientos;
   - moverlos a «Otros gastos › Gastos varios» deja ese filtro en 5;
   - la equivalencia `Ocio›Bares y restaurantes` muestra ahora «Gastos varios».
8. **CA-08** · Borrar y destino (Vitest, Node):
   - con «Dejarlos sin categoría», los movimientos quedan con `category_id` NULL y las equivalencias que apuntaban a la categoría se borran;
   - un destino que es una subcategoría de la que se borra da `category_move_target_invalid` y no cambia nada;
   - `invalid_icon`, `category_name_empty` y `category_name_taken` se comprueban en `create`;
   - `movements.setCategory` con `{ filter }` cambia exactamente los que devuelve `listMovements` con ese filtro, y `restoreCategories` deja cada uno como estaba.
9. **CA-09** · `CategoryPicker` (Vitest de componente):
   - escribir «gaso» muestra solo «Transporte › Combustible»;
   - con el teclado se llega a una opción y se elige con `Enter`;
   - «Sin categoría» es la primera opción;
   - el nombre de una categoría renombrada se muestra tal cual en los dos idiomas.
10. **CA-10** · `src/i18n/keys.test.ts` pasa, con las 51 claves `categories.*` en los dos idiomas.
11. **CA-11** · axe sin infracciones en Categorías, sus diálogos, el selector abierto y el modo selección de Movimientos (claro y oscuro); sin scroll horizontal a 375 px.
12. **CA-12** · Los e2e de todas las specs anteriores pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Nombres reales de BBVA**: la lista se basa en las categorías vistas y en las habituales de BBVA. Si el banco usa otros textos, esas filas llegan sin categoría y el usuario las enlaza una vez en «Categorías del banco» (punto 5).
- **Tests anteriores con la lista vacía**: SPEC-0010 y SPEC-0015 se implementan antes, sin categorías. Con la siembra, sus e2e verán categorías y sugerencias. Ninguno de sus CA comprueba que la lista esté vacía, pero si alguno falla, se para y se vuelve a Refinar (`test_changes: none`).
- **Selector sustituido**: los e2e anteriores que usen el selector de categoría por su etiqueta siguen funcionando. Si alguno usa `selectOption`, aplica el riesgo anterior.

### Preguntas abiertas
- Ninguna para el propietario.
