---
id: ADR-0005
title: Criptografía y desbloqueo (AES-GCM, Argon2id, PIN con clave de dispositivo, código de recuperación)
status: proposed       # proposed → accepted (solo una persona) → superseded
summary: Clave de datos aleatoria AES-GCM-256 envuelta con Argon2id(contraseña maestra) y con el código de recuperación; desbloqueo diario con PIN de 4 dígitos atado a una clave de dispositivo no extraíble; base local sin cifrar (riesgo aceptado)
---

# ADR-0005 · Criptografía y desbloqueo

## Contexto
ADR-0001 exige cifrar en el dispositivo lo que se sube a GitHub. El propietario ha decidido (2026-10-24):
- **contraseña maestra** más un **código de recuperación** en papel;
- **PIN de 4 dígitos** cada vez que se abre la app;
- la contraseña maestra se vuelve a pedir cada **30 días** o tras **5 PIN fallidos**;
- **autobloqueo** a los 5 minutos;
- **token de GitHub cifrado**;
- la **base local no se cifra**: se confía en el cifrado del propio dispositivo;
- la configuración de seguridad es **obligatoria** en el primer uso.

Todo debe funcionar en el navegador, sin servidor y con coste 0 €.

## Decisión
| Pieza | Elección |
|---|---|
| Clave de datos (DEK) | AES-GCM de 256 bits, aleatoria (`crypto.subtle.generateKey`), creada una vez. Cifra todo lo que sale del dispositivo (SPEC-0008) y los secretos locales (token). Solo existe en claro **en memoria** mientras Míre está desbloqueada. |
| Contraseña maestra | KEK = **Argon2id** (`hash-wasm`, MIT) con `m = 64 MiB`, `t = 3`, `p = 1`, sal aleatoria de 16 bytes y salida de 32 bytes. Envuelve la DEK con **AES-KW** (`wrapKey`). Los parámetros se guardan con el envoltorio para poder subirlos en el futuro. |
| Código de recuperación | 24 caracteres **Crockford base32** (120 bits), mostrados como 6 grupos de 4. KEK = **HKDF-SHA256** (alta entropía, sin KDF lenta) con sal propia e `info = "mire-recovery-v1"`. Envuelve la DEK con AES-KW. Al usarlo o regenerarlo, el anterior deja de valer. |
| Anillo de claves (*keyring*) | JSON `{ v: 1, kdf: { alg, m, t, p, salt }, wrappedByPassword, recovery: { salt, wrappedByCode }, createdAt }` en IndexedDB (`mire-keys`). SPEC-0008 lo subirá al repositorio de datos para desbloquear dispositivos nuevos. |
| Desbloqueo por PIN | Cada dispositivo crea una **clave de dispositivo** AES-GCM-256 **no extraíble**, guardada en IndexedDB como `CryptoKey`. KEK_pin = Argon2id(PIN) con `m = 19 MiB`, `t = 2`, `p = 1` y sal del dispositivo. Se guarda `AES-GCM_dispositivo( AES-KW_pin(DEK) )` con `failedAttempts` y `lastMasterAt`. |
| Límites del PIN | Al 5.º fallo seguido, o si `lastMasterAt` tiene más de 30 días, se **borra** el envoltorio por PIN de ese dispositivo y se exige la contraseña maestra. |
| Bloqueo | Bloquear borra de memoria la DEK y el token descifrado. Ocurre tras 5 minutos sin interacción, o tras 5 minutos seguidos con la pestaña oculta. |
| Formato cifrado | Sobre binario `[0x01 versión][IV de 12 bytes aleatorio][texto cifrado + etiqueta GCM]`, con **AAD** obligatoria que liga el sobre a su contexto (p. ej. la ruta del fichero). Funciones `encrypt(bytes, aad)` y `decrypt(sobre, aad)`. |
| Token de GitHub | Cifrado con la DEK (AAD `"github-token"`) en IndexedDB, junto a su fecha de caducidad. Solo se descifra con Míre desbloqueada. |
| CSP | `<meta http-equiv="Content-Security-Policy">`, porque GitHub Pages no permite cabeceras, inyectada en la build con el hash del script de tema (SPEC-0003). `frame-ancestors` no funciona en `<meta>`, así que hay protección por script contra el *framing*. |

## Alternativas consideradas
| Alternativa | Por qué no |
|---|---|
| PBKDF2 nativo de WebCrypto | Sin dependencias, pero mucho más débil que Argon2id frente a GPU con la misma latencia. |
| scrypt o libsodium completo | Válidos; `hash-wasm` da Argon2id con menos peso. |
| Derivar la DEK directamente de la contraseña | Cambiar la contraseña obligaría a recifrar todos los datos; con DEK envuelta solo se reenvuelve. |
| PIN sin clave de dispositivo | 10.000 combinaciones que se podrían probar fuera del navegador en segundos si se copia el almacenamiento. |
| Passkeys (WebAuthn con PRF) | Muy prometedor, pero el soporte en Android y entre navegadores aún no es uniforme. Candidato para el futuro. |
| Cifrar la base local (SQLite3 Multiple Ciphers) | El propietario prefiere confiar en el dispositivo y mantener el SQLite oficial (ADR-0002). |
| Solo contraseña, sin código de recuperación | El propietario quiere poder recuperar los datos si olvida la contraseña. |

## Consecuencias
- **+** Cambiar la contraseña o el PIN no recifra datos. Perder un dispositivo no expone la DEK sin su PIN y su clave de dispositivo.
- **+** Lo que sale del dispositivo está cifrado y autenticado: cualquier manipulación se detecta.
- **−** **Riesgo aceptado**: la base SQLite local está en claro dentro del almacenamiento del navegador. Quien tenga el dispositivo desbloqueado y acceso técnico al perfil del navegador puede leerla. El PIN solo bloquea la interfaz.
- **−** **Riesgo aceptado**: con un PIN de 4 dígitos, quien controle el perfil del navegador puede probar las 10.000 combinaciones ejecutando código en el propio origen (la clave de dispositivo no sale, pero se puede usar allí). El límite de 5 intentos solo lo impone la app. Los 30 días de contraseña maestra acotan la exposición.
- **−** Argon2id con 64 MiB tarda alrededor de 1 s en un móvil medio; solo al poner la contraseña maestra.
- **−** Sin contraseña ni código de recuperación, los datos son irrecuperables por diseño.
