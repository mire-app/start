---
id: SPEC-0014
title: Seguridad: recuperación, ajustes, CSP y repositorio de datos
status: draft          # draft → approved (solo una persona) → implemented
summary: Recuperación con el código, diálogo «Seguridad…» (cambiar PIN y contraseña, regenerar código, estado del token), CSP en todas las páginas, antienmarcado y guía para crear mire-datos en la cuenta personal sin acceso de Claude
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0002, SPEC-0003, SPEC-0005, ADR-0005]
---

# SPEC-0014 · Seguridad: recuperación, ajustes, CSP y repositorio de datos

## Intención
Completar la seguridad de SPEC-0005 con:
- **recuperar el acceso** con el código si se olvida la contraseña;
- **gestionar** PIN, contraseña y código;
- una **política de seguridad de contenidos** en todas las páginas;
- la **guía** para crear el repositorio de datos sin que Claude tenga acceso.

## Contexto
- `SPEC-0005`: núcleo (`keyring`, `device`, `session`), pantallas y menú de `TopBar`. **Se implementa antes.**
- `ADR-0005`: CSP por `<meta>`, antienmarcado y recuperación por HKDF.
- `SPEC-0003`: script de tema en línea, pendiente de CSP por hash.
- `SPEC-0011` y `SPEC-0012`: ExcelJS y pdf.js, que deben funcionar bajo la CSP (se verifica en SPEC-0010).
- `SPEC-0001` CA-14: Claude Code sin acceso al repositorio de datos.
- **Decisión del propietario**: repositorio `mire-datos` privado en su **cuenta personal**; token de grano fino de 1 año.

## Cambio (delta)
### 1. Recuperación
- **Acceso**: desde la pantalla de contraseña maestra (SPEC-0005), con el enlace **«¿La has olvidado? Usar código de recuperación» / «Forgot it? Use recovery code»**.
- **Pasos**:
  1. campo **«Código de recuperación» / «Recovery code»**;
  2. nueva contraseña (dos campos, como en la configuración);
  3. **nuevo código** (`data-testid="recovery-code"`), con la misma confirmación de los grupos 2 y 5;
  4. nuevo PIN.
- **Guardado**: el anillo nuevo se guarda de forma **atómica al terminar el paso 4**. Hasta entonces el código anterior sigue valiendo.

### 2. Diálogo «Seguridad…» (menú de `TopBar` → **«Seguridad…» / «Security…»**)
- **Cambiar PIN**: pide el PIN actual y el nuevo dos veces. El PIN actual se verifica con `unlockWithPin`, de modo que **cuenta como intento** y aplica el límite de 5 fallos.
- **Cambiar contraseña maestra**: pide la actual y la nueva dos veces; reenvuelve la DEK.
- **Regenerar código de recuperación**: pide la contraseña, muestra el código nuevo y exige confirmación; el anterior deja de valer al confirmar.
- **Token de GitHub**: estado con `tokenStatus()` (configurado sí o no, y fecha de caducidad). La configuración del token es de SPEC-0008.

### 3. CSP y endurecimiento (solo en la build de producción)
- Un **plugin de Vite** usa `transformIndexHtml` con `order: 'post'` en **todas** las entradas HTML (así el *precache* de vite-plugin-pwa ve el HTML final) e inserta, como **primer hijo de `<head>`**:

  ```
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-<hash de cada script en línea de esa página>'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.github.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'">
  <meta name="referrer" content="no-referrer">
  ```

  El hash se calcula por página a partir de sus scripts en línea; hoy, el script de tema de SPEC-0003.
- **Service worker**: vite-plugin-pwa con `injectRegister: 'script'`, que registra desde un fichero externo, nunca en línea.
- **pdf.js** (SPEC-0012) se usa con `isEvalSupported: false`.
- **Límite conocido**: la meta CSP no gobierna los Web Workers ni el service worker, porque GitHub Pages no envía cabeceras. Los workers solo cargan código propio.
- **Antienmarcado**: si `window.top !== window.self`, la app no se renderiza y muestra «Míre no puede abrirse dentro de otra página».

### 4. Repositorio de datos (`docs/setup-datos.md`, acción del propietario)
- Pasos, en español:
  1. crear el repositorio **privado** `mire-datos` en la **cuenta personal**;
  2. crear un **token de grano fino**:
     - propietario del recurso: la cuenta personal;
     - acceso **solo** a `mire-datos`;
     - permisos *Contents: Read and write* (*Metadata: Read*, obligatorio);
     - caducidad de 1 año;
  3. comprobar en *Settings → Applications* que la GitHub App de Claude **no** está instalada en la cuenta personal o no incluye `mire-datos`;
  4. **nunca** pegar el token en el chat de Claude, en issues ni en ficheros; solo en la pantalla de Míre (SPEC-0008).
- **Borrado remoto efectivo**: eliminar el repositorio `mire-datos` en GitHub (*Settings → Danger zone*). Borrar ficheros no elimina el historial de git, y el token de Míre no tiene permiso para eliminar repositorios.

## Fuera de alcance
- Conexión con GitHub, subida del anillo y segundo dispositivo: SPEC-0008.
- Passkeys y biometría.
- Cabeceras HTTP reales (`frame-ancestors`, HSTS): GitHub Pages no lo permite.

## Criterios de aceptación
1. **CA-01** · e2e de recuperación:
   - tras la configuración, al forzar la contraseña («Bloquear ahora» y 5 PIN fallidos), «Usar código de recuperación» con el código de la configuración permite fijar una contraseña nueva y da un código **distinto**;
   - tras recargar, la contraseña nueva funciona y la antigua no;
   - el código antiguo da `wrong_recovery_code`;
   - si se abandona la recuperación en el paso 3 y se recarga, el código antiguo **sigue valiendo**.
2. **CA-02** · e2e de ajustes:
   - cambiar el PIN (el anterior deja de valer);
   - cambiar la contraseña (la anterior deja de valer);
   - regenerar el código (el anterior da `wrong_recovery_code` en la recuperación);
   - el estado del token muestra «No configurado».
3. **CA-03** · CSP (e2e sobre la build):
   - todos los `.html` de `dist/` tienen la meta CSP como primer hijo de `<head>`, con el hash correcto de sus scripts en línea;
   - la revisión de cada HTML en el manifiesto de *precache* coincide con el hash del fichero final de `dist/`;
   - al recorrer configuración, desbloqueo, pantalla de inicio, guía de estilo y recuperación **no** hay eventos `securitypolicyviolation`, SQLite WASM funciona y el service worker se registra.
4. **CA-04** · Cargada dentro de un `iframe` (página creada con `page.setContent` con un `<iframe src>` a la URL de la app), la app muestra el aviso de antienmarcado y no renderiza la pantalla de inicio.
5. **CA-05** · axe sin infracciones en la recuperación y en el diálogo «Seguridad…», en claro y en oscuro; sin scroll horizontal a 375 px.
6. **CA-06** · `docs/setup-datos.md` contiene los pasos del punto 4.
   - **El propietario** crea `mire-datos` y el token.
   - **Claude** verifica que no tiene acceso:
     - `mire-datos` no aparece en su listado de repositorios;
     - una lectura directa de `<cuenta>/mire-datos` con su herramienta de GitHub da **403 o 404**.
   - Cubre SPEC-0001 CA-14.
7. **CA-07** · Los e2e de SPEC-0002 a SPEC-0005 pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Librerías bajo la CSP**: ExcelJS y pdf.js corren en el worker de la base de datos, al que la meta CSP no se aplica. Un spike del 2026-10-24 confirmó que funcionan en un Web Worker de módulo incluso con CSP estricta en cabecera (sin `unsafe-eval`). SPEC-0010 lo verifica de extremo a extremo.
- **Workers y service worker sin CSP propia**: aceptado; solo ejecutan código del propio origen.
- **Instalación de la GitHub App de Claude** con acceso a «todos los repositorios» de la cuenta personal: CA-06 lo detecta.

### Preguntas abiertas
- Ninguna para el propietario.
