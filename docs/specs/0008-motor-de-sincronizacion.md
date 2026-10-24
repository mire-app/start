---
id: SPEC-0008
title: Motor de sincronización local-first cifrada
status: draft          # draft → approved (solo una persona) → implemented
summary: Captura por campo con triggers, reloj lógico híbrido, fusión «gana el último» por campo con invariantes y avisos, ficheros cifrados por dispositivo en el repositorio privado con la API Git, compactación, anillo remoto y planificación cada 5 min; sin pantallas
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0004, SPEC-0005, SPEC-0007, SPEC-0011, SPEC-0013, SPEC-0014, SPEC-0019, SPEC-0020, ADR-0001, ADR-0002, ADR-0005, ADR-0006]
---

# SPEC-0008 · Motor de sincronización local-first cifrada

## Intención
Que los datos de Míre estén en todos los dispositivos del usuario:
- cada dispositivo trabaja en local y sin conexión;
- los cambios viajan **cifrados** a su repositorio privado `mire-datos`;
- los cambios concurrentes se fusionan sin perder datos sin aviso.

Esta spec es el **motor**, sin pantallas. La conexión, la vinculación y el estado visible son de SPEC-0020.

## Contexto
- `SPEC-0001` (draft): CA-11, CA-12 y CA-13.
- `ADR-0001`: modelo local-first.
- `ADR-0002`: registro de operaciones propio y límites de la API.
- `ADR-0006` (proposed): diseño de esta spec. **Se acepta junto con ella.**
- `SPEC-0004`:
  - worker, `SqlDb` y transacciones por llamada;
  - columnas comunes, borrado lógico y `UNIQUE` parciales;
  - `linkTransfer` y `unlinkTransfer`;
  - tablas locales `sync_*` del esquema inicial.
- `SPEC-0005`:
  - DEK (AES-GCM) y `withDek`;
  - `onBeforeLock` con plazo de 2 s;
  - anillo `mire-keys` y cotas de KDF al leer un anillo de fuera;
  - `getGithubToken`.
- `SPEC-0007`: filas sembradas con ids y marcas de tiempo fijos, que se fusionan como cualquier otra.
- `SPEC-0019`: deshacer importaciones (destino del aviso de importación duplicada).
- `SPEC-0013`: exportación, que excluye las tablas `sync_*`.
- **Decisiones del propietario** (2026-10-24):
  - separar el motor (esta spec) de las pantallas (SPEC-0020);
  - conflictos **por campo, gana el último**;
  - importaciones duplicadas: **detectar y avisar**;
  - **un solo token** de grano fino (*Contents* de lectura y escritura sobre el repositorio de datos).

## Cambio (delta)
### 1. Tablas locales (ya creadas en `0001_initial.sql` por SPEC-0004)
Sin columnas comunes; nunca se sincronizan ni se exportan. Esta spec define su uso:
- `sync_state(key PRIMARY KEY, value)`: `deviceId` (UUID aleatorio), `repo` (`owner/name`), `lastHlc`, `lastSyncAt`, `headSha` y `keyringSha`;
- `sync_clock(table_name, row_id, field, hlc, PRIMARY KEY(table_name, row_id, field))`;
- `sync_outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT, table_name, row_id, field, value, hlc)`, donde `value` es JSON;
- `sync_applied(path PRIMARY KEY, sha)`: ficheros remotos ya aplicados;
- `sync_notice(seq INTEGER PRIMARY KEY AUTOINCREMENT, kind, payload, created_at, seen_at)`.

### 2. Reloj lógico híbrido (`src/sync/hlc.ts`, puro)
- **Formato**: `"<ms, 13 dígitos>-<contador, 4 hex>-<deviceId>"`, comparable como texto.
- **`now(last, wallMs)`**: avanza sobre el reloj de pared y sobre el último visto.
- **`receive(last, remote, wallMs)`**: hace lo mismo con un HLC remoto.
- **`fromIso(iso)`**: `"<ms>-0000-0"`. Es el reloj de un campo que no tiene entrada en `sync_clock`, como los datos anteriores a esta spec y las filas sembradas.

### 3. Captura (`src/sync/capture.ts`, en el worker)
- **Tablas sincronizadas**: la constante `SYNCED_TABLES` lista cada tabla de usuario y sus columnas, sin `id`.
  - Un test falla si alguna tabla con columnas comunes, o alguna de sus columnas, no está en la lista.
  - Las tablas `schema_migrations`, `sync_*` y `sqlite_*` no entran.
- **Triggers `TEMP`**: al abrir `/mire.sqlite3`, el worker crea un `AFTER INSERT` y un `AFTER UPDATE` por tabla. No es una migración: `db-version` sigue en 1.
  - Por cada columna en la que `OLD.c IS NOT NEW.c` (todas en `INSERT`), insertan en `sync_outbox` y actualizan `sync_clock` con el HLC de `temp.sync_ctx`.
  - Solo actúan si `temp.sync_ctx.mode = 'local'`.
- **Contexto**: el envoltorio de transacción de la API del worker (SPEC-0004) fija `temp.sync_ctx = { hlc: now(), mode: 'local' }` al empezar cada llamada que escribe. La fusión usa `mode = 'remote'`.
- **Tests en Node**: los que no llaman a `installCapture(db)` no tienen *triggers* y siguen igual.

### 4. Formato remoto (repositorio `mire-datos`)
| Ruta | Contenido |
|---|---|
| `format.json` | En claro: `{ "format": "mire-data", "version": 1 }` |
| `keyring.json` | En claro: el anillo de SPEC-0005 (solo claves envueltas y parámetros de KDF) |
| `ops/<deviceId>/<seq, 10 dígitos>.bin` | Lote de cambios cifrado |
| `snapshots/<hlc>/part-<NNNN>.bin` y `snapshots/<hlc>/manifest.bin` | Instantánea cifrada, en partes |
| `devices/<deviceId>.bin` | Cifrado: `{ name, lastSeenAt, appVersion }` |

- **Cifrado de cada `.bin`**: byte de versión `1`, IV de 12 bytes y `AES-GCM_DEK(gzip(JSON))`, con la AAD `"mire:" + ruta`. Un fichero cambiado o movido de ruta no se descifra.
  - Un fallo de descifrado da `sync_corrupt` y no aplica nada de ese ciclo.
- **Tamaño**: cada lote, como máximo 512 KB de JSON antes de comprimir; si es mayor, se parte en varios ficheros. Las partes de una instantánea miden como máximo 900 KB.
- **Commits**: el mensaje es siempre `mire sync`. Ni las rutas ni los mensajes llevan importes, conceptos, nombres de cuentas ni categorías (SPEC-0001 CA-12).

### 5. Transporte (`src/sync/github.ts`, en la página)
- **API**: REST de `api.github.com` con el token de SPEC-0005 (`Authorization: Bearer`), en la rama por defecto.
  - **Lectura**: `GET /repos/{r}/git/ref/heads/{rama}`, `GET /git/commits/{sha}`, `GET /git/trees/{sha}?recursive=1` y `GET /git/blobs/{sha}`.
  - **Escritura**: `POST /git/blobs`, `POST /git/trees` (con `base_tree`), `POST /git/commits` y `PATCH /git/refs/heads/{rama}` con `force: false`.
- **Errores**:

  | Respuesta | Código |
  |---|---|
  | 401 | `auth_error` |
  | 403 por límite | `rate_limited` (se reintenta en el siguiente ciclo) |
  | 404 del repositorio | `remote_missing` |
  | Sin red | `offline` |

- **Rama que avanzó** (422 al actualizar la referencia): descarga, aplica y reintenta, hasta 3 veces; después `push_conflict`.

### 6. Ciclo de sincronización (`src/sync/engine.ts`, en la página)
**Descargar** (`pull`):
1. Lee la referencia. Si coincide con `headSha`, no hay nada nuevo.
2. Lee el árbol.
3. Si cambió `keyring.json`, valida el anillo con las cotas de SPEC-0005 y lo adopta, con el aviso `keyring_updated`. Si no pasa la validación: `keyring_invalid`, sin adoptarlo.
4. Si hay una instantánea no aplicada, la aplica.
5. Aplica los ficheros `ops/**` no aplicados, **en orden de secuencia dentro de cada dispositivo**. Cada fichero se aplica en su transacción y se anota en `sync_applied`.
6. Ejecuta la comprobación de invariantes (punto 8).

**Subir** (`push`):
1. Toma de `sync_outbox` hasta el límite de tamaño y lo cifra.
2. Crea un commit con el lote y `devices/<deviceId>.bin`.
3. Si va bien, borra esas entradas de la cola y anota el fichero propio como aplicado.

**Ciclo**: `pull` y después `push`. Un solo ciclo a la vez; si se pide otro durante uno, se encadena al terminar.

**Cuándo se ejecuta**, solo con Míre desbloqueada y conectada:
- al desbloquear y al recuperar la red (`online`);
- cada **5 minutos**;
- al pasar a segundo plano (`visibilitychange` a `hidden`), solo `push` y sin esperar respuesta;
- con `sync.now()`;
- en `onBeforeLock`: intenta `push` dentro del plazo de 2 s de SPEC-0005.

**Bloqueada**: no hay DEK ni token, así que no hay peticiones. Los cambios siguen en la cola.

### 7. Fusión (`src/sync/merge.ts`, en el worker, `mode = 'remote'`)
- **Por fila**:
  - si la fila no existe, se inserta con los campos recibidos;
  - si existe, cada campo se escribe solo si `hlc_remoto > sync_clock` local (o `fromIso(updated_at)` si no hay entrada), y se actualiza `sync_clock`.
  - El último HLC recibido avanza el reloj local (`receive`).
- **Restricciones** (cada fila en un `SAVEPOINT`):
  - **`UNIQUE`**:
    - gana la fila con menor `created_at` (en empate, menor `id`);
    - la otra recibe `deleted_at`, como cambio local con su HLC, para que todos converjan;
    - aviso `unique_resolved`;
  - **`CHECK` o *trigger*** (por ejemplo `category_depth`, o `kind` con `transfer_group_id` mezclados): la fila se toma **entera** de la versión, local o remota, con el mayor HLC de campo, y se emite el aviso `row_conflict`.
- **Determinismo**: aplicar los mismos ficheros en cualquier orden entre dispositivos da el mismo estado.

### 8. Invariantes y avisos tras fusionar
- **Traspasos**: un grupo con un número de movimientos vivos distinto de 2, con dos movimientos en la misma cuenta o con importes que no son opuestos e iguales se desvincula (`unlinkTransfer`, como cambio local). Aviso `transfer_unlinked`.
- **Importación duplicada**:
  - dos lotes vivos, no revertidos, con el mismo `file_sha256` y creados en **dispositivos distintos** (según el `deviceId` del HLC de inserción de su `id`);
  - aviso `duplicate_import { keptBatchId, laterBatchId }`, donde el posterior es el de mayor HLC;
  - no se borra nada: el usuario lo deshace desde el historial (SPEC-0019).
- **Lista de avisos**: `sync.notices()` devuelve los avisos no vistos y `sync.markSeen(seq)` los marca. Los muestra SPEC-0020.

### 9. Compactación
- **Cuándo**: tras un `pull` correcto, si `ops/**` tiene más de 500 ficheros o más de 5 MB. Como mucho una vez al día por dispositivo.
- **Qué hace**, en **un solo commit**:
  1. escribe una instantánea con todas las filas de `SYNCED_TABLES` (las borradas incluidas) y `sync_clock`;
  2. borra los ficheros `ops/**` que ya había aplicado y las instantáneas anteriores.
- Un dispositivo nuevo o atrasado aplica la instantánea, que se fusiona como cualquier otro cambio, y después los `ops/**` restantes.

### 10. Inicialización y alta (API para SPEC-0020)
- **`sync.initRemote(repo)`**, en un repositorio vacío:
  - sube `format.json`, `keyring.json` y una instantánea de todo, en un commit;
  - guarda `repo` y `keyringSha`.
  - Si el repositorio no está vacío ni es de Míre, da `remote_not_empty`.
- **`sync.inspectRemote(repo)`** → `'empty' | 'mire' | 'other'`, y el anillo si es `mire`.
- **`sync.joinRemote(repo)`**, en un dispositivo **sin datos**, tras desbloquear con el anillo remoto:
  - descarga la instantánea y los `ops/**`;
  - si el dispositivo tiene datos, da `local_not_empty`.
- **`sync.status()`** → `{ state: 'off' | 'idle' | 'syncing' | 'error' | 'locked', error?, lastSyncAt, pending }`, donde `pending` es el número de entradas en `sync_outbox`.
- **`sync.now()`** y **`sync.disconnect()`**. Desconectar borra `sync_state.repo` y las tablas `sync_applied` y `sync_outbox`, y no toca los datos.
- **`keyring.json` al cambiar el anillo**: con un cambio de contraseña o un código nuevo (SPEC-0014), se sube en el siguiente ciclo.

### 11. Pruebas: GitHub simulado (`tools/fake-github.ts`)
- **Implementa** en memoria las rutas del punto 5, incluidos los 401, 404 y 422.
- **Uso**: Vitest lo usa directamente. Los e2e de SPEC-0020 lo montan con `page.route`, y dos contextos de navegador pueden compartir el mismo repositorio simulado.
- **Inspección**: permite leer todos los ficheros, rutas y mensajes de commit.

## Fuera de alcance
- Pantallas, conexión, QR de vinculación, aviso de caducidad del token y estado visible: SPEC-0020.
- Borrar el repositorio remoto desde la app: el token solo tiene *Contents*. Se elimina en GitHub (guía de SPEC-0014).
- Fusionar dos conjuntos de datos independientes (un dispositivo con datos que se une a un repositorio con otros datos).
- Varios usuarios u hogar.

## Criterios de aceptación
Todos son tests de Vitest: los de base en Node con SQLite en memoria y `installCapture`, y los de `engine` y `github` con el GitHub simulado.

1. **CA-01** · HLC: es monótono con el reloj de pared hacia atrás, `receive` supera al remoto, el orden de texto coincide con el orden lógico y `fromIso` es menor que cualquier `now` posterior.
2. **CA-02** · Captura:
   - cambiar la nota de un movimiento produce **una** entrada en `sync_outbox`, con el HLC de `sync_ctx`;
   - una inserción produce una por columna;
   - con `mode = 'remote'` no produce ninguna;
   - el test de cobertura de `SYNCED_TABLES` pasa, y falla si se añade al esquema una tabla de prueba que no esté en la lista.
3. **CA-03** · Fusión por campo (dos bases A y B con la misma instantánea inicial):
   - A cambia la categoría y B la nota del mismo movimiento; tras intercambiar, **ambas** tienen los dos cambios;
   - si las dos cambian la nota, gana la de mayor HLC en las dos;
   - un borrado en A y una edición en B dejan la fila borrada con la nota de B.
4. **CA-04** · Convergencia: con una semilla fija, 200 secuencias aleatorias de cambios en 3 bases, aplicadas en órdenes distintos, dan estados idénticos (todas las tablas de `SYNCED_TABLES` y `sync_clock`).
5. **CA-05** · `UNIQUE`: A y B crean una regla «CAFETERIA» (SPEC-0018) sin sincronizar. Tras fusionar, en las dos queda viva la de menor `created_at`, la otra queda borrada, y hay un aviso `unique_resolved`.
6. **CA-06** · Invariantes:
   - **traspaso huérfano**:
     - B desvincula el traspaso de 500 € y vincula su lado de «Diario» (−500) con otro movimiento sintético M3 (+500, en una tercera cuenta);
     - A, con un HLC posterior, desvincula el traspaso original;
     - tras fusionar, el lado de «Diario» queda `regular` (cambio de A) y M3 queda solo en su grupo, así que se desvincula;
     - las dos bases quedan iguales, con el aviso `transfer_unlinked`;
   - **fila que rompe un `CHECK`**: un movimiento construido en el test con `kind = 'transfer'` de A y `transfer_group_id = NULL` de B se toma entero de la versión con mayor HLC, con el aviso `row_conflict`.
7. **CA-07** · Importación duplicada: A y B importan `bbva-informe.xlsx` (SPEC-0011) sin sincronizar. Tras fusionar, las dos tienen el aviso `duplicate_import`, con el mismo `laterBatchId`, y siguen existiendo los dos lotes.
8. **CA-08** · Siembra: A y B siembran las categorías (SPEC-0007) por separado. Tras fusionar, no hay ningún cambio en sus filas ni ningún aviso.
9. **CA-09** · Cifrado (SPEC-0001 CA-12): con BBVA, MyInvestor y el PDF de SPEC-0011 y SPEC-0012 importados, categorías y una regla, tras `initRemote` y dos ciclos:
   - ningún fichero, ruta ni mensaje de commit del repositorio simulado contiene un concepto, un nombre de cuenta, de categoría o de fondo, un ISIN ni un importe de esos ficheros (en céntimos y en `1.023,44` o `1023,44`);
   - las rutas cumplen `^(format\.json|keyring\.json|(ops|devices|snapshots)/[0-9a-f-]+(/[0-9a-z.-]+)*\.bin)$`;
   - todos los mensajes son `mire sync`.
10. **CA-10** · Integridad:
    - cambiar un byte de un `.bin` da `sync_corrupt` y no cambia la base;
    - mover un `.bin` válido a otra ruta también da `sync_corrupt`.
11. **CA-11** · Compactación:
    - con 501 lotes, el siguiente ciclo crea una instantánea y deja `ops/` vacío en **un** commit;
    - una base nueva que se une después llega al mismo estado que la de origen.
12. **CA-12** · Concurrencia: si otro dispositivo sube entre la lectura y la actualización de la referencia, el `push` recibe 422, descarga, aplica y vuelve a subir, sin perder ninguno de los dos lotes.
13. **CA-13** · Planificación (temporizadores simulados):
    - con un cambio pendiente, hay un commit antes de 5 minutos;
    - sin cambios locales ni remotos, un ciclo no crea commits;
    - `sync.now()` sincroniza en el acto;
    - bloqueada, no hay ninguna petición;
    - `lock()` con cambios pendientes los sube antes de que pasen 2 s.
14. **CA-14** · Anillo: si `keyring.json` cambia en el remoto (contraseña cambiada en A), B lo adopta y desbloquea con la nueva contraseña. Un anillo con `kdf.m` fuera de cotas da `keyring_invalid` y no se adopta.
15. **CA-15** · Errores: un 404 del repositorio da `remote_missing`, un 401 da `auth_error` y sin red da `offline`. En los tres, los cambios siguen en la cola.
16. **CA-16** · Tamaño: una importación sintética de 5.000 movimientos generada en el test produce varios lotes, cada uno de 512 KB o menos antes de comprimir, y otra base que los aplica llega al mismo estado.
17. **CA-17** · `db-version` sigue en 1, la exportación de SPEC-0013 no incluye tablas `sync_*`, y los tests anteriores pasan sin modificarse. `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Relojes desajustados**: un dispositivo con la hora muy adelantada gana los conflictos del mismo campo. El HLC limita el efecto a ese caso; es un riesgo aceptado (ADR-0006).
- **Límites y comportamiento de la API de GitHub**: no se han podido consultar las cifras vigentes desde este entorno. Hay que verificarlas en la implementación, incluido que *Contents* basta para la API Git con un token de grano fino.
- **Escritura al cerrar**: el navegador no garantiza el `push` en segundo plano. La garantía real son los 5 minutos, el desbloqueo siguiente y `onBeforeLock`.
- **Tamaño de la spec para una sesión del plan Pro**: si no cabe, se implementa en dos PR de la misma spec. El primero tiene los puntos 1–3, 7 y 8 con CA-01 a CA-08; el segundo, el resto.

### Preguntas abiertas
- Ninguna para el propietario.
