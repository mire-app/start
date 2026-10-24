---
id: SPEC-0013
title: Privacidad: exportación, borrado y aviso
status: draft          # draft → approved (solo una persona) → implemented
summary: Exportación completa en .zip (JSON + CSV seguros para Excel), borrado de todos los datos del dispositivo con destrucción de la clave local, aviso de privacidad es/en y telemetría cero verificada
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0002, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0014, ADR-0005]
---

# SPEC-0013 · Privacidad: exportación, borrado y aviso

## Intención
Dar al propietario control sobre sus datos, como pide el RGPD:
- **llevárselos**: exportación completa y legible;
- **borrarlos** de este dispositivo, destruyendo aquí la clave;
- **saber qué se hace con ellos**: aviso de privacidad;
- con **ningún dato ni metadato** enviado a terceros.

## Contexto
- `SPEC-0001` CA-22: exportar y borrar.
- `SPEC-0004`: esquema y repositorios.
- `SPEC-0005`: puerta de seguridad, contraseña maestra, menú de `TopBar` y `mire-keys`.
- `SPEC-0014`: recuperación (`unlockWithRecoveryCode`), CSP aplicada a todas las páginas y guía de borrado remoto.
- `SPEC-0002` y `SPEC-0003`: PWA, entradas de Vite, sistema de diseño, `checks.sh` y contrato de e2e.
- **Orden de implementación**: SPEC-0004, SPEC-0005 y SPEC-0014 antes que esta.
- **Decisiones del propietario** (2026-10-24):
  - «Borrar todos mis datos» = local + remoto + destruir la clave;
  - exportación en JSON + CSV;
  - ninguna telemetría;
  - aviso de privacidad breve.
- **Alcance real del borrado**:
  - esta spec borra **todo lo del dispositivo** y destruye **aquí** la clave;
  - la copia remota no se vuelve ilegible con eso: el anillo subido sigue envuelto con la contraseña y el código, y borrar ficheros no borra el historial de git;
  - el borrado remoto efectivo es **eliminar el repositorio `mire-datos`** (guía en SPEC-0014);
  - SPEC-0008 añadirá avisar a los demás dispositivos.

## Cambio (delta)
### 1. Exportación (`src/privacy/export.ts`, menú → **«Exportar mis datos…» / «Export my data…»**)
- **Acceso**: pide la **contraseña maestra o el código de recuperación**, aunque la app esté desbloqueada.
- **Fichero**: genera en el navegador, con `fflate` (MIT, versión exacta), `mire-export-AAAAMMDD.zip`, y lo descarga.
- **`mire.json`**: `{ format: 'mire-export', version: 1, schemaVersion, exportedAt, tables: { <tabla>: [filas vivas] } }`.
  - Las tablas se **enumeran dinámicamente** desde `sqlite_master` (`type='table'`), excluyendo `schema_migrations` y las `sqlite_%`.
  - Solo se incluyen filas con `deleted_at IS NULL`.
  - Importes en céntimos y fechas ISO.
- **CSV legibles en Excel**: `cuentas.csv`, `movimientos.csv`, `valoraciones.csv` y `categorias.csv`.
  - UTF-8 con BOM y separador `;`.
  - **Entrecomillado RFC 4180**: comillas dobles en los campos con `;`, `"`, CR o LF, y `"` duplicada.
  - **Protección contra inyección de fórmulas**: toda celda de **texto** que empiece por `=`, `+`, `-`, `@`, tabulador o CR se prefija con `'`. Las celdas **numéricas** (importes con coma decimal, p. ej. `-51,56`) no se tocan.
  - Fechas `dd/mm/aaaa` y cabeceras en el idioma de la interfaz.
  - Los movimientos llevan el nombre de su cuenta y de su categoría.
- **No incluye**: el anillo de claves, el token ni los secretos.

### 2. Borrado del dispositivo (`src/privacy/erase.ts`, menú → **«Borrar todos mis datos…» / «Delete all my data…»**)
- **Diálogo**:
  - explica qué se borra y que no se puede deshacer;
  - ofrece exportar antes;
  - avisa de que **el token de GitHub sigue vigente** (hay que revocarlo en GitHub) y de que **la copia remota solo se elimina borrando el repositorio `mire-datos`**, con enlace a la guía de SPEC-0014;
  - pide la **contraseña maestra o el código de recuperación** y escribir **`BORRAR`** (en inglés, **`DELETE`**).
- **Comprobación previa**: si hay otra pestaña de Míre abierta, se detecta con un `BroadcastChannel('mire')` y un *ping* con un plazo de 500 ms. En ese caso se cancela con «Cierra las otras pestañas de Míre e inténtalo de nuevo», sin borrar nada.
- **Acción, en orden**. Si cualquier paso falla, **se detiene** sin pasar a los siguientes, y la clave solo se destruye si todo lo anterior ha ido bien:
  1. el worker de la base de datos llama a `wipeFiles()` del pool `opfs-sahpool` y a `removeVfs()`; después se termina el worker;
  2. se borran las claves `mire.*` de `localStorage`;
  3. se borran las cachés del *service worker* salvo la de la estructura de la app;
  4. se cierran las conexiones a `mire-keys` y `indexedDB.deleteDatabase('mire-keys')`; un evento `blocked` cuenta como fallo. Es la **destrucción de la clave en este dispositivo**.
- **Resultado**: la app recarga y muestra la bienvenida de SPEC-0005.
- **Gancho para SPEC-0008**: `eraseAll({ remote })`; con `remote: true` devuelve `remote_not_available` sin borrar nada.

### 3. Aviso de privacidad (`privacidad.html`, tercera entrada de Vite)
- **Configuración en la PWA**: se añade `/privacidad\.html$/` al `navigateFallbackDenylist`, y la página incluye el script de tema de SPEC-0003. Su CSP la pone el plugin de SPEC-0014.
- **Acceso**: desde la bienvenida (sin configurar) y desde el menú (**«Privacidad» / «Privacy»**). Funciona sin conexión.
- **Contenido** (es/en, tono de `docs/brand.md`, breve):
  - qué datos se guardan: cuentas, movimientos, valoraciones, categorías y ajustes;
  - dónde:
    - en el navegador del dispositivo, **sin cifrar**: su protección **depende de que el dispositivo esté cifrado y bloqueado**, y el PIN de Míre solo bloquea la interfaz;
    - si se activa la sincronización, **cifrados** en el repositorio privado de GitHub del usuario;
  - lo que **no** hace: cookies, analíticas, terceros ni conexiones bancarias;
  - cómo exportar y borrar, incluido que el borrado remoto exige eliminar `mire-datos`;
  - qué pasa si se pierden la contraseña y el código;
  - fecha de actualización;
  - responsable: «uso personal del propietario», sin datos de contacto personales.

### 4. Telemetría cero
- **`tools/check-deps.ts`**, ejecutado por `.arda/checks.sh`, falla si alguna **dependencia directa** (`dependencies` o `devDependencies`) está en esta lista negra:
  `@sentry/*`, `posthog-*`, `mixpanel*`, `@vercel/analytics`, `react-ga*`, `@datadog/*`, `logrocket*`, `@amplitude/*`, `firebase`, `@google-analytics/*`.
  - Su función `checkDeps(pkgJson)` recibe el objeto, lo que permite probarla.
  - Las dependencias **transitivas no** se comprueban (limitación aceptada; la CSP y el CA-06 cubren el efecto).

### 5. Ficheros que cambia
- **Nuevos**: `src/privacy/*`, `privacidad.html`, `src/privacy/ui/*` y `tools/check-deps.ts`.
- **Modificados**:
  - `vite.config.ts`: entrada y *denylist*;
  - `package.json`: `fflate`;
  - `.arda/checks.sh`: `check-deps`;
  - claves i18n en `es.json` y `en.json`;
  - el menú de `TopBar`.

## Fuera de alcance
- Borrado remoto y aviso a otros dispositivos: SPEC-0008. Guía para eliminar el repositorio: SPEC-0014.
- Restaurar desde la copia exportada: futuro (el formato ya está versionado).
- Política para terceros usuarios: cuando el hogar sea multiusuario.

## Criterios de aceptación
1. **CA-01** · Exportación (Vitest, Node, SQLite en memoria). Datos de partida: 2 cuentas, 3 movimientos (uno con el concepto `=HYPERLINK("http://x";"y")`, otro con `Café; "bueno"` y otro de −51,56 € del 05/09/2026), 1 valoración, 1 categoría y 1 movimiento borrado. Resultado:
   - el `.zip` contiene `mire.json` y los 4 CSV;
   - las claves de `tables` son exactamente las tablas de SPEC-0004 menos `schema_migrations`;
   - el movimiento borrado no aparece;
   - `movimientos.csv` empieza por BOM, la celda del concepto peligroso es `'=HYPERLINK(""http://x"";""y"")`, entrecomillada según RFC 4180, `Café; "bueno"` aparece como `"Café; ""bueno"""`, y el importe aparece como `-51,56` **sin** `'`, con la fecha `05/09/2026`;
   - ningún fichero contiene `github_pat_` ni el anillo de claves.
2. **CA-02** · e2e de exportación:
   - con una contraseña errónea no hay descarga;
   - con la correcta, o con el código de recuperación, se descarga `mire-export-AAAAMMDD.zip` con 5 ficheros.
3. **CA-03** · e2e de borrado:
   - tras configurar y pulsar la prueba de almacenamiento, el borrado con la contraseña y `BORRAR` lleva a la bienvenida;
   - tras recargar sigue la bienvenida, `indexedDB.databases()` no incluye `mire-keys` y no hay claves `mire.*`;
   - al configurar de nuevo, la prueba de almacenamiento muestra **0** y `db-version` muestra 1;
   - con `BORRA` o con una contraseña errónea no se borra nada.
4. **CA-04** · e2e con dos pestañas: con una segunda página abierta, el borrado se cancela con el aviso de otras pestañas y no borra nada.
5. **CA-05** · `eraseAll({ remote: true })` devuelve `remote_not_available` y no borra nada (Vitest). Si se simula un fallo en el paso 1, `mire-keys` sigue existiendo.
6. **CA-06** · Aviso de privacidad (e2e):
   - se abre desde la bienvenida sin configurar, y también sin conexión tras la primera visita;
   - tiene versión es y en con los apartados del punto 3;
   - tiene la meta CSP de SPEC-0014 y no produce `securitypolicyviolation`;
   - axe no da infracciones en claro ni en oscuro, y no hay scroll horizontal a 375 px.
7. **CA-07** · Telemetría cero (e2e): en un recorrido completo (bienvenida, configuración, inicio, exportación, aviso y guía de estilo), **todas** las peticiones observadas con `context.on('request')` (página, workers y service worker) van al propio origen.
8. **CA-08** · `checkDeps` (Vitest) da error con `{ dependencies: { '@sentry/browser': '1.0.0' } }` y no da error con el `package.json` real. `checks.sh` la ejecuta.
9. **CA-09** · Los e2e de SPEC-0002 a SPEC-0005 y SPEC-0014 pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Borrado parcial**: el orden y la parada ante fallos evitan destruir la clave con datos aún presentes, y repetir la acción completa lo que falte.
- **Copia remota**: solo desaparece eliminando el repositorio (acción del propietario); el diálogo y el aviso lo dicen.
- **Exportación en claro**: el `.zip` no va cifrado; el diálogo lo advierte.

### Preguntas abiertas
- Ninguna para el propietario.
