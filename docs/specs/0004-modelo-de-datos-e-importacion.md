---
id: SPEC-0004
title: Modelo de datos y motores de importación
status: draft          # draft → approved (solo una persona) → implemented
summary: Esquema SQLite con migraciones (cuentas, grupos, movimientos, traspasos, valoraciones, lotes) y motores de importación BBVA xlsx, MyInvestor xlsx/PDF y CSV/xlsx genérico con duplicados, traspasos, conciliación y deshacer; sin pantallas
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0002, ADR-0001, ADR-0002, ADR-0004]
---

# SPEC-0004 · Modelo de datos y motores de importación

## Intención
Crear la **base de datos real** de Míre y los **motores de importación** que convierten los extractos del propietario en movimientos y valoraciones fiables. Los motores deben:
- importar sin duplicar;
- detectar traspasos entre cuentas propias;
- comprobar que los saldos cuadran;
- poder deshacer una importación.

Esta spec **no tiene pantallas**: todo se verifica con tests sobre ficheros sintéticos. El asistente de importación llega en SPEC-0010.

## Contexto
- `SPEC-0001` (draft): funciones 1–6 y CA-04 a CA-07, CA-20 y CA-21. Esta spec implementa su **lógica**; SPEC-0010, sus pantallas.
- `ADR-0001`: local-first y sincronización. Esta spec prepara la sincronización con ids UUIDv7, borrado lógico y escritura centralizada; el registro de operaciones es de SPEC-0008.
- `ADR-0002`: SQLite WASM con `opfs-sahpool` en un worker.
- `ADR-0004` (proposed): librerías de importación. **Se acepta junto con esta spec.**
- `SPEC-0002`: deja el worker de SQLite y la base de datos de prueba `/mire-smoke.sqlite3`. **Esta spec no toca esa prueba**; su retirada se decidirá en SPEC-0006.
- **Formatos reales observados** (capturas anonimizadas que el propietario compartió en el chat el 2026-10-24; no se guardan en el repositorio):

  | Fichero | Estructura |
  |---|---|
  | **BBVA** «Informe de gastos, ingresos y movimientos de ahorro o financiación» (`.xlsx`) | Logotipo, título y «Fecha de generación del informe: dd/mm/aaaa». Una tabla resumen `Desde · Hasta · Categoría · Subcategoría · Importe`, que se ignora. Después, la tabla de movimientos `Fecha · Producto · Entidad · Categoría · Subcategoría · Importe · Concepto · Observaciones`. `Producto` distingue varias cuentas del mismo informe (alias del usuario). Sin saldo y con una sola fecha. Importes negativos para cargos. |
  | **MyInvestor** `Movimientos_dd-mm-aaaa_dd-mm-aaaa.xlsx` | Cabecera `TITULAR:` · `CUENTA:` · `Saldo:` y título «Movimientos». Tabla `Fecha Operación · Fecha Valor · Movimiento · Importe · Saldo`, con importes como texto con € pegado (`10,81€`). |
  | **MyInvestor** extracto PDF (5 páginas) | Página 1: `FECHA:`, titular, «Posición integrada». Página 2: «Detalle últimos movimientos de efectivo», que se ignora. Página 3: tabla **«Posiciones»** `Código (ISIN) · Nombre · Divisa · Títulos · Precio medio posicion · Valor de mercado · Valor de mercado EUR`. Los títulos llevan punto decimal (`145.891`) y los valores van en es-ES con 4 decimales (`1.967,8300 €`). Algún fondo está en USD. |

- **Decisiones del propietario** (2026-10-24):
  - duplicados marcados para que él decida;
  - manda la fecha de operación;
  - se puede deshacer por lote;
  - se comprueba el saldo (el del fichero o uno indicado por él);
  - traspasos sugeridos y confirmados (±3 días);
  - un fondo por cuenta más una vista de grupo;
  - formatos CSV y `.xlsx` (sin `.xls`);
  - la cartera se importa del PDF;
  - las categorías de BBVA son una sugerencia con tabla de equivalencias;
  - el dinero del banco anterior es una **aportación externa**;
  - motor y asistente van en specs separadas.

## Cambio (delta)
### 1. Base de datos y convenciones
- **Fichero**: `/mire.sqlite3` en el VFS `opfs-sahpool` del worker de SPEC-0002, con `PRAGMA foreign_keys = ON`.
- **Migraciones**:
  - en `src/db/migrations/NNNN_nombre.sql`, aplicadas en orden al abrir y cada una en una transacción;
  - la versión aplicada se registra en `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT)`;
  - esta spec crea `0001_initial.sql`.
- **Convenciones de columnas**:

  | Dato | Formato |
  |---|---|
  | `id` | UUIDv7 como `TEXT PRIMARY KEY` |
  | `created_at`, `updated_at`, `deleted_at` | ISO-8601 UTC (`TEXT`) |
  | Fechas de negocio | `YYYY-MM-DD` |
  | Dinero | `*_cents INTEGER`, en EUR |
  | Participaciones | `TEXT` decimal (p. ej. `'145.891'`) |

- **Borrado lógico**: las tablas de usuario se borran poniendo `deleted_at`, nunca con `DELETE`. Así quedan las marcas que necesita SPEC-0008, y todas las consultas filtran `deleted_at IS NULL`.
- **Escritura centralizada**:
  - todas las escrituras pasan por `src/db/repo/*.ts`;
  - el SQL solo existe dentro de `src/db/`;
  - una regla de ESLint (`no-restricted-imports`) impide importar el cliente del worker fuera de `src/db/`.

### 2. Esquema (`0001_initial.sql`)
| Tabla | Columnas principales | Restricciones |
|---|---|---|
| `account_group` | `id, name, created_at, updated_at, deleted_at` | Agrupa cuentas, p. ej. «Cartera MyInvestor». |
| `account` | `id, name, type, institution, group_id, isin, opening_date, opening_balance_cents, archived_at, …` | `type IN ('checking','savings','cash','investment')`. `isin` solo si `type='investment'`. `group_id` → `account_group`. |
| `source_link` | `id, source, key, account_id, …` | Asocia una clave de origen a una cuenta: `('bbva_report','BBVA·RESPALDO')`, `('myinvestor_movements','default')`, `('myinvestor_pdf','LU0000000000')`. `UNIQUE(source, key)` mientras no esté borrada. |
| `category` | `id, parent_id, system_key, name, archived_at, …` | Máximo **dos niveles**: un trigger impide que el padre tenga a su vez padre. La lista inicial y su edición son de SPEC-0007. |
| `category_map` | `id, source, source_category, category_id, …` | Equivalencia de una categoría del banco con una de Míre: `('bbva_report','Transporte›Combustible') → categoría`. `UNIQUE(source, source_category)`. |
| `movement` | `id, account_id, date, value_date, amount_cents, description, note, kind, category_id, transfer_group_id, import_batch_id, fingerprint, source_category, raw, …` | `amount_cents ≠ 0` (+ entra, − sale). `kind IN ('regular','transfer','external')`. `kind='external'` solo si `amount_cents > 0`. `kind='transfer'` exige `transfer_group_id`. `raw` es el JSON de la fila original. Índices por `(account_id, date)` y `fingerprint`. |
| `valuation` | `id, account_id, date, value_cents, units, import_batch_id, …` | Solo en cuentas `investment` (trigger). `UNIQUE(account_id, date)` mientras no esté borrada. |
| `import_batch` | `id, source, file_name, file_sha256, row_count, imported_count, duplicate_count, created_at, reverted_at` | `source` es el formato. |
| `import_template` | `id, name, format, settings, …` | `format IN ('csv','xlsx')`. `settings` es un JSON con la forma del punto 4.5. |
| `balance_check` | `id, account_id, date, expected_cents, computed_cents, source, import_batch_id, created_at` | `source IN ('file','user')`. |

### 3. Dominio (`src/domain/`, funciones puras con tests)
- **`accountBalance(accountId, date)`** para corriente, ahorro y efectivo: `opening_balance_cents` + suma de `amount_cents` de los movimientos no borrados hasta `date`, todos los `kind`.
- **`investmentValue(accountId, date)`**: valor de la última valoración en o antes de `date`, más la suma de movimientos posteriores a ella hasta `date` (aportaciones y retiradas). Sin valoración, es la suma de movimientos. Cumple SPEC-0001 CA-01.
- **`netWorth(date)`**: suma de las cuentas no borradas, archivadas incluidas. **`groupValue(groupId, date)`**: suma de las cuentas del grupo.
- **`countsAsIncomeOrExpense(movement)`**: verdadero solo si `kind = 'regular'`. Los traspasos y las aportaciones externas no cuentan (SPEC-0001 CA-03, CA-10 y CA-20).

### 4. Motores de importación (`src/import/`)
Las librerías se cargan bajo demanda (ADR-0004). El flujo es: `read(file)` → `detect` → `parse` → filas normalizadas → `plan` → `commit(plan, decisiones)` → lote. `revert(batchId)` lo deshace.

#### 4.1 Utilidades de lectura
- **`parseAmount(input, decimal = ',')` → céntimos**:
  - acepta números de celda y textos;
  - ignora `€`, espacios y NBSP;
  - admite `-`, `−` (U+2212) y `+`, y separadores de miles;
  - redondea a céntimos alejándose de cero (`1.967,8350 €` → `196784`);
  - nunca usa aritmética de coma flotante sobre el texto. Los números de celda se convierten con `toFixed(4)` antes de analizarlos.
- **`parseDate(input, format)` → `YYYY-MM-DD`**:
  - acepta fechas de celda de ExcelJS, leídas por sus componentes UTC;
  - y textos en `dd/mm/aaaa`, `dd-mm-aaaa`, `aaaa-mm-dd` o `mm/dd/aaaa`, según la plantilla.
- **`normalizeText(s)`**: NFD sin diacríticos, mayúsculas, espacios colapsados y sin espacios en los extremos.
- **Errores de fila**: una fila que no se puede leer no aborta el fichero; queda en el plan como `error` con su número de fila y el motivo.

#### 4.2 BBVA, informe `.xlsx` (`source = 'bbva_report'`)
- **Detección**: alguna fila de la primera hoja contiene, normalizadas, exactamente las cabeceras `FECHA, PRODUCTO, ENTIDAD, CATEGORIA, SUBCATEGORIA, IMPORTE, CONCEPTO, OBSERVACIONES`.
- **Lectura**: se leen las filas siguientes hasta la primera vacía. La tabla resumen anterior (`DESDE…IMPORTE`) se ignora.
- **Mapeo**:

  | Campo de Míre | Origen |
  |---|---|
  | `date` | `Fecha` |
  | `amount` | `Importe` |
  | `description` | `Concepto` |
  | `note` | `Observaciones` |
  | `source_category` | `Categoría›Subcategoría` |
  | clave de cuenta | `Entidad·Producto` (p. ej. `BBVA·RESPALDO`) |

- Sin saldo en el fichero.

#### 4.3 MyInvestor, movimientos `.xlsx` (`source = 'myinvestor_movements'`)
- **Detección**: fila de cabeceras `FECHA OPERACION, FECHA VALOR, MOVIMIENTO, IMPORTE, SALDO`.
- **Mapeo**:

  | Campo de Míre | Origen |
  |---|---|
  | `date` | `Fecha Operación` |
  | `value_date` | `Fecha Valor` |
  | `description` | `Movimiento` |
  | `amount` | `Importe` |
  | `balance` | `Saldo` |
  | clave de cuenta | `default` (una sola cuenta de efectivo) |

- Las filas se ordenan cronológicamente, por fecha y después por orden en el fichero, sea cual sea su orden de origen.

#### 4.4 MyInvestor, extracto PDF (`source = 'myinvestor_pdf'`)
- **Lectura del texto**: pdf.js extrae el texto con sus coordenadas.
- **Fecha de la valoración**: la que sigue a `FECHA:` en la página 1. Si falta, el plan la pide al usuario.
- **Tabla «Posiciones»**:
  - se localiza el título «Posiciones» y la fila de cabeceras (`Código`, `Nombre`, `Divisa`, `Títulos`, `Valor de mercado EUR`…);
  - las columnas se asignan por rangos de x a partir de las cabeceras;
  - las filas se agrupan por y, y un nombre de varias líneas se une a su fila;
  - la tabla puede seguir en páginas posteriores y termina en la línea final de la tabla o en el siguiente título.
- **Cada posición** produce `isin`, `name`, `currency`, `units` (texto decimal con punto, tal cual) y `valueCents` (de «Valor de mercado EUR», en es-ES). Para los fondos en USD se usa siempre la columna EUR.
- **Cuenta destino**: la de `source_link('myinvestor_pdf', isin)`. Si el ISIN es nuevo, el plan propone crear una cuenta `investment` con ese nombre e ISIN dentro del grupo «Cartera MyInvestor», que también se crea si no existe.
- La sección «Detalle últimos movimientos de efectivo» se ignora.

#### 4.5 Genérico CSV y `.xlsx` con plantilla (`source = 'generic_csv' | 'generic_xlsx'`)
- **CSV**: se decodifica UTF-8 estricto y, si falla, `windows-1252`. El separador (`;`, `,` o tabulador) se detecta solo o lo fija la plantilla.
- **`.xlsx`**: la primera hoja o la que indique la plantilla.
- **Plantilla** (`import_template.settings`):
  - `headerRow` (índice);
  - `columns` con `date`, `description` y, para el importe, `amount` **o** el par `debit`/`credit`; opcionalmente `valueDate`, `balance` y `category`;
  - `dateFormat` y `decimal` (`,` o `.`);
  - `sheet` (solo `.xlsx`) y `delimiter` (solo CSV).
- Una plantilla guardada se aplica igual a otro fichero con la misma estructura.

#### 4.6 Ficheros no admitidos
- `.xls`: error `xls_not_supported`, con el mensaje traducido «Guarda el fichero como .xlsx (Excel → Guardar como) e impórtalo de nuevo».
- Formato no reconocido: error `unknown_format`, que lleva al mapeo genérico.

#### 4.7 Plan de importación (`plan`)
Para cada fila normalizada, el plan calcula:

- **Cuenta destino**: la de su `source_link`. Si no hay ninguna, el plan la deja **sin asignar** y el asistente (SPEC-0010) pedirá elegir o crear la cuenta antes de confirmar.
- **Huella**:
  - `sha256(accountId | date | amountCents | normalizeText(description) | ordinal)`;
  - `ordinal` es el número de aparición de esa misma combinación (cuenta, fecha, importe, concepto) dentro del fichero, empezando en 0.
  - Así, dos cafés iguales el mismo día tienen huellas distintas, y reimportar el fichero reproduce las mismas.
- **Duplicado**:
  - si la huella ya existe en un movimiento no borrado: `duplicate = true` e `include = false` por defecto;
  - si `file_sha256` coincide con un lote no revertido, el plan añade el aviso `same_file`.
- **Sugerencia de traspaso**:
  - candidatos: pares de movimientos con importes opuestos e iguales, en **cuentas distintas de Míre**, con `|Δfecha| ≤ 3 días` y sin traspaso asignado;
  - se buscan dentro del plan y frente a movimientos ya guardados;
  - emparejamiento voraz por menor `Δfecha` y, en empate, por orden de fichero;
  - cada movimiento está como mucho en un par.
  - Es **solo una sugerencia** (`transferSuggestion`); no se aplica sin aceptación.
- **Sugerencia de categoría**:
  1. reglas del usuario, mediante el gancho `suggestCategory(row)` que implementará SPEC-0007 (hasta entonces no devuelve nada);
  2. `category_map` por `source_category`;
  3. ninguna.
- **Apertura** (solo MyInvestor movimientos, si la cuenta no tiene movimientos): se sugiere `opening_balance_cents` = saldo de la primera fila cronológica − su importe, con `opening_date` igual a esa fecha.
- **Valoraciones** (PDF): una por posición, con su cuenta destino o la propuesta de cuenta nueva.

#### 4.8 Confirmación (`commit`) y deshacer (`revert`)
- **`commit(plan, decisiones)`** se ejecuta en **una transacción**:
  - **decisiones** por fila: `include`, `accountId`, `categoryId`, `kind` (`regular` | `external` | `transfer`), traspaso aceptado sí o no, y apertura aceptada sí o no;
  - **crea** el `import_batch`, los movimientos y valoraciones incluidos, las cuentas, grupos y `source_link` propuestos y aceptados, y la apertura aceptada;
  - **traspasos aceptados**: ambos movimientos pasan a `kind='transfer'` con el mismo `transfer_group_id`, también si la contrapartida ya estaba guardada;
  - **saldo del fichero**: si las filas traen saldo, compara el saldo de la última fila con `accountBalance` en esa fecha y guarda un `balance_check` (`source='file'`) con ambos valores.
- **`recordBalanceCheck(accountId, date, realCents)`**: guarda un `balance_check` (`source='user'`) y devuelve la diferencia. Es el caso de BBVA, cuando el usuario indica el saldo real.
- **`revert(batchId)`** se ejecuta en una transacción:
  - marca `deleted_at` en los movimientos y valoraciones del lote;
  - si una contrapartida de traspaso pertenece a otro lote, la devuelve a `kind='regular'` con `transfer_group_id = NULL`;
  - marca `reverted_at` en el lote;
  - las cuentas y grupos creados se mantienen.

### 5. Ficheros sintéticos y herramientas
- **`tools/build-fixtures.mjs`** genera en `src/import/__fixtures__/`, con datos **inventados**:
  - **`bbva-informe.xlsx`**:
    - título, fecha de generación y tabla resumen;
    - tabla de movimientos con dos productos, `AHORRO` y `DIARIO`;
    - un traspaso entre ellos, dos movimientos idénticos el mismo día y categorías BBVA.
  - **`myinvestor-movimientos.xlsx`**:
    - cabecera `TITULAR: TITULAR EJEMPLO` y `CUENTA: ES00 0000 0000 00 0000000000`;
    - importes como texto con €, y saldo;
    - una entrada que es la contrapartida de un traspaso desde `DIARIO` dos días después.
  - **`myinvestor-extracto.pdf`** (con pdf-lib):
    - cinco páginas que imitan la maquetación, con `FECHA: 24/10/2026`;
    - tabla «Posiciones» con tres fondos de ISIN ficticio, uno en USD y otro con nombre en dos líneas.
  - **`generico-latin1.csv`**: separador `;`, columnas Debe y Haber, codificación `windows-1252` con «Ñ» y tildes.
  - **`generico.xlsx`** y **`antiguo.xls`** (este último solo sus bytes de cabecera OLE, para el error).
  - Los ficheros generados se versionan. El script se ejecuta con `pnpm build:fixtures`.
- **`tools/import-check.mjs`** (`pnpm import:check <fichero>`): para que el propietario valide **en su ordenador** sus ficheros reales, sin compartirlos.
  - Ejecuta `detect`, `parse` y `plan` en Node.
  - Imprime solo un **resumen estructural**: formato detectado, número de filas, errores por fila (número y motivo), rango de fechas, claves de cuenta y número de posiciones.
  - **Nunca imprime conceptos, importes ni nombres.**
- **Tests**: Vitest en Node, con SQLite en memoria (la build `node` de `@sqlite.org/sqlite-wasm`) para los tests de repositorio y dominio.

## Fuera de alcance
- Pantallas de importación, de cuentas y de movimientos: SPEC-0010 y SPEC-0006.
- Motor de reglas y lista inicial de categorías: SPEC-0007. Aquí solo existen la tabla y el gancho `suggestCategory`.
- Registro de operaciones y sincronización: SPEC-0008. Cifrado: SPEC-0005.
- Ficheros `.xls`, multimoneda (se usa siempre la columna EUR) y movimientos de efectivo del PDF.
- Formatos predefinidos de otros bancos.
- Retirar la prueba de almacenamiento de SPEC-0002 (SPEC-0006).

## Criterios de aceptación
1. **CA-01** · Migraciones.
   - Sobre una base vacía, `0001_initial.sql` crea todas las tablas del punto 2 y registra la versión 1.
   - Abrir de nuevo no vuelve a aplicarla.
   - Una migración que falla deja la base como estaba.
2. **CA-02** · Restricciones (test de repositorio). Fallan con error:
   - un tercer nivel de categoría;
   - `kind='external'` con importe negativo;
   - `kind='transfer'` sin grupo;
   - una valoración en una cuenta no `investment`;
   - `amount_cents = 0`;
   - una clave ajena inexistente.
3. **CA-03** · `parseAmount` y `parseDate` devuelven exactamente:

   | Entrada | Resultado |
   |---|---|
   | `parseAmount("10,81€")` | `1081` |
   | `parseAmount("-51,56")` | `-5156` |
   | `parseAmount("−1.234,50 €")` | `-123450` |
   | `parseAmount("1.967,8300 €")` | `196783` |
   | `parseAmount("1.967,8350 €")` | `196784` |
   | `parseAmount(-51.56)` | `-5156` |
   | `parseAmount("1,234.50", ".")` | `123450` |
   | `parseDate("24/10/2026","dd/mm/aaaa")` | `"2026-10-24"` |

   Además, una fecha de celda de ExcelJS da su día UTC, con `TZ=Pacific/Kiritimati` y con `TZ=America/Los_Angeles`.
4. **CA-04** · BBVA:
   - `bbva-informe.xlsx` se detecta como `bbva_report`;
   - ignora la tabla resumen;
   - produce exactamente las filas de movimientos del fichero, con las claves `BBVA·AHORRO` y `BBVA·DIARIO`, las categorías `Categoría›Subcategoría` y los importes en céntimos esperados.
   - Cubre la lógica de SPEC-0001 CA-04.
5. **CA-05** · MyInvestor:
   - `myinvestor-movimientos.xlsx` se detecta, se ordena cronológicamente y sugiere la apertura correcta;
   - `myinvestor-extracto.pdf` produce tres posiciones con ISIN, `units` como texto exacto y `valueCents` exactos (también el fondo en USD y el de nombre en dos líneas), con fecha `2026-10-24`;
   - el `commit` crea tres cuentas de inversión en el grupo «Cartera MyInvestor», y `groupValue` es igual a la suma.
   - Cubre la lógica de SPEC-0001 CA-05.
6. **CA-06** · Genérico:
   - `generico-latin1.csv` se lee con tildes y «Ñ» correctas y Debe y Haber convertidos a importes con signo;
   - la plantilla guardada, aplicada a `generico.xlsx` con la misma estructura, da el mismo resultado;
   - `antiguo.xls` da `xls_not_supported`.
   - Cubre la lógica de SPEC-0001 CA-06.
7. **CA-07** · Duplicados:
   - la primera importación de `bbva-informe.xlsx` incluye los dos movimientos idénticos;
   - reimportarlo marca **todas** las filas como `duplicate` con `include=false` y añade el aviso `same_file`;
   - un fichero que solapa parcialmente solo marca las filas repetidas.
8. **CA-08** · Traspasos:
   - el traspaso `AHORRO`→`DIARIO` del mismo fichero se sugiere;
   - la salida de `DIARIO` y la entrada en MyInvestor dos días después, en ficheros distintos, se sugieren;
   - un caso igual a 4 días no se sugiere.
   - Al aceptarlos, ambos lados quedan `transfer` con el mismo grupo, `netWorth` no cambia y `countsAsIncomeOrExpense` es falso.
   - Cubre la lógica de SPEC-0001 CA-03 y CA-07.
9. **CA-09** · Aportación externa: un movimiento confirmado con `kind='external'` aumenta `netWorth` en su importe y `countsAsIncomeOrExpense` es falso. Cubre la lógica de SPEC-0001 CA-20.
10. **CA-10** · Categoría sugerida: con una entrada `category_map('bbva_report','Transporte›Combustible')`, las filas de BBVA con esa categoría salen del plan con esa categoría sugerida.
11. **CA-11** · Saldo:
    - tras confirmar los movimientos de MyInvestor con la apertura sugerida, el `balance_check` de fichero tiene diferencia 0;
    - con la apertura alterada en 1 €, la diferencia es de 100 céntimos;
    - `recordBalanceCheck` devuelve la diferencia correcta.
    - Cubre la lógica de SPEC-0001 CA-21.
12. **CA-12** · Deshacer:
    - tras `revert` del lote BBVA, `accountBalance` y `netWorth` vuelven a sus valores previos y el lote tiene `reverted_at`;
    - la contrapartida del traspaso en MyInvestor vuelve a `regular` sin grupo;
    - reimportar después ya no marca duplicados.
13. **CA-13** · Valor de inversión: con una valoración de 1.000,00 € el día D, una aportación de 200,00 € en D+1 y una retirada de 50,00 € en D+2, `investmentValue(D+2)` = 1.150,00 €. Una valoración nueva en D+3 sustituye ese cálculo. Cubre la lógica de SPEC-0001 CA-01.
14. **CA-14** · Escritura centralizada: ESLint falla si un fichero fuera de `src/db/` importa el cliente del worker, y `git grep` de `INSERT|UPDATE|DELETE` no encuentra nada fuera de `src/db/`, salvo los tests.
15. **CA-15** · Ficheros sintéticos:
    - `pnpm build:fixtures` regenera ficheros con el mismo contenido de celdas o texto;
    - ningún fichero contiene nombres o identificadores reales; los ISIN y cuentas son ficticios (`LU0000000001`, `ES00 …`).
16. **CA-16** · `pnpm import:check` sobre cada fichero sintético imprime solo el resumen estructural; un test comprueba que la salida no contiene ningún concepto ni importe del fichero.
17. **CA-17** · **El propietario** ejecuta `pnpm import:check` en su ordenador sobre sus tres ficheros reales y confirma que se detectan sin errores de fila.
18. **CA-18** · `.arda/checks.sh` completo sigue por debajo de 5 minutos (SPEC-0002 CA-09).

## Riesgos y preguntas abiertas
### Riesgos
- **Ficheros reales distintos de las capturas**: tipos de celda, formato de negativos en MyInvestor o las páginas 4–5 del PDF. Mitigación: lectores tolerantes (`parseAmount` acepta número y texto), `import:check` en local (CA-17) y ajustes con nuevas muestras anonimizadas.
- **Maquetación del PDF**: si MyInvestor cambia su extracto, el lector deja de encontrar «Posiciones». Mitigación: error claro, con valoración manual como respaldo (SPEC-0006).
- **Exactitud de la huella**: si el banco cambia el texto del concepto entre descargas, la huella cambia y no se detecta el duplicado. Mitigación: la previsualización de SPEC-0010 muestra posibles duplicados por cuenta, fecha e importe aunque el concepto difiera (aviso suave).
- **Peso de las librerías**: carga bajo demanda y *precache* (ADR-0004).
- **Datos reales**: los tests usan solo ficheros sintéticos. Las capturas del chat no se guardan en el repositorio.
- **Tamaño de la spec para Claude Pro**: si no cabe en una sesión, se parte en «esquema + dominio» e «importadores». Requeriría volver a Refinar.

### Preguntas abiertas
- Ninguna para el propietario (decisiones del 2026-10-24).
