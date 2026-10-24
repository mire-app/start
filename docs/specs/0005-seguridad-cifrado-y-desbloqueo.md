---
id: SPEC-0005
title: Seguridad: cifrado, claves y desbloqueo
status: draft          # draft → approved (solo una persona) → implemented
summary: Configuración obligatoria (contraseña maestra, código de recuperación, PIN de 4 dígitos), anillo de claves, desbloqueo con PIN, autobloqueo, recuperación, token de GitHub cifrado, CSP y repositorio de datos en la cuenta personal
test_changes: allowed  # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0002, SPEC-0003, SPEC-0004, ADR-0001, ADR-0005]
---

# SPEC-0005 · Seguridad: cifrado, claves y desbloqueo

## Intención
Que Míre solo se pueda usar tras desbloquearla y que todo lo que salga del dispositivo vaya cifrado con una clave que solo controla el propietario. En concreto:
- **configuración de seguridad obligatoria** en el primer uso;
- **PIN** en cada apertura;
- **contraseña maestra** periódica;
- **código de recuperación**;
- **autobloqueo**;
- **token de GitHub cifrado**;
- una **política de seguridad de contenidos (CSP)** estricta.

La privacidad (exportación, borrado y aviso) va en SPEC-0013.

## Contexto
- `SPEC-0001`:
  - CA-12, cifrado de lo que sale. Aquí se crean las primitivas; la verificación completa es de SPEC-0008.
  - CA-14, Claude Code sin acceso al repositorio de datos.
  - Riesgos «pérdida de la clave» y «token en el navegador».
- `ADR-0001` (accepted): local-first con copia cifrada en GitHub.
- `ADR-0005` (proposed): diseño criptográfico. **Se acepta junto con esta spec.**
- `SPEC-0002`, `SPEC-0003` y `SPEC-0004`: la pantalla de inicio, sus e2e (contrato de localizadores), el script de tema en línea (pendiente de CSP por hash), `TopBar`, tokens e i18n.
- **Decisiones del propietario** (2026-10-24):
  - contraseña maestra, código de recuperación en papel y PIN de **4 dígitos**;
  - PIN **cada vez que se abre**;
  - contraseña cada **30 días** o tras **5 PIN fallidos**;
  - autobloqueo a los **5 min**;
  - token **cifrado**, con caducidad de 1 año y aviso;
  - repositorio de datos en la **cuenta personal**;
  - base local **sin cifrar** (riesgo aceptado);
  - configuración **obligatoria antes de nada**;
  - partir la spec (privacidad en SPEC-0013).

## Cambio (delta)
### 1. Núcleo criptográfico (`src/security/`)
- **`crypto.ts`**:
  - `encrypt(bytes, aad)` y `decrypt(envelope, aad)`, con el formato de sobre de ADR-0005;
  - si la etiqueta GCM no valida (AAD distinta o bytes alterados), `decrypt` lanza `decrypt_failed`.
- **`keyring.ts`**:
  - `createKeyring(password)` → `{ keyring, recoveryCode }`;
  - `unlockWithPassword(keyring, password)` → DEK;
  - `unlockWithRecoveryCode(keyring, code)` → DEK;
  - `rewrapPassword(keyring, dek, newPassword)`;
  - `regenerateRecoveryCode(keyring, dek)` → `{ keyring, recoveryCode }`.
  - Argon2id con `hash-wasm` y los parámetros de ADR-0005.
  - El código de recuperación se normaliza antes de usarlo: mayúsculas, sin espacios ni guiones, y `O`→`0`, `I`/`L`→`1` (Crockford).
- **`device.ts`**:
  - `enrollPin(dek, pin)` crea la clave de dispositivo no extraíble y el envoltorio por PIN;
  - `unlockWithPin(pin)` → DEK, o el error `pin_wrong` (con los intentos restantes) o `pin_disabled`;
  - `resetPin()`.
- **Almacenamiento**: IndexedDB `mire-keys`, con los almacenes `keyring`, `device` y `secrets`. **Nada de esto va a SQLite** (que se sincronizará).
- **`session.ts`**:
  - estado `locked | unlocked`;
  - la DEK solo en memoria del hilo principal;
  - `lock()`, `isUnlocked()` y `withDek(fn)`, que lanza `locked` si está bloqueada.

### 2. Reglas del PIN y de la contraseña
- **PIN**:
  - exactamente 4 dígitos;
  - se rechazan los triviales (`0000`, `1111`…`9999`, `1234`, `4321`, `0123`, `3210`, `1212`, `2580`, `0852`, `1004`, `2000`) con el mensaje `pin_too_simple`;
  - se introduce dos veces al crearlo.
- **Contraseña maestra**:
  - mínimo **12 caracteres**;
  - se rechaza si es igual al nombre de la app o de la marca (`mire`, `míre`), o si son 12 caracteres repetidos;
  - se confirma dos veces.
- **Fallos de PIN**:
  - `failedAttempts` sube con cada fallo y vuelve a 0 con cada acierto;
  - a partir del 3.er fallo se muestran los intentos restantes;
  - **al 5.º fallo seguido** se borra el envoltorio por PIN (`pin_disabled`) y se pide la contraseña maestra.
- **Caducidad de 30 días**: si `now − lastMasterAt > 30 días`, se aplica también `pin_disabled`. Tras poner la contraseña maestra se vuelve a crear el PIN (puede ser el mismo).

### 3. Pantallas (`src/security/ui/`, componentes y tokens de SPEC-0003, textos es/en)
- **Puerta de seguridad** (`SecurityGate`): envuelve la app en `index.html`.
  - Sin anillo de claves → **Bienvenida y configuración**.
  - Con anillo pero bloqueada → **Desbloqueo con PIN**, o **Contraseña maestra** si el PIN no está activo.
  - Desbloqueada → la app.
  - `estilo.html` (guía de estilo, sin datos) **no** pasa por la puerta.
- **Bienvenida y configuración**, en 4 pasos con indicador de progreso:
  1. bienvenida, con el texto de `docs/brand.md` y un enlace al aviso de privacidad (SPEC-0013);
  2. crear la contraseña maestra, con el aviso «Si la olvidas y pierdes el código de recuperación, nadie puede recuperar tus datos»;
  3. **código de recuperación**:
     - se muestra en 6 grupos y se puede copiar;
     - casilla «Lo he guardado en un lugar seguro»;
     - para confirmar hay que escribir los grupos 2 y 5;
  4. crear el PIN, dos veces.
- **Desbloqueo con PIN**:
  - teclado numérico en pantalla con botones de ≥ 44 px, y también acepta teclado físico;
  - un enlace «Usar contraseña maestra».
- **Contraseña maestra**: campo de contraseña y enlace «¿La has olvidado? Usar código de recuperación».
- **Recuperación**:
  1. código de recuperación;
  2. nueva contraseña maestra;
  3. **nuevo** código de recuperación (el anterior deja de valer, con confirmación como en la configuración);
  4. nuevo PIN.
- **Menú de `TopBar`** (`DropdownMenu`):
  - «Bloquear ahora»;
  - «Seguridad…», un `Dialog` con: cambiar PIN (pide el actual), cambiar contraseña maestra (pide la actual), regenerar el código de recuperación (pide la contraseña) y estado del token de GitHub (configurado sí o no, y caducidad).
- **Contrato de localizadores** para los e2e:
  - campos `getByLabel` «Contraseña maestra» / «Master password», «Repite la contraseña» / «Repeat password», «PIN», «Código de recuperación» / «Recovery code»;
  - botones `getByRole('button', { name })`;
  - el código mostrado lleva `data-testid="recovery-code"`.

### 4. Autobloqueo
- **Inactividad**: tras 5 minutos sin `pointerdown` ni `keydown`, `lock()`.
- **Pestaña oculta**: si queda oculta (`visibilitychange`) durante 5 minutos seguidos, `lock()`; al volver se muestra el PIN.
- **Al recargar o abrir**: siempre empieza bloqueada, porque la DEK no persiste.
- **Base de datos**: abrir la base local (SPEC-0004) no depende del desbloqueo. Si otra pestaña la tiene en uso, el aviso de SPEC-0002 se muestra **también sobre la pantalla de PIN**.

### 5. Token de GitHub (solo la API; las pantallas de conexión son de SPEC-0008)
- **`secrets.ts`**:
  - `setGithubToken(token, expiresAt)` exige que esté desbloqueada y que el token empiece por `github_pat_` (grano fino; si no, `token_not_fine_grained`). Lo guarda cifrado con la DEK y la AAD `"github-token"`;
  - `getGithubToken()` → `{ token, expiresAt }`; si está bloqueada lanza `locked`;
  - `tokenStatus()` → `{ configured, expiresAt, daysLeft }`, disponible sin desbloquear.

### 6. CSP y endurecimiento (solo en la build de producción)
- **Plugin de Vite** que inyecta en `index.html`, `estilo.html` y `privacidad.html` (SPEC-0013):

  ```
  default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-<hash del script de tema>';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
  connect-src 'self' https://api.github.com; worker-src 'self' blob:;
  object-src 'none'; base-uri 'self'; form-action 'none'
  ```

  El hash se calcula en la build a partir del script de tema de SPEC-0003.
- `<meta name="referrer" content="no-referrer">`.
- **Antienmarcado**: si `window.top !== window.self`, la app no se renderiza y muestra «Míre no puede abrirse dentro de otra página».

### 7. Repositorio de datos (acción del propietario, guía en `docs/setup-datos.md`)
- `docs/setup-datos.md` explica, en español:
  1. crear el repositorio **privado** `mire-datos` en la **cuenta personal** del propietario, fuera de la organización `mire-app`;
  2. crear un **token de grano fino**:
     - propietario del recurso: la cuenta personal;
     - acceso solo al repositorio `mire-datos`;
     - permisos *Contents: Read and write* (*Metadata: Read*, obligatorio);
     - caducidad de **1 año**;
  3. comprobar que la GitHub App de Claude **no** está instalada en la cuenta personal o no incluye `mire-datos`.
- La conexión desde la app y la subida del anillo de claves son de SPEC-0008.

### 8. Cambio de tests existentes (`test_changes: allowed`)
**Justificación**: la configuración obligatoria hace que, en un contexto de navegador nuevo, la app muestre la bienvenida en vez de la pantalla de inicio. Los e2e de SPEC-0002, SPEC-0003 y SPEC-0004 necesitan configurar la seguridad y desbloquear antes de sus comprobaciones.

**Alcance permitido**, y solo este:
- añadir el ayudante `e2e/helpers/security.ts` con `completeSetup(page)` (contraseña, código y PIN sintéticos) y `unlock(page)` (PIN);
- en los e2e existentes, **añadir llamadas** a esos ayudantes tras `page.goto` y tras cada recarga, cuando lleguen a la pantalla de inicio;
- **no se cambia ni se elimina ninguna comprobación** (`expect`), ni ningún localizador del contrato de SPEC-0002.

Un test de `e2e/security/contract.spec.ts` comprueba, con `git diff` contra la rama base, que en los ficheros de e2e preexistentes solo hay líneas **añadidas** que llaman a `completeSetup` o `unlock`, o que los importan.

## Fuera de alcance
- Exportación, borrado y aviso de privacidad: SPEC-0013.
- Conexión con GitHub, subida del anillo y sincronización cifrada: SPEC-0008.
- Avisos de caducidad del token en pantalla: SPEC-0008, que usará `tokenStatus()`.
- Cifrado de la base local: descartado por el propietario (riesgo aceptado en ADR-0005).
- Passkeys y biometría: candidatos para el futuro.

## Criterios de aceptación
1. **CA-01** · `crypto` (Vitest):
   - `decrypt(encrypt(b, 'a'), 'a')` devuelve `b`;
   - con la AAD `'b'`, o con un byte alterado, lanza `decrypt_failed`;
   - dos cifrados de los mismos bytes dan IV distintos.
2. **CA-02** · `keyring` (Vitest, Node, con parámetros de Argon2id reducidos solo en el test, inyectados por parámetro):
   - la DEK de `unlockWithPassword` cifra y descifra igual que la de `unlockWithRecoveryCode`;
   - una contraseña errónea da `wrong_password`;
   - un código con minúsculas, guiones u `O`/`I` se acepta normalizado;
   - tras `regenerateRecoveryCode`, el código anterior da `wrong_recovery_code`;
   - tras `rewrapPassword`, la contraseña antigua falla y la nueva funciona.
3. **CA-03** · Los parámetros de producción son exactamente los de ADR-0005 (`m = 65536 KiB`, `t = 3`, `p = 1` para la contraseña y `m = 19456 KiB`, `t = 2`, `p = 1` para el PIN). Un test lee la configuración.
4. **CA-04** · e2e de configuración en un contexto nuevo:
   - se muestra la bienvenida, no la pantalla de inicio;
   - con un PIN `1234` sale `pin_too_simple`, y con una contraseña de 11 caracteres sale un error;
   - al completar la configuración se llega a la pantalla de inicio;
   - tras recargar se pide el PIN y, al introducirlo, se vuelve a la pantalla de inicio.
5. **CA-05** · e2e de fallos de PIN:
   - 4 PIN erróneos muestran los intentos restantes;
   - el 5.º lleva a la pantalla de contraseña maestra;
   - con la contraseña se llega a crear el PIN de nuevo.
6. **CA-06** · e2e de los 30 días (`page.clock`): avanzando 31 días, al recargar se pide la contraseña maestra y no el PIN.
7. **CA-07** · e2e de autobloqueo (`page.clock`):
   - tras 5 min sin interacción se muestra el PIN;
   - con interacción cada 4 min, no se bloquea;
   - con la pestaña oculta 5 min, al volver se muestra el PIN.
8. **CA-08** · e2e de recuperación:
   - en la pantalla de contraseña, «Usar código de recuperación» con el código mostrado en la configuración permite fijar una contraseña nueva y obtener un código **distinto**;
   - el código antiguo ya no funciona.
9. **CA-09** · Token (Vitest con IndexedDB simulado, `fake-indexeddb` como dependencia de desarrollo):
   - `setGithubToken('ghp_x…')` da `token_not_fine_grained`;
   - con `github_pat_…` y `lock()`, `getGithubToken` lanza `locked`;
   - tras desbloquear, devuelve el mismo token;
   - en IndexedDB no aparece el token en claro;
   - `tokenStatus` calcula `daysLeft`.
10. **CA-10** · CSP (e2e sobre la build):
    - `index.html` y `estilo.html` tienen la meta CSP con el hash correcto del script de tema;
    - al recorrer configuración, desbloqueo, pantalla de inicio y guía de estilo no se produce ningún evento `securitypolicyviolation`, y SQLite WASM funciona;
    - cargada en un `iframe` de otro origen de prueba, la app muestra el aviso de antienmarcado.
11. **CA-11** · Los e2e de SPEC-0002, SPEC-0003 y SPEC-0004 pasan con solo los cambios permitidos del punto 8, verificado por `e2e/security/contract.spec.ts`. El aviso de dos pestañas de SPEC-0002 CA-08 sigue apareciendo.
12. **CA-12** · axe (reglas de SPEC-0003) sin infracciones en bienvenida, configuración, PIN, contraseña y recuperación, en tema claro y oscuro, y sin scroll horizontal a 375 px.
13. **CA-13** · `docs/setup-datos.md` existe con los pasos del punto 7. **El propietario** crea `mire-datos` en su cuenta personal y el token. **Claude** comprueba, con su herramienta de listado de repositorios, que `mire-datos` **no** aparece entre los accesibles. Cubre SPEC-0001 CA-14.
14. **CA-14** · `.arda/checks.sh` completo sigue por debajo de 5 minutos. Los e2e usan una contraseña y un PIN de prueba, y el coste de Argon2id en e2e se mide y se documenta.

## Riesgos y preguntas abiertas
### Riesgos
- **Base local en claro y PIN de 4 dígitos**: riesgos aceptados por el propietario (ADR-0005, Consecuencias).
- **Tiempo de Argon2id en e2e**: varias configuraciones por test (64 MiB) pueden alargar los checks. Mitigación: un contexto con la seguridad ya configurada por test, y medirlo (CA-14). No se rebajan los parámetros en producción.
- **`page.clock` y View Transitions o temporizadores de Motion**: podrían interferir. Mitigación: probar el autobloqueo en la pantalla de inicio.
- **Tamaño de la spec**: núcleo, 5 pantallas, autobloqueo, CSP y cambio de tests. Si no cabe en una sesión, se separan las pantallas de recuperación y ajustes; requeriría volver a Refinar.
- **Repositorio de datos visible para Claude**: si la GitHub App de Claude se instala en la cuenta personal con acceso a todos los repositorios, CA-13 lo detecta.

### Preguntas abiertas
- Ninguna para el propietario (decisiones del 2026-10-24).
