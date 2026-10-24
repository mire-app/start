---
id: SPEC-0013
title: Privacidad: exportación, borrado y aviso
status: draft          # draft → approved (solo una persona) → implemented
summary: Exportación completa en .zip (JSON + CSV), borrado de todos los datos del dispositivo con destrucción de la clave local, aviso de privacidad es/en y telemetría cero verificada
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0004, SPEC-0005, ADR-0005]
---

# SPEC-0013 · Privacidad: exportación, borrado y aviso

## Intención
Dar al propietario control total sobre sus datos, como pide el RGPD:
- **llevárselos** (exportación completa y legible);
- **borrarlos** (supresión con destrucción de la clave);
- **saber qué se hace con ellos** (aviso de privacidad);
- con la garantía de que **ningún dato ni metadato** sale a terceros.

## Contexto
- `SPEC-0001`: restricción RGPD del proyecto (`docs/project-context.md`).
- `SPEC-0004`: esquema y repositorios. Se implementa antes.
- `SPEC-0005`: puerta de seguridad, contraseña maestra, menú de `TopBar`, CSP y almacén `mire-keys`. Se implementa antes.
- `ADR-0005`: la base local no se cifra (riesgo aceptado).
- **Decisiones del propietario** (2026-10-24):
  - «Borrar todos mis datos» = local + remoto + destruir la clave;
  - exportación en JSON + CSV;
  - ninguna telemetría;
  - aviso de privacidad breve.
- **Reparto del borrado**: esta spec borra todo lo del **dispositivo**, incluida la clave. La parte **remota** (ficheros del repositorio de datos, anillo de claves subido y aviso al resto de dispositivos) la añade SPEC-0008, que reutiliza la misma acción.

## Cambio (delta)
### 1. Exportación (`src/privacy/export.ts`, menú de `TopBar` → «Exportar mis datos…»)
- Pide la **contraseña maestra** (SPEC-0005), aunque la app esté desbloqueada.
- Genera `mire-export-AAAAMMDD.zip` con `fflate` (MIT) en el navegador y lo descarga.
- **`mire.json`**: `{ format: 'mire-export', version: 1, schemaVersion, exportedAt, tables: { <tabla>: [filas vivas] } }`.
  - Incluye todas las tablas de usuario de SPEC-0004 (y las que añadan specs posteriores), sin filas borradas.
  - Importes en céntimos y fechas ISO.
  - El formato es estable y versionado, pensado para un futuro «restaurar desde copia».
- **CSV legibles en Excel**: `cuentas.csv`, `movimientos.csv`, `valoraciones.csv` y `categorias.csv`.
  - UTF-8 con BOM, separador `;`, decimales con coma y fechas `dd/mm/aaaa`;
  - cabeceras en el idioma de la interfaz;
  - los movimientos llevan el nombre de la cuenta y de la categoría, no sus ids.
- **No incluye** el anillo de claves, el token ni los secretos.

### 2. Borrado de todos los datos del dispositivo (`src/privacy/erase.ts`, menú → «Borrar todos mis datos…»)
- **Diálogo**:
  - explica qué se borra y que no se puede deshacer;
  - recomienda exportar antes, con un botón;
  - pide la **contraseña maestra** y escribir la palabra **`BORRAR`** (o **`DELETE`** en inglés).
- **Acción**, en este orden:
  1. cierra la base de datos en el worker;
  2. borra los ficheros OPFS de `/mire.sqlite3` y `/mire-smoke.sqlite3`, incluido el pool de `opfs-sahpool`;
  3. borra la base IndexedDB `mire-keys` completa. Es la **destrucción de la clave en este dispositivo**: la DEK deja de existir aquí;
  4. borra las claves `mire.*` de `localStorage`;
  5. borra las cachés del *service worker* que no sean la estructura de la app (la estructura no contiene datos).
- **Resultado**: la app vuelve a la bienvenida de SPEC-0005.
- **Gancho para SPEC-0008**: `eraseAll({ remote })` acepta `remote: true`, que en esta spec lanza `remote_not_available` sin borrar nada. SPEC-0008 lo implementará y la interfaz lo usará cuando haya sincronización.

### 3. Aviso de privacidad (`privacidad.html`, tercera entrada de Vite)
- **Acceso**: desde la bienvenida (SPEC-0005) y desde el menú de `TopBar`. Disponible **antes de configurar la seguridad** y sin conexión (*precache*).
- **Contenido**, en es/en, con el tono de `docs/brand.md`, breve:
  - qué datos guarda: cuentas, movimientos, valoraciones, categorías y ajustes;
  - dónde:
    - en tu dispositivo (almacenamiento del navegador, **sin cifrar en el dispositivo**, protegido por el cifrado del propio dispositivo);
    - y, si activas la sincronización, **cifrados** en tu repositorio privado de GitHub;
  - qué **no** hace: sin cookies, sin analíticas, sin terceros y sin conexiones bancarias;
  - cómo exportar y borrar;
  - qué pasa si pierdes la contraseña y el código de recuperación;
  - fecha de la última actualización.
- **Responsable**: «uso personal del propietario». No incluye datos de contacto personales, porque el repositorio es público.
- Usa la CSP de SPEC-0005 y el sistema de diseño de SPEC-0003.

### 4. Telemetría cero
- **Sin dependencias** de analíticas, métricas ni informes de errores. `checks.sh` falla si `package.json` incluye alguna de esta lista negra: `@sentry/*`, `posthog-*`, `mixpanel*`, `@vercel/analytics`, `react-ga*`, `@datadog/*`, `logrocket*`, `@amplitude/*`, `firebase`, `@google-analytics/*`.
- **Sin peticiones de red** salvo al propio origen y, desde SPEC-0008, a `api.github.com`. La CSP de SPEC-0005 (`connect-src`) ya lo impone; aquí se verifica.

## Fuera de alcance
- Borrado remoto y aviso al resto de dispositivos: SPEC-0008.
- Restaurar desde la copia exportada: futuro.
- Política de privacidad para terceros usuarios, que solo hará falta cuando el hogar sea multiusuario.

## Criterios de aceptación
1. **CA-01** · Exportación (Vitest, Node, SQLite en memoria con datos de SPEC-0004: 2 cuentas, 3 movimientos con un traspaso, 1 valoración y 1 categoría):
   - el `.zip` contiene `mire.json` y los 4 CSV;
   - `mire.json` tiene `format`, `version: 1` y el `schemaVersion` actual, y **no** contiene filas borradas;
   - `movimientos.csv` empieza por BOM, usa `;` y muestra `-51,56` y `05/09/2026` en la fila esperada;
   - ningún fichero contiene el anillo de claves ni `github_pat_`.
2. **CA-02** · e2e de exportación:
   - el menú pide la contraseña maestra; con una errónea no exporta;
   - con la correcta, se descarga `mire-export-AAAAMMDD.zip` (evento `download` de Playwright) con los 5 ficheros.
3. **CA-03** · e2e de borrado:
   - tras configurar la seguridad y pulsar la prueba de almacenamiento, «Borrar todos mis datos» con la contraseña y `BORRAR` vuelve a la bienvenida;
   - tras recargar sigue en la bienvenida, `indexedDB.databases()` no incluye `mire-keys` y no hay claves `mire.*` en `localStorage`;
   - tras volver a configurar, la prueba de almacenamiento muestra **0** y `db-version` muestra 1 (base nueva);
   - con la palabra mal escrita o la contraseña errónea, no se borra nada.
4. **CA-04** · `eraseAll({ remote: true })` lanza `remote_not_available` y no borra nada (Vitest).
5. **CA-05** · Aviso de privacidad (e2e):
   - `privacidad.html` se abre desde la bienvenida sin configurar la seguridad, y también sin conexión tras la primera visita;
   - tiene versión es y en, con los apartados del punto 3;
   - axe no da infracciones en claro ni en oscuro, y no hay scroll horizontal a 375 px.
6. **CA-06** · Telemetría cero (e2e): en un recorrido completo (bienvenida, configuración, inicio, exportación, aviso y guía de estilo), **todas** las peticiones (`page.on('request')`) van al propio origen.
7. **CA-07** · `checks.sh` falla si se añade a `package.json` cualquier paquete de la lista negra del punto 4; un test lo comprueba con un `package.json` temporal.
8. **CA-08** · Los e2e de SPEC-0002 a SPEC-0005 pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Borrado parcial** si el navegador falla a mitad: el orden del punto 2 deja la clave para el final de lo crítico, y una segunda ejecución completa lo que falte (es idempotente).
- **Cachés de otros navegadores o dispositivos**: el borrado es por dispositivo. Los demás se borrarán mediante SPEC-0008.
- **Exportación en claro**: el `.zip` contiene los datos sin cifrar; el diálogo lo advierte. Guardarlo es responsabilidad del propietario.

### Preguntas abiertas
- Ninguna para el propietario.
