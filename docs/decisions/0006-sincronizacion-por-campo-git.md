---
id: ADR-0006
title: Sincronización por campo con reloj híbrido sobre la API Git de GitHub
status: proposed       # proposed → accepted (solo una persona) → superseded
summary: Registro de cambios por campo capturado con triggers, fusión «gana el último» con reloj lógico híbrido, ficheros cifrados por dispositivo en el repositorio privado mediante la API Git (un commit por ciclo) y compactación con instantáneas
---

# ADR-0006 · Sincronización por campo con reloj híbrido sobre la API Git de GitHub

## Contexto
- ADR-0001 fija el modelo: base local en cada dispositivo y copia maestra **cifrada** en un repositorio privado de GitHub, sincronizada cada 5 minutos.
- ADR-0002 eligió un **registro de operaciones propio** frente a librerías de sincronización.
- SPEC-0001 CA-13 exige que los cambios concurrentes **no pierdan datos sin aviso**.
- **Decisiones del propietario** (2026-10-24):
  - conflictos **por campo, gana el último**, sin pantalla de conflictos;
  - importaciones duplicadas entre dispositivos: **detectar y avisar**;
  - **un solo token** de grano fino, con el permiso *Contents* sobre el repositorio de datos;
  - alta guiada **sin servidor**;
  - segundo dispositivo por **QR de vinculación**.
- **Restricciones**:
  - la app es estática (GitHub Pages), sin servidor propio;
  - `api.github.com` admite CORS, pero los *endpoints* OAuth de `github.com` no;
  - la API Contents lee hasta 1 MB por fichero, y la API Git lee *blobs* de hasta 100 MB.

## Decisión
1. **Captura por campo**:
   - *triggers* `TEMP` de SQLite, generados desde una lista de tablas sincronizadas, registran cada campo que cambia en una cola local (`sync_outbox`) y su reloj en `sync_clock`, en la misma transacción que el cambio;
   - no hay migración nueva: las tablas locales de sincronización están en el esquema inicial (SPEC-0004) y los *triggers* se crean al abrir la base.
2. **Reloj lógico híbrido (HLC)**:
   - forma `"<ms, 13 dígitos>-<contador, 4 hex>-<id de dispositivo>"`, comparable como texto;
   - cada llamada que escribe en el worker usa un único HLC.
3. **Fusión «gana el último» por campo**:
   - un campo remoto se aplica si su HLC es mayor que el local;
   - los borrados son el campo `deleted_at` y siguen la misma regla;
   - es conmutativa e idempotente, así que el orden de llegada no importa.
4. **Invariantes tras fusionar**, con reglas deterministas iguales en todos los dispositivos y un aviso local:
   - `UNIQUE`: gana la fila creada antes;
   - una fila mezclada que rompe un `CHECK` o *trigger* se toma entera de la versión más reciente;
   - los traspasos que dejan de ser válidos se desvinculan.
5. **Formato remoto**:
   - en claro, solo `format.json` (sin datos) y `keyring.json` (claves envueltas, ADR-0005);
   - todo lo demás son ficheros binarios cifrados con la DEK (AES-GCM, la ruta como AAD), comprimidos antes de cifrar;
   - rutas sin datos personales: `ops/<dispositivo>/<secuencia>.bin`, `snapshots/<hlc>/part-NNNN.bin` y `devices/<dispositivo>.bin`.
6. **Transporte**:
   - API Git de GitHub (*blobs*, *trees*, *commits* y *refs*): **un commit por ciclo**, con el mensaje fijo `mire sync`;
   - actualización de la rama sin forzar; si la rama avanzó, se descarga y se reintenta.
7. **Compactación**: con más de 500 ficheros de operaciones o 5 MB, un dispositivo al día escribe una instantánea completa (con los relojes) y borra en el mismo commit los ficheros que cubre. La historia de git conserva lo borrado, siempre cifrado.

## Alternativas consideradas
| Alternativa | Por qué no |
|---|---|
| Copia completa de la base cifrada en cada sincronización | Pierde cambios concurrentes de otro dispositivo (último fichero gana entero) y sube toda la base cada vez. |
| Fusión por fila | Más simple, pero pierde un cambio de otro campo sin avisar (choca con CA-13). Descartada por el propietario. |
| CRDT genérico (Automerge, Yjs) o cr-sqlite | Dependencia grande para un modelo relacional pequeño. cr-sqlite no tiene una compilación mantenida para `@sqlite.org/sqlite-wasm` con `opfs-sahpool`. Los invariantes (traspasos, `UNIQUE`) habría que resolverlos igualmente. |
| Captura en los repositorios (sin *triggers*) | Fácil olvidar una escritura. Los *triggers* generados desde una lista verificada por test no dependen de cada repositorio. |
| API Contents (un fichero por petición) | Un commit por fichero, límite de 1 MB al leer y sin commits atómicos de varios ficheros (necesarios para compactar). |
| OAuth con un servidor intermedio gratuito | El token pasaría por un tercero y habría infraestructura que mantener. Descartado por el propietario. |

## Consecuencias
- **+** Funciona sin servidor y sin coste. Los cambios concurrentes de campos distintos se conservan, y los del mismo campo se resuelven igual en todos los dispositivos.
- **+** GitHub solo ve ficheros cifrados, rutas con identificadores aleatorios y un mensaje fijo (CA-12).
- **−** «Gana el último» puede sustituir el cambio de otro dispositivo en el **mismo campo** sin preguntar. Lo aceptó el propietario.
- **−** Relojes de dispositivo muy desajustados pueden decidir mal el «último». El HLC lo atenúa, pero no lo elimina.
- **−** Las tablas sincronizadas y sus columnas deben estar en la lista. Un test falla si una tabla nueva no lo está.
- **−** Hay que verificar en la implementación los límites vigentes de la API de GitHub (ADR-0002) y su comportamiento con tokens de grano fino.
