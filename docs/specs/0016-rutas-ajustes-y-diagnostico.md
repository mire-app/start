---
id: SPEC-0016
title: Rutas, Ajustes, Diagnóstico y datos de ejemplo
status: draft          # draft → approved (solo una persona) → implemented
summary: Router con rutas hash, página Ajustes (idioma, tema, seguridad, datos, privacidad y Diagnóstico con la prueba de almacenamiento y db-version trasladadas), datos de ejemplo con la base vacía y traslado acotado de tests
test_changes: allowed  # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0002, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0013, SPEC-0014, ADR-0002]
---

# SPEC-0016 · Rutas, Ajustes, Diagnóstico y datos de ejemplo

## Intención
Preparar la app para tener varias pantallas:
- montar el **router**;
- crear la página **Ajustes**, que reúne idioma, tema, seguridad, datos, privacidad y **Diagnóstico**;
- **vaciar la pantalla de inicio** de los controles provisionales (selectores, prueba de almacenamiento y versión de la base);
- ofrecer **datos de ejemplo** para ver la app y probar las pantallas sin extractos reales.

Las pantallas de Inicio, Cuentas y navegación son de SPEC-0006.

## Contexto
- `ADR-0002`: React Router con rutas *hash*.
- `SPEC-0002`: pantalla de inicio con los selectores «Idioma» y «Tema» (`<select>` nativos), la prueba de almacenamiento (`smoke-count`) y su contrato de e2e.
- `SPEC-0003`: `TopBar`, componentes, axe y `navigate(direction)`.
- `SPEC-0004`: `db-version` en la pantalla de inicio y repositorios (`createAccount`, `createGroup` y movimientos).
- `SPEC-0005`: puerta de seguridad, menú de `TopBar`, `check-test-changes` y su política.
- `SPEC-0013` y `SPEC-0014`: exportar, borrar, privacidad y «Seguridad…». **Se implementan antes que esta spec** (orden del backlog).
- **Decisiones del propietario** (2026-10-24):
  - Diagnóstico en Ajustes;
  - datos de ejemplo solo con la base vacía;
  - partir SPEC-0006 en SPEC-0016 (esta, primero) y SPEC-0006.

## Cambio (delta)
### 1. Router (`src/app/router.tsx`)
- `createHashRouter` con estas rutas:
  - `#/`: pantalla de inicio (de momento, `TopBar` y un saludo; su contenido es de SPEC-0006);
  - `#/ajustes`: Ajustes;
  - cualquier otra ruta redirige a `#/`.
- **Índices de sección** para las transiciones: Inicio 0, Cuentas 1, Movimientos 2, Importar 3 y Ajustes 4. Las rutas de detalle son el nivel 2 de su sección.
- **Regla de transición**, también para el botón «atrás» del navegador: se compara el índice de sección de origen y de destino.
  - Mayor, o el mismo con más nivel: `navigate('forward')`.
  - Menor, o el mismo con menos nivel: `navigate('back')`.
  - Ruta igual: sin transición.
- **`SecurityGate`** (SPEC-0005) **conserva la ruta**: al desbloquear se muestra la ruta que había en el *hash*.

### 2. Ajustes (`#/ajustes`), con entrada **«Ajustes» / «Settings»** en el menú de `TopBar` (las demás entradas del menú se mantienen)
Secciones, cada una con un encabezado `h2`:
- **General**: los selectores **«Idioma»** y **«Tema»**, **trasladados** desde la pantalla de inicio sin cambiar sus nombres accesibles.
- **Seguridad**: los botones «Bloquear ahora» y «Seguridad…» (diálogo de SPEC-0014).
- **Datos**: los botones «Exportar mis datos…» y «Borrar todos mis datos…» (SPEC-0013).
- **Privacidad**: enlace a `privacidad.html`.
- **Diagnóstico**:
  - «Base de datos: versión N» (`data-testid="db-version"`, con `data-applied-at`), trasladado;
  - espacio usado: `navigator.storage.estimate().usage`, en MB con un decimal en formato es-ES (`12,3 MB`), o «No disponible» si el navegador no lo da;
  - versión de la app: `package.json` → `import.meta.env.APP_VERSION`;
  - la **prueba de almacenamiento**, trasladada con el mismo botón y el mismo `data-testid="smoke-count"`;
  - los **datos de ejemplo** (punto 3).
- **Roles**: las acciones de Ajustes son `button`; las del menú son `menuitem`. No se confunden en los e2e.

### 3. Datos de ejemplo (`src/db/repo/demo.ts`)
- **`seedDemo(db)`** crea, en una transacción:
  - un `import_batch` con `source='demo'`;
  - los datos de la tabla siguiente, con **fechas fijas** (las de la tabla), con `created_by_batch_id` igual a ese lote en las cuentas y el grupo, y los traspasos enlazados con `linkTransfer`.
  - Si ya hay alguna cuenta viva, lanza `demo_requires_empty`.
- **`removeDemo(db)`**:
  - si alguna cuenta del ejemplo tiene movimientos o valoraciones vivos de **otros** lotes, lanza `demo_mixed` y no cambia nada;
  - si no: desvincula los traspasos, marca `deleted_at` en los movimientos, valoraciones, cuentas y grupo del lote, y también en los `source_link` de esas cuentas, y pone `reverted_at` en el lote.
- **Interfaz**:
  - «Cargar datos de ejemplo» solo está habilitado si no hay ninguna cuenta viva;
  - «Quitar datos de ejemplo» solo aparece si existe un lote `demo` no revertido.

| Grupo / cuenta | Tipo | Institución | Apertura | Movimientos | Valoración |
|---|---|---|---|---|---|
| — / Cuenta Ejemplo | `checking` | Banco Ejemplo | 2026-09-01 · 1.000,00 | 2026-09-01 +2.000,00 «NÓMINA EJEMPLO» · 2026-09-05 −51,56 «GASOLINERA EJEMPLO» · 2026-09-10 −300,00 «TRASPASO A AHORRO» (traspaso) · 2026-09-15 −500,00 «APORTACIÓN FONDO» (traspaso) | — |
| — / Ahorro Ejemplo | `savings` | Banco Ejemplo | 2026-09-01 · 5.000,00 | 2026-09-10 +300,00 «TRASPASO DESDE CUENTA» (traspaso) | — |
| Cartera Ejemplo / Fondo Global Ejemplo | `investment` (ISIN `LU0000000001`) | Bróker Ejemplo | — | 2026-09-16 +500,00 «APORTACIÓN» (traspaso) | 2026-10-24 · 2.450,12 |
| Cartera Ejemplo / Fondo Europa Ejemplo | `investment` (ISIN `IE0000000002`) | Bróker Ejemplo | — | — | 2026-10-24 · 1.967,84 |

Valores **a 2026-10-24 o después**:

| Concepto | Céntimos |
|---|---|
| Cuenta Ejemplo | 214844 |
| Ahorro Ejemplo | 530000 |
| Cartera Ejemplo | 441796 |
| **Patrimonio** | **1186640** |

Hay 6 movimientos y 2 traspasos (4 movimientos de traspaso).

### 4. Cambio de tests existentes (`test_changes: allowed`)
**Justificación**: los selectores «Idioma» y «Tema», la prueba de almacenamiento y `db-version` salen de la pantalla de inicio hacia Ajustes. Los e2e preexistentes que los usan (SPEC-0002, SPEC-0003, SPEC-0004 y **SPEC-0013**, CA-03) deben navegar hasta allí antes de usarlos. Los de SPEC-0005 y SPEC-0014 no los usan, pero entran en el mismo control.

**Alcance permitido**:
- nuevo `e2e/helpers/navigation.ts` con:
  - `openSettings(page)`: si la URL no es `#/ajustes`, abre el menú de `TopBar` y pulsa «Ajustes»; si ya lo es, no hace nada;
  - `openDiagnostics(page)`: `openSettings` y después desplaza hasta el encabezado `/^(Diagnóstico|Diagnostics)$/`.
  - Ambos son bilingües, con localizadores anclados, e idempotentes.
- en los ficheros de test preexistentes, solo **líneas añadidas** que importen o llamen a `openSettings` u `openDiagnostics`.

**Prohibido**: lo mismo que en SPEC-0005.

**Control**:
- **firma**: `checkDiff(diff, baseTestFiles, policy?)`, compatible con SPEC-0005, que pasa a recibir la política como parámetro opcional (por defecto, la de SPEC-0005);
- **políticas**: en `tools/test-change-policies.ts`, por id de spec (`'SPEC-0005'`, `'SPEC-0016'`);
- **id de spec**: se obtiene leyendo el `id:` del *frontmatter* del fichero al que apunta `.arda/active-spec`;
- **cuándo actúa**: solo si existe una política para ese id;
- **tests del control**: los de SPEC-0005 (`tools/*.test.ts`) no se modifican; esta spec añade los suyos en un fichero nuevo.

## Fuera de alcance
- Barras de navegación, Inicio con resumen, Cuentas: SPEC-0006. Movimientos: SPEC-0015. Importar: SPEC-0010.
- Alta manual de datos: descartada (solo importación).

## Criterios de aceptación
1. **CA-01** · Router:
   - `#/ajustes` muestra Ajustes, y una ruta desconocida lleva a `#/`;
   - tras recargar en `#/ajustes` y desbloquear, se sigue en `#/ajustes`;
   - con el espía de SPEC-0003, ir de `#/` a `#/ajustes` usa `vt-forward`, y el botón «atrás» del navegador usa `vt-back`.
2. **CA-02** · Ajustes:
   - «Idioma» y «Tema» funcionan desde Ajustes y ya no están en la pantalla de inicio;
   - Diagnóstico muestra `db-version` = 1, el espacio en el formato indicado y la versión de la app;
   - la prueba de almacenamiento incrementa y persiste.
3. **CA-03** · `seedDemo` y `removeDemo` (Vitest, en memoria):
   - tras `seedDemo`, `netWorth('2026-10-24') = 1186640`, los valores por cuenta y por grupo son los del punto 3, y hay 6 movimientos con 4 de tipo `transfer`;
   - con una cuenta previa, lanza `demo_requires_empty`;
   - `removeDemo` deja 0 cuentas vivas y 0 `source_link` vivos de esas cuentas;
   - con un movimiento de otro lote en «Cuenta Ejemplo», lanza `demo_mixed`.
4. **CA-04** · e2e de datos de ejemplo:
   - «Cargar datos de ejemplo» funciona y después queda deshabilitado;
   - «Quitar datos de ejemplo» lo revierte y vuelve a habilitar la carga.
5. **CA-05** · Control de tests (Vitest, fichero nuevo):
   - con la política `SPEC-0016`, `checkDiff` **acepta** un diff que solo añade `import { openSettings } …` y `await openDiagnostics(page)`;
   - **rechaza** uno que añade `await openSettings(page); expect(...)`, o que quita una línea;
   - el id de spec se obtiene del *frontmatter*.
6. **CA-06** · Los e2e de SPEC-0002, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0013 y SPEC-0014 pasan con solo los cambios permitidos, verificado por `check-test-changes`.
7. **CA-07** · axe sin infracciones en Ajustes (claro y oscuro), y sin scroll horizontal a 375 px.
8. **CA-08** · `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Fechas fijas del ejemplo**: el patrimonio de ejemplo es 11.866,40 € a partir del 24/10/2026. Antes de esa fecha la valoración no contaría, pero los e2e se ejecutan después.
- **Datos de ejemplo mezclados**: los impiden `demo_requires_empty` y `demo_mixed`.

### Preguntas abiertas
- Ninguna para el propietario.
