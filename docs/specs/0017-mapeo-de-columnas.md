---
id: SPEC-0017
title: Mapeo de columnas y plantillas para otros bancos
status: draft          # draft → approved (solo una persona) → implemented
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
  - lector genérico con `read(bytes, fileName, template: { id, name, settings })`, que fuerza el lector genérico;
  - `normalizeRows(rawRows, settings)`;
  - enlaces con `source = 'generic'` y `sourceKey = template:<id>`;
  - la cuenta propuesta lleva el nombre de la plantilla;
  - la plantilla se guarda dentro de `commit` (`decisions.saveTemplate`);
  - `last_used_at`;
  - errores `template_mismatch` y `template_invalid`;
  - ficheros sintéticos `generico-latin1.csv` y `generico.xlsx`.
- `SPEC-0010`: asistente, pasos e indicador. **Se implementa antes.**
- `SPEC-0012`: `import:check --plantilla`, que usa el mismo formato de plantilla.
- **Decisión del propietario** (2026-10-24): separar el mapeo del asistente.

## Cambio (delta)
### 1. Vista previa en bruto (método nuevo `import.preview`)
- `import.preview(bytes, fileName, { sheet?, delimiter? })` → `{ format: 'csv' | 'xlsx', sheets?, sheet?, delimiter?, rows: string[][] }`.
  - `rows` son las **primeras 20 filas**, decodificadas como en SPEC-0011.
  - En `.xlsx` se usa la hoja indicada, o la primera si no se indica.
- No escribe nada.

### 2. Paso «Mapeo» del asistente (SPEC-0010)
- **Acceso**:
  - en el paso 1, ante `unknown_format`, aparece el botón **«Mapear columnas» / «Map columns»**;
  - en cualquier CSV o `.xlsx` reconocido, el enlace **«Usar mapeo de columnas»**.
  - El indicador pasa a «Fichero · Mapeo · Cuentas · Revisión · Resultado».
- **Contenido**:
  - la **tabla en bruto**, con números de fila y desplazamiento horizontal propio;
  - **«Fila de cabeceras»** (de la 1 a la 20); por defecto, la primera con 3 o más celdas de texto no vacías;
  - **«Hoja»** (`.xlsx`) y **«Separador»** (CSV: `;`, `,` o tabulador, con el detectado preseleccionado). Cambiarlos vuelve a pedir `import.preview`;
  - **selectores de columna**, que solo ofrecen cabeceras **no vacías y únicas** de esa fila:
    - obligatorios: «Fecha» y «Concepto»;
    - el importe: «Importe en una columna» (por defecto) o «Debe y Haber en columnas separadas»;
    - opcionales: «Fecha valor», «Saldo» y «Categoría del banco»;
  - **«Formato de fecha»**: `dd/mm/aaaa`, `dd-mm-aaaa`, `aaaa-mm-dd` o `mm/dd/aaaa`; se preselecciona el primero que interpreta bien todas las fechas de la vista previa;
  - **«Separador decimal»**: `,` (por defecto) o `.`.
- **Vista previa en vivo**: `normalizeRows` (SPEC-0011) sobre las filas de debajo de la cabecera, mostrando las 5 primeras (fecha, concepto y `Amount`) y marcando los errores con su mensaje.
- **«Continuar»**: deshabilitado mientras falten los obligatorios o si **todas** las filas de la vista previa dan error.
- **Plantilla**:
  - al entrar en el paso, el cliente genera el `id` de la plantilla (UUIDv7);
  - casilla **«Guardar como plantilla»**, marcada por defecto, y **«Nombre»** (por defecto, el nombre del fichero sin extensión);
  - al continuar se llama a `read(bytes, fileName, { id, name, settings })` y el asistente sigue en «Cuentas»;
  - la plantilla **solo se guarda al confirmar «Importar»** (decisión `saveTemplate`). Si se desmarca la casilla, el `sourceKey` sigue siendo `template:<id>`, pero ni la plantilla ni el enlace se reutilizarán.

### 3. Reconocimiento automático (`templates.match`)
- **Cuándo**: en el paso 1, si el formato no es predefinido.
- **Cómo**: el cliente pide `import.preview` de la hoja de cada plantilla candidata. Una plantilla viva **encaja** si su `headerRow` (≤ 19) contiene todas las cabeceras que usa (con `normalizeText`). Si encajan varias, gana la de `last_used_at` más reciente.
- **Si encaja**: «Reconocido con la plantilla «X»», y el asistente sigue directamente a «Cuentas» con `read(…, plantilla)`, con un enlace «Cambiar mapeo».
- **Uso**: `last_used_at` se actualiza **solo** en el `commit` (SPEC-0011). Renombrar no lo cambia.

### 4. Gestión de plantillas (en Importar, sección «Plantillas de otros bancos»)
- **Lista**: nombre y último uso, con **«Renombrar»** y **«Eliminar»** (borrado lógico, con confirmación). Eliminar no afecta a lo importado.
- **Métodos nuevos de la API del worker**:
  - `templates.list`;
  - `templates.rename(id, name)`, que no toca `last_used_at`;
  - `templates.delete(id)`;
  - `templates.match(previews)`, que recibe las vistas previas por hoja y devuelve el `id` ganador o `null`.

## Fuera de alcance
- Formatos predefinidos nuevos.
- Transformaciones avanzadas (columnas calculadas, varias filas por movimiento, filtros).
- `.xls` (ADR-0004).

## Criterios de aceptación
Los e2e parten de la seguridad configurada, sin datos, y usan los ficheros sintéticos de SPEC-0011.

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
3. **CA-03** · Sin guardar: abandonar el asistente en el paso «Cuentas» tras el mapeo no deja ninguna plantilla en la lista; con la casilla desmarcada e importando, tampoco.
4. **CA-04** · Validación:
   - sin «Concepto», «Continuar» queda deshabilitado;
   - con «Fecha» en una columna de texto, todas las filas de la vista previa dan `invalid_date` y «Continuar» sigue deshabilitado;
   - una cabecera repetida no aparece en los selectores.
5. **CA-05** · Plantillas: renombrar «Banco Ejemplo» a «Mi banco» no cambia su último uso; tras eliminarla, `generico.xlsx` vuelve a dar `unknown_format` con «Mapear columnas».
6. **CA-06** · `templates.match` (Vitest):
   - encaja con todas las cabeceras presentes;
   - no encaja si falta una;
   - con dos que encajan, gana la de `last_used_at` más reciente;
   - ignora las borradas.
7. **CA-07** · `import.preview` (Vitest), con un CSV de 30 filas generado en el test: devuelve exactamente 20 filas, decodifica `windows-1252` y detecta `;`.
8. **CA-08** · axe sin infracciones en el paso «Mapeo» y en la sección de plantillas (claro y oscuro). A 375 px, la tabla en bruto se desplaza dentro de su contenedor y la página no tiene scroll horizontal.
9. **CA-09** · Los e2e de todas las specs anteriores pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Extractos con varias tablas o cabeceras partidas**: el mapeo cubre una tabla con una fila de cabeceras.
- **Cabecera más allá de la fila 20**: no se puede mapear (`headerRow` ≤ 19). Es poco habitual en extractos bancarios.

### Preguntas abiertas
- Ninguna para el propietario.
