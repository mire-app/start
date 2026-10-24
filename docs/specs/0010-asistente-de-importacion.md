---
id: SPEC-0010
title: Asistente de importación (BBVA y MyInvestor)
status: draft          # draft → approved (solo una persona) → implemented
summary: Pantalla Importar con asistente por pasos (fichero, cuentas, revisión con lo que requiere atención primero, resultado con comprobación de saldo) para BBVA y MyInvestor xlsx/PDF
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0007, SPEC-0011, SPEC-0012, SPEC-0014, SPEC-0015, SPEC-0016, SPEC-0017, SPEC-0018, SPEC-0019, ADR-0004]
---

# SPEC-0010 · Asistente de importación (BBVA y MyInvestor)

## Intención
Que el propietario meta sus datos reales en Míre importando sus extractos de **BBVA** y **MyInvestor** (`.xlsx` y PDF):
- un asistente guiado;
- **revisar** solo lo que requiere decisión (duplicados, traspasos y aperturas);
- **comprobar que el saldo cuadra**.

El historial y «Deshacer» van en SPEC-0019; el mapeo de columnas para otros bancos, en SPEC-0017.

## Contexto
- `SPEC-0001` (draft): función 4, CA-04, CA-05, CA-07, CA-20 y CA-21, de extremo a extremo.
- `SPEC-0011` y `SPEC-0012`: motores, con estos contratos:
  - funciones `read`, `resolve` y `commit` en el worker;
  - tipos `ParsedFile`, `ImportPlan`, `ValuationPlan` y `Decisions`;
  - resultado de `commit`;
  - numeración `row` (clave) y `sheetRow` (la que ve el usuario);
  - errores: `xls_not_supported`, `unreadable_file`, `unknown_format`, `pdf_layout_unknown`, `nothing_to_import`, `external_requires_positive`, `external_conflicts_transfer`, `transfer_side_excluded`, `transfer_invalid`, `valuation_date_required`, `account_type_mismatch`, `account_assigned_twice` y `replace_without_duplicate`;
  - ficheros sintéticos en `src/import/__fixtures__/`.
- `SPEC-0004`: `recordBalanceCheck`, `parseAmount` y `parseDate`. `SPEC-0016`: router (`createHashRouter`) y datos de ejemplo. `SPEC-0006`: navegación, marcador de `#/importar` (esta spec lo sustituye) y repositorios de cuentas. `SPEC-0015`: lista de movimientos y su contador. `SPEC-0005`: autobloqueo y gancho `onBeforeLock`.
- `SPEC-0014`: CSP. La meta CSP no gobierna los workers, y la lectura se hace en el worker de la base de datos (ADR-0004).
- **Spike del 2026-10-24** (descartado): ExcelJS 4.4.0 y pdf.js 6.4.299 (`legacy`, `isEvalSupported: false`) leen `.xlsx` y PDF dentro de un Web Worker de módulo en Chromium con una CSP estricta en cabecera (sin `unsafe-eval`), sin infracciones.
- **Decisiones del propietario** (2026-10-24):
  - asistente por pasos, un fichero cada vez;
  - «primero lo que requiere atención»;
  - selector de archivos (más arrastrar y soltar en el ordenador);
  - traspasos sugeridos que el usuario confirma;
  - historial en SPEC-0019 y mapeo en SPEC-0017.

## Cambio (delta)
### 1. Pantalla Importar (`#/importar`)
- **Selección de fichero**:
  - **«Elegir fichero» / «Choose file»** (`<input type="file" accept=".xlsx,.csv,.pdf,.xls">` etiquetado);
  - **arrastrar y soltar** en el ordenador;
  - ayuda: «BBVA: informe de movimientos (.xlsx). MyInvestor: movimientos (.xlsx) o extracto con tu cartera (.pdf)».
- **Límite**: 10 MB, con el error `file_too_large`.

### 2. Asistente (estado en memoria; **no escribe nada hasta «Importar»**)
**Comportamiento general**:
- Indicador de pasos: «Fichero · Cuentas · Revisión · Resultado». SPEC-0017 inserta «Mapeo» cuando se usa.
- Los pasos 2 y 3 tienen **«Atrás»**, que conserva lo elegido. Volver al paso 1 descarta el fichero.
- **Estado**: vive en un almacén en memoria del módulo de importación (`src/features/import/session.ts`), fuera del componente. Guarda los bytes del fichero, el `ParsedFile`, el plan y lo elegido.
- **Salir a medias** (pasos 1 con fichero leído, 2 y 3): `useBlocker` del router pregunta «¿Descartar la importación en curso?». Cubre los enlaces, el botón «atrás» del navegador y editar el *hash* a mano. Recargar o cerrar la pestaña usa el aviso estándar `beforeunload`.
- **Bloqueo** (SPEC-0005): el asistente registra un `onBeforeLock` que vacía el almacén y deja la marca `discardedByLock`. No se había escrito nada. Al desbloquear, Importar vuelve al paso 1, muestra el aviso «La importación en curso se descartó al bloquearse Míre» y borra la marca.

**Paso 1 · Fichero** (`import.read`):
- **Si va bien**: el formato detectado («BBVA», «MyInvestor (movimientos)» o «MyInvestor (cartera)»), el número de filas o posiciones y el rango de fechas. Los **errores de fila** se listan como `fila <sheetRow>: <mensaje traducido>`; esas filas no se importan.
- **Errores de fichero**, cada uno con «Elegir otro fichero»:

  | Error | Mensaje |
  |---|---|
  | `xls_not_supported` | Instrucciones para guardar como `.xlsx` |
  | `unreadable_file` | «No se puede leer el fichero» |
  | `pdf_layout_unknown` | «Este PDF no tiene la tabla de posiciones de MyInvestor» |
  | `unknown_format` | «Formato no reconocido» (SPEC-0017 añade «Mapear columnas») |
  | `file_too_large` | «El fichero supera los 10 MB» |

**Paso 2 · Cuentas** (una tarjeta por cada entrada de `ParsedFile.accounts`):
- **Con `linkedAccountId`**: esa cuenta preseleccionada, y se puede cambiar.
- **Cuenta archivada**: si la cuenta elegida está archivada (enlazada o elegida a mano), aviso «Esta cuenta está archivada» con la casilla **«Desarchivar al importar»** marcada (decisión `unarchive`). El selector muestra las archivadas con la etiqueta «archivada».
- **Sin enlace**: **«Crear cuenta nueva»** (por defecto) o **«Usar una cuenta existente»**.
  - Al crear, el nombre es editable desde la propuesta y el tipo es `checking`, `savings` o `cash`.
  - En el PDF, el tipo `investment` es fijo y se conservan el ISIN y el grupo «Cartera MyInvestor».
- **Selector de cuenta existente**:
  - en el PDF solo ofrece cuentas `investment` y no repite una cuenta ya elegida para otro ISIN;
  - en movimientos ofrece las no `investment`.
- **PDF sin fecha**: campo **«Fecha de la valoración»** (`<input type="date">`), obligatorio. No admite fechas posteriores a hoy («La fecha no puede ser futura»). «Continuar» queda deshabilitado mientras falte o no sea válida.

**Paso 3 · Revisión** (`import.resolve(parsed, assignments, { valuationDate })`):
- **«Requiere tu atención»**, arriba:
  - **Saldo inicial** de las cuentas cuyo plan trae `opening`: campo editable con el valor sugerido, aceptado por defecto, y la explicación «Calculado a partir del primer saldo del extracto».
  - **Posibles duplicados** (`duplicate`): sin marcar por defecto, con la casilla «Importar igualmente».
  - **Parecidos** (`nearDuplicate`): incluidos por defecto, con la nota «Parecido a un movimiento ya importado (mismo día e importe)» y una casilla para excluirlo.
  - **Traspasos sugeridos**: tarjeta con **los dos lados** (cuenta, fecha, importe y concepto; si un lado ya estaba guardado, se indica «ya importado»), con el interruptor «Es un traspaso» **desactivado por defecto**. Si el usuario excluye una fila de un traspaso, el interruptor se desactiva y queda deshabilitado, con la nota «Incluye las dos filas para marcarlo como traspaso» (evita `transfer_side_excluded`).
  - **Avisos** del plan: `same_file` («Ya importaste este fichero») y `balance_chain_mismatch`.
- **Valoraciones** (PDF): una fila por posición (nombre, participaciones y valor) con el selector **«Importar» / «Omitir»**, y en las duplicadas **«Omitir»** (por defecto) / **«Reemplazar»**.
- **«Nuevos (N)»**, plegado por defecto con un resumen. Cada fila muestra:
  - casilla de incluir, fecha, concepto y `Amount`;
  - **categoría**: selector con `suggestedCategoryId` preseleccionado; sin categorías aparece solo «Sin categoría»;
  - **«Aportación externa»**: solo en filas con importe > 0. Es **excluyente** con «Es un traspaso»: si la fila está en un traspaso activado, el interruptor queda deshabilitado, y al revés.
- **Pie**: «Se importarán N movimientos (ingresos X, gastos Y), T traspasos y V valoraciones; se omitirán D».
  - N: filas incluidas, traspasos incluidos;
  - X e Y: suma de las incluidas que no están en un traspaso activado ni son aportación externa (la misma regla que el contador de SPEC-0015);
  - T: traspasos activados;
  - V: valoraciones con «Importar» o «Reemplazar»;
  - D: filas y posiciones que no se importan.
  - Botón **«Importar»**.
  - Si no hay nada que importar ni ninguna cuenta que crear, el botón queda deshabilitado con «No hay nada nuevo que importar».

**Paso 4 · Resultado** (`import.commit`, que devuelve `accounts[]` y `duplicateAtCommit`):
- «Importados N movimientos en: <cuenta (n)…>», con `importedCount` de cada cuenta, o «Importadas V valoraciones», con la suma de `valuationCount`.
- Si hay filas en `duplicateAtCommit`: «M filas no se importaron porque ya existían».
- **Saldo**, por cuenta:
  - **con `diffCents`**: 0 → «El saldo cuadra con el extracto»; otro valor → «Diferencia de ±X € con el extracto», con enlace a la cuenta;
  - **sin `diffCents` y con `lastDate`** (BBVA): campo opcional **«Saldo en tu banco el dd/mm/aaaa»**, con `lastDate`, y «Comprobar», que llama a `balance.record` (`recordBalanceCheck` con esa fecha) y muestra el mismo mensaje. El importe se lee con `parseAmount` (decimal `,`); si no es válido: «Importe no válido», sin llamar al worker;
  - cuentas solo con valoraciones: sin comprobación.
- **Error de `commit`**: la transacción se revierte y se muestra el mensaje traducido de su código, con «Volver a la revisión». Hay mensaje propio para `nothing_to_import`, `external_requires_positive`, `external_conflicts_transfer`, `transfer_side_excluded`, `transfer_invalid`, `replace_without_duplicate`, `account_type_mismatch`, `account_assigned_twice`, `template_invalid` y `template_mismatch` (SPEC-0017), y un mensaje genérico de reserva para cualquier otro código: «No se pudo importar. No se ha guardado nada».
- **Botones**: «Ver movimientos» (`#/movimientos?cuenta=…` si hay una sola cuenta) e «Importar otro fichero».

### 3. Integración
- **Ejecución**: la lectura (ExcelJS y pdf.js) y la lógica corren en el **worker de la base de datos** (ADR-0004).
  - pdf.js va con `isEvalSupported: false` y `GlobalWorkerOptions.workerSrc` apuntando a su worker.
  - Ese fichero, ExcelJS y pdf.js entran en el *precache*: importar funciona **sin conexión**.
- **Paso del fichero**: el cliente conserva los bytes en el almacén del asistente y envía **una copia** (clonado estructurado, sin transferir) en cada llamada que los necesita (`import.read` y, en SPEC-0017, `import.preview`). Nunca se guardan en disco. Se descartan al volver al paso 1, al salir del asistente, al bloquearse Míre y al llegar al resultado.
- **Decisiones**: lo elegido en los pasos 2 y 3 se traduce exactamente al tipo `Decisions` de SPEC-0011 y SPEC-0012.
- **Métodos de la API del worker que usa la interfaz** (`src/db/api.ts`); esta spec añade los que no existan ya:
  - `import.read`, `import.resolve` e `import.commit`;
  - `accounts.list` (cuentas vivas, con tipo y estado de archivo);
  - `categories.list`;
  - `balance.record`.
- **Textos**: todos tienen clave en `es.json` y `en.json`. Esta spec añade el test `src/i18n/keys.test.ts`, que comprueba que los dos ficheros tienen exactamente las mismas claves; las specs siguientes lo reutilizan.

## Fuera de alcance
- Historial y «Deshacer»: SPEC-0019. Mapeo de columnas: SPEC-0017.
- Varios ficheros a la vez, y «Compartir con Míre» (no elegidos).
- Crear o editar categorías y reglas: SPEC-0007 y SPEC-0018.

## Criterios de aceptación
**Condiciones de los e2e**:
- parten de la seguridad configurada y **sin** datos;
- se ejecutan sobre la build;
- suben los ficheros sintéticos con `setInputFiles`;
- **como máximo 5 ficheros e2e** en esta spec, con varios casos encadenados por contexto:
  1. `import-bbva.spec.ts`: CA-01 → CA-02 → CA-03 (primer contexto) → CA-09; CA-03 con `99,00` en un segundo contexto;
  2. `import-cartera.spec.ts`: CA-04 y CA-05, cada uno en su contexto;
  3. `import-extremos.spec.ts`: CA-06, CA-07 y CA-10, cada uno en su contexto;
  4. `import-offline-csp.spec.ts`: CA-11 y CA-12;
  5. `import-a11y.spec.ts`: CA-13 (texto en inglés) y CA-14.

1. **CA-01** · BBVA:
   - el paso 1 muestra «BBVA», 9 filas y 01/09/2026–20/09/2026;
   - el paso 2 propone crear «Diario» y «Ahorro»;
   - el paso 3 muestra 1 traspaso sugerido (filas 2 y 3, desactivado) y «Nuevos (9)»;
   - se activa el traspaso y se importa: el resultado dice 7 en «Diario» y 2 en «Ahorro»;
   - «Saldo en tu banco el 15/09/2026» de «Diario» con `1.023,44` → cuadra; con `1.000,00` → «Diferencia de +23,44 €»; con `abc` → «Importe no válido»;
   - Inicio muestra un patrimonio de `1.338,44 €`.
   - Cubre SPEC-0001 CA-04.
2. **CA-02** · Reimportar BBVA: el paso 3 muestra «Ya importaste este fichero», 9 posibles duplicados sin marcar y **ninguna** tarjeta de traspaso, y «Importar» queda deshabilitado.
3. **CA-03** · MyInvestor tras BBVA:
   - el paso 2 propone «MyInvestor efectivo»;
   - el paso 3 muestra el saldo inicial `100,00` y **solo** el traspaso de 500 € con «Diario» (10/09, «ya importado» ↔ 12/09);
   - al activarlo e importar, el resultado dice «El saldo cuadra con el extracto»;
   - en otro contexto, con el saldo inicial `99,00`, dice «Diferencia de −1,00 €».
   - Cubre SPEC-0001 CA-05 (movimientos), CA-07 y CA-21.
4. **CA-04** · Cartera:
   - `myinvestor-extracto.pdf` crea 4 cuentas en «Cartera MyInvestor», el resultado dice «Importadas 4 valoraciones» y el grupo vale `5.930,31 €` en Inicio;
   - `myinvestor-extracto-v2.pdf` con «Reemplazar» en LU0000000001 lo deja en `5.980,19 €`.
   - Cubre SPEC-0001 CA-05 (cartera).
5. **CA-05** · PDF sin fecha (con el reloj fijado por `page.clock` en `2026-10-24T12:00` hora local): con `myinvestor-extracto-sin-fecha.pdf`, el paso 2 exige la fecha; una fecha futura deja «Continuar» deshabilitado; con `24/10/2026` se importa, y el grupo vale `5.930,31 €`.
6. **CA-06** · Errores: `antiguo.xls`, `corrupto.xlsx`, `sin-posiciones.pdf`, `generico-latin1.csv` y un fichero de 11 MB generado en el test muestran sus mensajes.
7. **CA-07** · Aportación externa:
   - en BBVA, con la fila 1 (+2.000,00 €) como aportación externa y el traspaso **sin** activar, tras importar Movimientos (SPEC-0015) muestra la marca en esa fila y el contador da ingresos `315,00 €` y gastos `976,56 €`;
   - el interruptor no aparece en filas negativas;
   - al activar el traspaso de las filas 2 y 3, la fila 3 deja de ofrecerlo.
   - Cubre SPEC-0001 CA-20.
8. **CA-08** · Categoría sugerida (Vitest, componente con un plan simulado): la fila con `suggestedCategoryId` sale con esa categoría preseleccionada, y el resto con «Sin categoría».
9. **CA-09** · Cuenta archivada: tras importar BBVA, archivar «Diario» e importar `bbva-informe-parcial.xlsx`, el paso 2 avisa con «Desarchivar al importar» marcado; tras importar la fila nueva, «Diario» vuelve a verse en Inicio.
10. **CA-10** · Salir y bloquear:
    - en el paso 3, ir a Inicio muestra el diálogo. Al cancelar se sigue en el paso 3; al aceptar no se escribe nada (Inicio sigue sin cuentas);
    - en el paso 3, «Bloquear ahora» y desbloquear muestra el aviso de importación descartada, sin cuentas creadas;
    - «Atrás» del paso 3 al 2 conserva el nombre editado de una cuenta nueva;
    - con BBVA, en el paso 3, excluir la fila 3 desactiva y deshabilita el interruptor del traspaso de las filas 2 y 3.
11. **CA-11** · Sin conexión: tras una primera visita y con la red cortada, importar `bbva-informe.xlsx` y `myinvestor-extracto.pdf` funciona.
12. **CA-12** · CSP en el worker: en un e2e, `page.route` añade a las respuestas de los scripts de worker la CSP de SPEC-0014 sin `unsafe-eval` (como en el spike). Importar BBVA y el PDF funciona y no aparecen errores de CSP ni de `eval` en la consola de la página ni en la de los workers.
13. **CA-13** · `src/i18n/keys.test.ts` pasa, y en inglés el paso 1 muestra «Choose file».
14. **CA-14** · axe sin infracciones en Importar y en los 4 pasos (con el PDF y con BBVA), en claro y en oscuro; sin scroll horizontal a 375 px.
15. **CA-15** · Los e2e de todas las specs anteriores pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos, con el tiempo de esta spec medido y anotado en el PR.

## Riesgos y preguntas abiertas
### Riesgos
- **Tiempo de los e2e**: hay muchos recorridos. El límite es de 5 ficheros y se mide (CA-15).
- **Ficheros reales**: la validación real es SPEC-0012 CA-07 (`import:check`) y después el uso real (SPEC-0001 CA-19).

### Preguntas abiertas
- Ninguna para el propietario.
