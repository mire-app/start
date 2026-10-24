---
id: SPEC-0004
title: Modelo de datos, base de datos y dominio
status: draft          # draft → approved (solo una persona) → implemented
summary: Base de datos real /mire.sqlite3 con migraciones, API del worker con transacciones, esquema (cuentas, grupos, movimientos, traspasos, valoraciones, lotes), dominio de saldos y patrimonio, y lectura de importes y fechas; sin pantallas
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0002, ADR-0001, ADR-0002, ADR-0004]
---

# SPEC-0004 · Modelo de datos, base de datos y dominio

## Intención
Crear la **base de datos real** de Míre, su **API de acceso** con transacciones seguras y el **dominio** que calcula saldos, valor de inversiones y patrimonio. También las utilidades de lectura de importes y fechas que usarán los importadores.

Es la primera de tres specs de datos e importación:
- **SPEC-0004** (esta): modelo y dominio;
- **SPEC-0011**: importadores xlsx/CSV;
- **SPEC-0012**: lector del PDF de cartera.

**Sin pantallas**: todo se verifica con tests.

## Contexto
- `SPEC-0001` (draft, ampliada el 2026-10-24): funciones 1–4, CA-01, CA-03 y CA-20. Esta spec implementa su lógica de cálculo.
- `ADR-0001`: local-first. Esta spec prepara la sincronización (SPEC-0008) con:
  - ids UUIDv7;
  - borrado lógico;
  - escritura centralizada en el worker.
- `ADR-0002`: SQLite WASM con `opfs-sahpool` en un worker.
- `ADR-0004` (proposed): UUIDv7, céntimos enteros y librerías. **Se acepta junto con esta spec, SPEC-0011 y SPEC-0012.**
- `SPEC-0002` (approved): deja el worker, un cliente con *abrir* y *ejecutar consulta*, y la prueba de almacenamiento `/mire-smoke.sqlite3`.
  - Su texto dice que «SPEC-0004 lo eliminará». **Esta spec la mantiene**: retirarla rompería el contrato de e2e de SPEC-0002, y SPEC-0016 la traslada a Ajustes › Diagnóstico con `test_changes: allowed`.
  - SPEC-0002 queda desactualizada en esa frase; no se puede editar porque está aprobada.
- **Comprobado el 2026-10-24**: la build Node de `@sqlite.org/sqlite-wasm` 3.54.1 funciona con `oo1.DB(':memory:')`, claves ajenas, triggers y `db.transaction()`.

## Cambio (delta)
### 1. Arquitectura de acceso a datos
- **`SqlDb`** (`src/db/sql.ts`): interfaz síncrona común.
  - Operaciones: `exec(sql)`, `all<T>(sql, bind?)`, `get<T>(sql, bind?)`, `run(sql, bind?) → { changes }` y `transaction<T>(fn: () => T): T`.
  - Se implementa sobre `oo1.DB` de `@sqlite.org/sqlite-wasm`: en el worker con `OpfsSAHPoolDb`, y en los tests de Node con `new oo1.DB(':memory:')`.
- **Repositorios** (`src/db/repo/*.ts`):
  - funciones síncronas que reciben `SqlDb`;
  - **el SQL solo existe en `src/db/`**;
  - cada función que escribe fija `updated_at` y se ejecuta dentro de `db.transaction()`.
- **Dominio** (`src/domain/*.ts`): funciones **puras** sobre datos ya cargados (listas de movimientos y valoraciones), sin SQL. Los repositorios de consulta (`src/db/repo/queries.ts`) cargan los datos y llaman al dominio.
- **API del worker** (`src/db/api.ts`):
  - un mapa tipado `método → función(db, params)`;
  - el worker ejecuta **cada llamada completa dentro del worker**; si escribe, en una única transacción.
  - Nunca hay `BEGIN`/`COMMIT` repartidos entre mensajes.
- **Cliente** (`src/db/client.ts`, el de SPEC-0002 ampliado): `call<M>(method, params): Promise<Result<M>>`. Los errores llegan como `{ code, message }`. Las operaciones de prueba de SPEC-0002 se mantienen.
- **Apertura**:
  - al arrancar, el worker instala el pool `opfs-sahpool` con **`initialCapacity: 10`**, porque cada base más su *journal* ocupa varias entradas;
  - abre `/mire-smoke.sqlite3` (SPEC-0002) y **`/mire.sqlite3`**;
  - aplica las migraciones pendientes **antes** de atender ninguna `call`;
  - si una migración falla, todas las `call` responden `{ code: 'migration_failed' }`.
- **Relación con el cliente de SPEC-0002**:
  - la operación *abrir* de SPEC-0002, con su reintento de ~1 s y el aviso «Míre ya está abierto en otra pestaña», **se conserva**;
  - ahora abre las dos bases, y si cualquiera de ellas está bloqueada por otra pestaña, se muestra el mismo aviso;
  - SPEC-0002 CA-08 debe seguir pasando sin cambios.
- **ESLint**: `no-restricted-imports` (con `allowTypeImports: true`) impide importar **valores** de `src/db/worker*` y `src/db/sql*` fuera de `src/db/`, tanto por el alias `@/db/…` como por rutas relativas. Fuera de ahí solo se usa `client.ts` y, como tipo, `SqlDb` (`import type`), para el código que el worker ejecuta, como `src/import/`.

### 2. Migraciones
- Ficheros `src/db/migrations/NNNN_nombre.sql`, cargados con `import.meta.glob` (en Node, con lectura de ficheros).
- Se aplican en orden, cada una en su transacción.
- La versión se registra en `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`.
- `migrate(db, migrations)` acepta la lista de migraciones como parámetro, lo que permite inyectar una que falla en los tests.
- Esta spec crea `0001_initial.sql`.

### 3. Convenciones
| Dato | Formato |
|---|---|
| Columnas comunes | **Todas las tablas** salvo `schema_migrations` tienen `id TEXT PRIMARY KEY` (UUIDv7), `created_at`, `updated_at` y `deleted_at` (ISO-8601 UTC, `TEXT`; `deleted_at` admite NULL). |
| Fechas de negocio | `TEXT` `YYYY-MM-DD` |
| Dinero | `*_cents INTEGER`, en EUR |
| Participaciones | `units TEXT`, decimal con punto |

- **Borrado lógico**: nunca hay `DELETE` sobre tablas de usuario; las consultas filtran `deleted_at IS NULL`.
- **Restricciones `UNIQUE`**: son **índices parciales** `WHERE deleted_at IS NULL`.
- **Claves ajenas** activas (`PRAGMA foreign_keys = ON` en cada apertura).

### 4. Esquema (`0001_initial.sql`)
Además de las columnas comunes:

| Tabla | Columnas | Restricciones |
|---|---|---|
| `account_group` | `name, created_by_batch_id` | FK `created_by_batch_id` → `import_batch` (admite NULL) |
| `account` | `name, type, institution, group_id, isin, opening_date, opening_balance_cents, archived_at, created_by_batch_id` | `CHECK(type IN ('checking','savings','cash','investment'))`, `CHECK(isin IS NULL OR type='investment')`, FK `group_id`, `opening_balance_cents` por defecto 0 |
| `source_link` | `source, key, account_id` | `UNIQUE(source, key)` parcial, FK `account_id` |
| `category` | `parent_id, system_key, name, icon, archived_at` (`icon` admite NULL; lo usa SPEC-0007) | FK `parent_id`; triggers `BEFORE INSERT/UPDATE` que lanzan `RAISE(ABORT,'category_depth')` si `parent_id` apunta a una categoría que ya tiene padre, **o** si se da padre a una categoría que ya tiene hijos vivos |
| `category_map` | `source, source_category, category_id` | `UNIQUE(source, source_category)` parcial, FK |
| `category_rule` | `pattern, pattern_norm, category_id` | `UNIQUE(pattern_norm)` parcial, FK `category_id`; la usa SPEC-0018 |
| `movement` | `account_id, date, value_date, amount_cents, description, note, kind, category_id, transfer_group_id, import_batch_id, fingerprint, source_category` | `CHECK(amount_cents <> 0)`, `CHECK(kind IN ('regular','transfer','external'))`, `CHECK(kind <> 'external' OR amount_cents > 0)`, `CHECK((kind = 'transfer') = (transfer_group_id IS NOT NULL))`, FKs; índices `(account_id, date)` y `fingerprint` |
| `valuation` | `account_id, date, value_cents, units, import_batch_id, deleted_by_batch_id` (FK a `import_batch`) | Trigger: la cuenta debe ser `investment` (`RAISE(ABORT,'valuation_account_type')`); `UNIQUE(account_id, date)` parcial |
| `import_batch` | `source, file_name, file_sha256, row_count, imported_count, duplicate_count, reverted_at` | — |
| `import_template` | `name, format, settings, last_used_at` | `CHECK(format IN ('csv','xlsx'))`: `format` es informativo (el formato del fichero con el que se creó), no restringe su uso; `settings` es un JSON (lo define SPEC-0011); `last_used_at` admite NULL (hasta el primer uso) |
| `balance_check` | `account_id, date, expected_cents, computed_cents, source, import_batch_id` | `CHECK(source IN ('file','user'))` |

- **No se guarda la fila original** del fichero importado, ni cabeceras como titular o número de cuenta: solo los campos de la tabla. Así se reducen datos personales y el volumen que se sincroniza.
- **Coherencia de traspasos**: un `transfer_group_id` agrupa **exactamente dos** movimientos en **cuentas distintas** con **importes opuestos**.
  - La impone la función de repositorio `linkTransfer(db, movementIdA, movementIdB)`, que es la única que asigna `transfer_group_id`.
  - Lanza `transfer_invalid` si no se cumple, o si alguno de los dos es `external` o ya está en un traspaso.
  - `unlinkTransfer(db, groupId)` devuelve ambos a `regular`.
- **`valuation.deleted_by_batch_id`**: cuando una importación reemplaza una valoración (SPEC-0012), se guarda qué lote la borró, para que deshacer ese lote pueda restaurarla.

### 5. Repositorios mínimos de esta spec
- **Cuentas y grupos**: `createAccount` y `createGroup` (ambas con `createdByBatchId?` opcional), `updateAccount`, `archiveAccount`, `unarchiveAccount` y `setAccountGroup`.
- **Movimientos**: `createMovement`, `updateMovement` y `deleteMovement` (lógico); `linkTransfer` y `unlinkTransfer`; `setKind` (`regular` | `external`).
- **Valoraciones**: `createValuation` y `deleteValuation` (lógico).
- **Enlaces y equivalencias**: `upsertSourceLink` y `upsertCategoryMap`.
- **Saldos**: `recordBalanceCheck(db, { accountId, date, expectedCents, source = 'user', importBatchId? })`, que guarda `computed_cents = accountBalance(...)` y devuelve `diff = computed − expected`. SPEC-0011 lo usa con `source='file'`.
- Los lotes, el *commit* y el *revert* de importación son de SPEC-0011.

### 6. Dominio (`src/domain/`)
**Tipos** (`src/domain/types.ts`):
- `AccountData = { id, type, groupId: string | null, openingDate: string | null, openingBalanceCents: number }`;
- `MovementData = { accountId, date, amountCents, kind }`;
- `ValuationData = { accountId, date, valueCents }`.

Las funciones reciben solo datos vivos (no borrados).

- **`balanceAt(account, movements, date)`**, para corriente, ahorro y efectivo:
  - **si `openingDate` es NULL**, la cuenta cuenta «desde siempre»: el saldo es `openingBalanceCents` (0 por defecto) más la suma de todos los movimientos con fecha ≤ `date`;
  - si tiene fecha, antes de `openingDate` vale **0**, y desde `openingDate` (incluida) vale `openingBalanceCents` más la suma de `amountCents` con fecha ≤ `date`;
  - se suman **todos los `kind`**.
- **`investmentValueAt(account, valuations, movements, date)`**:
  - sea `V` la última valoración con `V.date ≤ date`;
  - si existe: `V.value_cents` + suma de movimientos con `V.date < m.date ≤ date` (**estrictamente posteriores**, todos los `kind`). Los movimientos del mismo día que la valoración se consideran incluidos en ella;
  - si no existe: igual que `balanceAt`.
- **`netWorthAt(accounts, movements, valuations, date)`**: suma de todas las cuentas recibidas, archivadas incluidas, con `balanceAt` o `investmentValueAt` según su tipo. **`groupValueAt(groupId, accounts, movements, valuations, date)`**: la misma suma, solo para las cuentas del grupo.
- **`countsAsIncomeOrExpense(movement)`**: verdadero solo si `kind = 'regular'`.
- **Consultas** (`src/db/repo/queries.ts`): `accountBalance(db, accountId, date)`, `netWorth(db, date)` y `groupValue(db, groupId, date)` cargan los datos y llaman al dominio.

### 7. Lectura de importes y fechas (`src/import/parse.ts`)
Las usarán SPEC-0011 y SPEC-0012; se definen y prueban aquí.

- **`parseAmount(input, decimal = ',')` → `{ ok: true, cents } | { ok: false, code: 'invalid_amount' }`**
  - **Número** (celda de Excel):
    - se convierte con `Math.abs(n).toFixed(6)` y se analiza **siempre con `.` como decimal**, ignorando el parámetro `decimal`;
    - después se aplica el signo.
  - **Texto**:
    - quita espacios, NBSP y `€`;
    - acepta un signo inicial `+`, `-` o `−` (U+2212);
    - con `decimal=','`, el `.` es separador de miles y debe agrupar de tres en tres (`1.234,5`); con `decimal='.'`, la `,` es separador de miles;
    - cualquier otro carácter o agrupación da `invalid_amount`.
  - **Redondeo único** a céntimos desde la cadena decimal completa (sin coma flotante), **alejándose de cero** en el empate: `…,835` → `…,84` y `-…,835` → `-…,84`.
- **`parseDate(input, format)` → `{ ok: true, date } | { ok: false, code: 'invalid_date' }`**
  - acepta un `Date` (celda de ExcelJS), que se lee por sus componentes **UTC**;
  - acepta textos en `dd/mm/aaaa`, `dd-mm-aaaa`, `aaaa-mm-dd` o `mm/dd/aaaa`, según `format`;
  - las fechas imposibles (`31/02/2026`) son `invalid_date`.
- **`normalizeText(s)`**: NFD sin diacríticos, mayúsculas, espacios colapsados y sin espacios en los extremos.

### 8. Diagnóstico en la pantalla de inicio
- La pantalla de inicio (SPEC-0002/0003) muestra «Base de datos: versión N» (`data-testid="db-version"`, con el atributo `data-applied-at` igual al `applied_at` de esa versión), junto a la prueba de almacenamiento.
- Usa los tokens y componentes de SPEC-0003, y sus textos tienen claves en `es.json` y `en.json`. Los e2e de axe de SPEC-0003 (claro y oscuro) deben seguir pasando.
- Sirve para verificar en navegador que `/mire.sqlite3` abre y migra junto a la base de prueba.

## Fuera de alcance
- Importadores, lotes, *commit* y *revert* de importación: SPEC-0011. PDF: SPEC-0012.
- Pantallas de cuentas, movimientos e importación: SPEC-0006 y SPEC-0010.
- Contenido inicial y edición de categorías y de `category_map`: SPEC-0007. Reglas (`category_rule`): SPEC-0018.
- Registro de operaciones y sincronización: SPEC-0008. Cifrado: SPEC-0005.
- Trasladar la prueba de almacenamiento y `db-version` a Ajustes › Diagnóstico: SPEC-0016.

## Criterios de aceptación
1. **CA-01** · Migraciones (Node, en memoria).
   - Sobre una base vacía, `migrate` crea todas las tablas del punto 4 y registra la versión 1.
   - Un segundo `migrate` no hace nada.
   - Con una lista inyectada `[0001, 0002 que falla]`, la versión queda en 1 y no existe ningún objeto de la 0002.
2. **CA-02** · Restricciones (Node). Fallan con el error indicado:

   | Caso | Error |
   |---|---|
   | Tercer nivel de categoría | `category_depth` |
   | Dar padre a una categoría con hijos | `category_depth` |
   | `linkTransfer` sobre un movimiento `external` | `transfer_invalid` |
   | `kind='external'` con importe negativo | `CHECK` |
   | `kind='transfer'` sin grupo, o `regular` con grupo | `CHECK` |
   | Valoración en cuenta `checking` | `valuation_account_type` |
   | `amount_cents = 0` | `CHECK` |
   | `type='loan'` | `CHECK` |
   | `isin` en una cuenta `savings` | `CHECK` |
   | Clave ajena inexistente | `FOREIGN KEY` |
   | Dos `source_link` vivos con la misma `(source, key)` | `UNIQUE` |
   | Dos valoraciones vivas con la misma `(account_id, date)` | `UNIQUE` |
   | `account.created_by_batch_id` con un lote inexistente | `FOREIGN KEY` |

   Además, `created_by_batch_id` NULL **sí** se admite en `account` y en `account_group`.

   Además, tras el borrado lógico de una de ellas, insertar otra igual **sí** funciona.
3. **CA-03** · `parseAmount` devuelve exactamente:

   | Entrada | Resultado |
   |---|---|
   | `"10,81€"` | `1081` |
   | `"-51,56"` | `-5156` |
   | `"−1.234,50 €"` | `-123450` |
   | `"1.967,8300 €"` | `196783` |
   | `"1.967,8350 €"` | `196784` |
   | `"-1.967,8350 €"` | `-196784` |
   | `-51.56` (número, con `decimal=','`) | `-5156` |
   | `1234.5` (número) | `123450` |
   | `"1,234.50"` con `decimal='.'` | `123450` |
   | `"12,34,56"` | `invalid_amount` |
   | `"1.23,45"` | `invalid_amount` |
   | `"abc"` | `invalid_amount` |

4. **CA-04** · `parseDate`:
   - `("24/10/2026","dd/mm/aaaa")` da `"2026-10-24"`;
   - `("2026-10-24","aaaa-mm-dd")` da `"2026-10-24"`;
   - `("31/02/2026","dd/mm/aaaa")` da `invalid_date`;
   - `new Date(Date.UTC(2026,9,24))` da `"2026-10-24"` con `TZ=Pacific/Kiritimati` y con `TZ=America/Los_Angeles`.
5. **CA-05** · Saldo (dominio), con una cuenta `checking` de apertura `2026-09-01` y 100,00 €, y movimientos +50,00 € el 2026-09-05 y −20,00 € el 2026-09-10:

   | Fecha | `balanceAt` |
   |---|---|
   | `2026-08-31` | 0 |
   | `2026-09-01` | 10000 |
   | `2026-09-05` | 15000 |
   | `2026-09-30` | 13000 |

   La misma cuenta **con `openingDate` NULL** y apertura 0 da 3000 a `2026-09-30` y 5000 a `2026-09-05`.

6. **CA-06** · Valor de inversión, con apertura 0, valoración de 1.000,00 € el D = `2026-09-01`, aportación +200,00 € el D+1, retirada −50,00 € el D+2 y otra valoración de 1.180,00 € el D+3:

   | Fecha | `investmentValueAt` |
   |---|---|
   | D+2 | 115000 |
   | D+3 | 118000 |
   | D+3, con un movimiento de +10,00 € el mismo D+3 | 118000 (incluido en la valoración) |
   | D+4, con ese mismo movimiento | 118000 |

   Cubre SPEC-0001 CA-01.
7. **CA-07** · Traspasos y aportaciones (repositorio y dominio):
   - `linkTransfer` entre −300,00 € en A y +300,00 € en B deja ambos en `transfer` con el mismo grupo;
   - `netWorth` no cambia respecto a la suma previa y `countsAsIncomeOrExpense` es falso en ambos;
   - `linkTransfer` con importes no opuestos, o en la misma cuenta, lanza `transfer_invalid`;
   - un movimiento +1.000,00 € con `setKind('external')` suma 1.000,00 € a `netWorth` y `countsAsIncomeOrExpense` es falso.

   Cubre la lógica de SPEC-0001 CA-03 y CA-20.
8. **CA-08** · `recordBalanceCheck` sobre la cuenta de CA-05 a `2026-09-30`:
   - con un esperado de 13.000 céntimos devuelve `diff = 0`;
   - con 12.900, devuelve `diff = +100`;
   - guarda el `balance_check` con `source='user'`;
   - con `source='file'` e `importBatchId`, guarda ambos valores.
9. **CA-09** · `groupValue` de un grupo con dos cuentas de inversión, valoradas en 1.000,00 € y 500,00 €, es 150000. Una cuenta archivada del grupo sigue sumando.
10. **CA-10** · Escritura centralizada:
    - un test que usa la API de ESLint (`ESLint#lintText`) da error de `no-restricted-imports` para un código situado en `src/ui/x.ts` que hace `import { x } from '@/db/sql'`, y ningún error para `import type { SqlDb } from '@/db/sql'`;
    - `git grep -nE "\b(INSERT|UPDATE|DELETE)\b" -- src ':!src/db' ':!**/*.test.*'` no devuelve nada.
11. **CA-11** · e2e en navegador (contexto nuevo), en un fichero nuevo `e2e/data/db.spec.ts`:
    - la pantalla de inicio muestra `db-version` = 1;
    - la prueba de almacenamiento de SPEC-0002 sigue funcionando;
    - tras recargar, `db-version` sigue en 1 y su `data-applied-at` es **el mismo** que antes de recargar, lo que demuestra que `/mire.sqlite3` persiste y no se ha vuelto a migrar, conviviendo con la base de prueba en `opfs-sahpool`.
12. **CA-12** · Los e2e de SPEC-0002 y SPEC-0003 pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Capacidad del pool OPFS**: si 10 entradas no bastan para el *journal*, el arranque falla; lo detecta CA-11. Mitigación: subir `initialCapacity`.
- **Rendimiento del dominio en memoria**: cargar todos los movimientos de una cuenta para calcular saldos es suficiente para un uso personal (miles de filas). Si crece, SPEC-0009 puede pasar a agregados en SQL.
- **Contradicción con SPEC-0002** sobre la base de prueba: está explicada en Contexto. SPEC-0016 la traslada a Diagnóstico.

### Preguntas abiertas
- Ninguna para el propietario.
