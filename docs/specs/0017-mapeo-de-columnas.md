---
id: SPEC-0017
title: Mapeo de columnas y plantillas para otros bancos
status: approved          # draft → approved (solo una persona) → implemented
summary: Paso «Mapeo» en el asistente para CSV y .xlsx sin formato predefinido (fila de cabeceras, columnas, formato de fecha y decimales, vista previa), plantilla guardada al importar, reconocimiento automático y gestión de plantillas
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0010, SPEC-0011, SPEC-0012]
---

# SPEC-0017 · Mapeo de columnas y plantillas para otros bancos

## Intención
Importar extractos de **cualquier banco** que exporte CSV o `.xlsx`:
- el usuario indica una vez qué columna es cada cosa;
- lo guarda como **plantilla** al importar;
- las siguientes veces Míre lo **reconoce solo**.

## Contexto
- `SPEC-0001` (draft): función 4 y CA-06.
- `SPEC-0011`:
  - `read(bytes, fileName, template: { id, name, settings })`, que fuerza el lector genérico;
  - celdas en bruto `Cell = string | number | Date | null` y `normalizeRows(rawRows, settings)`;
  - enlaces `('generic', template:<id>)`, que solo se crean si la plantilla existe tras el `commit`;
  - la cuenta propuesta lleva el nombre de la plantilla;
  - `plan.templateId`;
  - `saveTemplate` (upsert por `id`) dentro de `commit`;
  - `last_used_at`, que se actualiza en cada `commit` que usa una plantilla existente y es NULL hasta el primer uso;
  - errores `template_mismatch` y `template_invalid`;
  - repositorios en `src/db/repo/templates.ts`;
  - ficheros sintéticos `generico-latin1.csv` (texto) y `generico.xlsx` (celdas de fecha y numéricas).
- `SPEC-0010`:
  - asistente, pasos e indicador;
  - almacén en memoria con los bytes, de los que se envía una copia en cada llamada;
  - test de paridad `src/i18n/keys.test.ts`.
  - **Se implementa antes.**
- `SPEC-0012`: `import:check --plantilla`, que usa el mismo formato de plantilla.
- **Decisión del propietario** (2026-10-24): separar el mapeo del asistente.

## Cambio (delta)
### 1. Vista previa en bruto (método nuevo `import.preview`)
- **Firma**: `import.preview(bytes, fileName, { sheet?, delimiter? })` → `{ format: 'csv' | 'xlsx', sheets?, sheet?, delimiter?, rows: Cell[][] }`.
- **Filas**: `rows` son las **primeras 20 filas** de la hoja o del CSV, con las mismas celdas que vería `read`:
  - en CSV, texto decodificado como en SPEC-0011;
  - en `.xlsx`, `number`, `Date` o texto.
- **Hoja**: en `.xlsx` se usa la indicada, o la primera si no se indica.
- **Bytes**: el cliente envía una copia de los bytes guardados en el almacén del asistente (SPEC-0010), así que se puede llamar tantas veces como haga falta.
- No escribe nada.

### 2. Paso «Mapeo» del asistente (SPEC-0010)
#### Acceso
- En el paso 1, ante `unknown_format`, aparece el botón **«Mapear columnas» / «Map columns»**.
- En cualquier CSV o `.xlsx` reconocido aparece el enlace **«Usar mapeo de columnas»**.
- El indicador pasa a «Fichero · Mapeo · Cuentas · Revisión · Resultado».

#### Contenido
- **Tabla en bruto**, con números de fila y desplazamiento horizontal propio. Las celdas `Date` se muestran como `dd/mm/aaaa` y las numéricas con el formato del idioma.
- **«Fila de cabeceras»**: un selector de la 1 a la 20, guardado como `headerRow` de 0 a 19. Por defecto, la primera fila con 3 o más celdas de texto no vacías.
- **«Hoja»** (`.xlsx`) y **«Separador»** (CSV: `;`, `,` o tabulador, con el detectado preseleccionado). Cambiarlos vuelve a pedir `import.preview`.
- **Selectores de columna**: solo ofrecen cabeceras **no vacías y únicas** de esa fila, y una cabecera ya elegida no se ofrece en otro selector.
  - Obligatorios: «Fecha» y «Concepto».
  - El importe: «Importe en una columna» (por defecto) o «Debe y Haber en columnas separadas».
  - Opcionales: «Fecha valor», «Saldo» y «Categoría del banco».
- **«Formato de fecha»**: `dd/mm/aaaa`, `dd-mm-aaaa`, `aaaa-mm-dd` o `mm/dd/aaaa`.
  - Se preselecciona el primero que interpreta bien todas las fechas **de texto** de la vista previa.
  - Las celdas `Date` valen con cualquier formato (SPEC-0011).
- **«Separador decimal»**: `,` (por defecto) o `.`. Las celdas numéricas no dependen de él.

#### Vista previa en vivo
- `normalizeRows` (SPEC-0011) sobre las celdas de las filas de debajo de la cabecera.
- Muestra las 5 primeras (fecha, concepto y `Amount`) y marca los errores con su mensaje y el número de fila de la tabla en bruto.

#### «Continuar»
- Deshabilitado mientras falten los obligatorios o si **todas** las filas de la vista previa dan error.
- Al pulsarlo se llama a `read(bytes, fileName, { id, name, settings })`.
  - Si devuelve `template_mismatch` o `template_invalid`, el asistente se queda en «Mapeo» con el mensaje «El mapeo no encaja con el fichero. Revisa la fila de cabeceras y las columnas».
  - Si no, sigue en «Cuentas».

#### Plantilla nueva
- El cliente genera el `id` (UUIDv7) la primera vez que se entra en «Mapeo» con un fichero. Se conserva al ir «Atrás» desde «Cuentas» y volver; solo cambia al elegir otro fichero.
- «Atrás» desde «Cuentas» vuelve a «Mapeo» con todo lo elegido.
- Casilla **«Guardar como plantilla»**, marcada por defecto, y **«Nombre»** (por defecto, el nombre del fichero sin extensión).
- La plantilla **solo se guarda al confirmar «Importar»** (decisión `saveTemplate`).
- Si se desmarca la casilla, se importa sin crear la plantilla ni el enlace de cuenta (SPEC-0011).

#### Cambiar el mapeo de una plantilla reconocida
- «Cambiar mapeo» abre «Mapeo» con los ajustes de esa plantilla y **su mismo `id`**.
- En lugar de «Guardar como plantilla» aparece la casilla **«Actualizar la plantilla «X»»**, marcada por defecto.
  - **Marcada**: `saveTemplate` con ese `id` (upsert), que actualiza la plantilla y mantiene su enlace de cuenta.
  - **Desmarcada**: el cambio vale solo para esta importación y la plantilla no cambia.
  - En los dos casos su `last_used_at` se actualiza al confirmar.

#### Errores al confirmar
- Si el `commit` devuelve `template_invalid`, el resultado muestra su mensaje y el botón **«Volver al mapeo»**.

#### Textos
- Todos tienen clave en `es.json` y `en.json`.

### 3. Reconocimiento automático
- **Cuándo**: en el paso 1, si el formato no es predefinido.
- **Cómo**:
  - el cliente pide `templates.list`;
  - para cada plantilla viva, pide `import.preview` con su `sheet` (`.xlsx`) o su `delimiter` (CSV);
  - pasa las vistas previas a `templates.match`.
- **Cuándo encaja una plantilla**: si su fila `headerRow` contiene todas las cabeceras que usa (con `normalizeText`).
- **Desempate**: si encajan varias, gana la de `last_used_at` más reciente. NULL cuenta como la más antigua, y en empate gana la de `created_at` más reciente.
- **Si encaja**:
  - el asistente muestra «Reconocido con la plantilla «X»», con el enlace «Cambiar mapeo»;
  - sigue directamente a «Cuentas» con `read(…, plantilla)`.
- **Uso**: `last_used_at` se actualiza **solo** en el `commit` (SPEC-0011). Renombrar no lo cambia.

### 4. Gestión de plantillas (en Importar, sección «Plantillas de otros bancos»)
- **Lista**: nombre y fecha del último uso.
- **Acciones**: **«Renombrar»** y **«Eliminar»** (borrado lógico, con confirmación). Eliminar no afecta a lo importado.
- **Métodos nuevos de la API del worker** (repositorios en `src/db/repo/templates.ts`):
  - `templates.list()` → `{ id, name, format, settings, lastUsedAt, createdAt }[]`, solo las vivas;
  - `templates.rename(id, name)`, que no toca `last_used_at`;
  - `templates.delete(id)`;
  - `templates.match(previews: { templateId, rows: Cell[][] }[])` → el `id` ganador o `null`.

## Fuera de alcance
- Formatos predefinidos nuevos.
- Transformaciones avanzadas (columnas calculadas, varias filas por movimiento, filtros).
- `.xls` (ADR-0004).

## Criterios de aceptación
Los e2e parten de la seguridad configurada y sin datos, y usan los ficheros sintéticos de SPEC-0011. Son como máximo 2 ficheros e2e: `mapeo.spec.ts` (CA-01 → CA-02 → CA-03 → CA-05) y `mapeo-a11y.spec.ts` (CA-09).

1. **CA-01** · Mapeo de CSV:
   - con `generico-latin1.csv`, el paso 1 ofrece «Mapear columnas»;
   - la tabla muestra «COMPRA ÑANDÚ TIENDA» y «DEVOLUCIÓN» bien decodificados, con `;` y la fila de cabeceras 1 preseleccionados;
   - con Fecha, Concepto, Debe y Haber, Saldo, `dd/mm/aaaa` y `,`, la vista previa muestra `−45,90 €` y `+10,00 €`;
   - con el nombre «Banco Ejemplo», el paso de cuentas propone crear «Banco Ejemplo», y se importan 2 movimientos.
   - Cubre SPEC-0001 CA-06.
2. **CA-02** · Reconocimiento:
   - a continuación, `generico.xlsx` muestra «Reconocido con la plantilla «Banco Ejemplo»»;
   - el paso de cuentas preselecciona la cuenta enlazada «Banco Ejemplo»;
   - la revisión muestra **2 posibles duplicados**.
3. **CA-03** · Cambiar mapeo:
   - en ese mismo fichero, «Cambiar mapeo» muestra la vista previa con `03/09/2026` y `−45,90 €`, leídos de celdas de fecha y numéricas, sin errores;
   - se cambia el nombre a «Banco Ejemplo 2» con «Actualizar la plantilla» marcada, se incluye un duplicado con «Importar igualmente» y se importa;
   - la sección de plantillas muestra **una sola** plantilla, «Banco Ejemplo 2».
4. **CA-04** · Validación (Vitest de componente con `import.preview` simulado sobre filas generadas en el test, incluida una fila de cabeceras con `Importe` repetido):
   - sin «Concepto», «Continuar» queda deshabilitado;
   - con «Fecha» en una columna de texto, todas las filas de la vista previa dan `invalid_date` y «Continuar» sigue deshabilitado;
   - `Importe` repetido no aparece en los selectores, y una cabecera elegida no se ofrece en otro selector;
   - el selector «Fila de cabeceras» ofrece exactamente de la 1 a la 20;
   - si `read` devuelve `template_mismatch`, se muestra el mensaje y se sigue en «Mapeo».
5. **CA-05** · Eliminar y no guardar (e2e, a continuación):
   - eliminar «Banco Ejemplo 2» deja la sección vacía, y `generico.xlsx` vuelve a dar `unknown_format` con «Mapear columnas»;
   - mapearlo y abandonar el asistente en «Cuentas» no añade ninguna plantilla;
   - repetirlo con la casilla desmarcada e importando en una cuenta nueva tampoco la añade.
6. **CA-06** · `templates.match` y `templates.rename` (Vitest):
   - encaja si están todas las cabeceras, y no si falta una;
   - si encajan dos, gana la de `last_used_at` más reciente;
   - NULL pierde frente a una fecha;
   - ignora las borradas;
   - `templates.rename` deja `last_used_at` idéntico.
7. **CA-07** · `import.preview` (Vitest):
   - con un CSV de 30 filas generado en el test, devuelve exactamente 20 filas, decodifica `windows-1252` y detecta `;`;
   - con `generico.xlsx`, devuelve celdas `Date` y `number`, y `normalizeRows` sobre ellas da el mismo resultado que `read`.
8. **CA-08** · `src/i18n/keys.test.ts` pasa, y en inglés el botón muestra «Map columns».
9. **CA-09** · axe sin infracciones en el paso «Mapeo» y en la sección de plantillas (claro y oscuro). A 375 px, la tabla en bruto se desplaza dentro de su contenedor y la página no tiene scroll horizontal.
10. **CA-10** · Los e2e de todas las specs anteriores pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Extractos con varias tablas o cabeceras partidas**: el mapeo cubre una tabla con una fila de cabeceras.
- **Cabecera más allá de la fila 20**: no se puede mapear (`headerRow` ≤ 19). Es poco habitual en extractos bancarios.

### Preguntas abiertas
- Ninguna para el propietario.
