---
id: SPEC-0010
title: Asistente de importación (BBVA y MyInvestor)
status: draft          # draft → approved (solo una persona) → implemented
summary: Pantalla Importar con asistente por pasos (fichero, cuentas, revisión con lo que requiere atención primero, resultado con comprobación de saldo) para BBVA y MyInvestor xlsx/PDF, e historial de importaciones con deshacer
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0011, SPEC-0012, SPEC-0014, SPEC-0015, SPEC-0016, SPEC-0006, ADR-0004]
---

# SPEC-0010 · Asistente de importación (BBVA y MyInvestor)

## Intención
Que el propietario meta sus datos reales en Míre importando sus extractos de **BBVA** y **MyInvestor** (`.xlsx` y PDF):
- un asistente guiado;
- **revisar** solo lo que requiere decisión (duplicados y traspasos);
- **comprobar que el saldo cuadra**;
- **deshacer** cualquier importación.

Es la primera spec con la que Míre se puede usar de verdad. El mapeo de columnas para otros bancos va en SPEC-0017.

## Contexto
- `SPEC-0001` (draft): función 4, CA-04, CA-05, CA-07, CA-20 y CA-21, de extremo a extremo.
- `SPEC-0011` y `SPEC-0012`: motores (`read`, `resolve`, `commit` y `revert` en el worker; `ParsedFile.accounts`; plan con duplicados, traspasos, categoría, apertura y valoraciones; errores `xls_not_supported`, `unreadable_file`, `unknown_format` y `pdf_layout_unknown`; `nothing_to_import`, `revert_blocked_by_later_batch` y `already_reverted`) y sus ficheros sintéticos (`src/import/__fixtures__/`).
- `SPEC-0004`: `recordBalanceCheck` y dominio. `SPEC-0016`: router y datos de ejemplo. `SPEC-0006`: navegación, marcador de `#/importar` (esta spec lo sustituye) y cuentas archivadas. `SPEC-0015`: lista de movimientos (destino de «Ver movimientos»).
- `SPEC-0014`: CSP. **La meta CSP no gobierna los workers**, y la lectura se hace en el worker de la base de datos (ADR-0004).
- **Spike del 2026-10-24** (descartado): ExcelJS 4.4.0 y pdf.js 6.4.299 (build `legacy`, `isEvalSupported: false`) leen un `.xlsx` y un PDF **dentro de un Web Worker de módulo** en Chromium, servido con una CSP estricta en cabecera (sin `unsafe-eval`), sin infracciones. Queda despejado el riesgo de ADR-0004.
- **Decisiones del propietario** (2026-10-24):
  - asistente por pasos, un fichero cada vez;
  - revisión con «primero lo que requiere atención»;
  - selector de archivos (más arrastrar y soltar en el ordenador);
  - historial con «Deshacer» en Importar (por defecto, sin preferencia del propietario);
  - mapeo genérico en SPEC-0017;
  - traspasos sugeridos que el usuario confirma.

## Cambio (delta)
### 1. Pantalla Importar (`#/importar`)
- **Selección de fichero**:
  - botón **«Elegir fichero» / «Choose file»** (`<input type="file" accept=".xlsx,.csv,.pdf,.xls">`, etiquetado);
  - zona de **arrastrar y soltar** en el ordenador;
  - texto de ayuda: «BBVA: informe de movimientos (.xlsx). MyInvestor: movimientos (.xlsx) o extracto con tu cartera (.pdf)».
- **Límite de tamaño**: 10 MB, con el error `file_too_large`.
- **«Importaciones anteriores»**: la lista del punto 4.

### 2. Asistente (componente con estado; **no escribe nada hasta confirmar**)
Un indicador muestra los 4 pasos. Si se sale de `#/importar` con un asistente a medias, un diálogo pregunta «¿Descartar la importación en curso?».

**Paso 1 · Fichero**
- Se ejecuta `import.read` en el worker.
- **Si va bien**, se muestra:
  - el formato detectado: «BBVA», «MyInvestor (movimientos)» o «MyInvestor (cartera)»;
  - el número de filas o posiciones y el rango de fechas;
  - los avisos de fichero;
  - los **errores de fila** (`fila N: <mensaje traducido del código>`); esas filas no se importan.
- **Si hay un error de fichero**, mensaje traducido y la opción «Elegir otro fichero»:

  | Error | Mensaje |
  |---|---|
  | `xls_not_supported` | Instrucciones para guardar como `.xlsx` |
  | `unreadable_file` | «No se puede leer el fichero» |
  | `pdf_layout_unknown` | «Este PDF no tiene la tabla de posiciones de MyInvestor» |
  | `unknown_format` | «Formato no reconocido». SPEC-0017 añade aquí «Mapear columnas». |

**Paso 2 · Cuentas**, una tarjeta por cada clave de origen (`ParsedFile.accounts`):
- **Con cuenta enlazada viva**: se preselecciona y se puede cambiar por otra.
- **Si esa cuenta está archivada**: aviso «Esta cuenta está archivada», con la casilla **«Desarchivar al importar»** marcada por defecto.
- **Sin enlace**: se ofrece **«Crear cuenta nueva»** (por defecto) o **«Usar una cuenta existente»** (selector).
  - Al crear, el nombre (editable) viene de la propuesta.
  - El tipo es `checking`, `savings` o `cash` en movimientos, y fijo `investment` en el PDF.
  - En el PDF, el grupo es «Cartera MyInvestor».
- **Saldo inicial** (si el plan lo sugiere, MyInvestor): campo editable, aceptado por defecto, con la explicación «Calculado a partir del primer saldo del extracto».
- **Fecha de la valoración** (PDF sin fecha): campo de fecha obligatorio; «Continuar» queda deshabilitado mientras falte.

**Paso 3 · Revisión** (`import.resolve`):
- **«Requiere tu atención»** (arriba):
  - **Posibles duplicados**: cada uno sin marcar por defecto, con la casilla «Importar igualmente».
  - **Traspasos sugeridos**: tarjeta con los dos lados (cuenta, fecha e importe), y el interruptor «Es un traspaso» **desactivado por defecto**; el usuario confirma.
  - **Avisos**: `same_file` («Ya importaste este fichero») y `balance_chain_mismatch`.
  - **Valoraciones duplicadas** (PDF): selector «Omitir» (por defecto) o «Reemplazar».
- **«Nuevos (N)»**, plegado por defecto, con un resumen. Al desplegarlo, cada fila muestra:
  - casilla de incluir, fecha, concepto y `Amount`;
  - un selector de **categoría**, con la sugerida preseleccionada; hasta SPEC-0007 puede no haber categorías y solo aparece «Sin categoría»;
  - en entradas que no son traspaso, la acción **«Marcar como aportación externa»**.
- **Pie**: «Se importarán N movimientos (ingresos X, gastos Y), T traspasos y V valoraciones; se omitirán D».
  - Botón **«Importar»**.
  - Si no hay nada que importar ni ninguna cuenta que crear, el botón queda deshabilitado con el texto «No hay nada nuevo que importar».

**Paso 4 · Resultado** (`import.commit`):
- «Importados N movimientos en: …» (o valoraciones), más los avisos `duplicate_at_commit` si los hay.
- **Comprobación de saldo**, por cuenta con movimientos importados:
  - **si el fichero traía saldo**: se muestra `diff`. Con 0: «El saldo cuadra con el extracto». Si no: «Diferencia de ±X € con el extracto», con un enlace a la cuenta;
  - **si no lo traía (BBVA)**: campo opcional **«Saldo real en tu banco»** con «Comprobar», que llama a `recordBalanceCheck` y muestra el mismo mensaje.
- Botones «Ver movimientos» (`#/movimientos?cuenta=…` si hay una sola cuenta) e «Importar otro fichero».

### 3. Integración con los motores
- **Dónde se ejecuta**: la lectura (ExcelJS y pdf.js) y la lógica corren en el **worker de la base de datos** (ADR-0004).
- **pdf.js** se configura con `isEvalSupported: false` y `GlobalWorkerOptions.workerSrc` apuntando a su worker. Ese fichero, igual que ExcelJS y pdf.js, entra en el *precache* de la PWA, de modo que importar funciona **sin conexión**.
- **Paso del fichero**: los bytes viajan al worker como `ArrayBuffer` transferido; nunca se guardan.
- **Traducción de decisiones**: la interfaz convierte lo elegido en los pasos 2 y 3 a `assignments` y `decisions` de SPEC-0011 y SPEC-0012, incluidos «Desarchivar al importar» (llama a `unarchiveAccount` en la misma transacción del `commit`), el saldo inicial editado y la fecha de valoración.

### 4. Historial (`listImportBatches`, repositorio nuevo)
- **Contenido**: las importaciones **no demo**, de la más reciente a la más antigua, hasta 50.
- **Cada fila**: fecha y hora, formato (etiquetas de SPEC-0015), nombre del fichero, número importado y estado («Activa» / «Deshecha»).
- **«Deshacer»** (solo en las activas): diálogo que explica el efecto («Se borran sus N movimientos o valoraciones; los traspasos con otras importaciones se desvinculan; las cuentas se mantienen»).
  - Llama a `import.revert`.
  - El error `revert_blocked_by_later_batch` se explica: «Deshaz antes la importación del dd/mm/aaaa que reemplazó valoraciones de esta».

## Fuera de alcance
- Mapeo de columnas y plantillas para otros bancos: SPEC-0017.
- Varios ficheros a la vez, y «Compartir con Míre» desde Android (no elegido).
- Crear o editar categorías y reglas: SPEC-0007.

## Criterios de aceptación
**Condiciones de todos los e2e**:
- parten de la seguridad configurada y **sin** datos de ejemplo;
- se ejecutan sobre la build con la CSP de SPEC-0014;
- suben los ficheros sintéticos de `src/import/__fixtures__/` con `setInputFiles`;
- para no pasarse del tiempo, cada fichero e2e encadena varios casos en un mismo contexto.

1. **CA-01** · BBVA de extremo a extremo:
   - el paso 1 muestra «BBVA», 9 filas y el rango 01/09/2026–20/09/2026;
   - el paso 2 propone crear «Diario» y «Ahorro»;
   - el paso 3 muestra 1 traspaso sugerido (filas 2 y 3) desactivado y «Nuevos (9)». Se activa el traspaso y se importa;
   - el resultado dice 9 importados;
   - con «Saldo real» de «Diario» `1.023,44` dice que cuadra; con `1.000,00` dice «Diferencia de +23,44 €»;
   - Inicio muestra un patrimonio de `1.338,44 €`.
   - Cubre SPEC-0001 CA-04.
2. **CA-02** · Reimportar BBVA:
   - el paso 3 muestra el aviso «Ya importaste este fichero» y 9 posibles duplicados sin marcar;
   - «Importar» está deshabilitado con «No hay nada nuevo que importar».
3. **CA-03** · MyInvestor movimientos tras BBVA:
   - el paso 2 propone «MyInvestor efectivo» con un saldo inicial de `100,00`;
   - el paso 3 sugiere **solo** el traspaso de 500 € con «Diario» (10/09 ↔ 12/09);
   - al aceptarlo e importar, el resultado dice «El saldo cuadra con el extracto»;
   - en otro contexto, con el saldo inicial editado a `99,00`, dice «Diferencia de −1,00 €».
   - Cubre SPEC-0001 CA-05 (movimientos), CA-07 y CA-21.
4. **CA-04** · Cartera en PDF:
   - `myinvestor-extracto.pdf` crea 4 cuentas de inversión en «Cartera MyInvestor», y en Inicio el grupo vale `5.930,31 €`;
   - `myinvestor-extracto-v2.pdf` con «Reemplazar» en LU0000000001 lo deja en `5.980,19 €`;
   - deshacer esa importación lo devuelve a `5.930,31 €`.
   - Cubre SPEC-0001 CA-05 (cartera).
5. **CA-05** · `myinvestor-extracto-sin-fecha.pdf`: el paso 2 exige la fecha; con ella, la importación funciona.
6. **CA-06** · Errores:
   - `antiguo.xls`, `corrupto.xlsx`, `sin-posiciones.pdf` y `generico-latin1.csv` muestran sus mensajes;
   - un fichero de 11 MB, generado en el test, da `file_too_large`.
7. **CA-07** · Aportación externa: en el paso 3 de BBVA, marcar la fila 1 (+2.000,00 €) como aportación externa hace que, tras importar, aparezca así en Movimientos (SPEC-0015) y no cuente como ingreso. Cubre SPEC-0001 CA-20.
8. **CA-08** · Categoría sugerida (Vitest, componente con un plan simulado): la fila con `suggestedCategoryId` sale con esa categoría preseleccionada, y el resto con «Sin categoría».
9. **CA-09** · Historial y deshacer:
   - tras BBVA y MyInvestor con el traspaso aceptado, el historial lista 2 importaciones activas;
   - deshacer la de BBVA la marca «Deshecha», pone «Diario» a `0,00 €` y deja el movimiento de +500 de MyInvestor sin traspaso;
   - la fila deshecha ya no ofrece «Deshacer»;
   - los datos de ejemplo cargados desde Diagnóstico no aparecen en el historial.
10. **CA-10** · Cuenta archivada: tras importar BBVA, archivar «Diario» y deshacer la importación, al reimportar el paso 2 avisa de que está archivada con «Desarchivar al importar» marcado; tras importar, «Diario» vuelve a verse en Inicio.
11. **CA-11** · Salir a medias: en el paso 3, ir a Inicio muestra el diálogo. Al cancelar se sigue en el paso 3; al aceptar, `listImportBatches` sigue vacío.
12. **CA-12** · Sin conexión: tras una primera visita y con la red cortada, importar `bbva-informe.xlsx` y `myinvestor-extracto.pdf` funciona, porque las librerías y el worker de pdf.js están en el *precache*.
13. **CA-13** · CSP: durante CA-01 a CA-12 no se produce ningún evento `securitypolicyviolation`, y la consola no muestra errores de `eval`.
14. **CA-14** · axe sin infracciones en Importar, los 4 pasos, el historial y los diálogos, en claro y en oscuro; sin scroll horizontal a 375 px.
15. **CA-15** · Los e2e de todas las specs anteriores pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Tiempo de los e2e**: es la spec con más recorridos. Mitigación: encadenar casos por contexto y medir; si se supera el límite, agrupar más (sin quitar CA).
- **Ficheros reales**: los e2e usan ficheros sintéticos. La validación real es SPEC-0012 CA-07 (`import:check`), y después usarlo de verdad (SPEC-0001 CA-19).
- **Tamaño**: 4 pasos, historial y 15 CA. Cabe en una sesión si se reutilizan los componentes de SPEC-0003; si no, se separa el historial (requiere volver a Refinar).

### Preguntas abiertas
- Ninguna para el propietario.
