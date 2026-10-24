---
id: SPEC-0006
title: Navegación, Inicio, cuentas y ajustes
status: draft          # draft → approved (solo una persona) → implemented
summary: Navegación (barra inferior en móvil y superior en escritorio, rutas hash), Inicio con resumen de patrimonio, Cuentas (detalle, edición, grupos, inversiones, archivar y borrar vacías), Ajustes con Diagnóstico y datos de ejemplo
test_changes: allowed  # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0002, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0013, SPEC-0014, ADR-0002]
---

# SPEC-0006 · Navegación, Inicio, cuentas y ajustes

## Intención
Convertir el esqueleto en una app navegable:
- **secciones** con navegación adaptada a móvil y escritorio;
- **Inicio** con el patrimonio y las cuentas;
- **Cuentas**, para ver y ordenar lo importado;
- **Ajustes**, que recoge idioma, tema, seguridad, datos y diagnóstico.

Los movimientos van en SPEC-0015 y la importación en SPEC-0010.

## Contexto
- `SPEC-0001` (draft): funciones 1 y 6, CA-01, CA-09 (parcial: patrimonio total y desglose) y CA-16.
- **Decisión del propietario** (2026-10-24): **solo importación**. Los movimientos, las cuentas y las valoraciones nacen al importar (SPEC-0011, SPEC-0012 y SPEC-0010); aquí solo se editan, se agrupan, se archivan o se borran (las cuentas, solo si están vacías). SPEC-0001 se actualiza en consecuencia.
- `ADR-0002`: React Router con rutas *hash*.
- `SPEC-0003`: `TopBar`, Material Symbols Rounded, tokens, `navigate(direction)` (deslizamiento direccional) y `Amount`.
- `SPEC-0004`: repositorios y dominio (`accountBalance`, `investmentValue`, `netWorth`, `groupValue`). La prueba de almacenamiento y `db-version` estaban en la pantalla de inicio.
- `SPEC-0005`: puerta de seguridad, menú de `TopBar` y política de cambio de tests. `SPEC-0013` y `SPEC-0014`: entradas del menú («Exportar…», «Borrar…», «Privacidad», «Seguridad…»).
- **Decisiones del propietario** (2026-10-24):
  - barra inferior con iconos en móvil y barra superior en escritorio;
  - secciones funcionales: Inicio, Cuentas, Movimientos e Importar;
  - Inicio con el resumen de cuentas;
  - archivar, y borrar solo cuentas vacías;
  - Diagnóstico en Ajustes;
  - datos de ejemplo con la base vacía;
  - partir en SPEC-0006 y SPEC-0015;
  - SPEC-0010 justo después de SPEC-0015.

## Cambio (delta)
### 1. Navegación (`src/app/`)
- **Rutas** (React Router, `createHashRouter`):

  | Ruta | Pantalla | Índice de sección |
  |---|---|---|
  | `#/` | Inicio | 0 |
  | `#/cuentas` | Cuentas | 1 |
  | `#/cuentas/:id` | Detalle de cuenta | 1, nivel 2 |
  | `#/movimientos` | Movimientos (SPEC-0015) | 2 |
  | `#/importar` | Importar (SPEC-0010) | 3 |
  | `#/ajustes` | Ajustes | 4 |

  - Hasta SPEC-0015, `#/movimientos` muestra «Próximamente». Hasta SPEC-0010, `#/importar` muestra «Próximamente: importa tus extractos de BBVA y MyInvestor».
  - Una ruta desconocida redirige a `#/`.
- **Transiciones**: ir a una sección de índice mayor, o a un nivel más profundo, usa `navigate('forward')` (SPEC-0003); lo contrario, `navigate('back')`. El botón «atrás» del navegador también usa `back`.
- **Móvil** (< 768 px): **barra inferior** fija con 4 pestañas (icono Material Symbols Rounded y texto):

  | Pestaña | Icono |
  |---|---|
  | Inicio | `home` |
  | Cuentas | `account_balance` |
  | Movimientos | `receipt_long` |
  | Importar | `upload_file` |

  La barra respeta `env(safe-area-inset-bottom)` y cada objetivo mide ≥ 44 × 44 px.
- **Escritorio** (≥ 768 px): las 4 secciones como enlaces dentro de `TopBar`; no hay barra inferior.
- **Sección activa**: `aria-current="page"` y el estilo del token `accent`.
- **Ajustes**: se llega desde el menú de `TopBar` con la entrada nueva **«Ajustes» / «Settings»**. Las entradas existentes del menú (SPEC-0005, SPEC-0013 y SPEC-0014) **se mantienen**.
- **Etiquetas** (es/en): «Inicio» / «Home», «Cuentas» / «Accounts», «Movimientos» / «Transactions», «Importar» / «Import» y «Ajustes» / «Settings». Son las provisionales; los nombres de marca se decidirán más adelante.

### 2. Inicio (`#/`)
- **Patrimonio**: `netWorth(hoy)` con `Amount kind="balance"`, en tamaño grande, con el título «Patrimonio» / «Net worth».
- **Lista de cuentas no archivadas**:
  - primero cada **grupo**, con su total (`groupValue`) y sus cuentas;
  - después las cuentas sin grupo, agrupadas por tipo, en este orden: Corriente, Ahorro, Efectivo, Inversión.
- **Cada fila**: nombre, institución y saldo o valor. Es un enlace a `#/cuentas/:id`.
- **Estado vacío**: «Aún no hay cuentas. Importa tu primer extracto para empezar.», con un botón que lleva a `#/importar`.

### 3. Cuentas (`#/cuentas` y `#/cuentas/:id`)
- **Lista**:
  - la misma agrupación que Inicio;
  - un interruptor **«Mostrar archivadas»** (las archivadas, atenuadas y con la marca «Archivada»);
  - un botón **«Gestionar grupos»**.
- **Gestionar grupos** (`Dialog`):
  - crear un grupo con nombre;
  - renombrar un grupo;
  - borrar un grupo **vacío**; si tiene cuentas, da `group_not_empty`.
- **Detalle de cuenta**:
  - **cabecera**: nombre, institución, tipo, grupo, y saldo o valor actual;
  - **edición** (`Dialog` «Editar cuenta»): nombre, institución y grupo;
    - el **tipo** solo se puede cambiar entre corriente, ahorro y efectivo; pasar a o desde inversión no se permite;
    - la **apertura** (fecha e importe) se puede editar, con el aviso «Cambiar la apertura altera todos los saldos de esta cuenta».
  - **«Archivar» / «Desarchivar»**.
  - **«Borrar cuenta»**: solo está habilitado si no tiene movimientos ni valoraciones vivos. Si no, el repositorio lanza `account_not_empty` y la interfaz lo explica: «Archívala para ocultarla; su historia seguirá contando en tu patrimonio». Pide confirmación.
  - **Últimos 10 movimientos** (solo lectura, con `Amount` según su tipo) y un enlace «Ver todos» a `#/movimientos?cuenta=:id` (SPEC-0015).
  - **Solo en cuentas de inversión**: ISIN, valor (`investmentValue`) y tabla de **valoraciones** (fecha, participaciones y valor), de solo lectura y más reciente primero.
- **Movimientos en cuentas de inversión**: se admite cualquier movimiento importado (traspasos, aportaciones o movimientos normales). Todos suman a su valor hasta la siguiente valoración (SPEC-0004). Con esto se cierra la pregunta abierta de SPEC-0001.

### 4. Ajustes (`#/ajustes`)
Secciones:
- **General**: los selectores **«Idioma»** y **«Tema»** (`<select>` nativos, mismos nombres accesibles que en SPEC-0002 y SPEC-0003) **se trasladan aquí** desde la pantalla de inicio.
- **Seguridad**: «Bloquear ahora» y el botón «Seguridad…», que abre el diálogo de SPEC-0014.
- **Datos**: «Exportar mis datos…» y «Borrar todos mis datos…» (SPEC-0013).
- **Privacidad**: enlace a `privacidad.html`.
- **Diagnóstico**:
  - «Base de datos: versión N» (`data-testid="db-version"` y `data-applied-at`, trasladado desde la pantalla de inicio);
  - espacio usado (`navigator.storage.estimate()`, en MB);
  - versión de la app (de `package.json`, inyectada en la build);
  - la **prueba de almacenamiento** de SPEC-0002, trasladada con el mismo botón y el mismo `data-testid="smoke-count"`;
  - **datos de ejemplo** (punto 5).
- Las secciones de SPEC-0013 y SPEC-0014 aparecen si ya están implementadas; si no, se omiten.

### 5. Datos de ejemplo (`src/db/repo/demo.ts`)
- **Esquema**: `account` y `account_group` tienen la columna `created_by_batch_id` (SPEC-0004, FK a `import_batch`, admite NULL).
- **«Cargar datos de ejemplo»**: solo se habilita si **no hay ninguna cuenta viva**.
  - Crea un `import_batch` con `source='demo'` y, dentro de una transacción, los datos de la tabla siguiente.
  - Marca las cuentas y el grupo con `created_by_batch_id` igual a ese lote.
- **«Quitar datos de ejemplo»**: solo aparece si existe un lote `demo` no revertido.
  - Desvincula los traspasos y marca `deleted_at` en sus movimientos, valoraciones, cuentas y grupo.
  - Marca `reverted_at` en el lote.
  - Si alguna cuenta del ejemplo tiene movimientos de **otros** lotes, da `demo_mixed` y no hace nada.

| Grupo / cuenta | Tipo | Institución | Apertura | Movimientos | Valoración |
|---|---|---|---|---|---|
| — / Cuenta Ejemplo | `checking` | Banco Ejemplo | 2026-09-01 · 1.000,00 | 2026-09-01 +2.000,00 «NÓMINA EJEMPLO» · 2026-09-05 −51,56 «GASOLINERA EJEMPLO» · 2026-09-10 −300,00 «TRASPASO A AHORRO» (traspaso) · 2026-09-15 −500,00 «APORTACIÓN FONDO» (traspaso) | — |
| — / Ahorro Ejemplo | `savings` | Banco Ejemplo | 2026-09-01 · 5.000,00 | 2026-09-10 +300,00 «TRASPASO DESDE CUENTA» (traspaso) | — |
| Cartera Ejemplo / Fondo Global Ejemplo | `investment` (ISIN `LU0000000001`) | Bróker Ejemplo | — | 2026-09-16 +500,00 «APORTACIÓN» (traspaso) | 2026-10-24 · 2.450,12 |
| Cartera Ejemplo / Fondo Europa Ejemplo | `investment` (ISIN `IE0000000002`) | Bróker Ejemplo | — | — | 2026-10-24 · 1.967,84 |

Valores resultantes a 2026-10-24:

| Concepto | Céntimos |
|---|---|
| Cuenta Ejemplo | 214844 |
| Ahorro Ejemplo | 530000 |
| Cartera Ejemplo | 441796 |
| **Patrimonio** | **1186640** |

### 6. Repositorios nuevos (SPEC-0004, en `src/db/repo/`)
- `listAccountsWithValues(db, date, { includeArchived })`
- `deleteAccount(db, id)`, que lanza `account_not_empty`
- `renameGroup` y `deleteGroup`, este último con `group_not_empty`
- `listValuations(db, accountId)`
- `listRecentMovements(db, accountId, limit)`
- `seedDemo(db, today)` y `removeDemo(db)`

### 7. Cambio de tests existentes (`test_changes: allowed`)
**Justificación**: la pantalla de inicio deja de tener los selectores de idioma y tema, la prueba de almacenamiento y `db-version`, que pasan a Ajustes. Los e2e de SPEC-0002, SPEC-0003, SPEC-0004 y SPEC-0005 que los usan deben navegar hasta allí antes de sus comprobaciones.

**Alcance permitido**:
- añadir en `e2e/helpers/navigation.ts` las funciones `openSettings(page)` y `openDiagnostics(page)`, bilingües y con localizadores anclados;
- en los ficheros de test preexistentes, solo **líneas añadidas** que importen o llamen a `openSettings` u `openDiagnostics`, justo antes de usar los controles trasladados.

**Prohibido**: lo mismo que en SPEC-0005 (quitar o modificar líneas, borrar o renombrar ficheros, `.skip`/`.only`, *timeouts*, cambiar Vitest).

**Control**: se reutiliza `tools/check-test-changes.ts` (SPEC-0005), cuya lista de patrones permitidos pasa a estar **por spec** en `tools/test-change-policies.ts` (`{ 'SPEC-0005': [...], 'SPEC-0006': [...] }`). Solo actúa si `.arda/active-spec` apunta a una spec con política.

## Fuera de alcance
- Lista global, detalle y edición de movimientos, vincular traspasos y aportación externa: SPEC-0015.
- Asistente de importación: SPEC-0010. Categorías: SPEC-0007. Panel con evolución y resumen mensual: SPEC-0009.
- **Alta manual** de movimientos, cuentas o valoraciones: descartada por el propietario (solo importación).
- Coordinación real entre varias pestañas: se mantiene el aviso de SPEC-0002; la coordinación, si hace falta, va en SPEC-0008.
- Nombres de marca de las secciones.

## Criterios de aceptación
Los e2e parten de la configuración de seguridad (SPEC-0005) y, salvo indicación, cargan los datos de ejemplo desde Diagnóstico.

1. **CA-01** · Navegación móvil (375 × 812):
   - hay barra inferior con 4 pestañas, iconos y textos; no hay enlaces de sección en `TopBar`;
   - pulsar Cuentas cambia a `#/cuentas` con `aria-current="page"`;
   - los objetivos miden ≥ 44 × 44 px;
   - no hay scroll horizontal.
2. **CA-02** · Navegación de escritorio (1280 × 800): no hay barra inferior, las 4 secciones están en `TopBar` y Ajustes está en el menú.
3. **CA-03** · Transiciones: con el espía de SPEC-0003 CA-08, ir de Inicio a Movimientos añade `vt-forward`, y volver a Inicio añade `vt-back`. Con `reducedMotion: 'reduce'` no se llama a `startViewTransition`.
4. **CA-04** · Inicio con datos de ejemplo:
   - el patrimonio es `11.866,40 €`;
   - se ve el grupo «Cartera Ejemplo» con `4.417,96 €` y sus dos fondos;
   - después «Corriente: Cuenta Ejemplo `2.148,44 €`» y «Ahorro: Ahorro Ejemplo `5.300,00 €`».
   - Cubre SPEC-0001 CA-09 (patrimonio total y desglose).
5. **CA-05** · Inicio sin datos: se ve el estado vacío y su botón lleva a `#/importar` («Próximamente»).
6. **CA-06** · Cuentas:
   - **editar**: renombrar «Cuenta Ejemplo» a «Diario» se refleja en Inicio;
   - **archivar** «Ahorro Ejemplo» la oculta de Inicio y de la lista, salvo con «Mostrar archivadas», pero el patrimonio sigue siendo `11.866,40 €`;
   - **«Borrar cuenta»** está deshabilitado en «Diario», con la explicación.
   - Cubre SPEC-0001 CA-01 (salvo el alta, que es por importación).
7. **CA-07** · Grupos:
   - crear el grupo «Bancos» y mover a él «Diario» muestra el grupo en Inicio con `2.148,44 €`;
   - borrar «Cartera Ejemplo» con cuentas da `group_not_empty`;
   - borrar «Bancos» tras sacar «Diario» funciona.
8. **CA-08** · Inversión: el detalle de «Fondo Global Ejemplo» muestra el ISIN, el valor `2.450,12 €` y una valoración del `24/10/2026`.
9. **CA-09** · Cambio de tipo: en «Diario» se puede pasar a Ahorro; en un fondo, el selector de tipo no ofrece otras opciones.
10. **CA-10** · Repositorios (Vitest): `deleteAccount` sobre una cuenta con un movimiento vivo da `account_not_empty`; sobre una cuenta vacía la borra (lógico).
11. **CA-11** · Datos de ejemplo (Vitest y e2e):
    - `seedDemo` produce exactamente los valores del punto 5 (Vitest);
    - con alguna cuenta viva, «Cargar datos de ejemplo» está deshabilitado (e2e);
    - «Quitar datos de ejemplo» deja el patrimonio en 0 y la base sin cuentas vivas (e2e);
    - `removeDemo` con un movimiento de otro lote en «Cuenta Ejemplo» da `demo_mixed` (Vitest).
12. **CA-12** · Ajustes:
    - los selectores «Idioma» y «Tema» funcionan desde Ajustes;
    - Diagnóstico muestra `db-version`, el espacio usado y la versión;
    - la prueba de almacenamiento funciona.
13. **CA-13** · Los e2e de SPEC-0002 a SPEC-0005 (y de SPEC-0013 y SPEC-0014, si existen) pasan con solo los cambios permitidos del punto 7, verificado por `tools/check-test-changes.ts`.
14. **CA-14** · axe (SPEC-0003) sin infracciones en Inicio, Cuentas, detalle (corriente e inversión), Ajustes y en los diálogos de cuenta y grupos, en claro y en oscuro.
15. **CA-15** · `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Rendimiento del cálculo en memoria** (SPEC-0004) con muchos movimientos: es suficiente para uso personal; si se nota, se cachea por cuenta.
- **Datos de ejemplo mezclados con reales**: lo impiden la condición de base vacía al cargar y `demo_mixed` al quitar.
- **Tamaño**: rutas, 4 pantallas, 2 diálogos, Ajustes, datos de ejemplo y cambio de tests. Si no cabe en una sesión, se separan los datos de ejemplo (requiere volver a Refinar).

### Preguntas abiertas
- Ninguna para el propietario.
