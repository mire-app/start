---
id: SPEC-0005
title: Seguridad: cifrado, claves y desbloqueo
status: draft          # draft → approved (solo una persona) → implemented
summary: Núcleo criptográfico (DEK, anillo de claves, clave de dispositivo), configuración obligatoria (contraseña maestra, código de recuperación, PIN de 4 dígitos), desbloqueo, autobloqueo y token de GitHub cifrado
test_changes: allowed  # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0002, SPEC-0003, SPEC-0004, SPEC-0008, SPEC-0020, ADR-0001, ADR-0005]
---

# SPEC-0005 · Seguridad: cifrado, claves y desbloqueo

## Intención
Que Míre solo se pueda usar tras desbloquearla, y que exista una clave controlada solo por el propietario para cifrar lo que salga del dispositivo. La spec cubre:
- la **configuración de seguridad obligatoria** en el primer uso;
- el **PIN** en cada apertura;
- la **contraseña maestra** periódica;
- el **autobloqueo**;
- el **token de GitHub cifrado**.

Recuperación, ajustes de seguridad, CSP y guía del repositorio de datos: **SPEC-0014**. Privacidad: **SPEC-0013**.

## Contexto
- `SPEC-0001`: CA-12, cifrado de lo que sale (aquí, las primitivas; la verificación completa es de SPEC-0008). Riesgos «pérdida de la clave» y «token en el navegador».
- `ADR-0001` (accepted): copia cifrada en GitHub.
- `ADR-0005` (proposed): diseño criptográfico. **Se acepta junto con esta spec.**
- `SPEC-0002`, `SPEC-0003` y `SPEC-0004`: pantalla de inicio y sus e2e (contrato de localizadores, aviso de dos pestañas con `role=alert`), `TopBar`, tokens, i18n, axe y `db-version`.
- **Decisiones del propietario** (2026-10-24):
  - contraseña maestra, código de recuperación en papel y PIN de **4 dígitos**;
  - PIN **cada vez que se abre**;
  - contraseña cada **30 días** o tras **5 PIN fallidos**;
  - autobloqueo a los **5 min**;
  - token **cifrado**;
  - base local **sin cifrar** (riesgo aceptado);
  - configuración **obligatoria antes de nada**;
  - partir en SPEC-0005, SPEC-0014 y SPEC-0013.

## Cambio (delta)
### 1. Núcleo criptográfico (`src/security/`)
- **`crypto.ts`**: `encrypt(bytes, aad)` y `decrypt(envelope, aad)`.
  - Sobre: `[0x01][IV de 12 bytes aleatorio][texto cifrado + etiqueta]`.
  - **La AAD efectiva es `byte de versión ‖ aad`.**
  - Si la autenticación falla, lanza `decrypt_failed`.
- **DEK (clave de datos)**:
  - en la configuración se genera **extraíble** solo el tiempo justo para envolverla;
  - al desbloquear se desenvuelve **no extraíble** para la sesión;
  - las operaciones que necesitan reenvolverla (crear o cambiar el PIN, cambiar la contraseña, regenerar el código) la desenvuelven extraíble de nuevo desde el secreto que el usuario acaba de introducir, y la descartan al terminar.
- **`keyring.ts`** (todas aceptan `opts = { kdf?, bounds? }`, solo para inyectar parámetros en los tests):
  - `createKeyring(password, opts)` → `{ keyring, recoveryCode, dek }`;
  - `unlockWithPassword(keyring, password, opts)` → DEK, o el error `wrong_password`. Si SPEC-0008 ha dejado un **anillo pendiente** (en `sync_state.pendingKeyring` de la base, que se abre antes del desbloqueo; no es secreto) y la contraseña no abre el local, se prueba con el pendiente, que se adopta si da la misma DEK (lo prueba SPEC-0008 CA-14);
  - `unlockWithRecoveryCode(keyring, code, opts)` → DEK, o el error `wrong_recovery_code` (lo usa SPEC-0014);
  - `rewrapPassword(...)` y `regenerateRecoveryCode(...)` (las usa SPEC-0014).
- **Parámetros de Argon2id** (`hash-wasm`, versión exacta):
  - los de ADR-0005 en producción;
  - al **leer** un anillo, `kdf.m`, `kdf.t` y `kdf.p` deben estar dentro de unas cotas (`m` ∈ [19456, 1048576] KiB, `t` ∈ [1, 10], `p` ∈ [1, 4]); si no, el error es `keyring_invalid`. Así se evita la rebaja de parámetros y la denegación de servicio con anillos llegados de fuera (SPEC-0008).
- **Código de recuperación**:
  - 15 bytes de `crypto.getRandomValues` codificados en Crockford base32 dan **exactamente 24 caracteres**, sin sesgo (5 bits por carácter);
  - se normaliza antes de usarlo: mayúsculas, sin espacios ni guiones, `O`→`0` e `I`/`L`→`1`.
- **`device.ts`**:
  - `enrollPin(dekExtraible, pin)` crea, si no existe, la clave de dispositivo no extraíble y guarda `AES-GCM_dispositivo(AES-KW_pin(DEK))` con la AAD `"mire-device-pin-v1"`, `failedAttempts = 0` y `lastMasterAt = now`;
  - `unlockWithPin(pin)` → DEK no extraíble, o los errores `pin_wrong` (con `remaining`), `pin_disabled` o `master_expired`.
- **Almacenamiento**: IndexedDB `mire-keys` con los almacenes `keyring`, `device` y `secrets`. Nunca va a SQLite.
- **`session.ts`**:
  - estado `locked | unlocked`;
  - `unlock(dek)`, `lock()`, `isUnlocked()` y `withDek(fn)`, que lanza `locked` si está bloqueada;
  - `onBeforeLock(cb)`: un gancho que se llama antes de borrar la DEK. Lo usará SPEC-0008 para vaciar la cola de sincronización.
  - `lock()` es **asíncrona**: espera a los `cb` que devuelvan una promesa, con un **plazo máximo de 2 s**, y después borra la DEK en cualquier caso.

### 2. Reglas del PIN y de la contraseña
- **PIN**:
  - 4 dígitos;
  - se rechazan los triviales (`0000`, `1111`…`9999`, `1234`, `4321`, `0123`, `3210`, `1212`, `2580`, `0852`, `1004`, `2000`) con `pin_too_simple`;
  - se introduce dos veces.
- **Contraseña maestra**:
  - mínimo 12 caracteres;
  - se rechaza `mire`/`míre` (ignorando mayúsculas) y los 12 caracteres iguales;
  - se introduce dos veces.
- **Fallos**:
  - `failedAttempts` se incrementa y **se guarda antes** de verificar el PIN (cerrar la pestaña no devuelve intentos), y vuelve a 0 con cada acierto;
  - desde el 3.er fallo se muestran los intentos restantes;
  - al **5.º** se borra el envoltorio por PIN (`pin_disabled`).
- **30 días**: se evalúa **al mostrar la pantalla de PIN y al enviar el PIN**, no solo al cargar. Si `now − lastMasterAt > 30 días`, el resultado es `master_expired` y se pide la contraseña maestra.
- **Tras poner la contraseña maestra**: se crea el PIN de nuevo (puede ser el mismo).

### 3. Pantallas (`src/security/ui/`, componentes y tokens de SPEC-0003, textos es/en)
- **`SecurityGate`** envuelve `index.html`:
  - sin anillo → configuración;
  - con anillo y bloqueada → PIN, o contraseña si el resultado es `pin_disabled` o `master_expired`;
  - desbloqueada → la app, **en la ruta que había en el *hash*** (no se pierde al bloquear ni al recargar).
  - `estilo.html` y `privacidad.html` no pasan por la puerta.
- **Configuración**, 4 pasos con indicador de progreso. El anillo y el PIN **se guardan de forma atómica solo al terminar el paso 4**; si se cierra antes, no queda nada guardado y se empieza de cero.
  1. Bienvenida, con enlace al aviso de privacidad (SPEC-0013) → botón **«Empezar» / «Get started»**.
  2. Campos **«Contraseña maestra» / «Master password»** y **«Repite la contraseña» / «Repeat password»** → **«Continuar» / «Continue»**.
  3. Código en `data-testid="recovery-code"`, con un botón para copiarlo.
     - Casilla **«Lo he guardado en un lugar seguro» / «I have stored it somewhere safe»**.
     - Campos **«Grupo 2» / «Group 2»** y **«Grupo 5» / «Group 5»** → **«Continuar»**.
  4. Campos **«PIN»** y **«Repite el PIN» / «Repeat PIN»** → **«Crear PIN» / «Create PIN»**.
- **PIN**:
  - un `<input>` con etiqueta **«PIN»** (`type=password`, `inputmode=numeric`, `maxlength=4`) más un teclado en pantalla de botones ≥ 44 px que lo rellena;
  - se envía **automáticamente al 4.º dígito** y también con **«Desbloquear» / «Unlock»**;
  - enlace **«Usar contraseña maestra» / «Use master password»**.
- **Contraseña maestra**: campo **«Contraseña maestra»** y botón **«Desbloquear»**.
- **Errores**: en un contenedor `role="status"` (**nunca** `role="alert"`, reservado al aviso de SPEC-0002) con `data-error-code` (p. ej. `pin_too_simple`).
- **Menú de `TopBar`**: un botón **«Menú» / «Menu»** que abre un `DropdownMenu` con **«Bloquear ahora» / «Lock now»**. SPEC-0014 y SPEC-0013 añaden más entradas.
- **Selector de nombre accesible**: los ayudantes de e2e aceptan ambos idiomas mediante expresiones regulares **ancladas** (`/^(Contraseña maestra|Master password)$/`, `/^PIN$/`), para que «PIN» no coincida con «Repite el PIN».

### 4. Autobloqueo
- Se guardan `lastActivityAt` (en cada `pointerdown` o `keydown`) y `hiddenSince` (en `visibilitychange`).
- Se comprueba **por marcas de tiempo**, no solo por temporizadores, porque en Android se congelan con la pestaña oculta:
  - al volver a visible y en cada interacción: si `now − lastActivityAt ≥ 5 min`, o `now − hiddenSince ≥ 5 min`, `lock()`;
  - además, una comprobación cada 15 s mientras está visible.
- Siempre se empieza bloqueada al abrir o recargar.
- La base local (SPEC-0004) se abre sin esperar al desbloqueo. Si otra pestaña la usa, el aviso de SPEC-0002 se ve también sobre la pantalla de PIN.

### 5. Token de GitHub (API; las pantallas son de SPEC-0020)
- `setGithubToken(token, expiresAt)`:
  - exige estar desbloqueada;
  - exige el prefijo `github_pat_`; si no, `token_not_fine_grained`;
  - lo guarda cifrado con la DEK y la AAD `"github-token"`.
- `getGithubToken()`: lanza `locked` si está bloqueada.
- `tokenStatus()` → `{ configured, expiresAt, daysLeft }`, disponible sin desbloquear.

### 6. Cambio de tests existentes (`test_changes: allowed`)
**Justificación**: con la configuración obligatoria, un contexto de navegador nuevo muestra la bienvenida y no la pantalla de inicio. Los e2e de SPEC-0002, SPEC-0003 y SPEC-0004 deben configurar y desbloquear antes de sus comprobaciones.

**Alcance permitido, y solo este**:
- nuevo `e2e/helpers/security.ts` con `completeSetup(page)` y `unlock(page)`. Terminan cuando es visible el botón **«Menú» / «Menu»** de `TopBar`, nunca un control de la pantalla de inicio, que otras specs pueden mover. Son bilingües, que usan las constantes `TEST_MASTER_PW` y `TEST_PIN` (sintéticas);
- en los ficheros de test **preexistentes**, solo **líneas añadidas** que importen esos ayudantes o los llamen (`await completeSetup(page)` y `await unlock(page)`), tras `page.goto` y tras cada recarga;
- `playwright.config.ts` puede subir `timeout` hasta 60 s por test.

**Prohibido** en los ficheros de test preexistentes (e2e **y** Vitest, `src/**/*.test.*`):
- borrar o renombrar ficheros;
- quitar o modificar líneas;
- añadir `.skip` u `.only`;
- cambiar *timeouts* dentro de los tests.

**Control** `tools/check-test-changes.ts`, ejecutado con `tsx` (ADR-0004; si aún no está en `package.json`, esta spec lo añade como `devDependency` exacta) por `.arda/checks.sh` **solo mientras `.arda/active-spec` apunta a esta spec**. La política es ampliable por spec: SPEC-0016 añade la suya. Su lógica se separa en `checkDiff(diff, baseTestFiles)`, una función pura con tests en `tools/*.test.ts` (el `include` de Vitest se amplía a `tools/**/*.test.ts`):
- **base**: `git merge-base HEAD origin/main`, haciendo antes `git fetch origin main` si falta. Si no se puede resolver, **falla** con un mensaje claro (en `arda-gate`, `fetch-depth: 0` lo garantiza);
- **qué comprueba**: los ficheros que en la base cumplen el patrón de tests de `arda_guard.py` deben seguir existiendo y su diff solo puede tener líneas añadidas de la lista permitida.

Fuera de SPEC-0005, el control no hace nada, de modo que no bloquea las specs futuras.

## Fuera de alcance
- Recuperación con el código, diálogo «Seguridad…», CSP, antienmarcado y guía del repositorio de datos: SPEC-0014.
- Exportación, borrado y aviso de privacidad: SPEC-0013.
- Sincronización y subida y descarga del anillo: SPEC-0008. Conexión con GitHub y **alta de un segundo dispositivo** («Ya uso Míre en otro dispositivo»): SPEC-0020.
- Cifrado de la base local: descartado (ADR-0005).

## Criterios de aceptación
1. **CA-01** · `crypto` (Vitest):
   - el viaje de ida y vuelta funciona;
   - con otra AAD, un byte alterado o el byte de versión cambiado, lanza `decrypt_failed`;
   - dos cifrados de los mismos bytes dan IV distintos.
2. **CA-02** · `keyring` (Vitest, Node, con `kdf` y `bounds` reducidos inyectados):
   - la DEK de `unlockWithPassword` y la de `unlockWithRecoveryCode` son equivalentes (cifran y descifran igual);
   - `wrong_password` con una contraseña errónea;
   - el código se acepta normalizado (minúsculas, guiones, `O` e `I`);
   - un anillo con `kdf.m = 1024` y las cotas por defecto da `keyring_invalid`;
   - el código generado tiene 24 caracteres del alfabeto Crockford.
3. **CA-03** · Los parámetros por defecto son exactamente los de ADR-0005 y las cotas los del punto 1 (test sobre la configuración exportada).
4. **CA-04** · e2e de configuración (contexto nuevo):
   - se ve la bienvenida;
   - el PIN `1234` da `data-error-code="pin_too_simple"`;
   - una contraseña de 11 caracteres da error;
   - si se recarga en el paso 3, se vuelve al paso 1 y no hay anillo guardado;
   - al completar, se ve la pantalla de inicio;
   - tras recargar se ve el PIN, y al introducirlo se ve la pantalla de inicio.
5. **CA-05** · e2e de fallos:
   - con 4 PIN erróneos se ven los intentos restantes;
   - si se recarga tras el 4.º y se falla una vez más, se pide la contraseña, porque el contador persiste;
   - con la contraseña se crea el PIN y se llega a la pantalla de inicio.
6. **CA-06** · e2e de 30 días: con `page.clock.install()` y `fastForward` de 31 días **sin recargar**:
   - si la app no se ha bloqueado sola, se pulsa «Bloquear ahora»;
   - en cualquier caso, se pide la **contraseña** y no el PIN.
7. **CA-07** · e2e de autobloqueo (`page.clock.install()` y `runFor`):
   - 5 min sin interacción muestran el PIN;
   - con un clic cada 4 min no se bloquea;
   - simulando la pestaña oculta (`Object.defineProperty(document, 'visibilityState', { value: 'hidden' })` y el evento `visibilitychange`) durante 5 min y volviendo a visible, se ve el PIN.
8. **CA-08** · Token (Vitest con `fake-indexeddb`, dependencia de desarrollo):
   - `setGithubToken('ghp_x')` da `token_not_fine_grained`;
   - bloqueada, `getGithubToken` da `locked`;
   - desbloqueada, devuelve el mismo token;
   - en IndexedDB no aparece el token en claro;
   - `daysLeft` es correcto.
   - Las cadenas de token de prueba tienen menos de 20 caracteres tras el prefijo.
9. **CA-09** · Gancho de bloqueo (Vitest):
   - `onBeforeLock` se llama antes de borrar la DEK;
   - un `cb` que tarda 5 s no impide el bloqueo pasados 2 s;
   - `withDek` después de `lock()` lanza `locked`.
10. **CA-10** · `checkDiff` (Vitest) **rechaza** diffs sintéticos que:
    - añaden un `expect`;
    - añaden `.skip` u `.only`;
    - quitan una línea;
    - borran o renombran un fichero de test de la base;
    - cambian un `.test.ts` de Vitest.

    Y **acepta** uno que solo añade `import { completeSetup, unlock } …` y `await completeSetup(page)`.
11. **CA-11** · Los e2e de SPEC-0002, SPEC-0003 y SPEC-0004 pasan con solo los cambios permitidos, verificado por `tools/check-test-changes.ts` en `checks.sh`. El aviso de dos pestañas (SPEC-0002 CA-08) sigue funcionando con `getByRole('alert')`.
12. **CA-12** · axe (SPEC-0003) sin infracciones en la configuración, el PIN y la contraseña, en claro y en oscuro; sin scroll horizontal a 375 px.
13. **CA-13** · `python3 .arda/tools/arda_ci.py secrets` pasa sobre los cambios de esta spec: las constantes de prueba no usan nombres que coincidan con `password|token|secret` con un valor literal de 12 o más caracteres.
14. **CA-14** · `.arda/checks.sh` sigue por debajo de 5 minutos. El coste de Argon2id en los e2e (una configuración por contexto nuevo) se mide y se anota en el PR.

## Riesgos y preguntas abiertas
### Riesgos
- **Riesgos aceptados** (ADR-0005): base local en claro; PIN de 4 dígitos atacable fuera del navegador por quien copie el perfil.
- **Sincronización y bloqueo**: con Míre bloqueada no hay DEK, así que no se puede cifrar ni descifrar el token. La sincronización se pausa mientras está bloqueada, y `onBeforeLock` permite vaciar la cola antes de bloquear. Lo concretará SPEC-0008.
- **Segundo dispositivo**: la configuración de esta spec crea una DEK **nueva**. Un segundo dispositivo debe importar el anillo del repositorio, no crear otro. SPEC-0020 añadirá esa opción a la bienvenida; mientras tanto, cada dispositivo sería independiente.
- **Tiempo de los e2e**: cada contexto nuevo hace una configuración, con Argon2id a 64 MiB (≈1 s en el escritorio). No se puede reutilizar una sesión, porque la clave de dispositivo no se serializa en `storageState`. Se mide (CA-14); si se pasa del presupuesto, se reducen flujos e2e, no los parámetros.
- **Escáner de secretos**: las constantes de prueba deben evitar el patrón de `arda_ci.py` (CA-13).

### Preguntas abiertas
- Ninguna para el propietario.
