---
id: SPEC-0007
title: Categorías: lista inicial, gestión, equivalencias del banco y recategorización
status: draft          # draft → approved (solo una persona) → implemented
summary: Lista inicial de dos niveles basada en BBVA con iconos y equivalencias sembradas de forma idempotente, pantalla de categorías (crear, renombrar, icono, borrar moviendo movimientos), equivalencias editables con las categorías del banco y categorización múltiple en Movimientos
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0008, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0015, SPEC-0016, SPEC-0017, SPEC-0018, SPEC-0019]
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
  - `upsertCategoryMap`;
  - columnas comunes (`id`, `created_at`, `updated_at`, `deleted_at`).
- `SPEC-0011`:
  - `sourceCategory` con el formato `Categoría›Subcategoría`, sin espacios alrededor de `›`;
  - sugerencia por `category_map(plan.source, sourceCategory)` con `suggestedBy = 'bank'`.
  - En el fichero sintético `bbva-informe.xlsx`, las categorías del banco son:
    - «ABONO NOMINA EJEMPLO»: `Salarios, rentas y subsidios›Nómina`;
    - «TRASPASO A CUENTA», «TRANSFERENCIA A MYINVESTOR» y «… B»: `No categorizable›No asociable a gasto o ingreso`;
    - «TRASPASO DESDE CUENTA»: `No categorizable›Autotransferencia recibida`;
    - «GASOLINERA EJEMPLO»: `Transporte›Combustible`;
    - los dos «CAFETERIA EJEMPLO»: `Ocio›Bares y restaurantes`;
    - «INGRESO EJEMPLO»: `Otros ingresos›Ingresos varios`.
- `SPEC-0015`:
  - lista con filtro de categoría (una categoría incluye sus subcategorías) y `listMovements`;
  - **`CategoryPicker`** y `categoryLabel`, cuyo contrato esta spec no cambia.
- `SPEC-0010`: revisión de la importación; test de paridad `src/i18n/keys.test.ts`.
- `SPEC-0005`: `SecurityGate` y desbloqueo. `SPEC-0013`: borrado total y exportación (`categorias.csv`). `SPEC-0016`: router, regla de transiciones y Ajustes. `SPEC-0006`: barra inferior.
- **Decisiones del propietario** (2026-10-24):
  - lista inicial basada en la de BBVA;
  - las categorías neutras de BBVA («No categorizable › …») **no se crean**, y esos movimientos quedan sin categoría;
  - un icono por categoría;
  - al borrar una categoría con movimientos, se elige otra o se dejan sin categoría;
  - categorización con selección múltiple;
  - reglas en SPEC-0018;
  - sincronización con conflictos resueltos **por campo, gana el último** (SPEC-0008).
- **Orden de implementación**: después de SPEC-0010, SPEC-0019 y SPEC-0017. El propietario ya tendrá la app configurada y con datos importados.

## Cambio (delta)
### 1. Lista inicial (`src/db/seed/categories.ts`)
- **Contenido**: 10 categorías y 41 subcategorías (tabla siguiente).
- **Cada una lleva**:
  - un **id fijo**, una constante UUID del fichero, igual en todos los dispositivos. Es una **excepción** a la regla UUIDv7 de SPEC-0004;
  - un `system_key`;
  - `name` en español;
  - `icon` en las categorías; las subcategorías lo tienen NULL y muestran el del padre.

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

- **`system_key` de las subcategorías**: `<padre>_<n>`, con `n` desde 1 en el orden de la tabla. Por ejemplo, `shopping_1` es Alimentación y `other_expenses_1` es Gastos varios.
- **Nombres traducidos**: claves `categoryNames.<system_key>`, que son 51 en `es.json` y 51 en `en.json`, con los textos de la tabla. Los demás textos de esta spec van bajo `categories.*`.
- **Equivalencias sembradas**: una `category_map` por subcategoría (41), con:
  - `source = 'bbva_report'`;
  - `source_category = '<Categoría>›<Subcategoría>'`, con los nombres españoles de la tabla;
  - su **id fijo**.

  Con ellas quedan enlazados los 4 pares no neutros del fichero sintético, y también `Compras›Alimentación`, que aparece en `bbva-informe-parcial.xlsx`. No se siembra nada para `No categorizable›…`.
- **Marcas de tiempo fijas**: todo lo sembrado lleva `created_at = updated_at = 2026-01-01T00:00:00.000Z`. Así, cualquier cambio real del usuario es posterior y gana en la fusión por campo de SPEC-0008.

### 2. Siembra (`categories.seedDefaults`)
- **Qué hace**: inserta la lista y sus equivalencias en una transacción, **solo si la tabla `category` no tiene ninguna fila** (tampoco borradas). Si tiene alguna, no hace nada.
- **Reloj**: se ejecuta con `sync_ctx.mode = 'seed'` (SPEC-0008). Si la captura está activa, los relojes de lo sembrado son `SEED_HLC` y no se encola nada; si no, el reloj implícito es su `created_at` fijo.
- **Cuándo**: en **cada desbloqueo**. `SecurityGate` espera a que termine **antes** de mostrar la app.
  - Si falla (por ejemplo, la base está bloqueada por otra pestaña, SPEC-0002), la app se muestra igualmente y se vuelve a intentar en el siguiente desbloqueo.
  - Así cubre las instalaciones ya configuradas y el borrado total con nueva configuración (SPEC-0013).
  - La comprobación es una consulta `SELECT 1 FROM category LIMIT 1`.
- **Sin migración nueva**: `db-version` sigue siendo 1. Los tests en Node que usan `migrate` no ven la lista.
- **Varios dispositivos** (SPEC-0008):
  - si dos dispositivos siembran, crean filas idénticas (mismos ids, valores y marcas de tiempo), y fusionarlas no cambia nada;
  - un renombrado o un borrado hecho en otro dispositivo tiene una marca posterior y gana.
  - SPEC-0008 debe fusionar lo sembrado como cualquier otra fila. No requiere ninguna regla especial.

### 3. Nombre visible (amplía `categoryLabel` de SPEC-0015)
- **Regla**:
  - con `system_key`, se muestra `categoryNames.<system_key>` del idioma activo;
  - sin él, se muestra `name`.
- **Renombrar**: guarda el nuevo `name` y pone `system_key = NULL`. Desde entonces se muestra igual en los dos idiomas.
- **Orden**: por nombre visible, con `localeCompare` del idioma activo.
- **Exportación** (SPEC-0013): usa `name`, así que las categorías sin renombrar salen en español. Es aceptable.

### 4. Pantalla Categorías (`#/ajustes/categorias`)
- **Rutas nuevas** en el router de SPEC-0016:
  - `#/ajustes/categorias`: sección 4, nivel 2;
  - SPEC-0018 añade `#/ajustes/reglas` en el nivel 3.
  - La regla de transición es la de SPEC-0016: desde Ajustes, `forward`; al volver, `back`.
- **Acceso**:
  - entrada **«Categorías» / «Categories»** en el menú de `TopBar`;
  - enlace en Ajustes, en una sección nueva **«Organización»**, entre «Seguridad» y «Datos».
  - Sin barra inferior en el móvil (SPEC-0006: «salvo `#/ajustes` y sus subrutas»).
  - Se vuelve con el logotipo o con «atrás».
- **Lista**: las categorías con su icono, cada una desplegable con sus subcategorías.
  - Cada fila muestra el nombre visible y el número de movimientos vivos (en el padre, incluidos los de sus subcategorías).
  - Botones **«Nueva categoría»** y, en cada categoría, **«Nueva subcategoría»**.
- **Crear y editar** (`Dialog`):
  - **«Nombre»**: obligatorio, hasta 40 caracteres;
  - **«Icono»**, solo en categorías: rejilla con los iconos permitidos. Una categoría nueva sin icono elegido recibe `more_horiz`. En las subcategorías el icono no se ofrece, y el worker guarda NULL aunque llegue uno;
  - **nombres repetidos**: la página comprueba que no haya dos con el mismo **nombre visible** (con `normalizeText`) bajo el mismo padre, o entre las categorías. El worker comprueba lo mismo sobre `name`. El error es `category_name_taken`, con el mensaje «Ya existe una categoría con ese nombre».
- **Iconos permitidos**: la constante `CATEGORY_ICONS` (`src/domain/categories/icons.ts`), compartida por la página y el worker. Son 32 de Material Symbols Rounded, importados como SVG:
  - los 10 de la tabla;
  - `restaurant`, `local_cafe`, `flight`, `school`, `pets`, `child_care`, `fitness_center`, `sports_esports`;
  - `movie`, `checkroom`, `devices`, `bolt`, `water_drop`, `wifi`, `phone_iphone`, `local_gas_station`;
  - `train`, `redeem`, `volunteer_activism`, `work`, `receipt_long`, `medical_services`.

  Uno fuera de la lista da `invalid_icon`.
- **Borrar** (borrado lógico):
  - **diálogo**: «¿Borrar «X»?». Si tiene subcategorías: «También se borrarán sus N subcategorías»;
  - **si tiene movimientos** (contando sus subcategorías): «Tiene M movimientos», con **«Moverlos a»** (`CategoryPicker` con `exclude` = la categoría y sus subcategorías y `allowNone: false`; opción por defecto) o **«Dejarlos sin categoría»**;
  - **destino**: no puede ser la categoría que se borra ni una de sus subcategorías; si lo es, el error es `category_move_target_invalid`;
  - **al confirmar**, en una transacción:
    1. los movimientos pasan al destino o a NULL;
    2. las equivalencias que apuntaban a lo borrado pasan al destino, o se borran;
    3. se borran la categoría y sus subcategorías;
  - SPEC-0018 amplía este diálogo con las reglas afectadas.
- **No incluido**: mover una subcategoría a otro padre y archivar categorías (`archived_at` queda sin uso).

### 5. Categorías del banco (sección de `#/ajustes/categorias`)
- **Lista**: cada par `(origen, categoría del banco)` que aparece en movimientos vivos. El origen es `import_batch.source` del movimiento (el mismo `source` que usa la sugerencia de SPEC-0011).
- **Cada fila muestra**:
  - el texto del banco;
  - la etiqueta de formato (SPEC-0015);
  - cuántos movimientos tiene y cuántos están sin categoría;
  - su equivalencia: una categoría o «Sin categoría».
- **Orden**: por número de movimientos, de mayor a menor.
- **Cambiar la equivalencia**, con `CategoryPicker`:
  - una categoría llama a `upsertCategoryMap`; «Sin categoría» borra la equivalencia (borrado lógico);
  - casilla **«Aplicar también a los K movimientos sin categoría con esta categoría del banco»**, desmarcada por defecto. Solo cambia los que **no tienen** categoría. Está deshabilitada si se elige «Sin categoría»;
  - sin la casilla, el cambio solo afecta a importaciones futuras.

### 6. Categorización múltiple en Movimientos (`#/movimientos`, SPEC-0015)
- **Modo selección**: botón **«Seleccionar»** en la cabecera de la lista.
  - Cada fila muestra una casilla, etiquetada con fecha, concepto e importe. Pulsar la fila la marca, en vez de abrir el detalle.
  - **«Cancelar»** o `Esc` salen del modo.
- **Barra de acción** (fija; en el móvil, encima de la barra inferior):
  - «N seleccionados», **«Categorizar»** y **«Cancelar»**;
  - si el filtro tiene más resultados que los cargados, el enlace **«Seleccionar los T que cumplen el filtro»**.
- **«Categorizar»**: abre `CategoryPicker`. Al elegir, se llama a `movements.setCategory`, en una transacción.
  - Se categorizan todos los seleccionados, traspasos incluidos.
  - Aviso (`Toast`): «N movimientos categorizados», con **«Deshacer»** durante 10 s, que llama a `movements.restoreCategories` con lo que devolvió `setCategory`.
  - La lista se refresca con el filtro actual.

### 7. API del worker y repositorios (`src/db/repo/categories.ts`)
**Categorías**:
- `categories.seedDefaults()`.
- `categories.list()` → `{ id, parentId, systemKey, name, icon, movementCount }[]`, solo las vivas. Añade `movementCount` al de SPEC-0015.
- `categories.create({ parentId?, name, icon? })` y `categories.update(id, { name?, icon? })`. Errores: `category_name_taken`, `category_name_empty`, `invalid_icon` y `category_depth`.
- `categories.delete(id, { moveTo: string | null })`. Error: `category_move_target_invalid`.

**Equivalencias**:
- `categoryMap.observed()` → `{ source, sourceCategory, movementCount, uncategorizedCount, categoryId: string | null }[]`.
- `categoryMap.set(source, sourceCategory, categoryId | null, { applyToUncategorized })` → `{ updated }`.

**Movimientos**:
- `movements.setCategory(target, categoryId | null)` → `{ previous: { id, categoryId }[] }`.
  - `target` es `{ ids: string[] }` o `{ filter: ListFilter }`.
  - `ListFilter` son los filtros de `listMovements` (SPEC-0015) **sin** `limit` ni `offset`.
- `movements.restoreCategories(previous)`.

**Textos**: todos tienen clave en `es.json` y `en.json`.

## Fuera de alcance
- Reglas por concepto: SPEC-0018.
- Mover subcategorías de padre, archivar categorías, colores por categoría y presupuestos.
- Equivalencias sembradas para orígenes distintos de BBVA.

## Criterios de aceptación
**Datos de partida**: los e2e parten de la seguridad configurada, sin datos y en español. Si cambian de idioma, vuelven a español antes de seguir.

**Ficheros e2e** (como máximo 3):
- `categorias.spec.ts`: CA-02, CA-03, CA-05, CA-06 y CA-07, encadenados;
- `categorias-gestion.spec.ts`: CA-04;
- `categorias-a11y.spec.ts`: CA-11. Importa antes `bbva-informe.xlsx` para tener movimientos.

1. **CA-01** · Siembra (Vitest, Node, SQLite en memoria tras `migrate`):
   - `seedDefaults` crea 10 categorías y 41 subcategorías con los ids, `system_key`, iconos y marcas de tiempo de `src/db/seed/categories.ts`;
   - crea 41 equivalencias `bbva_report` con ids fijos, entre ellas `Transporte›Combustible → transport_1`, `Ocio›Bares y restaurantes → leisure_1` y `Compras›Alimentación → shopping_1`, y ninguna para `No categorizable›…`;
   - una segunda llamada no hace nada;
   - con una categoría ya creada (aunque esté borrada), no hace nada;
   - dos bases sembradas por separado tienen filas idénticas, campo a campo, en `category` y `category_map`.
2. **CA-02** · Siembra al desbloquear (e2e):
   - tras configurar la seguridad, `#/ajustes/categorias` muestra las 10 categorías, y Diagnóstico sigue mostrando `db-version` = 1;
   - en inglés aparecen «Shopping» y «Groceries».
   - (Vitest de componente) `SecurityGate` no muestra la app hasta que `seedDefaults` resuelve.
3. **CA-03** · Importar con equivalencias (e2e, a continuación):
   - al importar `bbva-informe.xlsx` (SPEC-0010) sin activar traspasos, la revisión preselecciona categoría en «ABONO NOMINA EJEMPLO», «GASOLINERA EJEMPLO», los dos «CAFETERIA EJEMPLO» e «INGRESO EJEMPLO», y «Sin categoría» en los otros cuatro;
   - tras importar, Movimientos con el filtro «Sin categoría» muestra 4.
   - Cubre SPEC-0001 CA-08 (categorías).
4. **CA-04** · Gestión y navegación (e2e, contexto nuevo):
   - crear «Mascotas» con el icono `pets` y la subcategoría «Veterinario» las muestra en la lista;
   - crear «compras» da «Ya existe una categoría con ese nombre»;
   - renombrar «Compras» a «Supermercado y compras» muestra ese nombre también en inglés;
   - a 375 px, `#/ajustes/categorias` no muestra la barra inferior;
   - con el espía de SPEC-0003, ir desde Ajustes usa `vt-forward`, y «atrás» usa `vt-back`.
5. **CA-05** · Categorización múltiple (e2e, a continuación de CA-03):
   - con el filtro «Sin categoría», seleccionar «TRANSFERENCIA A MYINVESTOR» y «TRANSFERENCIA A MYINVESTOR B» (localizadas por texto exacto) y categorizarlos como «Otros gastos › Gastos varios» muestra «2 movimientos categorizados», y el filtro «Sin categoría» queda en 2;
   - «Deshacer» lo devuelve a 4.
6. **CA-06** · Equivalencias (e2e, a continuación):
   - «Categorías del banco» muestra `No categorizable›No asociable a gasto o ingreso` con 3 movimientos, 3 sin categoría y «Sin categoría»;
   - asignarle «Otros gastos › Gastos varios» con «Aplicar también a los 3 movimientos» deja el filtro «Sin categoría» en 1 y «Gastos varios» en 3.
7. **CA-07** · Borrar moviendo (e2e, a continuación):
   - borrar «Ocio» avisa de sus 5 subcategorías y de 2 movimientos;
   - moverlos a «Otros gastos › Gastos varios» deja ese filtro en 5;
   - la equivalencia `Ocio›Bares y restaurantes` muestra ahora «Gastos varios».
8. **CA-08** · Borrar, destino y errores (Vitest, Node):
   - con «Dejarlos sin categoría», los movimientos quedan con `category_id` NULL y las equivalencias que apuntaban a la categoría se borran;
   - un destino que es una subcategoría de la que se borra da `category_move_target_invalid` y no cambia nada;
   - `invalid_icon`, `category_name_empty` y `category_name_taken` se comprueban en `create`;
   - una subcategoría creada con icono queda con `icon` NULL;
   - `movements.setCategory` con `{ filter }` cambia exactamente los que devuelve `listMovements` con ese filtro, y `restoreCategories` deja cada uno como estaba.
9. **CA-09** · Nombre visible (Vitest):
   - `categoryLabel` de una categoría sembrada da «Compras» en español y «Shopping» en inglés;
   - una renombrada da su `name` en los dos;
   - el contrato de `CategoryPicker` (SPEC-0015 CA-10) sigue pasando sin cambios.
10. **CA-10** · `src/i18n/keys.test.ts` pasa, con las 51 claves `categoryNames.*` en los dos idiomas.
11. **CA-11** · axe sin infracciones en Categorías, sus diálogos, el selector abierto y el modo selección de Movimientos (claro y oscuro); sin scroll horizontal a 375 px.
12. **CA-12** · Los tests anteriores (e2e y Vitest) pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Nombres reales de BBVA**: la lista se basa en las categorías vistas y en las habituales de BBVA. Si el banco usa otros textos, esas filas llegan sin categoría y el usuario las enlaza una vez en «Categorías del banco» (punto 5).
- **Tests anteriores con la lista vacía**: SPEC-0010 y SPEC-0015 se implementan antes, sin categorías. Con la siembra, sus e2e verán categorías y sugerencias. Ninguno de sus CA comprueba que la lista esté vacía, pero si alguno falla, se para y se vuelve a Refinar (`test_changes: none`).
- **Tamaño para una sesión del plan Pro**: siembra, pantalla, equivalencias y selección múltiple. Si no cabe, se implementa en dos PR de la misma spec: puntos 1–3 y 5, y después 4 y 6.

### Preguntas abiertas
- Ninguna para el propietario.
