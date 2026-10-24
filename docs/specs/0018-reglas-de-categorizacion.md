---
id: SPEC-0018
title: Reglas de categorización por concepto
status: draft          # draft → approved (solo una persona) → implemented
summary: Reglas «el concepto contiene X → categoría Y» que sugieren categoría al importar (por encima de la del banco), creadas desde un movimiento o desde la pantalla de reglas, con vista previa para aplicarlas a lo ya importado
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0007, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0015, SPEC-0016]
---

# SPEC-0018 · Reglas de categorización por concepto

## Intención
Que los movimientos repetidos (supermercado, gasolinera, suscripciones) **se categoricen solos**:
- el usuario crea una vez la regla «el concepto contiene X → categoría Y»;
- puede aplicarla a lo ya importado, viendo antes qué cambia.

## Contexto
- `SPEC-0001` (draft): CA-08 (reglas).
- `SPEC-0004`: tabla `category_rule` (`pattern`, `pattern_norm`, `category_id`, con `UNIQUE(pattern_norm)` parcial) y `normalizeText`.
- `SPEC-0011`: gancho `suggestCategory(row)`, con prioridad sobre `category_map`, y los campos `suggestedBy = 'rule'` y `suggestedRule: { id, pattern }` de la fila del plan.
- `SPEC-0015`: `CategoryPicker`.
- `SPEC-0007`:
  - pantalla `#/ajustes/categorias` (sección 4, nivel 2);
  - diálogo de borrado de categorías;
  - `movements.setCategory` y `restoreCategories`;
  - siembra, con la equivalencia BBVA `Compras›Alimentación`.
  - **Se implementa antes.**
- `SPEC-0015`: detalle del movimiento y lista con filtros.
- `SPEC-0010`: revisión de la importación, con la nota «Por la regla «X»» cuando hay `suggestedRule`.
- `SPEC-0016`: router y regla de transiciones.
- Fichero `bbva-informe-parcial.xlsx` (SPEC-0011): fila 4 «SUPERMERCADO EJEMPLO», con la categoría del banco `Compras›Alimentación`.
- **Decisiones del propietario** (2026-10-24):
  - reglas «si el concepto contiene X → categoría Y»;
  - se crean desde un movimiento y desde una pantalla de reglas;
  - al crear o editar una regla, se pregunta si aplicarla a lo ya importado, con vista previa.

## Cambio (delta)
### 1. Coincidencia (`src/domain/rules.ts`, función pura)
- **Coincidencia**: una regla coincide con un movimiento si `normalizeText(description)` contiene `pattern_norm`, donde `pattern_norm = normalizeText(pattern)`.
- **Varias coincidencias**: gana la de `pattern_norm` **más largo** (la más concreta). En empate, gana la creada más recientemente.
- **Firma**: `matchRule(rules, description)` → la regla ganadora o `null`.
- **Patrón**: de 3 a 60 caracteres tras normalizar. Si no, el error es `rule_pattern_invalid`.

### 2. Al importar (gancho de SPEC-0011)
- `suggestCategory(row)` aplica `matchRule` con las reglas vivas, cargadas una vez por `resolve`.
- Si hay coincidencia, la fila del plan lleva `suggestedCategoryId` (la categoría de la regla), `suggestedBy = 'rule'` y `suggestedRule = { id, pattern }`, **por encima** de la equivalencia del banco.
- **En la revisión** (SPEC-0010), esa fila muestra la nota «Por la regla «X»», con `X = suggestedRule.pattern`. La sugerencia del banco no lleva nota.

### 3. Pantalla Reglas (`#/ajustes/reglas`)
- **Ruta nueva** en el router de SPEC-0016: `#/ajustes/reglas`, sección 4, **nivel 3**.
  - De Ajustes o de Categorías a Reglas, la transición es `forward`; al volver, `back`.
  - No muestra la barra inferior (SPEC-0006).
- **Acceso**: enlace **«Reglas» / «Rules»** en la sección «Organización» de Ajustes (SPEC-0007) y en la cabecera de Categorías. Se vuelve con el logotipo o con «atrás».
- **Lista**:
  - cada fila muestra «El concepto contiene «X» → <icono> Categoría» y cuántos movimientos vivos coinciden hoy;
  - orden por patrón;
  - acciones «Editar» y «Borrar», este con confirmación y borrado lógico.
- **Estado vacío**: «Aún no hay reglas. Créalas aquí o desde un movimiento».
- **«Nueva regla»** (`Dialog`):
  - campos «El concepto contiene» y «Categoría» (`CategoryPicker`, sin «Sin categoría»);
  - un patrón repetido da `rule_pattern_taken`, con el mensaje «Ya hay una regla para ese texto».

### 4. Crear desde un movimiento (detalle de SPEC-0015)
- **Botón «Crear regla»**: abre el mismo diálogo, con «El concepto contiene» relleno con el concepto del movimiento (el usuario lo recorta a la parte fija, p. ej. «MERCADONA») y la categoría actual del movimiento, si tiene.
- **Tras cambiar la categoría** en el diálogo de edición a una categoría (no a «Sin categoría»), aparece el aviso «¿Crear una regla para movimientos parecidos?», con el botón «Crear regla», que abre el mismo diálogo.

### 5. Aplicar a lo ya importado (vista previa)
- **Cuándo**: al guardar una regla nueva o editada, si `rules.preview` da `total > 0`. Cuenta los movimientos vivos que coinciden, sin traspasos y sin los que ya tienen la categoría de la regla.
- **Contenido**: un segundo paso del diálogo, «K movimientos ya importados coinciden», con su lista:
  - fecha, concepto, `Amount` y categoría actual;
  - en páginas de 50 con «Cargar más».
- **Casillas**:
  - marcadas por defecto en los que están **sin categoría**;
  - desmarcadas en los que ya tienen **otra** categoría.
  - Enlaces «Marcar todos» y «Desmarcar todos».
- **Selección**: el cliente no necesita los ids de las páginas sin cargar. Guarda la selección como `{ mode: 'defaults' | 'all' | 'none', include: string[], exclude: string[] }`:
  - `defaults` es el estado inicial; «Marcar todos» pone `all` y «Desmarcar todos» pone `none`, y ambos vacían las listas;
  - una casilla cambiada a mano se añade a `include` o a `exclude`.
  - El número N del botón se calcula con los totales de `rules.preview` (`total` y `uncategorizedTotal`) y las dos listas.
- **Botones**:
  - **«Aplicar a N»** llama a `rules.apply(id, selection)`, con el aviso «N movimientos categorizados» y «Deshacer» (`movements.restoreCategories`, SPEC-0007);
  - **«No aplicar»** solo guarda la regla.
- La regla se guarda **antes** de la vista previa. Cerrar el diálogo en ese paso equivale a «No aplicar».

### 6. Borrado de categorías (amplía el diálogo de SPEC-0007)
- Si hay reglas que apuntan a la categoría que se borra o a sus subcategorías, el diálogo añade «R reglas usan esta categoría».
- **Al confirmar**:
  - con **«Moverlos a»**, las reglas pasan al destino;
  - con **«Dejarlos sin categoría»**, las reglas se borran.

### 7. API del worker y repositorios (`src/db/repo/rules.ts`)
- `rules.list()` → `{ id, pattern, categoryId, matchCount, createdAt }[]`.
- `rules.create({ pattern, categoryId })` y `rules.update(id, { pattern?, categoryId? })`. Errores: `rule_pattern_invalid`, `rule_pattern_taken` y `rule_category_invalid` (categoría inexistente o borrada).
- `rules.delete(id)`.
- `rules.preview(id, { offset })` → `{ rows: { id, date, description, amountCents, categoryId }[], total, uncategorizedTotal }`, sin traspasos y sin los que ya tienen esa categoría.
- `rules.apply(id, { mode, include, exclude })` → `{ applied, previous: { id, categoryId }[] }`, en una transacción:
  - el conjunto de partida es el de `preview`, según `mode`: `defaults` son los sin categoría, `all` son todos y `none` ninguno;
  - después se suman `include` y se restan `exclude`, siempre dentro del conjunto de `preview`;
  - asigna la categoría de la regla.
- **Textos**: todos tienen clave en `es.json` y `en.json`.

## Fuera de alcance
- Condiciones distintas de «contiene»: empieza por, expresiones regulares, importe, cuenta o signo.
- Reglas que cambian el concepto, marcan traspasos o aportaciones externas.
- Aplicar reglas automáticamente a lo ya importado sin preguntar.
- Sugerir reglas de forma automática.

## Criterios de aceptación
Los e2e parten de la seguridad configurada, sin datos y con la siembra de SPEC-0007. Como máximo hay 2 ficheros e2e:
- `reglas.spec.ts`: CA-02, CA-03 y CA-04, encadenados;
- `reglas-a11y.spec.ts`: CA-09. Importa antes `bbva-informe.xlsx` y crea la regla «CAFETERIA» para tener la vista previa con datos.

1. **CA-01** · `matchRule` (Vitest):
   - «SUPERMERCADO» coincide con «Compra Supermercado Ejemplo» (mayúsculas y tildes normalizadas);
   - entre «SUPER» y «SUPERMERCADO», gana «SUPERMERCADO»;
   - en empate de longitud, gana la más reciente;
   - un patrón de 2 caracteres da `rule_pattern_invalid`.
2. **CA-02** · Desde un movimiento, con vista previa (e2e):
   - se importa `bbva-informe.xlsx` (SPEC-0010);
   - en el detalle del movimiento de −120,00 «TRANSFERENCIA A MYINVESTOR B», «Crear regla» con «MYINVESTOR» → «Otros gastos › Gastos varios» muestra «2 movimientos ya importados coinciden», ambos marcados («TRANSFERENCIA A MYINVESTOR» y «… B», sin categoría);
   - «Aplicar a 2» deja el filtro «Gastos varios» de Movimientos en 2.
3. **CA-03** · Prioridad al importar (e2e, a continuación):
   - en Reglas, «Nueva regla» con «SUPERMERCADO» → «Compras › Otras compras»; la vista previa no aparece, porque no hay coincidencias;
   - al importar `bbva-informe-parcial.xlsx`, la fila «SUPERMERCADO EJEMPLO» de la revisión llega con «Compras › Otras compras» preseleccionada y la nota «Por la regla «SUPERMERCADO»», aunque el banco diga `Compras›Alimentación`.
   - Cubre SPEC-0001 CA-08 (reglas).
4. **CA-04** · Ya categorizados (e2e, a continuación):
   - la regla «CAFETERIA» → «Compras › Otras compras» muestra 2 coincidencias **desmarcadas**, con su categoría actual «Bares y restaurantes»;
   - «No aplicar» las deja como estaban, y la regla aparece en la lista con «2 coincidencias»;
   - a 375 px, `#/ajustes/reglas` no muestra la barra inferior, y con el espía de SPEC-0003 ir de Categorías a Reglas usa `vt-forward`.
5. **CA-05** · Repositorio (Vitest, Node):
   - `rule_pattern_taken` ocurre también con «  cafetería » frente a «CAFETERIA»;
   - `rule_category_invalid` ocurre con una categoría borrada;
   - `rules.preview` excluye traspasos y los que ya tienen la categoría;
   - `matchCount` cuenta los movimientos vivos que coinciden, sin traspasos;
   - `rules.apply` con 120 coincidencias sintéticas (80 sin categoría):
     - `defaults` con 2 `exclude` aplica 78;
     - `all` aplica 120;
     - `none` con 1 `include` aplica 1;
     - `restoreCategories` deja todo como estaba.
6. **CA-06** · Borrado de categoría con reglas (Vitest, Node): al borrar una categoría con 1 regla, con «Moverlos a» la regla pasa al destino y con «Dejarlos sin categoría» se borra.
7. **CA-07** · Aviso tras editar (Vitest de componente): cambiar la categoría en el diálogo de edición de un movimiento muestra «¿Crear una regla para movimientos parecidos?»; sin cambiarla, o cambiándola a «Sin categoría», no aparece.
8. **CA-08** · `src/i18n/keys.test.ts` pasa, y en inglés la pantalla se titula «Rules».
9. **CA-09** · axe sin infracciones en Reglas, el diálogo (en sus dos pasos) y la nota de la revisión (claro y oscuro); sin scroll horizontal a 375 px.
10. **CA-10** · Los e2e de todas las specs anteriores pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Patrones demasiado amplios**: una regla como «PAGO» coincide con casi todo. La vista previa lo hace visible, y el mínimo de 3 caracteres limita el caso extremo.
- **Conceptos que cambian entre bancos**: la regla no distingue cuentas. Es suficiente para el MVP.
- **Coste de `matchCount`**: es O(reglas × movimientos) en cada carga de la lista. Con uso personal (decenas de reglas y miles de movimientos) es aceptable; si se nota lento, se calcula bajo demanda.

### Preguntas abiertas
- Ninguna para el propietario.
