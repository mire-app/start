---
id: SPEC-0017
title: Mapeo de columnas y plantillas para otros bancos
status: draft          # draft → approved (solo una persona) → implemented
summary: Paso de mapeo en el asistente para CSV y .xlsx sin formato predefinido (fila de cabeceras, columnas, formato de fecha y decimales, vista previa), guardado de plantillas, reconocimiento automático y gestión de plantillas
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0010, SPEC-0011]
---

# SPEC-0017 · Mapeo de columnas y plantillas para otros bancos

## Intención
Importar extractos de **cualquier banco** que exporte CSV o `.xlsx`, aunque Míre no conozca su formato:
- el usuario indica una vez qué columna es cada cosa;
- lo guarda como **plantilla**;
- las siguientes veces Míre lo **reconoce solo**.

## Contexto
- `SPEC-0001` (draft): función 4 (mapeo y plantillas) y CA-06.
- `SPEC-0011`:
  - motor genérico (`generic_csv` y `generic_xlsx`) con `read(bytes, fileName, template)`;
  - `import_template.settings` (`headerRow`, `columns` por texto de cabecera, `dateFormat`, `decimal`, `delimiter`, `sheet` y `sourceKey`) y `saveTemplate`;
  - sus ficheros sintéticos `generico-latin1.csv` y `generico.xlsx`, y la plantilla de su CA-10.
- `SPEC-0010`: asistente y paso 1 con `unknown_format`. **Se implementa antes.**
- `SPEC-0004`: tabla `import_template` y borrado lógico.
- **Decisión del propietario** (2026-10-24): separar el mapeo del asistente.

## Cambio (delta)
### 1. Vista previa en bruto (worker, método nuevo `import.preview`)
- `import.preview(bytes, fileName, { sheet?, delimiter? })` devuelve:
  - el formato (`csv` o `xlsx`), las hojas (en `.xlsx`) y el separador detectado (en CSV);
  - las **primeras 20 filas** como matriz de textos, tal como aparecen (ya decodificados: UTF-8 o, si falla, `windows-1252`).
- No guarda nada.

### 2. Paso «Mapear columnas» en el asistente (SPEC-0010)
- **Acceso**:
  - en el paso 1, ante `unknown_format`, aparece el botón **«Mapear columnas» / «Map columns»**;
  - también hay un enlace **«Usar mapeo de columnas»** para cualquier CSV o `.xlsx` reconocido, por si el formato predefinido no encaja.
- **Contenido del paso**:
  - **Tabla** con las 20 filas en bruto, con desplazamiento horizontal propio y números de fila.
  - **«Fila de cabeceras»**: un selector con los números de fila; por defecto, la primera fila con 3 o más celdas de texto no vacías.
  - **Hoja** (en `.xlsx`) y **separador** (en CSV: `;`, `,` o tabulador, con el detectado preseleccionado).
  - **Selectores de columna**, cuyas opciones son los textos de la fila de cabeceras:
    - obligatorios: «Fecha» y «Concepto»;
    - importe, con un interruptor «Importe en una columna» (por defecto) o «Debe y Haber en columnas separadas», que muestra un selector o dos;
    - opcionales: «Fecha valor», «Saldo» y «Categoría del banco».
  - **«Formato de fecha»**: `dd/mm/aaaa`, `dd-mm-aaaa`, `aaaa-mm-dd` o `mm/dd/aaaa`. Se preselecciona el primero que interpreta bien todas las fechas de la vista previa.
  - **«Separador decimal»**: `,` (por defecto) o `.`.
- **Vista previa en vivo** de las 5 primeras filas ya normalizadas (fecha, concepto y `Amount`), con los errores de fila marcados con su mensaje.
- **«Continuar»** queda deshabilitado mientras falten los obligatorios o mientras **todas** las filas de la vista previa den error.
- **Guardar la plantilla**:
  - casilla **«Guardar como plantilla»**, marcada por defecto, y campo **«Nombre»** (por defecto, el nombre del fichero sin extensión);
  - al continuar, se guarda con `saveTemplate`, con `sourceKey` igual a `template:<id>`;
  - después el asistente sigue en su paso 2 (Cuentas) con `read(bytes, fileName, template)`.

### 3. Reconocimiento automático (`matchTemplate`, repositorio y worker)
- **Cuándo**: en el paso 1, si el formato no es predefinido.
- **Regla**: una plantilla viva **encaja** si su `headerRow` existe en el fichero (y, en `.xlsx`, su hoja) y **todas** las cabeceras que usa aparecen en esa fila (comparadas con `normalizeText`). Si encajan varias, gana la usada más recientemente (`updated_at`).
- **Si encaja**: el paso 1 dice «Reconocido con la plantilla «X»» y el asistente sigue directamente al paso 2, con un enlace «Cambiar mapeo».
- **Al usarla**: se actualiza `updated_at` de la plantilla.

### 4. Gestión de plantillas (en Importar, debajo del historial)
- Lista **«Plantillas de otros bancos»**: nombre y fecha de último uso, con **«Renombrar»** y **«Eliminar»** (borrado lógico con confirmación).
- Eliminar una plantilla no afecta a lo ya importado.
- **Repositorios nuevos**: `listTemplates`, `renameTemplate`, `deleteTemplate` y `matchTemplate(db, preview)`.

## Fuera de alcance
- Formatos predefinidos nuevos (otros bancos con detección propia).
- Transformaciones avanzadas: columnas calculadas, varias filas por movimiento o filtros por texto.
- `.xls` (ADR-0004).

## Criterios de aceptación
Los e2e parten de la seguridad configurada, sin datos, y usan los ficheros sintéticos de SPEC-0011.

1. **CA-01** · Mapeo de CSV:
   - con `generico-latin1.csv`, el paso 1 ofrece «Mapear columnas»;
   - la tabla muestra «COMPRA ÑANDÚ TIENDA» y «DEVOLUCIÓN» bien decodificados, y el separador `;` y la fila de cabeceras 1 vienen preseleccionados;
   - con Fecha, Concepto, Debe y Haber, Saldo, `dd/mm/aaaa` y `,`, la vista previa muestra `−45,90 €` y `+10,00 €`;
   - con el nombre «Banco Ejemplo» se continúa, se crea la cuenta «Banco Ejemplo» y se importan 2 movimientos.
   - Cubre SPEC-0001 CA-06.
2. **CA-02** · Reconocimiento: a continuación, con `generico.xlsx` el paso 1 dice «Reconocido con la plantilla «Banco Ejemplo»», el paso 2 preselecciona «Banco Ejemplo» y el paso 3 muestra **2 posibles duplicados**, porque son los mismos movimientos en la misma cuenta.
3. **CA-03** · Validación:
   - sin «Concepto», «Continuar» queda deshabilitado;
   - con «Fecha» en una columna de texto que no es fecha, la vista previa marca todas las filas con `invalid_date` y «Continuar» sigue deshabilitado.
4. **CA-04** · Plantillas: renombrar «Banco Ejemplo» a «Mi banco» se refleja en la lista; tras eliminarla, `generico.xlsx` vuelve a dar `unknown_format` con «Mapear columnas».
5. **CA-05** · `matchTemplate` (Vitest):
   - encaja con todas las cabeceras presentes;
   - no encaja si falta una;
   - con dos que encajan, gana la de `updated_at` más reciente;
   - ignora las plantillas borradas.
6. **CA-06** · `import.preview` (Vitest) devuelve 20 filas como máximo, decodifica `windows-1252` y detecta `;`.
7. **CA-07** · axe sin infracciones en el paso de mapeo (claro y oscuro). A 375 px, la tabla en bruto se desplaza dentro de su contenedor y la página no tiene scroll horizontal.
8. **CA-08** · Los e2e de todas las specs anteriores pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Extractos con formatos raros** (varias tablas o cabeceras partidas): el mapeo cubre una tabla con una fila de cabeceras; lo demás queda fuera de alcance.
- **Detección de la fila de cabeceras**: es heurística, y el usuario la puede cambiar.

### Preguntas abiertas
- Ninguna para el propietario.
