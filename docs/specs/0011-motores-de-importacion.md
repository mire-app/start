---
id: SPEC-0011
title: Motores de importación xlsx y CSV
status: draft          # draft → approved (solo una persona) → implemented
summary: Lectores BBVA (informe xlsx), MyInvestor movimientos (xlsx) y genérico CSV/xlsx con plantilla; plan con cuentas por clave de origen, duplicados, traspasos, categorías y apertura; commit, revert y comprobación de saldo; sin pantallas
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0004, ADR-0004]
---

# SPEC-0011 · Motores de importación xlsx y CSV

## Intención
Convertir los extractos `.xlsx` y CSV del propietario en movimientos de Míre:
- **sin duplicar**;
- **sugiriendo traspasos** entre cuentas propias;
- **comprobando que el saldo cuadra**;
- pudiendo **deshacer** cada importación.

Es la lógica que usará el asistente de SPEC-0010. **Sin pantallas.**

## Contexto
- `SPEC-0001` (draft, ampliada el 2026-10-24): función 4, CA-04, CA-05 (movimientos), CA-06, CA-07 y CA-21.
- `SPEC-0004`: esquema, `SqlDb`, repositorios, dominio, `parseAmount`, `parseDate` y `normalizeText`. **Se implementa antes.**
- `ADR-0004`: ExcelJS, PapaParse, UUIDv7, SHA-256 y `tsx` para scripts.
- **Formatos reales observados** (capturas anonimizadas que el propietario compartió en el chat el 2026-10-24; no se guardan en el repositorio):
  - **BBVA**, «Informe de gastos, ingresos y movimientos de ahorro o financiación» (`.xlsx`):
    - logotipo, título y «Fecha de generación del informe»;
    - tabla resumen `Desde · Hasta · Categoría · Subcategoría · Importe`;
    - tabla de movimientos `Fecha · Producto · Entidad · Categoría · Subcategoría · Importe · Concepto · Observaciones`;
    - `Producto` es el alias que el usuario da a cada cuenta, así que el informe puede traer varias cuentas;
    - sin saldo, con una sola fecha y cargos en negativo.
  - **MyInvestor**, `Movimientos_….xlsx`:
    - cabecera `TITULAR:` · `CUENTA:` · `Saldo:` y título «Movimientos»;
    - tabla `Fecha Operación · Fecha Valor · Movimiento · Importe · Saldo`;
    - importes como texto con € pegado (`10,81€`).
- **Decisiones del propietario** (2026-10-24):
  - duplicados marcados para que él decida;
  - fecha de operación;
  - deshacer por lote;
  - comprobación de saldo (del fichero o indicada por él);
  - traspasos sugeridos con margen de ±3 días y confirmados por él;
  - CSV y `.xlsx` sin `.xls`;
  - categorías de BBVA como sugerencia;
  - aportación externa.

## Cambio (delta)
### 1. Flujo (`src/import/`)
Las librerías se cargan bajo demanda (ADR-0004). Todo se ejecuta **dentro del worker de SPEC-0004** mediante métodos nuevos de su API (`import.read`, `import.resolve`, `import.commit`, `import.revert`, `import.saveTemplate`), con estos pasos:

1. **`read(bytes, fileName, template?)`** detecta el formato, lee el fichero y produce un **`ParsedFile`**:
   - `source` y `file_sha256`;
   - filas normalizadas `{ row, sourceKey, date, valueDate?, amountCents, description, note?, sourceCategory?, balanceCents? }`;
   - errores por fila `{ row, code }`;
   - las filas se devuelven **en el orden del fichero**; el orden cronológico y el aviso `balance_chain_mismatch` los calcula `resolve`;
   - **`accounts`**: una entrada por `sourceKey` distinta, `{ sourceKey, linkedAccountId?, proposal: { name, type, institution } }`. Se calcula consultando los `source_link` **vivos** cuya cuenta también esté viva; los enlaces a cuentas borradas se ignoran. Si hay enlace, el asistente asigna por defecto la cuenta enlazada; si no, propone `proposal`.
2. **`resolve(parsed, assignments)`** produce el **`ImportPlan`**. `assignments` dice, para cada `sourceKey`, `{ accountId }` o `{ create: { name, type, institution } }`.
3. **`commit(plan, decisions)`** guarda el lote.
4. **`revert(batchId)`** lo deshace.

### 2. Detección y errores de fichero
- **`.xls`** (firma OLE `D0 CF 11 E0`, sea cual sea la extensión): error `xls_not_supported`, con el mensaje traducido «Guarda el fichero como .xlsx (Excel → Guardar como) e impórtalo de nuevo».
- **`.xlsx` ilegible**: `unreadable_file`.
- **Formato no reconocido** sin plantilla: `unknown_format`.
- **Fila ilegible**: no aborta el fichero; produce un error de fila con código (`invalid_amount`, `invalid_date`, `empty_required`), **sin el texto de la celda**.

### 3. BBVA (`source = 'bbva_report'`)
- **Detección**: alguna fila de la primera hoja contiene, con `normalizeText`, exactamente las cabeceras `FECHA, PRODUCTO, ENTIDAD, CATEGORIA, SUBCATEGORIA, IMPORTE, CONCEPTO, OBSERVACIONES`.
- **Lectura**: las filas siguientes hasta la primera vacía. La tabla resumen anterior se ignora.
- **Mapeo**:

  | Campo de Míre | Origen |
  |---|---|
  | `date` | `Fecha`, que puede ser texto `dd/mm/aaaa` o celda de fecha |
  | `amountCents` | `Importe` |
  | `description` | `Concepto` |
  | `note` | `Observaciones` |
  | `sourceCategory` | `Categoría›Subcategoría` |
  | `sourceKey` | `Entidad·Producto` (p. ej. `BBVA·AHORRO`) |

- No trae `balanceCents`.
- **Cuenta nueva propuesta**: nombre `Producto` en formato título («Ahorro»), tipo `checking` e institución `Entidad`.

### 4. MyInvestor movimientos (`source = 'myinvestor_movements'`)
- **Detección**: fila de cabeceras `FECHA OPERACION, FECHA VALOR, MOVIMIENTO, IMPORTE, SALDO`.
- **No se leen** las celdas `TITULAR:` ni `CUENTA:`.
- **Mapeo**:

  | Campo de Míre | Origen |
  |---|---|
  | `date` | `Fecha Operación` |
  | `valueDate` | `Fecha Valor` |
  | `description` | `Movimiento` |
  | `amountCents` | `Importe` |
  | `balanceCents` | `Saldo` |
  | `sourceKey` | `default` |

- **Cuenta nueva propuesta**: «MyInvestor efectivo», tipo `savings` e institución `MyInvestor`.
- El orden cronológico sigue la regla común del punto 6.

### 5. Genérico CSV y `.xlsx` (`source = 'generic_csv' | 'generic_xlsx'`)
- **CSV**: se decodifica UTF-8 estricto y, si falla, `windows-1252`. El separador (`;`, `,`, tabulador) se detecta solo o lo fija la plantilla.
- **Plantilla** (`import_template.settings`, JSON):
  - el **formato lo determina el fichero**, no la plantilla;
  - `format` es **informativo**: el formato del fichero con el que se creó, que también se guarda en `import_template.format`. Una plantilla vale para CSV y para `.xlsx`; `delimiter` se ignora en `.xlsx` y `sheet` se ignora en CSV;
  - `headerRow` (índice de la fila de cabeceras, desde 0);
  - `columns`, cuyas claves son `date`, `description`, `amount` **o** `debit` + `credit`, y opcionalmente `valueDate`, `balance` y `category`; cada valor es el **texto de la cabecera** comparado con `normalizeText`;
  - `dateFormat`, `decimal` y `sourceKey` (texto libre, por defecto `default`);
  - `sheet` (solo `.xlsx`) y `delimiter` (solo CSV).
- **Debe y Haber**: `debit` con valor da importe **negativo** y `credit` da **positivo**. Si ambos tienen valor, o ninguno, la fila da el error `empty_required`.
- **Saldo**: la columna `balance` es opcional por fila. Una celda vacía da `balanceCents` indefinido, y esa fila no se usa para la comprobación de saldo.
- **`saveTemplate(name, settings)`** crea un `import_template`. Si la plantilla se pasa a `read`, se aplica a otro fichero con la misma estructura.

### 6. Plan (`resolve`)
**Orden cronológico (todos los formatos)**: antes de calcular el plan, las filas de cada `sourceKey` se ordenan así:
- si la fecha de la primera fila es posterior a la de la última, el fichero está en orden descendente y se invierte entero;
- si todas las fechas son iguales y hay saldo, se elige el sentido en el que se cumple la cadena `saldo[i] = saldo[i−1] + importe[i]`. Si no se cumple en ninguno de los dos sentidos, se mantiene el orden del fichero y se añade el aviso `balance_chain_mismatch`;
- después, el orden es estable.

Para cada fila, ya con su cuenta asignada o la cuenta nueva con un **id provisional** UUIDv7 generado en `resolve`, el plan calcula:

- **Huella**: `sha256(accountId | date | amountCents | normalizeText(description) | ordinal)`. `ordinal` es el número de aparición de esa combinación en el fichero, empezando en 0.
- **Duplicado**:
  - si la huella ya existe en un movimiento vivo: `duplicate = true` e `include = false` por defecto;
  - si `file_sha256` coincide con un lote no revertido, el plan añade el aviso `same_file`.
- **Sugerencia de traspaso**:
  - candidatos: pares con importes opuestos e iguales, en cuentas distintas, con `|Δfecha| ≤ 3` días y sin traspaso asignado;
  - se buscan dentro del plan y frente a movimientos vivos ya guardados;
  - emparejamiento voraz por menor `Δfecha` y, en empate, por orden de fichero;
  - cada movimiento está en un único par;
  - **no se aplica** si no se acepta.
- **Sugerencia de categoría**:
  1. gancho `suggestCategory(row)` (SPEC-0007; hasta entonces no devuelve nada);
  2. `category_map(source, sourceCategory)`;
  3. ninguna.
- **Apertura** (solo si las filas traen saldo y la cuenta no tiene movimientos vivos): se sugiere `opening = saldo(primera fila cronológica) − importe(primera fila)`, con `opening_date` igual a esa fecha.

### 7. Confirmación (`commit`) en una única transacción
**Validación previa**: antes de escribir nada, `commit` valida las decisiones. Una fila con `kind='external'` e importe negativo da `external_requires_positive`, sin escribir nada.

**Comprobación de duplicados en la confirmación**: dentro de la transacción, `commit` vuelve a comprobar cada huella. Las filas cuya huella ya existe en ese momento (la base cambió desde `resolve`) no se insertan y se devuelven como `duplicate_at_commit`.

**Decisiones**:
- por fila: `include`, `categoryId?` y `kind` (`regular` | `external`);
- por sugerencia de traspaso: aceptada sí o no. Si se excluye (`include=false`) una fila de un par aceptado, el traspaso no se aplica y la otra fila se importa como `regular`;
- por cuenta: `opening: { accept, cents? }`, con valor editable.

**Efectos**:
1. Crea el `import_batch` con los recuentos.
2. Crea las cuentas nuevas con su id provisional y `created_by_batch_id` igual al lote (SPEC-0004), y hace `upsertSourceLink(source, sourceKey, accountId)` para **todas** las asignaciones, nuevas o existentes.
3. Aplica la apertura aceptada.
4. Inserta los movimientos incluidos con su `fingerprint`, `import_batch_id` y `source_category`.
5. Llama a `linkTransfer` (SPEC-0004) para cada traspaso aceptado, también si la contrapartida ya estaba guardada.
6. Si las filas traen saldo, guarda un `balance_check` con `source='file'`, `expected` igual al saldo de la última fila cronológica y `computed = accountBalance` en su fecha.

El resultado devuelve el `batchId` y `diff = computed − expected` por cuenta.

**Comprobación de saldo de BBVA**: no hay saldo en el fichero, así que SPEC-0010 llama a `recordBalanceCheck` (SPEC-0004) con el saldo que indique el usuario.

### 8. Deshacer (`revert`) en una transacción
Si el lote ya tiene `reverted_at`, da `already_reverted`. Si no:
1. llama a `unlinkTransfer` en todo grupo de traspaso que incluya un movimiento del lote; la contrapartida **de fuera del lote** (de otro lote o manual) vuelve a `regular`;
2. marca `deleted_at` en los movimientos del lote;
3. marca `reverted_at` en el lote.

Las cuentas, la apertura, los `source_link` y los `balance_check` se mantienen.

### 9. Ficheros sintéticos (`tools/build-fixtures.ts`, ejecutado con `tsx`; `pnpm build:fixtures`)
Se generan con ExcelJS en `src/import/__fixtures__/` y se versionan. Todos los datos son **inventados**.

**`bbva-informe.xlsx`**: fila de título, «Fecha de generación del informe: 24/10/2026» y tabla resumen con tres filas. Después, la tabla de movimientos (importes como celdas numéricas; fechas como texto, salvo la fila 9, que es celda de fecha):

| # | Fecha | Producto | Categoría › Subcategoría | Importe | Concepto |
|---|---|---|---|---|---|
| 1 | 01/09/2026 | DIARIO | Salarios, rentas y subsidios › Nómina | 2000,00 | ABONO NOMINA EJEMPLO |
| 2 | 02/09/2026 | DIARIO | No categorizable › No asociable a gasto o ingreso | −300,00 | TRASPASO A CUENTA |
| 3 | 02/09/2026 | AHORRO | No categorizable › Autotransferencia recibida | 300,00 | TRASPASO DESDE CUENTA |
| 4 | 05/09/2026 | DIARIO | Transporte › Combustible | −51,56 | GASOLINERA EJEMPLO |
| 5 | 06/09/2026 | DIARIO | Ocio › Bares y restaurantes | −2,50 | CAFETERIA EJEMPLO |
| 6 | 06/09/2026 | DIARIO | Ocio › Bares y restaurantes | −2,50 | CAFETERIA EJEMPLO |
| 7 | 10/09/2026 | DIARIO | No categorizable › No asociable a gasto o ingreso | −500,00 | TRANSFERENCIA A MYINVESTOR |
| 8 | 15/09/2026 | DIARIO | No categorizable › No asociable a gasto o ingreso | −120,00 | TRANSFERENCIA A MYINVESTOR B |
| 9 | 20/09/2026 | AHORRO | Otros ingresos › Ingresos varios | 15,00 | INGRESO EJEMPLO |

`Entidad` es `BBVA` en todas las filas. `Observaciones` lleva textos genéricos («Traspaso», «Pago con tarjeta»).

**`bbva-informe-parcial.xlsx`**: solo las filas 7–9 y una nueva fila 10 (`25/09/2026`, DIARIO, Compras › Alimentación, −30,00, «SUPERMERCADO EJEMPLO»).

**`myinvestor-movimientos.xlsx`** (ascendente) y **`myinvestor-movimientos-desc.xlsx`** (las mismas filas, en orden descendente):
- cabecera `TITULAR: TITULAR EJEMPLO` y `CUENTA: ES00 0000 0000 0000 0000 0000`;
- importes y saldos como texto con € pegado:

| Fecha Operación | Fecha Valor | Movimiento | Importe | Saldo |
|---|---|---|---|---|
| 12/09/2026 | 12/09/2026 | TRANSFERENCIA RECIBIDA EJEMPLO | 500,00€ | 600,00€ |
| 19/09/2026 | 19/09/2026 | TRANSFERENCIA RECIBIDA EJEMPLO B | 120,00€ | 720,00€ |
| 19/09/2026 | 20/09/2026 | COMPRA FONDO EJEMPLO | -200,00€ | 520,00€ |
| 11/10/2026 | 10/10/2026 | PERIODO 10/09/2026 10/10/2026 | 0,49€ | 520,49€ |

**`generico-latin1.csv`** (`windows-1252`, separador `;`), con cabeceras `Fecha;Concepto;Debe;Haber;Saldo`:

| Fecha | Concepto | Debe | Haber |
|---|---|---|---|
| 03/09/2026 | COMPRA ÑANDÚ TIENDA | 45,90 | |
| 04/09/2026 | DEVOLUCIÓN | | 10,00 |

**`generico.xlsx`**: las mismas cabeceras y filas.

**`plantilla-generico.json`**: la plantilla de CA-10, para `import:check --plantilla` (SPEC-0012).

**`antiguo.xls`**: solo los 8 bytes de la firma OLE.

**`corrupto.xlsx`**: bytes `PK` truncados.

Los repositorios de lotes (`createBatch`, `insertImportedMovements`, `revertBatch`, `saveTemplate`) los añade esta spec en `src/db/repo/import.ts`, respetando el CA-10 de SPEC-0004 (SQL solo en `src/db/`).

## Fuera de alcance
- Pantallas del asistente: SPEC-0010. PDF de cartera: SPEC-0012.
- Motor de reglas, lista de categorías y edición de `category_map`: SPEC-0007.
- `.xls`, multimoneda y formatos predefinidos de otros bancos.

## Criterios de aceptación
Todos son tests de Vitest en Node con SQLite en memoria (SPEC-0004) y los ficheros del punto 9.

1. **CA-01** · BBVA:
   - `bbva-informe.xlsx` se detecta como `bbva_report` y produce **9 filas**, con `sourceKey` `BBVA·DIARIO` en las 1, 2 y 4–8, y `BBVA·AHORRO` en las 3 y 9;
   - importes en céntimos `[200000, -30000, 30000, -5156, -250, -250, -50000, -12000, 1500]`;
   - la fila 4 lleva `sourceCategory` `Transporte›Combustible`;
   - la fila 9, leída de una celda de fecha, da `2026-09-20`;
   - la tabla resumen no produce filas.
2. **CA-02** · MyInvestor:
   - el **plan** (`resolve`) de los dos ficheros (ascendente y descendente) tiene las 4 filas en el **mismo orden cronológico** (`+50000`, `+12000`, `−20000`, `+49`);
   - la apertura sugerida es **10000** el `2026-09-12`;
   - ningún campo del plan contiene `TITULAR EJEMPLO` ni `ES00`.
3. **CA-03** · Cuentas:
   - el primer `read` de `bbva-informe.xlsx` devuelve en `accounts` dos entradas sin `linkedAccountId`, con propuestas «Diario» y «Ahorro» (`checking`, `BBVA`);
   - con `assignments` `{ create }` para ambas, el `commit` crea las dos cuentas, con `created_by_batch_id` igual al lote, y sus dos `source_link`;
   - un segundo `read` devuelve en `accounts` el `linkedAccountId` de cada una;
   - si después se marca `deleted_at` en la cuenta «Ahorro» (vía repositorio), un nuevo `read` devuelve «Ahorro» **sin** `linkedAccountId`, con su propuesta.
4. **CA-04** · Duplicados:
   - la primera importación de `bbva-informe.xlsx` incluye las filas 5 y 6 (dos cafés);
   - reimportar el mismo fichero marca las **9** filas como `duplicate`, con `include=false` y el aviso `same_file`;
   - `bbva-informe-parcial.xlsx` marca como duplicadas las filas 7–9 y solo la 10 como nueva.
5. **CA-05** · Traspasos:
   - el plan de `bbva-informe.xlsx` sugiere el par de filas 2 y 3;
   - tras confirmar BBVA, el plan de `myinvestor-movimientos.xlsx` sugiere el par de la fila 7 de BBVA (`2026-09-10`) con la entrada de +500,00 € del `2026-09-12`, y **no** sugiere los 120,00 € (4 días);
   - al aceptar ambos pares, los cuatro movimientos quedan en `transfer`, y `netWorth` es igual a la suma de aperturas y movimientos con o sin el enlace.
6. **CA-06** · Categoría: con `category_map('bbva_report','Transporte›Combustible') → C`, la fila 4 sale con la categoría `C` sugerida y las demás sin categoría.
7. **CA-07** · Aportación externa: con la decisión `kind='external'` en la fila 1, el movimiento queda `external` y `countsAsIncomeOrExpense` es falso.
8. **CA-08** · Saldo:
   - con la apertura sugerida aceptada, el `commit` de MyInvestor da `diff = 0`;
   - con la apertura editada a 9900 céntimos, da `diff = −100`;
   - en ambos casos guarda un `balance_check` con `source='file'` y `expected = 52049`.
9. **CA-09** · Deshacer:
   - con BBVA y MyInvestor confirmados y el traspaso de 500,00 € aceptado, `revert` del lote BBVA devuelve el movimiento de MyInvestor a `regular` sin grupo;
   - `accountBalance` de «Diario» vuelve a 0 y el lote queda con `reverted_at`;
   - reimportar `bbva-informe.xlsx` después ya no marca ninguna fila como `duplicate` ni da el aviso `same_file`.
10. **CA-10** · Genérico:
    - `generico-latin1.csv`, con la plantilla `{ format: 'csv', headerRow: 0, columns: { date: 'Fecha', description: 'Concepto', debit: 'Debe', credit: 'Haber', balance: 'Saldo' }, dateFormat: 'dd/mm/aaaa', decimal: ',', delimiter: ';' }`, produce `COMPRA ÑANDÚ TIENDA` con −4590 céntimos y `DEVOLUCIÓN` con +1000, ambas sin `balanceCents`;
    - guardada con `saveTemplate` y aplicada a `generico.xlsx`, da las mismas filas (el `delimiter` se ignora).
11. **CA-11** · Errores:
    - `antiguo.xls` da `xls_not_supported`, también renombrado a `.xlsx`;
    - `corrupto.xlsx` da `unreadable_file`;
    - el test construye **en memoria con ExcelJS** un informe con el formato BBVA y dos filas, una de ellas con fecha `31/02/2026`. Esa fila da el error `invalid_date` sin abortar la otra, y el error no contiene el texto de la celda;
    - `revert` de un lote ya revertido da `already_reverted`;
    - `commit` con `kind='external'` en una fila negativa da `external_requires_positive` y no escribe nada;
    - si entre `resolve` y `commit` se inserta (vía repositorio) un movimiento con la misma huella que una fila del plan, esa fila se devuelve como `duplicate_at_commit` y no se inserta.
12. **CA-12** · `pnpm build:fixtures` regenera ficheros cuyo **contenido leído** (celdas y filas) coincide con los versionados; un test compara lo leído, no los bytes.
13. **CA-13** · `.arda/checks.sh` completo sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Ficheros reales distintos de las capturas**: tipos de celda o formato de negativos en MyInvestor. Mitigación: lectores tolerantes, y `import:check` (SPEC-0012) en el ordenador del propietario antes de usarlo de verdad.
- **Concepto cambiante entre descargas**: si el banco cambia el texto, la huella no detecta el duplicado. SPEC-0010 mostrará un aviso suave cuando coincidan cuenta, fecha e importe con concepto distinto.
- **ExcelJS y pdf.js dentro del worker** de la base de datos: no está verificado en navegador (los tests son en Node); lo cubrirá el e2e de SPEC-0010. Plan B: leer el fichero en un worker propio o en el hilo principal y pasar al worker de la base solo el `ParsedFile`.
- **Tamaño**: tres lectores, plan, *commit*, *revert* y ficheros sintéticos. Si no cabe en una sesión de Claude Pro, el genérico puede pasar a otra spec; requeriría volver a Refinar.

### Preguntas abiertas
- Ninguna para el propietario.
