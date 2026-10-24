---
id: SPEC-0020
title: Conexión con GitHub, vinculación de dispositivos y estado de la sincronización
status: approved          # draft → approved (solo una persona) → implemented
summary: Asistente guiado sin servidor para crear el repositorio privado y el token con enlaces prerrellenados y comprobarlos, vinculación y renovación de token por QR con código y contraseña, indicador de estado, Ajustes › Sincronización y avisos (caducidad del token, repositorio borrado, conflictos, importación duplicada)
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0005, SPEC-0006, SPEC-0008, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0014, SPEC-0016, SPEC-0019, ADR-0005, ADR-0006]
---

# SPEC-0020 · Conexión con GitHub, vinculación de dispositivos y estado de la sincronización

## Intención
Que cualquier persona pueda activar la sincronización **sin ayuda técnica**, sea el propietario o un amigo con quien comparta Míre (cada uno con su copia, su cuenta de GitHub y su repositorio):
- un asistente dentro de Míre hace todo lo automatizable;
- lo que hay que hacer en GitHub lo explica paso a paso, con enlaces que lo dejan ya rellenado;
- añadir el móvil, o pasarle un token renovado, es escanear un QR.

## Contexto
- `SPEC-0001` (draft): CA-11, CA-13 (de extremo a extremo), CA-14 (comprobación del propietario) y CA-16.
- `SPEC-0008`: motor.
  - `sync.inspectRemote`, `initRemote`, `joinRemote`, `status`, `now`, `pause`, `resume`, `stop`, `notices` y `markSeen`, todos con el token como parámetro;
  - definición de repositorio «vacío»;
  - códigos de error y avisos (`src/sync/codes.ts`);
  - GitHub simulado.
- `SPEC-0005`:
  - configuración en 4 pasos y `SecurityGate`;
  - `setGithubToken` (exige estar desbloqueada) y `tokenStatus`;
  - `unlockWithPassword`, Argon2id y el normalizado de códigos Crockford.
- `SPEC-0014`:
  - diálogo «Seguridad…» con el estado del token;
  - recuperación con el código;
  - CSP con `connect-src https://api.github.com` e `img-src data:`;
  - guía `docs/setup-datos.md`.
- `SPEC-0013`: borrado (que llama antes a `sync.stop()`). `SPEC-0019`: historial, con la ruta `#/importar?lote=<id>`. `SPEC-0016`: Ajustes y router. `SPEC-0006`: `TopBar` e Inicio. `SPEC-0010` y `SPEC-0011`: asistente y ficheros sintéticos que usan los e2e.
- **Restricción técnica**: los *endpoints* OAuth de `github.com` no admiten CORS, así que no hay «Conectar con GitHub» de un clic sin servidor. `api.github.com` sí los admite.
- **Decisiones del propietario** (2026-10-24):
  - **un solo token**;
  - el proceso **lo más automático posible**, con la parte manual explicada **desde la propia app**, para que también le sirva a un amigo;
  - asistente guiado sin servidor;
  - segundo dispositivo por **QR de vinculación**.
- **Orden de implementación**: después de SPEC-0008.

## Cambio (delta)
### 1. Asistente «Conectar con GitHub» (Ajustes › Sincronización)
**Sugerencia en Inicio** (no bloquea): con la sincronización desactivada, Inicio muestra una tarjeta, «Usa Míre en más dispositivos», con dos acciones:
- **«Conectar con GitHub»**;
- **«Ocultar»**, que la oculta para siempre en este dispositivo (preferencia local en `localStorage`, con la clave `mire.syncCardHidden`, que el borrado de SPEC-0013 elimina con las demás `mire.*`).
- La tarjeta se monta en Inicio (SPEC-0006), justo debajo del patrimonio.

**Pasos**: tres, con indicador de progreso, «Atrás» y textos de ayuda.

1. **Repositorio privado**:
   - enlace «¿No tienes cuenta de GitHub? Créala gratis» a `https://github.com/signup`;
   - campo **«Nombre del repositorio»**, con `mire-datos` por defecto. Solo admite `[A-Za-z0-9._-]`, hasta 100 caracteres;
   - botón **«Crear el repositorio en GitHub»**, que abre en otra pestaña, con `<nombre>` codificado:

     `https://github.com/new?name=<nombre>&visibility=private&description=Datos%20cifrados%20de%20M%C3%ADre`

   - instrucciones: «Comprueba que está marcado *Private* y pulsa *Create repository*. No hace falta añadir nada más».
2. **Token de acceso**:
   - botón **«Crear el token en GitHub»**, que abre literalmente:

     `https://github.com/settings/personal-access-tokens/new?name=M%C3%ADre&description=Sincronizaci%C3%B3n%20de%20M%C3%ADre&expires_in=366&contents=write`

   - instrucciones numeradas, con el único paso que no se puede rellenar: «En *Repository access* elige *Only select repositories* y marca `<nombre>`. Pulsa *Generate token* y cópialo»;
   - aviso: «Nunca compartas el token ni lo pegues fuera de Míre».
3. **Pegar y comprobar**: campo **«Token»** (`type=password`) y **«Comprobar y conectar»**. El token se queda **en memoria** hasta el final. Míre comprueba, en orden:
   1. el prefijo `github_pat_`; si falta: «Este no es un token de grano fino»;
   2. `GET /user` → `usuario`; un 401 da «El token no es válido»;
   3. `GET /repos/{usuario}/{nombre}`:
      - si no existe: «No encuentro el repositorio»;
      - si no es privado: «El repositorio debe ser privado»;
   4. `GET /user/repos?per_page=2`: debe ver **solo** ese repositorio; si ve más: «El token tiene acceso a más repositorios. Créalo con *Only select repositories*»;
   5. **caducidad**: la cabecera `github-authentication-token-expiration` si se puede leer; si no, hoy + 366 días, editable en Ajustes;
   6. **`sync.inspectRemote`**:
      - **`empty`**: `sync.initRemote`. Un 403 (`forbidden`) en el primer commit da «El token no tiene permiso de escritura (*Contents: Read and write*)»;
      - **`mire`**: «Este repositorio ya tiene datos de Míre». Si el dispositivo tiene datos (`sync.localIsEmpty()` falso), añade «Para usar los del repositorio, borra antes los de este dispositivo (Ajustes › Datos)». Si no los tiene, «Usar los datos del repositorio» lleva al alta del punto 2, desde el paso de la contraseña: el anillo y el PIN locales se sustituyen por los del repositorio y un PIN nuevo;
      - **`other`**: «Ese repositorio tiene otros ficheros. Usa uno nuevo y vacío».
   7. **Solo si todo va bien**: `setGithubToken(token, expiresAt)`.
   - **Al terminar**: «Conectado con `<usuario>/<nombre>`», y arranca la primera sincronización.
- **Comprobación de privacidad** (informativa): «Si usas Claude Code u otras apps de GitHub, comprueba que no tienen acceso a este repositorio», con enlace a `https://github.com/settings/installations`.

### 2. Vinculación: dispositivo nuevo o token renovado
#### En un dispositivo conectado: «Vincular dispositivo» (Ajustes › Sincronización)
1. Pide la **contraseña maestra**.
2. Genera un **código de 8 caracteres** (Crockford base32, 40 bits aleatorios) y un **enlace** `<origen><base>#/vincular?d=<base64url(versión | sal | iv | cifrado)>`:
   - el contenido cifrado es `{ v: 1, owner, repo, token, exp }`;
   - se cifra con `AES-GCM_K`, donde `K = Argon2id(código ‖ contraseña maestra, sal)` con los parámetros de la contraseña (ADR-0005), y la AAD es `"mire-link-v1"`;
   - `exp` = ahora + 10 minutos.
3. Muestra:
   - el **QR** del enlace (librería `qrcode`, MIT, versión exacta, como imagen `data:`);
   - «Copiar enlace»;
   - el código en grande, `XXXX-XXXX`;
   - la cuenta atrás.

   El código **no va en el QR**. Al llegar a 0 o al cerrar, se olvidan el código y el enlace.

Como la clave también depende de la contraseña maestra, el enlace y el código **solos** no bastan para sacar el token.

#### Al abrir el enlace (`#/vincular?d=…`)
- La app guarda `d` en memoria y quita el fragmento con `history.replaceState`, **antes** de `SecurityGate`. En un dispositivo con anillo, el enlace se procesa después de desbloquear.
- Pantalla con **«Código del otro dispositivo»** y **«Contraseña maestra»**.
  - Si no descifra: «El código o la contraseña no son correctos».
  - Si `exp` ya pasó: «El enlace ha caducado. Genera otro».
  - Tras descifrar, se valida `owner/repo` (`^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$`) y el prefijo `github_pat_`; si no pasan, «Enlace no válido».
- **En un dispositivo nuevo** (sin anillo):
  1. `sync.inspectRemote` debe dar `mire`. Se descarga y valida el anillo (SPEC-0005).
  2. `unlockWithPassword` con el anillo remoto y la misma contraseña. El enlace «¿La has olvidado?» lleva a la recuperación de SPEC-0014, que termina subiendo el anillo nuevo.
  3. **PIN** de este dispositivo: el paso 4 de SPEC-0005.
  4. Guardado atómico del anillo, el PIN y el token (`setGithubToken`).
  5. `sync.joinRemote`, con «Descargando tus datos…». Si falla (sin red, por ejemplo), Míre queda conectada, y el siguiente ciclo descarga los datos.
  6. Inicio.
- **En un dispositivo ya conectado al mismo repositorio** (desbloqueado): «Actualizar el token de este dispositivo». Guarda el token nuevo y su caducidad. Así se **renueva el token** en todos los dispositivos sin copiarlo a mano.
- **En un dispositivo con otro repositorio, o con datos y sin conectar**: «Este dispositivo ya usa otros datos. El enlace no se ha usado».

#### Desde la bienvenida (SPEC-0005, dispositivo sin anillo)
Además de «Empezar», el botón **«Ya uso Míre en otro dispositivo»**, con dos caminos:
- **«Tengo el otro dispositivo a mano»**: instrucciones «En el otro dispositivo, abre Ajustes › Sincronización › Vincular dispositivo y escanea el QR con la cámara de este»;
- **«No lo tengo»**: los pasos 2 y 3 del asistente (un token nuevo para el mismo repositorio), en una variante **fuera de `SecurityGate`**. Con `inspectRemote = mire` sigue con los pasos 2 a 6 del dispositivo nuevo.

### 3. Estado visible
**Indicador en `TopBar`**: botón de icono, oculto con `state = 'off'`. Su `aria-label` es el texto del estado, y lleva a `#/ajustes?seccion=sincronizacion`, que desplaza la página hasta esa sección.

| Estado | Icono | Texto |
|---|---|---|
| `idle` sin pendientes | `cloud_done` | «Sincronizado» |
| `idle` con pendientes | `cloud_upload` | «1 cambio pendiente» o «N cambios pendientes» |
| `syncing` | `sync` | «Sincronizando…» (gira, salvo con `prefers-reduced-motion`) |
| `offline` | `cloud_off` | «Sin conexión: 1 cambio pendiente» o «… N cambios pendientes» |
| `error` | `error` | El texto del código (`src/sync/codes.ts`) |

**Sección «Sincronización»** en Ajustes, entre «Organización» y «Datos»:
- **sin conectar**: «Conectar con GitHub»;
- **conectada**:
  - repositorio y estado;
  - «Última sincronización: hace N min» y los pendientes;
  - **«Sincronizar ahora»**;
  - «El token caduca el dd/mm/aaaa», con **«Cambiar fecha»** si no se pudo leer de GitHub;
  - **«Renovar token»**;
  - **«Vincular dispositivo»**;
  - **«Desconectar»** (`sync.pause`), con la confirmación «Tus datos se quedan en este dispositivo. Los cambios se subirán cuando vuelvas a conectar». Volver a conectar al mismo repositorio usa `sync.resume`.

**Avisos** de `sync.notices()`, cada uno con «Entendido» (`markSeen`):

| Aviso | Texto |
|---|---|
| `duplicate_import` | «Importaste el mismo fichero en dos dispositivos», con «Revisar», que lleva a `#/importar?lote=<laterBatchId>` (SPEC-0019). Si esa importación creó cuentas, añade «Al deshacerla, borra después las cuentas vacías» |
| `unique_resolved`, `category_flattened`, `account_type_restored` y `transfer_unlinked` | «Se resolvió un cambio hecho a la vez en dos dispositivos», con el detalle de cada código |
| `keyring_updated` | «La contraseña maestra se cambió en otro dispositivo. Úsala también aquí» |
| `clock_skew` | «La hora de algún dispositivo está muy desajustada. Corrígela para sincronizar» |
| `update_required` | «Otro dispositivo usa una versión más nueva de Míre. Recarga para actualizar» |

**Avisos destacados**, bajo `TopBar`, en todas las rutas:
- **token** con `daysLeft ≤ 14`: «Tu token de GitHub caduca en N días», con «Renovar»;
- **`auth_error`**: «El token de GitHub no es válido o ha caducado», con «Renovar»;
- **`remote_missing`**: «No encuentro tu repositorio de datos. ¿Lo has borrado?», con:
  - «Reintentar»;
  - «Desconectar y seguir solo aquí» (`pause`);
  - «Borrar los datos de este dispositivo» (diálogo de SPEC-0013);
  - «Conectar con un repositorio nuevo», que abre el asistente; con un repositorio nuevo y vacío, `initRemote` sube los datos de este dispositivo.

**«Renovar token»**:
- abre `https://github.com/settings/personal-access-tokens`, con la instrucción «Abre el token «Míre», pulsa *Regenerate token* y cópialo»;
- campo para pegarlo, con las comprobaciones 1–5 del asistente;
- después, «Vincular dispositivo» lo lleva a los demás dispositivos (punto 2).

### 4. Borrado con la sincronización conectada
El diálogo de borrado de SPEC-0013 añade:
- «La copia de GitHub no se borra desde aquí. Para borrarla, elimina el repositorio»;
- un enlace a `https://github.com/<owner>/<repo>/settings`;
- la instrucción «*Danger zone → Delete this repository*».

Antes de borrar se llama a `sync.stop()`.

### 5. Textos y accesibilidad
- Todos los textos tienen clave en `es.json` y `en.json`, incluidos los de cada código de `src/sync/codes.ts`.
- Los enlaces externos abren en otra pestaña con `rel="noopener noreferrer"`.
- Las instrucciones son listas numeradas.

## Fuera de alcance
- OAuth de un clic (necesitaría un servidor intermedio, descartado).
- Crear el repositorio desde Míre (el token tendría que poder administrar toda la cuenta).
- Revocar tokens o expulsar dispositivos desde Míre (se hace en GitHub).
- Varios usuarios en un mismo dispositivo.

## Criterios de aceptación
**Condiciones de los e2e**:
- `page.route` sirve `api.github.com` con el GitHub simulado de SPEC-0008, incluido el *preflight*;
- dos contextos pueden compartir un repositorio simulado;
- ningún test abre `github.com`: solo se comprueban los `href`;
- los e2e no aceptan sugerencias de traspaso;
- con `page.clock`, el test hace un clic en una zona neutra en cada minuto simulado (SPEC-0005 solo cuenta `pointerdown` y `keydown`), para que no salte el autobloqueo.

**Ficheros e2e** (como máximo 4):
- `sync-conectar.spec.ts`: CA-01, CA-08 y CA-09;
- `sync-dispositivos.spec.ts`: CA-02 → CA-03 → CA-04 → CA-05 → CA-06;
- `sync-avisos.spec.ts`: CA-07;
- `sync-a11y.spec.ts`: CA-14.

1. **CA-01** · Asistente (e2e):
   - con Míre recién configurada, Inicio muestra la tarjeta «Usa Míre en más dispositivos», y «Ocultar» la quita también tras recargar;
   - los `href` de los dos botones son **exactamente** los del punto 1;
   - un token sin `github_pat_` da su mensaje;
   - uno que ve 2 repositorios da «El token tiene acceso a más repositorios…»;
   - con un repositorio público, «El repositorio debe ser privado»;
   - con un 403 en el primer commit, el mensaje de permiso de escritura, sin guardar el token (`tokenStatus().configured` es falso);
   - con un repositorio vacío (sin commits) y un token correcto, el indicador pasa a «Sincronizado», y el repositorio simulado contiene `format.json`, `keyring.json` y una instantánea.
2. **CA-02** · Dispositivo nuevo por QR (e2e):
   - en A (conectado, con `bbva-informe.xlsx` importado), «Vincular dispositivo» pide la contraseña y muestra el QR, el código, «Copiar enlace» y la cuenta atrás;
   - B, en un contexto nuevo, abre el enlace, y la URL ya no lleva `d=`;
   - con un código erróneo, B ve «El código o la contraseña no son correctos»;
   - con el correcto, la contraseña y un PIN, la región «Patrimonio» de Inicio de B (SPEC-0006) muestra `1.338,44 €`.
3. **CA-03** · Cambios entre dispositivos (e2e, a continuación):
   - A cambia la nota de «GASOLINERA EJEMPLO»; tras «Sincronizar ahora» en A y en B, B la ve;
   - B cambia su categoría y A su concepto, sin sincronizar; tras sincronizar los dos, ambos ven los dos cambios.
   - Cubre SPEC-0001 CA-13.
4. **CA-04** · Automática (e2e, con `page.clock`): un cambio en A deja el indicador en «1 cambio pendiente». Al avanzar 5 minutos se sube, y tras otros 5 minutos B lo tiene sin pulsar nada.
5. **CA-05** · Sin conexión (e2e): con A sin red (`context.setOffline`), importar `bbva-informe-parcial.xlsx` funciona y el indicador dice «Sin conexión: 1 cambio pendiente». Al recuperar la red se sincroniza, y B ve «SUPERMERCADO EJEMPLO». Cubre SPEC-0001 CA-11.
6. **CA-06** · Importación duplicada (e2e, a continuación):
   - A y B importan `myinvestor-movimientos.xlsx` sin sincronizar;
   - tras sincronizar, los dos muestran el aviso, y «Revisar» enfoca en el historial la importación posterior.
7. **CA-07** · Avisos y renovación (e2e):
   - con un token que caduca en 10 días, aparece «Tu token de GitHub caduca en 10 días»;
   - con el simulado devolviendo 401 aparece «El token de GitHub no es válido o ha caducado», y «Renovar» con un token correcto lo quita;
   - con dos dispositivos conectados al mismo repositorio, tras renovar en A, el enlace de «Vincular dispositivo» de A abierto en B muestra «Actualizar el token de este dispositivo», y tras aceptar, B sincroniza con el token nuevo;
   - con el repositorio borrado en el simulado aparece «No encuentro tu repositorio de datos…», y «Desconectar y seguir solo aquí» oculta el indicador sin borrar datos;
   - en otro contexto con el mismo aviso, «Conectar con un repositorio nuevo» con un repositorio simulado nuevo y vacío sube los datos locales, y el indicador pasa a «Sincronizado»;
   - un enlace de vinculación abierto en un dispositivo bloqueado muestra primero el PIN, y tras desbloquear, «Actualizar el token de este dispositivo»;
   - con la sincronización conectada, el diálogo de borrado muestra el enlace a los ajustes del repositorio.
8. **CA-08** · Repositorio con otros datos (e2e, en otro contexto tras CA-01):
   - un dispositivo con los datos de ejemplo (SPEC-0016) que conecta con el repositorio de CA-01 ve «Este dispositivo ya tiene datos…»;
   - un repositorio con otros ficheros da «Ese repositorio tiene otros ficheros…».
9. **CA-09** · «No lo tengo» (e2e, contexto nuevo): desde la bienvenida, el token y el repositorio de CA-01, la contraseña y un PIN, se llega a Inicio con los datos del repositorio.
10. **CA-10** · Enlace de vinculación (Vitest):
    - el enlace no contiene el token en claro;
    - con el código correcto y otra contraseña no se descifra;
    - un `exp` vencido da «El enlace ha caducado»;
    - un `repo` que no cumple el patrón da «Enlace no válido»;
    - el código se normaliza como el de recuperación de SPEC-0005;
    - la cuenta atrás olvida el enlace al llegar a 0.
11. **CA-11** · Avisos y fecha (Vitest de componente):
    - cada código de aviso de `src/sync/codes.ts` tiene texto, y «Entendido» llama a `markSeen`;
    - «Cambiar fecha» guarda la caducidad;
    - con `prefers-reduced-motion`, el icono `sync` no gira.
12. **CA-12** · Comprobación del propietario: con su cuenta real, el propietario sigue el asistente en su ordenador y vincula su móvil. Confirma que:
    - los enlaces abren GitHub ya rellenados;
    - la conexión y la vinculación funcionan;
    - la app de Claude no tiene acceso a `mire-datos` (SPEC-0001 CA-14).

    Es condición para marcar esta spec como `implemented`.
13. **CA-13** · `src/i18n/keys.test.ts` pasa, y en inglés el asistente se titula «Connect with GitHub».
14. **CA-14** · axe sin infracciones en la tarjeta de Inicio, el asistente (sus tres pasos), «Vincular dispositivo», la pantalla del enlace, la sección «Sincronización» y los avisos (claro y oscuro); sin scroll horizontal a 375 px.
15. **CA-15** · Los tests anteriores pasan sin modificarse: la tarjeta de Inicio no bloquea y el indicador está oculto hasta conectar. `.arda/checks.sh` sigue por debajo de 5 minutos, con el tiempo de esta spec anotado en el PR.

## Riesgos y preguntas abiertas
### Riesgos
- **Parámetros de los enlaces de GitHub**: la creación de tokens admite plantillas por URL, pero la selección del repositorio no se puede rellenar. No se han podido consultar desde este entorno los nombres vigentes de los parámetros; la comprobación real es CA-12.
- **Cabecera de caducidad**: puede que el navegador no pueda leerla por CORS. Por eso hay una fecha por defecto que se puede cambiar.
- **`GET /user/repos` con token de grano fino**: se espera que liste solo los repositorios seleccionados. Si no fuera así, la comprobación 4 pasa a ser un aviso informativo.
- **Enlace de vinculación**: quien tenga el enlace necesita además el código **y** la contraseña maestra. Cada intento cuesta un Argon2id de 64 MiB.
- **iOS**: un enlace abierto desde la cámara puede abrirse en Safari y no en la PWA instalada, que no comparten almacenamiento. Mitigación: «Copiar enlace» para pegarlo en la PWA. Lo valida CA-12.
- **Tamaño para una sesión del plan Pro**: se implementa en dos PR de la misma spec si no cabe:
  - puntos 1, 3 y 4;
  - punto 2.

### Preguntas abiertas
- Ninguna para el propietario.
