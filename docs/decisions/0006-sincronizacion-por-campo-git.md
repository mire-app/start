---
id: ADR-0006
title: Sincronización por campo con reloj híbrido sobre la API Git de GitHub
status: proposed       # proposed → accepted (solo una persona) → superseded
summary: Registro de cambios por campo y por grupos atómicos capturado con triggers, fusión «gana el último» con reloj lógico híbrido en un ciclo transaccional con reparaciones deterministas, ficheros cifrados por dispositivo en el repositorio privado mediante la API Git (arranque con Contents) y compactación con instantáneas
---

# ADR-0006 · Sincronización por campo con reloj híbrido sobre la API Git de GitHub

## Contexto
- ADR-0001 fija el modelo: base local en cada dispositivo y copia maestra **cifrada** en un repositorio privado de GitHub, sincronizada cada 5 minutos.
- ADR-0002 eligió un **registro de operaciones propio** frente a librerías de sincronización.
- SPEC-0001 CA-13 exige que los cambios concurrentes **no pierdan datos sin aviso**.
- **Decisiones del propietario** (2026-10-24):
  - conflictos **por campo, gana el último**, sin pantalla de conflictos;
  - importaciones duplicadas entre dispositivos: **detectar y avisar**;
  - **un solo token** de grano fino, con *Contents* sobre el repositorio de datos;
  - alta guiada **sin servidor**;
  - segundo dispositivo por **QR de vinculación**.
- **Restricciones**:
  - la app es estática (GitHub Pages), sin servidor propio;
  - `api.github.com` admite CORS, pero los *endpoints* OAuth de `github.com` no;
  - la API Git no escribe en un repositorio sin commits;
  - la API Contents lee hasta 1 MB por fichero y la API Git lee *blobs* de hasta 100 MB.

## Decisión
1. **Captura por campo**:
   - *triggers* `TEMP` de SQLite, generados desde una lista verificada de tablas sincronizadas, registran los campos que cambian en una cola local y su reloj, en la misma transacción que el cambio;
   - los campos que un `CHECK` relaciona forman **grupos atómicos** (p. ej. `kind`, `transfer_group_id` e importe del movimiento): se capturan y se fusionan juntos;
   - no hay migración nueva: las tablas locales de sincronización están en el esquema inicial (SPEC-0004).
2. **Reloj lógico híbrido (HLC)**:
   - comparable como texto;
   - un único HLC por llamada que escribe;
   - se rechaza un reloj remoto adelantado más de 24 h;
   - lo sembrado usa un reloj fijo menor que cualquier cambio real.
3. **Fusión «gana el último» por grupo**:
   - un ciclo de descarga se valida entero y se aplica en **una transacción**, con las claves ajenas diferidas y las tablas en orden de dependencias;
   - los borrados son el campo `deleted_at` y siguen la misma regla.
4. **Reparaciones deterministas tras fusionar**, con el mismo resultado en todos los dispositivos y un aviso local:
   - `UNIQUE`: gana la fila creada antes;
   - profundidad de categorías: se deshace el enlace más reciente;
   - valoraciones en una cuenta que no es de inversión: la cuenta vuelve a ser de inversión;
   - traspasos inválidos: se desvinculan.

   Los *triggers* de validación de varias filas no actúan durante la fusión; las reparaciones los sustituyen.
5. **Formato remoto**:
   - en claro, solo `format.json` (sin datos) y `keyring.json` (claves envueltas, ADR-0005);
   - todo lo demás son ficheros cifrados con la DEK (AES-GCM, la ruta como AAD), comprimidos antes de cifrar y con versión de esquema;
   - rutas sin datos personales.
6. **Transporte**:
   - **arranque** con un primer commit por la API Contents en un repositorio vacío;
   - **resto** por la API Git (*blobs*, *trees*, *commits* y *refs*), con **un commit por ciclo** y el mensaje fijo `mire sync`;
   - la rama se actualiza sin forzar; si avanzó, se descarga y se reintenta.
7. **Compactación**: con más de 500 ficheros de operaciones o 5 MB, un dispositivo, como mucho una vez al día, escribe una instantánea completa (con los relojes). En el mismo commit borra los ficheros que **estaban aplicados al leer el árbol** de esa instantánea. La historia de git conserva lo borrado, siempre cifrado.

## Alternativas consideradas
| Alternativa | Por qué no |
|---|---|
| Copia completa de la base cifrada en cada sincronización | Pierde los cambios concurrentes de otro dispositivo (el último fichero gana entero) y sube toda la base cada vez. |
| Fusión por fila | Más simple, pero pierde sin avisar un cambio de otro campo (choca con CA-13). Descartada por el propietario. |
| CRDT genérico (Automerge, Yjs) o cr-sqlite | Dependencia grande para un modelo relacional pequeño. cr-sqlite no tiene una compilación mantenida para `@sqlite.org/sqlite-wasm` con `opfs-sahpool`. Los invariantes de varias filas habría que resolverlos igualmente. |
| Captura en los repositorios (sin *triggers*) | Es fácil olvidar una escritura. Los *triggers* generados desde una lista verificada por test no dependen de cada repositorio. |
| Solo API Contents | Un commit por fichero, límite de 1 MB al leer y sin commits atómicos de varios ficheros, que hacen falta para compactar. |
| OAuth con un servidor intermedio gratuito | El token pasaría por un tercero y habría infraestructura que mantener. Descartado por el propietario. |

## Consecuencias
- **+** Funciona sin servidor y sin coste. Los cambios concurrentes de campos distintos se conservan, y los del mismo campo se resuelven igual en todos los dispositivos.
- **+** GitHub solo ve ficheros cifrados, rutas con identificadores aleatorios y un mensaje fijo (CA-12).
- **−** «Gana el último» puede sustituir sin preguntar el cambio de otro dispositivo en el **mismo campo** o en el mismo grupo. Lo aceptó el propietario.
- **−** Un dispositivo con la hora adelantada (menos de 24 h) gana esos conflictos. El HLC lo atenúa, pero no lo elimina.
- **−** Un dispositivo con una versión de esquema más antigua no aplica lotes más nuevos hasta actualizarse (`update_required`). No los descarta.
- **−** Las tablas sincronizadas, sus columnas y sus grupos deben estar en la lista. Un test falla si una tabla nueva no lo está.
- **−** Hay que verificar en la implementación los límites vigentes de la API de GitHub (ADR-0002), el comportamiento con repositorios vacíos y que *Contents* baste para la API Git con un token de grano fino.
