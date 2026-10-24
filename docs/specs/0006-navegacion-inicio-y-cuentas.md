---
id: SPEC-0006
title: Navegación, Inicio y cuentas
status: approved          # draft → approved (solo una persona) → implemented
summary: Barras de navegación (inferior en móvil y superior en escritorio), Inicio con resumen de patrimonio, Cuentas con detalle, edición, grupos, inversiones, archivar y borrar vacías
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0007, SPEC-0009, SPEC-0011, SPEC-0016, SPEC-0020, ADR-0002]
---

# SPEC-0006 · Navegación, Inicio y cuentas

## Intención
Dar a Míre su navegación y sus dos primeras pantallas de uso:
- **Inicio**, con el patrimonio y las cuentas;
- **Cuentas**, para ver y ordenar lo importado (detalle, edición, grupos e inversiones).

## Contexto
- `SPEC-0001` (draft): funciones 1 y 6, CA-01, CA-09 (patrimonio total y desglose) y CA-16.
- **Decisión del propietario** (2026-10-24): **solo importación**. Las cuentas nacen al importar; aquí se editan, se agrupan, se archivan y se borran si están vacías.
- `SPEC-0016`: router, regla de transiciones, Ajustes y datos de ejemplo. **Se implementa antes.**
- `SPEC-0003`: `TopBar`, Material Symbols Rounded, tokens, `Amount` y axe.
- `SPEC-0004`: repositorios y dominio. `SPEC-0011`: `source_link` y `read`.
- **Decisiones del propietario** (2026-10-24):
  - barra inferior con iconos en móvil y superior en escritorio;
  - secciones funcionales Inicio, Cuentas, Movimientos e Importar;
  - Inicio con el resumen de cuentas;
  - archivar, y borrar solo cuentas vacías;
  - valores por defecto aceptados para el detalle de cuenta y los grupos.

## Cambio (delta)
### 1. Navegación
- **Rutas nuevas** sobre el router de SPEC-0016:

  | Ruta | Pantalla | Sección | Nivel |
  |---|---|---|---|
  | `#/cuentas` | Cuentas | 1 | 1 |
  | `#/cuentas/:id` | Detalle de cuenta | 1 | 2 |
  | `#/movimientos` | Marcador «Próximamente»; SPEC-0015 lo sustituye | 2 | 1 |
  | `#/importar` | Marcador «Próximamente»; SPEC-0010 lo sustituye | 3 | 1 |

- **Móvil** (< 768 px): **barra inferior** fija con 4 pestañas (icono Material Symbols Rounded y texto):

  | Pestaña | Icono |
  |---|---|
  | Inicio / Home | `home` |
  | Cuentas / Accounts | `account_balance` |
  | Movimientos / Transactions | `receipt_long` |
  | Importar / Import | `upload_file` |

  - Respeta `env(safe-area-inset-bottom)` y cada objetivo mide ≥ 44 × 44 px.
  - Aparece en todas las rutas salvo `#/ajustes` y sus subrutas (p. ej. `#/ajustes/categorias`, SPEC-0007), a las que se llega desde el menú de `TopBar`; desde Ajustes se vuelve con el logotipo o con «atrás» (SPEC-0016).
- **Escritorio** (≥ 768 px): las 4 secciones como enlaces dentro de `TopBar`, sin barra inferior.
- **Sección activa**: `aria-current="page"` y color `accent`.

### 2. Inicio (`#/`)
- **Patrimonio**: `netWorth(hoy)` con `Amount kind="balance"` en grande, dentro de una región (`<section aria-labelledby>`) con el título «Patrimonio» / «Net worth».
- **Localizadores de los e2e** de Inicio: por rol, nombre y región, nunca por posición. El patrimonio se lee en `getByRole('region', { name: 'Patrimonio' })`, y los grupos y cuentas en sus filas, porque SPEC-0009 y SPEC-0020 añaden secciones.
- **Secciones de otras specs**: SPEC-0020 (tarjeta de sincronización) y SPEC-0009 (panel) añaden secciones entre el patrimonio y los grupos.
- **Grupos** que tengan alguna cuenta **no archivada**, ordenados por nombre. Cada uno muestra su total (`groupValue`, que **incluye las cuentas archivadas**, con la nota «incluye archivadas» si las hay) y sus cuentas no archivadas, ordenadas por nombre.
- **Cuentas sin grupo y no archivadas**, por tipo (Corriente, Ahorro, Efectivo, Inversión) y por nombre dentro de cada tipo.
- **Cada fila**: nombre, institución y saldo o valor. Es un enlace a `#/cuentas/:id`.
- **Estado vacío**: «Aún no hay cuentas. Importa tu primer extracto para empezar.», con un botón a `#/importar`.

### 3. Cuentas (`#/cuentas` y `#/cuentas/:id`)
- **Lista**:
  - la misma agrupación que Inicio, pero mostrando también los **grupos vacíos** (con «Sin cuentas»);
  - un interruptor **«Mostrar archivadas»** (las archivadas, atenuadas y con la marca «Archivada»);
  - un botón **«Gestionar grupos»**.
- **Gestionar grupos** (`Dialog`):
  - crear un grupo con nombre;
  - renombrar un grupo;
  - borrar un grupo sin cuentas vivas; si tiene, da `group_not_empty`.
- **Detalle**: nombre, institución, tipo, grupo y saldo o valor.
  - **«Editar cuenta»** (`Dialog`):
    - nombre, institución y grupo;
    - **tipo**: solo entre `checking`, `savings` y `cash`. En el repositorio, pasar a o desde `investment` lanza `account_type_change`, y la interfaz no lo ofrece;
    - **apertura** (fecha e importe), con el aviso «Cambiar la apertura altera todos los saldos de esta cuenta».
  - **«Archivar» / «Desarchivar»**.
  - **«Borrar cuenta»**: habilitado solo si no tiene movimientos ni valoraciones vivos. Si no, explica «Archívala para ocultarla; su historia seguirá contando en tu patrimonio». Pide confirmación.
  - **Últimos 10 movimientos** (solo lectura, `Amount` según su tipo) y un enlace «Ver todos» a `#/movimientos?cuenta=:id`.
  - **Solo en cuentas de inversión**: ISIN, valor (`investmentValue`) y tabla de valoraciones (fecha, participaciones y valor), de solo lectura y más reciente primero.
- **Movimientos en cuentas de inversión**: se admite cualquier movimiento importado, y todos suman a su valor hasta la siguiente valoración (SPEC-0004).

### 4. Repositorios (SPEC-0004, en `src/db/repo/`)
- `getAccount`, `listGroups`, `listAccountsWithValues(db, date, { includeArchived })`.
- `unarchiveAccount` y `updateAccount`, que lanza `account_type_change` según lo descrito.
- **`deleteAccount(db, id)`**:
  - lanza `account_not_empty` si tiene movimientos o valoraciones vivos;
  - si no, marca `deleted_at` en la cuenta **y en todos sus `source_link`**, para que una importación posterior no meta movimientos en una cuenta borrada.
- `renameGroup` y `deleteGroup` (`group_not_empty`).
- `listValuations(db, accountId)` y `listRecentMovements(db, accountId, limit)`.

## Fuera de alcance
- Movimientos: SPEC-0015. Importar: SPEC-0010. Ajustes y datos de ejemplo: SPEC-0016.
- **Alta manual** de cuentas o valoraciones: descartada (solo importación).
- Coordinación entre varias pestañas: se mantiene el aviso de SPEC-0002.
- Nombres de marca de las secciones.

## Criterios de aceptación
Los e2e parten de la seguridad configurada (SPEC-0005) y, salvo indicación, de los datos de ejemplo cargados desde Ajustes (SPEC-0016).

1. **CA-01** · Móvil (375 × 812):
   - hay barra inferior con 4 pestañas con icono y texto, y ningún enlace de sección en `TopBar`;
   - Cuentas lleva a `#/cuentas` con `aria-current="page"`;
   - los objetivos miden ≥ 44 × 44 px;
   - en `#/ajustes` no hay barra inferior.
2. **CA-02** · Escritorio (1280 × 800): no hay barra inferior y las 4 secciones están en `TopBar`.
3. **CA-03** · Transiciones (espía de SPEC-0003):
   - de Inicio a Cuentas, `vt-forward`;
   - de Cuentas al detalle, `vt-forward`;
   - del detalle a Inicio por la pestaña, `vt-back`.
4. **CA-04** · Inicio con datos de ejemplo:
   - patrimonio `11.866,40 €`;
   - el grupo «Cartera Ejemplo», con `4.417,96 €` y sus dos fondos;
   - «Corriente: Cuenta Ejemplo `2.148,44 €`» y «Ahorro: Ahorro Ejemplo `5.300,00 €`».
   - Cubre SPEC-0001 CA-09 (total y desglose).
5. **CA-05** · Inicio sin datos: el estado vacío lleva a la URL `#/importar` (no se comprueba el texto del marcador).
6. **CA-06** · Editar y archivar:
   - renombrar «Cuenta Ejemplo» a «Diario» se refleja en Inicio;
   - archivar «Ahorro Ejemplo» la oculta de Inicio y de la lista (salvo con «Mostrar archivadas»), y el patrimonio sigue en `11.866,40 €`;
   - «Borrar cuenta» está deshabilitado en «Cuenta Ejemplo».
   - Cubre SPEC-0001 CA-01.
7. **CA-07** · Grupos:
   - crear «Bancos» y mover a él «Cuenta Ejemplo» muestra el grupo en Inicio con `2.148,44 €`;
   - borrar «Cartera Ejemplo» da `group_not_empty`;
   - sacar «Cuenta Ejemplo» de «Bancos» y borrar «Bancos» funciona.
8. **CA-08** · Inversión: el detalle de «Fondo Global Ejemplo» muestra el ISIN, el valor `2.450,12 €` y una valoración del `24/10/2026`.
9. **CA-09** · Tipo:
   - «Cuenta Ejemplo» se puede pasar a Ahorro;
   - en un fondo, el selector de tipo no ofrece otras opciones;
   - `updateAccount` con `investment` sobre «Cuenta Ejemplo» da `account_type_change` (Vitest).
10. **CA-10** · `deleteAccount` (Vitest):
    - con un movimiento vivo da `account_not_empty`;
    - en vacío, marca `deleted_at` en la cuenta y en sus `source_link`;
    - tras importar `bbva-informe.xlsx` (SPEC-0011), deshacer el lote y borrar «Diario», un nuevo `read` del fichero **propone crear** «Diario», sin `linkedAccountId`.
11. **CA-11** · No hay scroll horizontal a 375 px en Inicio, Cuentas, el detalle de corriente y de inversión, ni en los diálogos. Cubre SPEC-0001 CA-16 para estas pantallas.
12. **CA-12** · axe sin infracciones en Inicio, Cuentas, detalles y diálogos, en claro y en oscuro.
13. **CA-13** · Los e2e de las specs anteriores pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Rendimiento del cálculo en memoria** con muchos movimientos: suficiente para uso personal; si hace falta, se cachea por cuenta.

### Preguntas abiertas
- Ninguna para el propietario.
