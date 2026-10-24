---
id: SPEC-0020
title: Conexión con GitHub, vinculación de dispositivos y estado de la sincronización
status: draft          # draft → approved (solo una persona) → implemented
summary: Asistente guiado sin servidor para crear el repositorio privado y el token con enlaces prerrellenados y comprobarlos, vinculación de un segundo dispositivo por QR con código, indicador de estado, Ajustes › Sincronización, avisos (caducidad del token, repositorio borrado, conflictos, importación duplicada)
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0005, SPEC-0006, SPEC-0008, SPEC-0013, SPEC-0014, SPEC-0016, SPEC-0019, ADR-0005, ADR-0006]
---

# SPEC-0020 · Conexión con GitHub, vinculación de dispositivos y estado de la sincronización

## Intención
Que cualquier persona (el propietario o un amigo con quien comparta Míre) pueda activar la sincronización **sin ayuda técnica**:
- un asistente dentro de Míre hace todo lo automatizable;
- lo que tiene que hacer en GitHub lo explica paso a paso, con enlaces que lo dejan ya rellenado;
- añadir el móvil es escanear un QR.

## Contexto
- `SPEC-0001` (draft): CA-11 y CA-13 (de extremo a extremo) y CA-16.
- `SPEC-0008`: motor.
  - `sync.inspectRemote`, `initRemote`, `joinRemote`, `status`, `now`, `notices`, `markSeen` y `disconnect`;
  - errores `auth_error`, `remote_missing`, `offline`, `remote_not_empty`, `local_not_empty` y `keyring_invalid`;
  - GitHub simulado `tools/fake-github.ts`.
- `SPEC-0005`:
  - configuración en 4 pasos y `SecurityGate`;
  - `setGithubToken` (prefijo `github_pat_`), `tokenStatus` y `unlockWithPassword`;
  - Argon2id (hash-wasm).
- `SPEC-0014`:
  - diálogo «Seguridad…» con el estado del token;
  - recuperación con el código;
  - CSP con `connect-src https://api.github.com`;
  - guía `docs/setup-datos.md`, que esta spec traslada a la app.
- `SPEC-0013`: borrado de los datos del dispositivo. `SPEC-0019`: historial. `SPEC-0016`: Ajustes y router. `SPEC-0006`: `TopBar`.
- **Restricción técnica**: los *endpoints* OAuth de `github.com` no admiten CORS, así que no hay «Conectar con GitHub» de un clic sin servidor. `api.github.com` sí los admite.
- **Decisiones del propietario** (2026-10-24):
  - **un solo token**;
  - el proceso **lo más automático posible**, con la parte manual explicada **desde la propia app**;
  - debe servir para que un amigo cree su propia cuenta, repositorio y token;
  - asistente guiado sin servidor;
  - segundo dispositivo por **QR de vinculación**.

## Cambio (delta)
### 1. Asistente «Conectar con GitHub» (Ajustes › Sincronización)
- **Ofrecimiento tras configurar**: al terminar la configuración de SPEC-0005 aparece una pantalla opcional, «¿Quieres usar Míre en más dispositivos?», con **«Conectar con GitHub»** y **«Ahora no»**.
- **Pasos**: tres, con indicador de progreso, «Atrás» y textos de ayuda.
  1. **Repositorio privado**:
     - enlace «¿No tienes cuenta de GitHub? Créala gratis» a `https://github.com/signup`;
     - botón **«Crear el repositorio en GitHub»**, que abre en otra pestaña `https://github.com/new?name=mire-datos&visibility=private&description=Datos%20cifrados%20de%20M%C3%ADre`;
     - instrucciones: «Comprueba que está marcado *Private* y pulsa *Create repository*. No hace falta añadir nada más»;
     - campo **«Nombre del repositorio»**, con `mire-datos` por defecto.
  2. **Token de acceso**:
     - botón **«Crear el token en GitHub»**, que abre `https://github.com/settings/personal-access-tokens/new` con `name=Míre`, `description=Sincronización de Míre`, `expires_in=366` y `contents=write`;
     - instrucciones numeradas, con el único paso que no se puede rellenar: «En *Repository access* elige *Only select repositories* y marca `<nombre>`. Pulsa *Generate token* y cópialo».
     - Aviso: «Nunca compartas el token con nadie ni lo pegues fuera de Míre».
  3. **Pegar y comprobar**: campo **«Token»** (`type=password`) y botón **«Comprobar y conectar»**. Míre hace, en orden:
     1. prefijo `github_pat_`; si no lo tiene: «Este no es un token de grano fino»;
     2. `GET /user` para obtener el usuario; un 401 da «El token no es válido»;
     3. `GET /repos/{usuario}/{nombre}`:
        - si no existe: «No encuentro el repositorio»;
        - `private: true`, o «El repositorio debe ser privado»;
        - `permissions.push: true`, o «El token no tiene permiso de escritura (*Contents: Read and write*)»;
     4. `GET /user/repos?per_page=2`: debe ver **solo** ese repositorio; si no: «El token tiene acceso a más repositorios. Créalo con *Only select repositories*»;
     5. **caducidad**: la cabecera `github-authentication-token-expiration` si el navegador puede leerla; si no, hoy + 366 días, editable en Ajustes;
     6. `setGithubToken(token, expiresAt)`;
     7. `sync.inspectRemote`:
        - **`empty`** (o solo con `README.md`, `LICENSE` o `.gitignore`): `sync.initRemote`, que hace el primer commit con la API Contents si el repositorio no tiene ninguno, porque la API Git no escribe en repositorios vacíos;
        - **`mire`**: «Este repositorio ya tiene datos de Míre», con dos casos:
          - dispositivo sin datos: «Usar los datos del repositorio» lleva al alta del punto 2, desde el paso de la contraseña;
          - dispositivo con datos: «Este dispositivo ya tiene datos. Para usar los del repositorio, borra antes los de este dispositivo (Ajustes › Datos)»;
        - **`other`**: «Ese repositorio tiene otros ficheros. Usa uno nuevo y vacío».
  - **Al terminar**: «Conectado con `<usuario>/<nombre>`», y la primera sincronización arranca.
- **Comprobación de privacidad** (información, no bloquea): «Si usas Claude Code u otras apps de GitHub, comprueba en *Settings → Applications* que no tienen acceso a este repositorio», con enlace a `https://github.com/settings/installations`.

### 2. Alta de otro dispositivo
#### En el dispositivo que ya está conectado: «Vincular dispositivo» (Ajustes › Sincronización)
1. Pide la **contraseña maestra**, como la exportación de SPEC-0013.
2. Genera un **código de 8 caracteres** (Crockford base32, 40 bits aleatorios) y un **enlace**:
   - `<origen><base>#/vincular?d=<base64url(sal | iv | cifrado)>`;
   - lo cifrado es `AES-GCM_K({ v: 1, owner, repo, token, exp })`, con `K = Argon2id(código, sal)` y los parámetros de la contraseña maestra (ADR-0005);
   - `exp` = ahora + 10 minutos.
3. Muestra:
   - el **QR** del enlace (librería `qrcode`, MIT, versión exacta, como imagen `data:`);
   - el botón «Copiar enlace»;
   - el código en grande, `XXXX-XXXX`;
   - la cuenta atrás de 10 minutos.

   El código **no va en el QR**.
4. Al caducar o al cerrar el diálogo, se olvidan el código y el enlace.

#### En el dispositivo nuevo
- **Bienvenida** (SPEC-0005, dispositivo sin anillo): además de «Empezar», el botón **«Ya uso Míre en otro dispositivo»**, con dos caminos:
  - **«Tengo el otro dispositivo a mano»**: instrucciones «En el otro dispositivo, abre Ajustes › Sincronización › Vincular dispositivo y escanea el QR con la cámara de este»;
  - **«No lo tengo»**: los pasos 2 y 3 del asistente (token nuevo para el mismo repositorio) y después el paso 3 de esta lista.
- **Pasos**:
  1. **Al abrir el enlace** (`#/vincular?d=…`, antes de `SecurityGate`): la app guarda `d` en memoria y quita el fragmento con `history.replaceState`.
  2. Campo **«Código del otro dispositivo»**. Si el código no descifra: «Código incorrecto». Si `exp` ya pasó: «El enlace ha caducado. Genera otro».
  3. `sync.inspectRemote` debe dar `mire`. Se descarga el anillo y se valida (SPEC-0005).
  4. Campo **«Contraseña maestra»** (`unlockWithPassword` con el anillo remoto). El enlace «¿La has olvidado?» lleva a la recuperación con el código de SPEC-0014, que termina subiendo el anillo nuevo.
  5. **PIN** de este dispositivo: el paso 4 de la configuración de SPEC-0005.
  6. **Guardado atómico**: se guardan el anillo y el PIN, como en SPEC-0005, y el token.
  7. `sync.joinRemote`, con «Descargando tus datos…».
  8. Inicio.

### 3. Estado visible
- **Indicador en `TopBar`**: un botón de icono, oculto si la sincronización está desactivada (`state = 'off'`), con el `aria-label` del estado. Lleva a Ajustes › Sincronización.

  | Estado | Icono | Texto |
  |---|---|---|
  | `idle` | `cloud_done` | «Sincronizado» |
  | `syncing` | `sync` | «Sincronizando…». Gira, salvo con `prefers-reduced-motion` |
  | `offline` | `cloud_off` | «Sin conexión: N cambios pendientes» |
  | `error`, `auth_error` o `remote_missing` | `error` | El mensaje del error |

- **Sección «Sincronización»** en Ajustes, entre «Organización» y «Datos»:
  - **sin conectar**: «Conectar con GitHub»;
  - **conectada**:
    - repositorio, estado, «Última sincronización: hace N min» y «N cambios pendientes»;
    - **«Sincronizar ahora»** (`sync.now`);
    - «El token caduca el dd/mm/aaaa» (editable si la fecha no se pudo leer);
    - **«Renovar token»**;
    - **«Vincular dispositivo»**;
    - **«Desconectar»**, con confirmación: «Tus datos se quedan en este dispositivo».
  - **Avisos** de `sync.notices()`, con «Entendido» (`markSeen`):

    | Aviso | Texto |
    |---|---|
    | `duplicate_import` | «Importaste el mismo fichero en dos dispositivos», con «Revisar» (lleva al historial de SPEC-0019 y enfoca el lote `laterBatchId`). Si su importación creó cuentas, la nota «Al deshacerla, borra después las cuentas vacías» |
    | `unique_resolved`, `row_conflict` y `transfer_unlinked` | «Se resolvió un cambio hecho a la vez en dos dispositivos (N)», con el detalle traducido |
    | `keyring_updated` | «La contraseña maestra se cambió en otro dispositivo. Úsala también aquí» |

- **Avisos destacados**, bajo `TopBar`, en todas las rutas:
  - **token** con `daysLeft ≤ 14`: «Tu token de GitHub caduca en N días», con «Renovar»;
  - **`auth_error`**: «El token de GitHub no es válido o ha caducado», con «Renovar»;
  - **`remote_missing`**: «No encuentro tu repositorio de datos. ¿Lo has borrado?», con:
    - «Reintentar»;
    - «Desconectar y seguir solo aquí»;
    - «Borrar los datos de este dispositivo» (diálogo de SPEC-0013).
- **«Renovar token»**:
  - abre `https://github.com/settings/personal-access-tokens`, con la instrucción «Abre el token «Míre», pulsa *Regenerate token* y cópialo»;
  - campo para pegarlo, con las comprobaciones 1–6 del asistente.
  - El token nuevo se copia a los demás dispositivos con «Vincular dispositivo», o se pega en cada uno.

### 4. Borrado y guía dentro de la app
- **Borrado de datos** (SPEC-0013) con la sincronización conectada: el diálogo añade «La copia de GitHub no se borra desde aquí. Para borrarla, elimina el repositorio», con enlace a `https://github.com/<owner>/<repo>/settings` y la instrucción «*Danger zone → Delete this repository*».
- **Guía**: la de `docs/setup-datos.md` (SPEC-0014) se mantiene para el propietario. Sus pasos ya están dentro del asistente.

### 5. Textos y accesibilidad
- Todos los textos tienen clave en `es.json` y `en.json`.
- Los enlaces externos abren en otra pestaña con `rel="noopener noreferrer"`.
- Los pasos con instrucciones usan listas numeradas.

## Fuera de alcance
- OAuth de un clic (necesitaría un servidor intermedio, descartado).
- Crear el repositorio desde Míre (el token tendría que poder administrar toda la cuenta).
- Revocar tokens desde Míre, y una lista de dispositivos con «expulsar» (se revoca o regenera el token en GitHub).
- Varios usuarios en un mismo dispositivo.

## Criterios de aceptación
**Condiciones de los e2e**:
- `page.route` sirve `api.github.com` con el GitHub simulado de SPEC-0008;
- dos contextos pueden compartir el mismo repositorio simulado;
- ningún test abre `github.com`: solo se comprueban los `href`;
- como máximo hay 4 ficheros e2e:
  - `sync-conectar.spec.ts`: CA-01 y CA-08;
  - `sync-dispositivos.spec.ts`: CA-02 → CA-03 → CA-04 → CA-05 → CA-06;
  - `sync-avisos.spec.ts`: CA-07;
  - `sync-a11y.spec.ts`: CA-12.

1. **CA-01** · Asistente (e2e):
   - los `href` de los botones son exactamente los del punto 1, y el del token lleva `name`, `description`, `expires_in=366` y `contents=write`;
   - un token sin `github_pat_` da su mensaje;
   - un token que ve 2 repositorios da «El token tiene acceso a más repositorios…»;
   - un repositorio público da «El repositorio debe ser privado»;
   - con un token y un repositorio correctos, el indicador pasa a «Sincronizado», y el repositorio simulado contiene `format.json`, `keyring.json` y una instantánea.
2. **CA-02** · Segundo dispositivo por QR (e2e):
   - en A (conectado, con `bbva-informe.xlsx` importado), «Vincular dispositivo» pide la contraseña y muestra el QR, el código y «Copiar enlace»;
   - B, en un contexto nuevo, abre el enlace: la URL ya no lleva `d=`;
   - con un código erróneo, B ve «Código incorrecto»; con el correcto, la contraseña maestra y un PIN, Inicio muestra un patrimonio de `1.338,44 €`.
3. **CA-03** · Cambios entre dispositivos (e2e, a continuación):
   - A cambia la nota de «GASOLINERA EJEMPLO»; tras «Sincronizar ahora» en A y en B, B la ve;
   - B cambia su categoría y A cambia su concepto, sin sincronizar; tras sincronizar los dos, ambos ven los dos cambios.
   - Cubre SPEC-0001 CA-13.
4. **CA-04** · Automática (e2e, con `page.clock`): un cambio en A sin pulsar nada aparece como «1 cambio pendiente» y se sube al avanzar el reloj 5 minutos; tras otros 5 minutos, B lo tiene.
5. **CA-05** · Sin conexión (e2e): con A sin red (`context.setOffline`), importar `bbva-informe-parcial.xlsx` funciona y el indicador dice «Sin conexión: … cambios pendientes»; al recuperar la red se sincroniza, y B ve «SUPERMERCADO EJEMPLO». Cubre SPEC-0001 CA-11.
6. **CA-06** · Importación duplicada (e2e): A y B importan `myinvestor-movimientos.xlsx` sin sincronizar; tras sincronizar, las dos muestran el aviso, y «Revisar» enfoca en el historial la importación posterior.
7. **CA-07** · Avisos destacados (e2e):
   - con un token que caduca en 10 días, aparece «Tu token de GitHub caduca en 10 días»;
   - con el simulado devolviendo 401, aparece «El token de GitHub no es válido o ha caducado»; «Renovar» con un token correcto lo quita;
   - con el repositorio borrado en el simulado, aparece «No encuentro tu repositorio de datos…», y «Desconectar y seguir solo aquí» oculta el indicador sin borrar datos.
8. **CA-08** · Repositorio con otros datos (e2e, a continuación de CA-01, en otro contexto): un dispositivo con datos de ejemplo (SPEC-0016) que conecta con el repositorio de CA-01 ve «Este dispositivo ya tiene datos…»; un repositorio con otros ficheros da «Ese repositorio tiene otros ficheros…».
9. **CA-09** · Enlace de vinculación (Vitest): el enlace no contiene el token en claro; un `exp` vencido da «El enlace ha caducado»; el código se normaliza (minúsculas, guion, `O`→`0`) como el de recuperación de SPEC-0005.
10. **CA-10** · Comprobación propia del propietario: con su cuenta real, el propietario sigue el asistente en su ordenador y en su móvil. Confirma que los enlaces abren GitHub ya rellenados, que la conexión y la vinculación funcionan, y que la app de Claude no tiene acceso a `mire-datos` (SPEC-0001 CA-14). Es condición para marcar esta spec como `implemented`.
11. **CA-11** · `src/i18n/keys.test.ts` pasa, y en inglés el asistente se titula «Connect with GitHub».
12. **CA-12** · axe sin infracciones en el asistente (sus tres pasos), «Vincular dispositivo», el alta del dispositivo nuevo, la sección «Sincronización» y los avisos (claro y oscuro); sin scroll horizontal a 375 px.
13. **CA-13** · Los tests anteriores pasan sin modificarse (el indicador está oculto mientras no se conecta), y `.arda/checks.sh` sigue por debajo de 5 minutos, con el tiempo de esta spec anotado en el PR.

## Riesgos y preguntas abiertas
### Riesgos
- **Parámetros de los enlaces de GitHub**: la creación de tokens admite plantillas por URL, pero la selección del repositorio no se puede rellenar. Hay que verificar los nombres de los parámetros con la documentación vigente (no se pudo consultar desde este entorno). La comprobación real es CA-10.
- **Cabecera de caducidad**: puede que el navegador no pueda leerla por CORS. Por eso hay una fecha por defecto editable.
- **`GET /user/repos` con token de grano fino**: se espera que liste solo los repositorios seleccionados. Si no fuera así, la comprobación 4 se sustituye por un aviso informativo.
- **Seguridad del enlace de vinculación**: quien vea a la vez el QR y el código en los 10 minutos de validez obtiene el token, pero no los datos: le falta la contraseña maestra. El código usa Argon2id, así que adivinarlo por fuerza bruta no es práctico.
- **Tamaño para una sesión del plan Pro**: si no cabe, se implementa en dos PR de la misma spec. El primero tiene los puntos 1 y 3; el segundo, 2 y 4.

### Preguntas abiertas
- Ninguna para el propietario.
