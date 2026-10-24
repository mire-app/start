---
id: SPEC-0019
title: Historial de importaciones y deshacer
status: draft          # draft → approved (solo una persona) → implemented
summary: Lista de importaciones en la pantalla Importar con estado y botón Deshacer, explicando sus efectos y los bloqueos por importaciones posteriores
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [SPEC-0001, SPEC-0006, SPEC-0010, SPEC-0011, SPEC-0012, SPEC-0015, SPEC-0016]
---

# SPEC-0019 · Historial de importaciones y deshacer

## Intención
Ver todas las importaciones hechas y **deshacer** cualquiera de ellas desde la app, de forma segura y entendiendo qué cambia.

## Contexto
- `SPEC-0001` (draft) CA-21: «una importación completa se puede deshacer».
- `SPEC-0011` y `SPEC-0012`: `import.revert(batchId)` y sus errores (`already_reverted`, y `revert_blocked_by_later_batch` con `{ blockingBatchId, blockingDate, blockingFileName }`, donde `blockingDate` es el `created_at` del lote); recuentos del lote; restauración de valoraciones reemplazadas.
- `SPEC-0010`: pantalla Importar y etiquetas de formato (las de SPEC-0015). **Se implementa antes.**
- `SPEC-0016`: los datos de ejemplo usan un lote `demo`, que se gestiona desde Diagnóstico.
- **Decisión del propietario** (2026-10-24): historial en Importar (por defecto) y separado de SPEC-0010.

## Cambio (delta)
### 1. Lista «Importaciones anteriores» (debajo del selector de fichero, en `#/importar`)
- **Contenido**: `history.list` (repositorio `listImportBatches`, nuevo método de la API del worker) devuelve los lotes **no `demo`**, de más reciente a más antiguo, en páginas de 50. Si hay más, aparece **«Cargar más»**.
- **Cada fila**:
  - fecha y hora;
  - formato (etiquetas de SPEC-0015) y nombre del fichero;
  - número importado (`imported_count`): «N movimientos» o «N valoraciones», según el formato;
  - estado: «Activa» o «Deshecha (dd/mm/aaaa)».
- **Estado vacío**: «Aún no has importado nada».

### 2. Deshacer
- **Botón «Deshacer»**: solo en las activas. Abre un diálogo con los efectos concretos del lote (`history.impact(batchId)`):
  - «Se borrarán N movimientos y V valoraciones»;
  - «T traspasos con otras importaciones se desvincularán»;
  - «Se restaurarán R valoraciones que esta importación reemplazó»;
  - «Las cuentas creadas, las plantillas y la asociación del fichero con sus cuentas se mantienen»;
  - si el lote tiene movimientos: «Incluye los cambios que hiciste en ellos».
- **Traspasos con otras importaciones**: grupos de traspaso con un movimiento del lote y el otro **fuera** del lote. Los traspasos con los dos lados dentro del lote desaparecen con él y no se cuentan.
- **Confirmar** llama a `import.revert`. Al terminar, la lista se refresca y aparece el aviso «Importación deshecha».
- **Errores**:
  - `revert_blocked_by_later_batch`: «Primero deshaz «<blockingFileName>», importado el dd/mm/aaaa a las hh:mm, que reemplazó valoraciones de esta», con un enlace **«Ir a esa importación»** que desplaza la lista hasta esa fila (cargando más páginas si hace falta) y le da el foco;
  - `already_reverted` (estado desfasado, p. ej. desde otra pestaña): «Esta importación ya estaba deshecha», y se refresca la lista;
  - cualquier otro código: «No se pudo deshacer. No se ha cambiado nada».
- **Textos**: todos tienen clave en `es.json` y `en.json`.

### 3. API del worker
- `history.list({ offset })` → `{ rows: { id, createdAt, source, fileName, importedCount, kind: 'movements' | 'valuations', revertedAt }[], total }`. `kind` es `valuations` si `source = 'myinvestor_pdf'`.
- `history.impact(batchId)` → `{ movements, valuations, transfersToUnlink, valuationsToRestore }`.

## Fuera de alcance
- Deshacer parcial (solo algunas filas de un lote).
- Volver a aplicar una importación deshecha: se reimporta el fichero.

## Criterios de aceptación
1. **CA-01** · Historial vacío y datos de ejemplo (e2e):
   - en un contexto nuevo con la seguridad configurada, Importar muestra «Aún no has importado nada»;
   - tras cargar los datos de ejemplo (SPEC-0016) la lista sigue vacía;
   - tras quitarlos, se continúa en el mismo contexto.
2. **CA-02** · Deshacer BBVA (e2e, a continuación):
   - se importa BBVA con el traspaso interno de las filas 2 y 3 activado, y después MyInvestor con el traspaso de 500 € activado (SPEC-0010); la lista muestra 2 importaciones activas;
   - el diálogo de BBVA dice «Se borrarán 9 movimientos», «1 traspaso con otras importaciones se desvinculará» (el interno no cuenta) e «Incluye los cambios que hiciste en ellos»;
   - al confirmar, BBVA aparece «Deshecha», «Diario» vale `0,00 €` y el movimiento de +500 de MyInvestor ya no es un traspaso (Movimientos, SPEC-0015);
   - la fila deshecha no ofrece «Deshacer».
   - Cubre SPEC-0001 CA-21 (deshacer).
3. **CA-03** · Bloqueo por orden (e2e):
   - tras importar `myinvestor-extracto.pdf`, después `-v2.pdf` con «Reemplazar» y luego `-v3.pdf` con «Reemplazar» (siempre en LU0000000001), deshacer v2 muestra el mensaje con «myinvestor-extracto-v3.pdf»;
   - «Ir a esa importación» deja el foco en la fila de `myinvestor-extracto-v3.pdf`;
   - deshacer v3 deja el grupo en `5.980,19 €`, y después deshacer v2 lo deja en `5.930,31 €`.
4. **CA-04** · Paginación (Vitest de componente con `history.list` simulado y 51 lotes): se muestran 50 y «Cargar más»; al pulsarlo aparece el 51.º y desaparece el botón.
5. **CA-05** · `history.impact` (Vitest) devuelve los recuentos correctos para un lote de movimientos con un traspaso externo y para un lote de PDF con 1 reemplazo.
6. **CA-06** · Errores (Vitest de componente): si `import.revert` devuelve `already_reverted`, se muestra el mensaje y se vuelve a pedir `history.list`; con un código desconocido se muestra el mensaje genérico.
7. **CA-07** · axe sin infracciones en la lista y el diálogo (claro y oscuro); sin scroll horizontal a 375 px.
8. **CA-08** · Los textos de esta spec tienen clave en `es.json` y `en.json` (test de paridad `src/i18n/keys.test.ts` de SPEC-0010), y en inglés el diálogo muestra «Undo import».
9. **CA-09** · Los e2e de todas las specs anteriores pasan sin modificarse, y `.arda/checks.sh` sigue por debajo de 5 minutos.

## Riesgos y preguntas abiertas
### Riesgos
- **Deshacer con ediciones posteriores**: si se editaron movimientos del lote (SPEC-0015), al deshacer se borran igualmente; el diálogo lo avisa.

### Preguntas abiertas
- Ninguna para el propietario.
