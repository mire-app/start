---
id: SPEC-0012
title: Lector del PDF de cartera de MyInvestor y comprobación local de ficheros
status: draft          # draft → approved (solo una persona) → implemented
summary: Lectura de la tabla «Posiciones» del extracto PDF de MyInvestor con pdf.js (un fondo por cuenta, grupo «Cartera MyInvestor», valoraciones con duplicados), y herramienta import:check que valida ficheros reales en local sin mostrar datos
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0004, SPEC-0011, ADR-0004]
---

# SPEC-0012 · Lector del PDF de cartera de MyInvestor y comprobación local de ficheros

## Intención
- Actualizar el valor de cada fondo o plan de MyInvestor leyendo su **extracto PDF**, el único formato en que MyInvestor da la cartera.
- Dar al propietario una herramienta para **validar sus ficheros reales en su ordenador** sin compartirlos.

## Contexto
- `SPEC-0001` (draft, ampliada el 2026-10-24): CA-05 (cartera) y grupos de cuentas.
- `SPEC-0004`: esquema (`valuation`, `account_group`, `source_link`), `groupValue` y `parseAmount`.
- `SPEC-0011`: flujo `read` → `resolve` → `commit` → `revert`, lotes y ficheros sintéticos. **Se implementan antes.**
- `ADR-0004`: pdfjs-dist, que en Node usa su build `legacy`, y `tsx` para scripts.
- **Formato real observado** (capturas anonimizadas que el propietario compartió en el chat el 2026-10-24; no se guardan en el repositorio). Extracto de 5 páginas:

  | Página | Contenido |
  |---|---|
  | 1 | `FECHA:`, titular y «Posición integrada» |
  | 2 | «Detalle últimos movimientos de efectivo» |
  | 3 | Tabla **«Posiciones»**: `Código (ISIN) · Nombre · Divisa · Títulos · Precio medio posicion · Valor de mercado · Valor de mercado EUR` |
  | 4–5 | No se han visto |

  En la tabla de posiciones:
  - los títulos llevan punto decimal (`145.891`);
  - los valores van en es-ES con 4 decimales (`1.967,8300 €`);
  - algún fondo está en USD.
- **Decisiones del propietario** (2026-10-24): importar el PDF y tener un fondo por cuenta, con vista de grupo.

## Cambio (delta)
### 1. Lector PDF (`source = 'myinvestor_pdf'`, `src/import/pdf/`)
- **Detección**: un fichero que empieza por `%PDF-` y contiene, en algún punto, el texto «Posiciones» seguido de una fila de cabeceras con `Código`, `Nombre`, `Divisa`, `Títulos` y `Valor de mercado EUR`. Si no se cumple, da el error `pdf_layout_unknown`.
- **Extracción**: pdf.js devuelve el texto de cada página con sus coordenadas `(x, y)`. Se usa siempre con **`isEvalSupported: false`**, por la CSP de SPEC-0014.
- **Cabeceras**: pueden ocupar dos líneas (`Valor de` / `mercado EUR`). Los textos de la banda vertical de la cabecera se unen por columna, por proximidad en x. `Valor de mercado` y `Valor de mercado EUR` son columnas distintas: la de EUR es la que termina en `EUR`.
- **Columnas**:
  - cada columna se identifica por el **centro en x** de su cabecera;
  - los límites entre columnas están en el punto medio entre centros consecutivos;
  - cada texto se asigna por su **centro en x**, lo que tolera números alineados a la derecha.
- **Filas**:
  - una fila nueva empieza en cada texto de la columna `Código` con forma de ISIN (`^[A-Z]{2}[A-Z0-9]{9}[0-9]$`);
  - los textos de la columna `Nombre` situados entre esa fila y la siguiente, dentro de una tolerancia vertical de 1,5 veces la altura de línea, se concatenan con un espacio. Así se unen los nombres de varias líneas.
- **Fin de la tabla**:
  - la tabla puede continuar en las páginas siguientes **sin repetir cabecera**, reutilizando los límites de columnas de la página donde apareció;
  - termina en la **última fila con ISIN**: en las páginas siguientes, los textos que no estén en una fila con ISIN se ignoran;
  - si una página repite la cabecera, se recalculan los límites;
  - el ISIN se valida solo con la expresión regular, sin comprobar su dígito de control.
- **Fecha de la valoración**: la que sigue a `FECHA:` en la página 1, leída con `parseDate` en formato `dd/mm/aaaa`. Si falta o no es válida, `ParsedFile.valuationDate = null` y el plan exige `decisions.valuationDate`.
- **Cada posición** produce:
  - `sourceKey = isin`;
  - `name`, con el nombre completo;
  - `currency`;
  - `units`, el texto de `Títulos` tal cual (decimal con punto);
  - `valueCents`, con `parseAmount` de «Valor de mercado EUR» y `decimal=','`. Para los fondos en USD se usa siempre esta columna.
- **No se lee**: el titular, la cuenta, los movimientos de efectivo ni el precio medio.

### 2. Plan y confirmación (extensión de SPEC-0011)
- **Asignación**: cada ISIN se asigna con `source_link('myinvestor_pdf', isin)`. Si es nuevo, se propone `create: { name, type: 'investment', institution: 'MyInvestor', isin }` dentro del grupo «Cartera MyInvestor». El grupo se crea si no existe y se reutiliza si ya existe con ese nombre.
- **Duplicado de valoración**: si la cuenta ya tiene una valoración viva en esa fecha, el plan la marca `duplicate` con la acción por defecto `skip`. Las acciones posibles son:
  - `skip`: no se importa;
  - `replace`: borrado lógico de la anterior, con `deleted_by_batch_id` igual al lote nuevo, e inserción de la nueva;
  - `include`: no se permite, por la restricción `UNIQUE`.
- **Aviso de fichero**: si `file_sha256` coincide con un lote no revertido, el plan añade el aviso `same_file`.
- **`commit`**, en una transacción:
  - si todas las posiciones son `skip` y no hay cuentas que crear, devuelve `nothing_to_import` **sin crear lote**;
  - si no:
    1. crea el lote, las cuentas y el grupo propuestos (con `created_by_batch_id` igual al lote) y los `source_link`;
    2. inserta una `valuation` (`date`, `value_cents`, `units`, `import_batch_id`) por cada posición no omitida.
- **`revert`**, en una transacción:
  1. marca `deleted_at` en las valoraciones del lote;
  2. **restaura** (`deleted_at = NULL`, `deleted_by_batch_id = NULL`) las valoraciones que ese lote había reemplazado.

  Los lotes se deshacen en orden inverso: si una valoración fue reemplazada por un lote posterior que sigue vivo, `revert` del lote anterior da `revert_blocked_by_later_batch` (hay que deshacer antes el posterior).

  Así se cumple SPEC-0001 CA-21.

### 3. PDF sintético (`tools/build-fixtures.ts`, ampliado; pdf-lib)
`src/import/__fixtures__/myinvestor-extracto.pdf`, de 5 páginas con datos **inventados**:

| Página | Contenido |
|---|---|
| 1 | `FECHA: 24/10/2026`, `TITULAR: TITULAR EJEMPLO` y «Posición integrada» |
| 2 | «Detalle últimos movimientos de efectivo», con dos filas |
| 3 | «Posiciones», con cabeceras en dos líneas como en el real (`Precio medio` / `posicion`, `Valor de` / `mercado`, `Valor de` / `mercado EUR`) y tres filas (tabla siguiente). Los números van **alineados a la derecha**. |
| 4 | Una cuarta posición, como continuación de la tabla **sin cabecera repetida** |
| 5 | Texto legal genérico |

Las columnas «Precio medio posicion» y «Valor de mercado» también existen en el fixture, con valores inventados cualesquiera que el lector ignora.

| Código | Nombre | Divisa | Títulos | Valor de mercado EUR |
|---|---|---|---|---|
| LU0000000001 | FONDO EJEMPLO RENTA VARIABLE GLOBAL | EUR | 19.61 | 2.450,1234 € |
| IE0000000002 | dos líneas: `FONDO EJEMPLO INDEXADO EUROPA` y debajo `CLASE ACUMULACION` | EUR | 145.891 | 1.967,8350 € |
| LU0000000003 | FONDO EJEMPLO USA | USD | 4.42 | 1.012,3456 € |
| IE0000000004 (página 4) | FONDO EJEMPLO BONOS | EUR | 10 | 500,0000 € |

Variantes:
- `myinvestor-extracto-sin-fecha.pdf`: el mismo documento con `FECHA:` vacío;
- `myinvestor-extracto-v2.pdf`: el mismo documento con la primera posición a `2.500,0000 €`;
- `myinvestor-extracto-v3.pdf`: el mismo documento con la primera posición a `2.600,0000 €`;
- `sin-posiciones.pdf`: solo las páginas 1, 2 y 5.

### 4. Comprobación local (`tools/import-check.ts`, `pnpm import:check <fichero> [--plantilla <fichero.json>]`)
- `--plantilla` recibe un JSON con la forma de `import_template.settings` (SPEC-0011), para validar ficheros de bancos sin formato predefinido.
- Ejecuta `read` (SPEC-0011 y esta spec) en Node, contra una base vacía en memoria, sobre el fichero indicado. **No escribe en ninguna base persistente.**
- **Código de salida**: `0` si `read` termina, aunque haya errores de fila; `2` si hay un error de fichero (`xls_not_supported`, `unreadable_file`, `unknown_format`, `pdf_layout_unknown`), que se imprime como código.
- **Imprime solo**:
  - el formato detectado (`source`) o el código de error de fichero;
  - el número de filas o posiciones;
  - los errores de fila como `fila N: código`;
  - el rango de fechas (primera y última);
  - el número de claves de cuenta distintas, como `cuenta#1 … cuenta#k`, **sin su texto**;
  - si trae saldo (sí o no) y si se ha encontrado la fecha de la valoración (sí o no).
- **Nunca imprime** conceptos, importes, saldos, nombres, ISIN, alias de cuenta ni texto de celdas.

## Fuera de alcance
- Pantallas: SPEC-0010.
- Precio medio, plusvalías y operaciones de compra y venta: gestión de cartera, descartada.
- Movimientos de efectivo del PDF (se importan del `.xlsx`, SPEC-0011).
- PDF escaneados (imagen) y extractos de otras entidades.

## Criterios de aceptación
Tests de Vitest en Node, salvo CA-07.

1. **CA-01** · `myinvestor-extracto.pdf` se detecta como `myinvestor_pdf`, con `valuationDate = '2026-10-24'` y estas **4** posiciones, en orden:

   | ISIN | `name` | `units` | `valueCents` |
   |---|---|---|---|
   | LU0000000001 | | `"19.61"` | 245012 |
   | IE0000000002 | `FONDO EJEMPLO INDEXADO EUROPA CLASE ACUMULACION` | `"145.891"` | 196784 |
   | LU0000000003 | `currency = 'USD'` | `"4.42"` | 101235 |
   | IE0000000004 | | `"10"` | 50000 |

   La posición de la página 4 se lee como continuación de la tabla.
2. **CA-02** · `commit` sobre una base vacía:
   - crea el grupo «Cartera MyInvestor», 4 cuentas `investment` con su `isin` y 4 valoraciones a `2026-10-24`;
   - `groupValue` en esa fecha es **593031**.
3. **CA-03** · Duplicados y deshacer:
   - reimportar el mismo PDF marca las 4 valoraciones `duplicate` con la acción `skip` y el aviso `same_file`, y el `commit` devuelve `nothing_to_import` sin crear lote;
   - importar `myinvestor-extracto-v2.pdf` con `replace` en LU0000000001 da un `groupValue` de **598019**;
   - `revert` de ese lote lo devuelve a **593031**, con la valoración original restaurada;
   - importando v2 y después v3, ambas con `replace` en LU0000000001, `revert` del lote v2 da `revert_blocked_by_later_batch`; tras revertir antes el v3, el de v2 sí se revierte.
4. **CA-04** · `myinvestor-extracto-sin-fecha.pdf` produce `valuationDate = null`, y el `commit` sin `decisions.valuationDate` falla con `valuation_date_required`.
5. **CA-05** · `sin-posiciones.pdf` da `pdf_layout_unknown`.
6. **CA-06** · `pnpm import:check` sobre cada fichero sintético de SPEC-0011 y de esta spec:
   - termina con **código 0** en los válidos e imprime el formato correcto. Esto incluye `myinvestor-extracto.pdf`, `-v2.pdf` y `-v3.pdf`, `myinvestor-extracto-sin-fecha.pdf`, que imprime «fecha de valoración: no», y `generico-latin1.csv` y `generico.xlsx` con `--plantilla` apuntando a la plantilla de SPEC-0011 CA-10 (guardada como `src/import/__fixtures__/plantilla-generico.json`);
   - termina con **código 2** e imprime el código de error en `antiguo.xls`, `corrupto.xlsx` y `sin-posiciones.pdf`, y también en `generico-latin1.csv` **sin** `--plantilla` (`unknown_format`);
   - un test comprueba que su salida **no contiene** ningún concepto, importe, saldo, ISIN, alias (`DIARIO`, `AHORRO`), `TITULAR EJEMPLO` ni `ES00` de esos ficheros.
7. **CA-07** · **El propietario** ejecuta `pnpm import:check` en su ordenador sobre sus tres ficheros reales (informe de BBVA, movimientos de MyInvestor y extracto PDF) y confirma que se detecta el formato correcto **sin errores de fila**. Es condición para marcar esta spec como `implemented`.
8. **CA-08** · `.arda/checks.sh` completo sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Maquetación real**: el PDF sintético imita las capturas, pero las tolerancias de x e y solo se validan de verdad con el PDF real (CA-07). Si falla, el propietario comparte el resumen de `import:check` (sin datos), y se ajusta en una nueva iteración de Refinar.
- **Páginas 4 y 5 no vistas**: pueden contener más posiciones u otras tablas. El lector termina la tabla en la última fila con ISIN.
- **pdf.js en el navegador**: su worker debe estar en el *precache* (ADR-0004). Lo verificará el e2e de SPEC-0010.

### Preguntas abiertas
- Ninguna para el propietario.
