---
id: SPEC-0008
title: Motor de sincronización local-first cifrada
status: draft          # draft → approved (solo una persona) → implemented
summary: Captura por campo y por grupos atómicos con triggers, reloj lógico híbrido, fusión «gana el último» en un ciclo transaccional con reparaciones deterministas y avisos, ficheros cifrados por dispositivo con la API Git (arranque con Contents), compactación, anillo remoto y planificación cada 5 min; sin pantallas
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0004, SPEC-0005, SPEC-0007, SPEC-0011, SPEC-0012, SPEC-0013, SPEC-0014, SPEC-0016, SPEC-0018, SPEC-0019, SPEC-0020, ADR-0001, ADR-0002, ADR-0005, ADR-0006]
---

# SPEC-0008 · Motor de sincronización local-first cifrada

## Intención
Que los datos de Míre estén en todos los dispositivos del usuario:
- cada dispositivo trabaja en local y sin conexión;
- los cambios viajan **cifrados** a su repositorio privado;
- los cambios concurrentes se fusionan igual en todos los dispositivos, sin perder datos sin aviso.

Esta spec es el **motor**, sin pantallas. La conexión, la vinculación y el estado visible son de SPEC-0020.

## Contexto
- `SPEC-0001` (draft): CA-12 y CA-13.
- `ADR-0001` y `ADR-0002`: modelo local-first, registro de operaciones propio y límites de la API.
- `ADR-0006` (proposed): diseño de esta spec. **Se acepta junto con ella.**
- `SPEC-0004`:
  - worker, `SqlDb` y transacción por llamada;
  - SQL solo en `src/db/` (CA-10);
  - columnas comunes, borrado lógico y `UNIQUE` parciales;
  - `CHECK` y los *triggers* `category_depth` y `valuation_account_type`;
  - `linkTransfer` y `unlinkTransfer`;
  - tablas locales `sync_*`.
- `SPEC-0005`:
  - DEK (AES-GCM, no extraíble) y `withDek`;
  - `onBeforeLock` con plazo de 2 s;
  - autobloqueo a los 5 min;
  - anillo y cotas de KDF;
  - `getGithubToken`.
- `SPEC-0007`: siembra con ids y marcas de tiempo fijos.
- `SPEC-0013`: exportación (excluye `sync_*`) y borrado.
- `SPEC-0016`: datos de ejemplo (lote `demo`, `file_sha256` NULL).
- `SPEC-0019`: deshacer importaciones.
- **Decisiones del propietario** (2026-10-24):
  - separar el motor de las pantallas (SPEC-0020);
  - conflictos **por campo, gana el último**;
  - importaciones duplicadas: **detectar y avisar**;
  - **un solo token** de grano fino (*Contents* de lectura y escritura sobre el repositorio de datos).
- **Orden de implementación**: después de SPEC-0004, 0005, 0007, 0011, 0012 y 0018.

## Cambio (delta)
### 1. Ficheros
- **`src/db/sync/`**: todo el SQL de la sincronización, cumpliendo SPEC-0004 CA-10.
  - `capture.ts`: *triggers* y contexto;
  - `merge.ts`: fusión y reparaciones;
  - `outbox.ts`: cola y relojes;
  - `snapshot.ts`.
- **`src/sync/`**: sin SQL, en la página.
  - `hlc.ts`, puro;
  - `crypto.ts`: cifrado de ficheros;
  - `github.ts`: transporte;
  - `engine.ts`: ciclo y planificación;
  - `schema.ts`: `SYNCED_TABLES`, `FIELD_GROUPS` y `SYNC_TABLE_ORDER`.
- **Cambios en ficheros existentes**:
  - `src/db/api.ts`: el envoltorio de transacción fija el contexto;
  - `src/db/worker.ts`: instala la captura al abrir y fija `PRAGMA temp_store = MEMORY`.
- **`tools/fake-github.ts`**: GitHub simulado.

### 2. Reloj lógico híbrido (`src/sync/hlc.ts`)
- **Formato**: `"<ms, 13 dígitos>-<contador, 4 hex>-<deviceId>"`, comparable como texto.
- **`now(last, wallMs)`**: avanza sobre el reloj de pared y sobre el último visto. Si el contador llegaría a `ffff`, espera al milisegundo siguiente.
- **`receive(last, remote, wallMs)`**: avanza con un HLC remoto. Si el remoto va **más de 24 h por delante** del reloj de pared, el ciclo se anula con `clock_skew` y el aviso del mismo nombre, sin aplicar nada.
- **Relojes fijos**:
  - `SEED_HLC = "1767225600000-0000-0"` (2026-01-01T00:00:00Z, SPEC-0007);
  - `fromIso(iso)`: `"<ms>-0000-0"`.

### 3. Captura (`src/db/sync/capture.ts`)
**Constantes** (`src/sync/schema.ts`):
- **`SYNCED_TABLES`**: cada tabla de usuario con sus columnas, sin `id`. Un test falla si alguna tabla con columnas comunes, o alguna de sus columnas, no está en la lista. Quedan fuera `schema_migrations`, `sync_*` y `sqlite_*`.
- **`FIELD_GROUPS`**: conjuntos de columnas que se capturan y se fusionan **juntos**, porque un `CHECK` las relaciona:
  - `movement`: `{ kind, transfer_group_id, amount_cents }`;
  - `account`: `{ type, isin }`.

  Cualquier otra columna forma un grupo por sí sola.
- **`SYNC_TABLE_ORDER`**: orden de las tablas según sus claves ajenas (los padres primero).

**Cuándo hay captura**: solo con la sincronización **activada**, es decir, desde `initRemote` o `joinRemote` hasta que se olvida el repositorio. Antes de conectar no se llena ninguna cola: `initRemote` sube una instantánea de todo.

**Triggers `TEMP`**: al abrir `/mire.sqlite3` con la captura activada, el worker crea un `AFTER INSERT` y un `AFTER UPDATE` por tabla, generados desde `SYNCED_TABLES`. No es una migración: `db-version` sigue en 1.
- Si cambia alguna columna de un grupo (`OLD.c IS NOT NEW.c`), registran **todas** las columnas del grupo en `sync_outbox` y en `sync_clock`, con el HLC de `temp.sync_ctx`. En `INSERT` registran todas.
- **Modos**:

  | `sync_ctx.mode` | Efecto |
  |---|---|
  | `local` | Escriben en la cola y en `sync_clock` |
  | `seed` | Solo escriben `sync_clock`, con `SEED_HLC`. Así siembra SPEC-0007 |
  | `remote` | No escriben nada (la fusión gestiona `sync_clock`) |

- **Sin contexto**: una escritura con la captura instalada y sin `sync_ctx` **falla** con `sync_ctx_missing`.

**Contexto**: el envoltorio de transacción de `src/db/api.ts` fija `temp.sync_ctx = { hlc: now(), mode: 'local' }` en cada llamada que escribe, y lo restaura en un `finally`. Una llamada usa un único HLC.

**Tests en Node**: los que no llaman a `installCapture(db)` no tienen *triggers* y no cambian.

### 4. Relojes de campo
- **Reloj de un grupo**: el mayor HLC de sus columnas en `sync_clock`.
- **Sin entrada** (datos anteriores a la conexión): se usa `fromIso(created_at)` de la fila, **no** `updated_at`. Así, una edición posterior de otro campo no infla el reloj de los demás.
- **Filas sembradas**: tienen `SEED_HLC`, menor que cualquier cambio real.

### 5. Formato remoto
| Ruta | Contenido |
|---|---|
| `format.json` | En claro: `{ "format": "mire-data", "version": 1 }` |
| `keyring.json` | En claro: el anillo de SPEC-0005 (solo claves envueltas y parámetros de KDF) |
| `ops/<deviceId>/<seq, 10 dígitos>.bin` | Lote de cambios cifrado |
| `snapshots/<hlc>/manifest.bin` | Cifrado: `{ hlc, schemaVersion, parts: [{ path, sha256 }] }` |
| `snapshots/<hlc>/part-<NNNN>.bin` | Partes cifradas de la instantánea |
| `devices/<deviceId>.bin` | Cifrado: `{ name, lastSeenAt, appVersion }` |

- **Cada `.bin`**: byte de versión `1`, IV de 12 bytes y `AES-GCM_DEK(gzip(JSON))`, con la AAD `"mire:" + ruta`.
- **Cada lote**: `{ schemaVersion, deviceId, entries: [{ t, r, f, v, h }] }`.
  - Como máximo 512 KB de JSON antes de comprimir.
  - **Nunca separa entradas con el mismo HLC** en dos lotes.
- **Descompresión**: limitada a 50 MB por fichero; si se supera, `sync_corrupt`.
- **Commits**: el mensaje es siempre `mire sync`. Ni las rutas ni los mensajes llevan importes, conceptos, nombres de cuentas ni categorías (SPEC-0001 CA-12).
- **Repositorio «vacío»** (definición única, la que usa SPEC-0020): sin commits, o con un árbol que solo contiene `README.md`, `LICENSE` o `.gitignore`.

### 6. Transporte (`src/sync/github.ts`)
- **Token**: todas las funciones reciben el **token como parámetro**. El motor lo obtiene con `getGithubToken()` (con Míre desbloqueada). El asistente y el alta de SPEC-0020 pasan el que tienen en memoria.
- **Lectura**:
  - `GET /repos/{r}`, para la rama por defecto y `private`;
  - `GET /repos/{r}/git/ref/heads/{rama}`; un 409 «Git Repository is empty» significa repositorio sin commits;
  - `GET /git/commits/{sha}`;
  - `GET /git/trees/{sha}?recursive=1`. Si la respuesta viene `truncated`, se recorre por directorios sin `recursive`;
  - `GET /git/blobs/{sha}`.
- **Escritura**:
  - **arranque** en un repositorio sin commits, porque la API Git no escribe en un repositorio vacío: `PUT /repos/{r}/contents/format.json`, con el mensaje `mire sync`;
  - **resto**: `POST /git/blobs`, `POST /git/trees` (con `base_tree`), `POST /git/commits` y `PATCH /git/refs/heads/{rama}` con `force: false`.
- **Errores**:

  | Respuesta | Código | Qué pasa |
  |---|---|---|
  | 401 | `auth_error` | — |
  | 403 sin cabeceras de límite | `forbidden` | Token sin permiso de escritura, p. ej. |
  | 403 o 429 con `x-ratelimit-remaining: 0` o `retry-after` | `rate_limited` | Se reintenta en el siguiente ciclo |
  | 404 del repositorio | `remote_missing` | — |
  | 409 en `PATCH` de la referencia | `push_conflict` | — |
  | 5xx | `server_error` | Se reintenta en el siguiente ciclo |
  | Sin red | `offline` | — |

- **Rama que avanzó** (422 al actualizar la referencia): descarga, aplica y reintenta, hasta 3 veces. Después da `push_conflict`.

### 7. Ciclo (`src/sync/engine.ts`)
**Descargar** (`pull`):
1. Lee la referencia. Si coincide con `headSha`, no hay nada nuevo.
2. Lee el árbol y descarga, **descifra y valida todos** los ficheros nuevos del ciclo (instantánea no aplicada y `ops/**` no aplicados) **antes de aplicar nada**.
   - Si alguno falla: `sync_corrupt`, y no se aplica nada.
   - Si alguno trae un `schemaVersion` mayor que el local: `update_required`, y no se aplica nada.
3. Aplica **todo el ciclo en una única transacción** (punto 8), anota los ficheros en `sync_applied` y guarda `headSha`.
4. **Anillo**: si `keyring.json` cambió, se valida con las cotas de SPEC-0005 (si no, `keyring_invalid`) y se guarda como **anillo pendiente**, con el aviso `keyring_updated`.
   - El anillo local **no** se sustituye todavía.
   - Se adopta en el siguiente desbloqueo con contraseña: si la contraseña desenvuelve el pendiente y la DEK resultante descifra un fichero remoto, el pendiente sustituye al local.
   - Con el PIN se sigue desbloqueando igual, porque envuelve la misma DEK.

**Subir** (`push`):
1. Toma **toda** la cola, partida en lotes.
2. Cifra los lotes y crea **un** commit con ellos, con `devices/<deviceId>.bin` y, si el anillo local cambió (SPEC-0014), con `keyring.json`.
3. Si va bien, borra esas entradas de la cola y anota los ficheros propios como aplicados.
4. `nextSeq` (en `sync_state`) **nunca se reinicia**, ni tras compactar.

**Ciclo**: `pull` y después `push`. Hay un solo ciclo a la vez; si se pide otro durante uno, se encadena al terminar.

**Cuándo se ejecuta**, solo con Míre desbloqueada y con la sincronización activada:
- al desbloquear y al recuperar la red (`online`);
- cada **5 minutos**;
- al pasar a segundo plano (`visibilitychange` a `hidden`), solo `push` y sin esperar respuesta;
- con `sync.now()`;
- en `onBeforeLock`: intenta `push` dentro del plazo de 2 s de SPEC-0005.
- Como Míre se bloquea a los 5 min sin actividad (SPEC-0005), la sincronización de fondo solo corre mientras hay uso; `onBeforeLock` sube lo pendiente.

**Bloqueada**: no hay DEK ni token, así que no hay peticiones. Los cambios siguen en la cola.

### 8. Fusión (`src/db/sync/merge.ts`, en una transacción por ciclo)
**Preparación**:
- `PRAGMA defer_foreign_keys = ON`;
- `sync_ctx.mode = 'remote'`;
- `sync_state.merging = 1`: los *triggers* `category_depth` y `valuation_account_type` de SPEC-0004 no actúan mientras esté puesto, y las reparaciones los sustituyen.

**Agrupación y orden**:
- se juntan las entradas de todos los ficheros del ciclo (la instantánea primero) por tabla, fila y grupo, y en cada grupo se queda la de mayor HLC;
- se recorren las tablas en el orden de `SYNC_TABLE_ORDER`.

**Por fila**:
- **Identificadores**: `t` y `f` solo se aceptan si están en `SYNCED_TABLES`; si no, `sync_corrupt`. Los valores van siempre como **parámetros**, nunca interpolados.
- **Fila que no existe**: se inserta con una sola sentencia. Si faltan columnas `NOT NULL`, da `sync_corrupt`. No debería ocurrir: quien editó la fila la recibió antes, así que su alta está en el repositorio o en una instantánea.
- **Fila que existe**: cada grupo remoto se aplica si su HLC es mayor que el reloj local del grupo (punto 4). Todos los grupos de la fila se escriben en **una** sentencia `UPDATE`, y se actualiza `sync_clock`.
- **Reloj**: `receive` avanza con el mayor HLC recibido.

**`UNIQUE`**: si una fila choca con otra viva por un índice `UNIQUE`:
- gana la de menor `created_at` (en empate, menor `id`);
- la perdedora recibe `deleted_at` antes de aplicar.
- El resultado es el mismo sea cual sea el orden de llegada.

**Reparaciones deterministas**, tras aplicar todo y dentro de la misma transacción, con `mode = 'local'` y repetidas hasta que no haya cambios (como máximo 5 pasadas):
1. **`UNIQUE`**: las perdedoras del paso anterior quedan borradas como cambio local. Aviso `unique_resolved { table, keptId, removedId }`.
2. **Profundidad de categorías**:
   - para cada categoría cuyo padre tiene padre, o que tiene padre y también hijas vivas, se deshace el enlace `parent_id` con **mayor** HLC (se pone NULL);
   - aviso `category_flattened { categoryId }`.
3. **Valoraciones en una cuenta que no es de inversión**: la cuenta vuelve a `type = 'investment'`. Aviso `account_type_restored { accountId }`.
4. **Traspasos**: un grupo con un número de movimientos vivos distinto de 2, con los dos en la misma cuenta, con importes que no son opuestos e iguales o con algún lado que no es `transfer` se desvincula entero (`unlinkTransfer`). Aviso `transfer_unlinked { groupId }`.
5. **Importación duplicada**:
   - dos lotes vivos y no revertidos, con el mismo `file_sha256` **no nulo** (el lote `demo` no cuenta), cuyos relojes de `created_at` tienen **`deviceId` distintos**;
   - el posterior es el de mayor reloj de `created_at`;
   - aviso `duplicate_import { keptBatchId, laterBatchId }`. No se borra nada.

Las reparaciones generan los mismos valores en todos los dispositivos. Aunque cada uno use su propio HLC, convergen.

**Final**: se quita `merging`, se restaura el contexto (`finally`) y se confirma la transacción.

**Avisos**: `sync_notice` tiene una clave `dedupe_key` (p. ej. `duplicate_import:<later>`). Un aviso ya registrado no se repite. `sync.notices()` devuelve los no vistos y `sync.markSeen(seq)` los marca.

### 9. Compactación
- **Cuándo**: tras un `pull` correcto, si `ops/**` tiene más de 500 ficheros o más de 5 MB, y como mucho una vez al día por dispositivo (`lastCompactAt`).
- **Qué hace**, en **un solo commit**:
  1. escribe una instantánea con todas las filas de `SYNCED_TABLES` (las borradas incluidas) y `sync_clock`, más su `manifest.bin`;
  2. borra los ficheros `ops/**` que estaban aplicados **al leer el árbol** a partir del cual se hizo la instantánea, y las instantáneas anteriores.
- **Si la rama avanzó** (422): se descarta y se reintenta en el siguiente ciclo.
- **Dispositivos atrasados**: aplican la instantánea, que se fusiona como cualquier otro cambio, y después los `ops/**` restantes. Lo que tengan en su cola local se sube después y se fusiona por reloj.

### 10. API para SPEC-0020
- **`sync.inspectRemote(repo, token)`** → `'empty' | 'mire' | 'other'`, más el anillo si es `mire` (definición de «vacío» en el punto 5).
- **`sync.initRemote(repo, token)`**, en un repositorio vacío:
  1. hace el arranque con la API Contents si no hay commits;
  2. hace un commit con `keyring.json` y una instantánea de todo (dos commits en total si no había ninguno, ambos `mire sync`);
  3. activa la captura.
  - Si el repositorio no está vacío, da `remote_not_empty`.
- **`sync.joinRemote(repo, token)`**:
  - descarga la instantánea y los `ops/**` y activa la captura;
  - exige un dispositivo **sin datos**: ninguna fila viva en `SYNCED_TABLES`, salvo las filas sembradas sin cambios (con `SEED_HLC` en todas sus columnas); si no, da `local_not_empty`;
  - se ejecuta **antes** de la siembra de SPEC-0007, y la siembra posterior no hace nada porque ya hay categorías.
- **`sync.status()`** → `{ state, error?, lastSyncAt, pending }`:
  - `state` es `'off' | 'idle' | 'syncing' | 'offline' | 'error' | 'locked'`;
  - `error` es uno de los códigos de los puntos 2, 6 y 7;
  - `pending` es `COUNT(DISTINCT hlc)` de la cola, es decir, el número de cambios del usuario y no de campos.
- **`sync.now()`**.
- **`sync.pause()`** («Desconectar»): deja de sincronizar, pero **mantiene la captura**. `sync.resume(repo, token)` reanuda si `repo` es el mismo (comprueba que la DEK local descifra `devices/<deviceId>.bin`), y sube lo pendiente.
- **`sync.stop()`**: espera al ciclo en curso y no deja empezar otro. Lo usa el borrado de SPEC-0013 antes de borrar ficheros.
- **Códigos de error y avisos**: la lista completa, con sus campos, está en `src/sync/codes.ts`. SPEC-0020 tiene un texto para cada uno.

### 11. GitHub simulado (`tools/fake-github.ts`)
- **Implementa en memoria**:
  - las rutas del punto 6, incluida `PUT /contents` y el 409 de repositorio vacío;
  - `GET /user`, `GET /repos/{r}` (con `private` y `default_branch`) y `GET /user/repos`;
  - la cabecera `github-authentication-token-expiration`;
  - las cabeceras CORS (`Access-Control-Allow-Origin`, `-Headers`, `-Expose-Headers`) y las respuestas `OPTIONS` (*preflight*);
  - los errores 401, 403, 404, 409, 422, 429 y 5xx, inyectables.
- **Uso**: Vitest lo usa directamente. Los e2e de SPEC-0020 lo montan con `page.route`, y dos contextos pueden compartir el mismo repositorio.
- **Inspección**: permite leer todos los ficheros, rutas y mensajes de commit.

## Fuera de alcance
- Pantallas, conexión, vinculación, caducidad del token y estado visible: SPEC-0020.
- Borrar el repositorio remoto desde la app: el token solo tiene *Contents*. Se elimina en GitHub (SPEC-0014 y SPEC-0020).
- Fusionar dos conjuntos de datos independientes (un dispositivo con datos que se une a otro repositorio).
- Conectar a un repositorio distinto tras desconectar sin borrar antes los datos locales.
- Varios usuarios u hogar.

## Criterios de aceptación
Todos son tests de Vitest:
- los de base, en Node con SQLite en memoria e `installCapture`;
- los de `engine` y `github`, con el GitHub simulado.

1. **CA-01** · HLC:
   - es monótono aunque el reloj de pared vaya hacia atrás;
   - `receive` supera al remoto;
   - el orden de texto coincide con el lógico;
   - `fromIso` y `SEED_HLC` son menores que cualquier `now` posterior;
   - un remoto 25 h por delante da `clock_skew`.
2. **CA-02** · Captura:
   - cambiar la nota de un movimiento produce 2 entradas (nota y `updated_at`) con el **mismo** HLC, y `pending` vale 1;
   - cambiar `kind` produce las 3 columnas de su grupo;
   - una inserción produce una entrada por columna;
   - `mode = 'remote'` no produce ninguna, y `mode = 'seed'` solo produce relojes con `SEED_HLC`;
   - una escritura sin contexto con la captura instalada da `sync_ctx_missing`;
   - sin la sincronización activada, no hay entradas;
   - el test de cobertura de `SYNCED_TABLES` pasa, y falla si se añade al esquema una tabla de prueba que no está en la lista.
3. **CA-03** · Fusión por campo (A y B con la misma instantánea inicial):
   - A cambia la categoría y B la nota del mismo movimiento; tras intercambiar, **ambas** tienen los dos cambios;
   - si las dos cambian la nota, gana la de mayor HLC en las dos;
   - un borrado en A y una edición de la nota en B dejan la fila borrada con la nota de B;
   - en una fila sin relojes, una edición local de la nota posterior **no** impide aplicar una edición remota anterior de la categoría (reloj de `created_at`).
4. **CA-04** · Convergencia, con una semilla fija:
   - **3 bases y 200 secuencias aleatorias**, con estas operaciones:
     - altas, ediciones y borrados de movimientos y cuentas;
     - `linkTransfer` y `unlinkTransfer`, y `setKind`;
     - categorías anidadas y reanidadas;
     - reglas con el mismo patrón (`UNIQUE`);
     - periodos sin conexión;
     - una compactación.
   - Los ficheros se aplican en órdenes distintos, y los ciclos se repiten hasta que no quedan cambios derivados.
   - Al final, las 3 bases son idénticas en todas las tablas de `SYNCED_TABLES` y todas cumplen los `CHECK`, `category_depth`, `valuation_account_type` y la coherencia de traspasos.
5. **CA-05** · `UNIQUE`: A y B crean una regla «CAFETERIA» (SPEC-0018) sin sincronizar. Tras fusionar, en las dos queda viva la de menor `created_at`, la otra queda borrada, y hay **un solo** aviso `unique_resolved` aunque se repitan los ciclos.
6. **CA-06** · Invariantes:
   - **grupo de campos**: A hace `linkTransfer` sobre un movimiento y B, sin sincronizar y con un HLC posterior, hace `setKind('external')` sobre ese mismo movimiento. Tras fusionar, el movimiento es `external` sin grupo, su antigua pareja se desvincula y hay un aviso `transfer_unlinked`;
   - **traspaso huérfano**: B desvincula el traspaso de 500 € y vincula su lado de «Diario» con un movimiento sintético M3 (+500, en otra cuenta); A, con un HLC posterior, desvincula el traspaso original. Tras fusionar, M3 queda `regular`;
   - **profundidad**: A cuelga X de P, y B cuelga P de Q. Tras fusionar, las dos bases tienen el mismo árbol de dos niveles, sin el enlace más reciente, y el aviso `category_flattened`.
7. **CA-07** · Importación duplicada:
   - A y B importan `bbva-informe.xlsx` (SPEC-0011) sin sincronizar. Tras fusionar, las dos tienen un solo aviso `duplicate_import`, con el mismo `laterBatchId`, y siguen existiendo los dos lotes;
   - dos dispositivos con datos de ejemplo (SPEC-0016) no dan el aviso.
8. **CA-08** · Siembra:
   - A y B siembran (SPEC-0007) por separado. Tras fusionar, no hay cambios ni avisos;
   - A renombra «Compras» y B siembra después, sin conexión. Tras fusionar, las dos tienen el nombre de A;
   - A borra «Ocio» y B siembra después. Tras fusionar, «Ocio» está borrada en las dos.
9. **CA-09** · Cifrado (SPEC-0001 CA-12). Con BBVA, MyInvestor y el PDF de SPEC-0011 y SPEC-0012 importados, categorías y una regla, se hace `initRemote` y dos ciclos. Después:
   - **lista de comprobación**: «GASOLINERA EJEMPLO», «CAFETERIA EJEMPLO», «Diario», «MyInvestor efectivo», «FONDO EJEMPLO RENTA VARIABLE GLOBAL», «LU0000000001», «Transporte», «CAFETERIA», «2.450,12», «2450,12» y «-51,56»;
   - **control positivo**: al descifrar con la DEK, el contenido de los ficheros sí contiene esas cadenas;
   - ninguna aparece en las rutas, en los mensajes de commit ni en `format.json` o `keyring.json`;
   - los `.bin` no se descifran con otra clave;
   - las rutas cumplen `^(format\.json|keyring\.json|(ops|devices|snapshots)/[0-9a-f-]+(/[0-9a-z.-]+)*\.bin)$`;
   - todos los mensajes son `mire sync`.
10. **CA-10** · Integridad:
    - con dos ficheros nuevos en un ciclo, cambiar un byte del **segundo** da `sync_corrupt` y no aplica **ninguno**;
    - mover un `.bin` válido a otra ruta también da `sync_corrupt`;
    - un lote con un `t` que no está en `SYNCED_TABLES` da `sync_corrupt`;
    - uno con un `schemaVersion` mayor da `update_required` y no se anota como aplicado.
11. **CA-11** · Compactación:
    - con 501 lotes, el siguiente ciclo crea una instantánea y deja `ops/` vacío en **un** commit;
    - el siguiente `push` usa `nextSeq` mayor que el último;
    - una base nueva que se une después llega al mismo estado que la de origen;
    - una base atrasada con cambios en cola llega al mismo estado que las demás tras sincronizar.
12. **CA-12** · Transporte:
    - si otro dispositivo sube entre la lectura y la actualización de la referencia, el `push` recibe 422, descarga, aplica y vuelve a subir, sin perder ningún lote;
    - `initRemote` sobre un repositorio sin commits (409) hace el arranque con Contents y deja `format.json`, `keyring.json` y la instantánea;
    - un árbol `truncated` se recorre por directorios;
    - los errores 401, 403, 404, 429 y 5xx dan sus códigos.
13. **CA-13** · Planificación (temporizadores simulados):
    - con un cambio pendiente, hay un commit antes de 5 minutos;
    - sin cambios locales ni remotos, un ciclo no crea commits;
    - `sync.now()` sincroniza en el acto;
    - bloqueada, no hay ninguna petición;
    - `lock()` con cambios pendientes los sube antes de que pasen 2 s;
    - `sync.stop()` espera al ciclo en curso.
14. **CA-14** · Anillo:
    - si `keyring.json` cambia en el remoto (contraseña cambiada en A), B guarda el anillo pendiente con el aviso `keyring_updated`;
    - B sigue desbloqueando con el PIN, y con la contraseña nueva adopta el anillo;
    - un anillo con `kdf.m` fuera de cotas da `keyring_invalid`, y uno que no envuelve la misma DEK no se adopta.
15. **CA-15** · Unirse y pausar:
    - `joinRemote` en un dispositivo que solo tiene la siembra funciona, y da `local_not_empty` si tiene una cuenta;
    - tras `pause()`, un cambio local queda en la cola, y `resume` con el mismo repositorio lo sube.
16. **CA-16** · Tamaño: una importación sintética de 5.000 movimientos generada en el test produce varios lotes en **un** commit, cada uno de 512 KB o menos antes de comprimir. Ningún HLC queda repartido entre dos lotes, y otra base que los aplica llega al mismo estado.
17. **CA-17** · Sin regresiones:
    - `db-version` sigue en 1;
    - la exportación de SPEC-0013 no incluye tablas `sync_*`;
    - el CA-10 de SPEC-0004 pasa (SQL solo en `src/db/`);
    - los tests anteriores pasan sin modificarse;
    - `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Relojes desajustados**: un dispositivo con la hora adelantada (menos de 24 h) gana los conflictos del mismo campo. Es un riesgo aceptado (ADR-0006).
- **Triggers `TEMP` con `opfs-sahpool`**: son SQL estándar, pero no se han probado en el navegador. `temp_store = MEMORY` evita que consuman entradas del pool. Los e2e de SPEC-0020 lo prueban de extremo a extremo.
- **API de GitHub**: las cifras de los límites, el 409 de repositorio vacío y que *Contents* baste para la API Git con un token de grano fino no se han podido consultar desde este entorno. Se verifican al implementar, y la prueba real es SPEC-0020 CA-10.
- **Token comprometido**: quien lo tenga no puede leer los datos (están cifrados), pero sí borrarlos o subir versiones antiguas, lo que afecta a la disponibilidad. Mitigación: los datos siguen en cada dispositivo; se revoca el token y se crea otro repositorio.
- **Escritura al cerrar**: el navegador no garantiza el `push` en segundo plano. La garantía real son los 5 minutos, el desbloqueo siguiente y `onBeforeLock`.
- **Tamaño para una sesión del plan Pro**: se implementa en dos PR de la misma spec si no cabe:
  - puntos 2–4 y 8, con CA-01 a CA-08;
  - el resto.

### Preguntas abiertas
- Ninguna para el propietario.
