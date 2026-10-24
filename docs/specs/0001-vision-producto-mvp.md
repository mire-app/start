---
id: SPEC-0001
title: Visión de producto y MVP
status: draft          # draft → approved (solo una persona) → implemented
summary: Visión TO-BE de Míre, alcance del MVP individual local-first con sincronización cifrada en GitHub, y fases posteriores
test_changes: none     # none | allowed (solo si hay que cambiar tests existentes; justificarlo)
refs: [ADR-0001, ADR-0004]       # IDs de specs y ADR relacionados
---

# SPEC-0001 · Visión de producto y MVP

## Intención
Fijar **qué es Míre y qué hace su primera versión utilizable (MVP)**, para que las specs siguientes (stack, diseño, modelo de datos, seguridad y funcionalidades) partan de un alcance cerrado y acordado.

**Visión.** Míre (en quenya, «joya» o «valor preciado»; identidad completa en SPEC-0003) es una aplicación de finanzas personales (y, más adelante, familiares) cuyo valor principal es la **vista global**: ver en un solo sitio todo el patrimonio y su evolución, a partir de **extractos importados** (sin alta manual), sin conexiones bancarias y con los datos bajo control exclusivo de su propietario.

**Problema que resuelve el MVP.** Hoy el propietario no tiene una visión consolidada de su patrimonio (cuentas en distintas entidades, efectivo e inversiones). El MVP debe dársela sin depender de otra herramienta.

## Contexto
- `docs/project-context.md`: producto, marca, restricciones (Claude Pro, RGPD, sin PSD2) y backlog.
- `ADR-0001` (`docs/decisions/0001-almacenamiento-local-first-github-cifrado.md`): estrategia de almacenamiento y sincronización (accepted el 2026-10-24).
- Renombrado NÖM → Míre (2026-10-24): la spec volvió a draft para cambiar el nombre, sin cambio de alcance. Identidad completa en SPEC-0003 y `docs/brand.md`.
- Ampliación de la importación (2026-10-24), tras ver los extractos reales anonimizados:
  - informe BBVA `.xlsx` con varias cuentas;
  - cartera de MyInvestor en PDF;
  - aportación externa (CA-20);
  - comprobación de saldo y deshacer (CA-21);
  - grupos de cuentas;
  - sin `.xls`;
  - reparto en SPEC-0004, SPEC-0011, SPEC-0012, SPEC-0010, SPEC-0017 y SPEC-0019.

  El propietario reabrió la spec para ello.
- Solo importación (2026-10-24): los movimientos, las cuentas y las valoraciones solo entran importando; no hay alta manual (funciones 1, 2 y 6, CA-01 y CA-02).
- Proyecto greenfield: no hay código ni specs previas. Stack sin decidir (lo decidirá SPEC-0002 con ADR-0002).
- Requisitos recogidos con el propietario en la sesión de Analizar y Refinar del 2026-10-24.

## Cambio (delta)
Esta spec **no produce código**: define el alcance TO-BE. Su implementación se reparte en las specs de la tabla «Trazabilidad». Se marcará `implemented` cuando el propietario valide el criterio de éxito (CA-19).

Cambios documentales que acompañan a esta spec:
- Nuevo `ADR-0001` (`status: proposed`).
- `docs/project-context.md`: se añade en «Current state» la línea «Storage (ADR-0001, proposed)…»; el backlog pasa a decir «SPEC-0002 — … (with ADR-0002)» y se añaden las specs de funcionalidad SPEC-0006 a SPEC-0009.

### Usuarios y uso
- **Un único usuario** en el MVP: el propietario. Sin registro público ni invitaciones.
- Visión futura (fuera del MVP): **hogar** con roles *administrador + miembros*. El modelo de datos del MVP no debe impedir añadirlo después.

### Plataforma, idioma y moneda
- **Web responsive**: usable en ordenador y en móvil desde el navegador.
- Interfaz en **español e inglés** desde el MVP; formato de números y fechas es-ES por defecto (`1.234,56 €`, `24/10/2026`).
- **Solo EUR**.

### Funciones del MVP (fase 1)
1. **Cuentas** de tipo **corriente, ahorro, efectivo e inversión**, con saldo inicial y fecha.
   - **Se crean al importar** (decisión del 2026-10-24: solo importación). Se pueden editar, agrupar y archivar, y borrar solo si están vacías.
   - Corriente, ahorro y efectivo: saldo = saldo inicial + movimientos.
   - Inversión: valor = última valoración registrada (función 6) + aportaciones − retiradas posteriores a esa valoración.
   - Una cuenta archivada se oculta de las listas, pero su histórico sigue contando en la evolución del patrimonio.
   - Las cuentas se pueden agrupar (p. ej. «Cartera MyInvestor» con un fondo por cuenta) para ver el valor de cada una y el del grupo completo.
2. **Movimientos**: **entran solo por importación** (sin alta manual). Se pueden **editar** (concepto, nota y categoría libremente; importe, fecha y cuenta con aviso) y **borrar**.
3. **Traspasos entre cuentas**: un traspaso enlaza la salida de una cuenta con la entrada en otra, de cualquier tipo; **no cuenta como ingreso ni gasto**. Un traspaso hacia o desde una cuenta de inversión es una aportación o retirada: suma o resta a su valor hasta la siguiente valoración, que lo ajusta a la realidad. Al importar, un movimiento se puede marcar como traspaso y emparejar con su contrapartida (si existe) para no duplicarlo.
   - **Aportación externa**: una entrada de dinero desde una cuenta que no está en Míre (p. ej. el banco anterior) se puede marcar como aportación externa: suma al patrimonio pero **no cuenta como ingreso**.
4. **Importación CSV, Excel (`.xlsx`) y PDF**:
   - Formatos predefinidos:
     - **BBVA**: «Informe de gastos, ingresos y movimientos…» (`.xlsx`), que puede traer **varias cuentas** en un fichero; cada producto se asocia a una cuenta de Míre.
     - **MyInvestor**: movimientos de la cuenta de efectivo (`.xlsx`) y **cartera** desde el extracto **PDF** (tabla «Posiciones»), que actualiza la valoración de cada fondo o plan.
   - Para otros bancos: **mapeo de columnas** manual de CSV o `.xlsx` (fecha, concepto, importe…) que se puede guardar como plantilla reutilizable.
   - **Previsualización** antes de confirmar, **detección de duplicados** (marcados para que el usuario decida), **sugerencia de traspasos** entre cuentas propias, **deshacer una importación completa** y **comprobación de saldo** (con el saldo del fichero o el que indique el usuario).
   - Las categorías que traiga el banco (BBVA) se usan como **sugerencia** mediante una tabla de equivalencias editable.
5. **Categorías y reglas**:
   - Categorías de **dos niveles** (categoría › subcategoría), con una **lista inicial predefinida** que el usuario puede editar.
   - Reglas automáticas por texto del concepto (p. ej. «MERCADONA» → Compras › Alimentación) que se aplican al importar y pueden aplicarse a movimientos existentes.
6. **Inversiones (solo valor)**: el valor de cada cuenta de inversión se actualiza importando la cartera de MyInvestor (sin valoración manual); se guarda el histórico de valoraciones. Sin operaciones de compra/venta.
7. **Panel**:
   - **Patrimonio** total (cuentas + efectivo + inversiones), desglose por cuenta y tipo, y evolución mensual.
   - **Resumen mensual** de ingresos y gastos por categoría (sin traspasos).

### Almacenamiento y sincronización (ver ADR-0001)
- **Local-first**: la app trabaja contra una base de datos local en cada dispositivo y funciona **sin conexión**.
- **Copia maestra** en un **repositorio privado de GitHub separado** del código (`mire-app/start`). Nombre y propietario del repositorio: SPEC-0014 (`mire-datos`, en la cuenta personal).
- Los datos se **cifran en el dispositivo** antes de salir de él (ver CA-12 para el alcance exacto).
- Las credenciales e integraciones de GitHub que usa Claude Code **no deben tener permisos** sobre el repositorio de datos (se concreta y verifica en SPEC-0014).
- **Varios dispositivos** (ordenador y móvil), cada uno con su copia local; los cambios se fusionan.
- Sincronización **cada 5 minutos si hay cambios pendientes**, bajo demanda con un botón **«sincronizar ahora»**, y al ocultar o cerrar la app en la medida en que el navegador lo permita.

### Coste
- **0 €**: todos los servicios usados en el MVP (alojamiento de la web incluido) deben ser gratuitos.

### Fases posteriores (orientativas, cada una con su spec)
- **Fase 2**: presupuestos, gastos recurrentes, objetivos de ahorro.
- **Fase 3**: previsión de futuro (proyección de saldo y ahorro).
- **Futuro sin fase**: hogar con roles, inmuebles y bienes, deudas, tarjetas de crédito, fiscalidad, app móvil nativa.

### Trazabilidad (provisional; los números de SPEC-0006 en adelante pueden cambiar)
| Spec | Ámbito | CA de esta spec |
|---|---|---|
| SPEC-0002 + ADR-0002 | Stack, alojamiento, i18n, librería de sincronización y cifrado, `.arda/checks.sh` | CA-15, CA-17 |
| SPEC-0003 | Sistema de diseño | CA-16 |
| SPEC-0004 | Modelo de datos, base de datos y dominio (sin pantallas) | CA-01, CA-03, CA-20 (lógica de cálculo) |
| SPEC-0011 + ADR-0004 | Motores de importación xlsx/CSV: BBVA, MyInvestor movimientos, genérico; duplicados, traspasos, saldo, deshacer (sin pantallas) | CA-04, CA-05 (movimientos), CA-06, CA-07, CA-21 (lógica) |
| SPEC-0012 | Lector del PDF de cartera de MyInvestor y comprobación local de ficheros reales | CA-05 (cartera, lógica) |
| SPEC-0005 + ADR-0005 | Seguridad: cifrado, claves, desbloqueo, autobloqueo y token | CA-12 (primitivas de cifrado) |
| SPEC-0014 | Seguridad: recuperación, ajustes, CSP y repositorio de datos | CA-14 |
| SPEC-0013 | Privacidad: exportación, borrado y aviso | CA-22 |
| SPEC-0016 | Rutas, Ajustes, Diagnóstico y datos de ejemplo | CA-15 (idioma en Ajustes), CA-16 |
| SPEC-0006 | Navegación, Inicio, cuentas, grupos e inversiones | CA-01, CA-09 (patrimonio y desglose), CA-16 |
| SPEC-0015 | Movimientos: lista, filtros, edición, traspasos y aportación externa | CA-02, CA-03, CA-20 (pantallas) |
| SPEC-0007 | Categorías: lista inicial, gestión y recategorización | CA-08 (categorías) |
| SPEC-0018 | Reglas «el concepto contiene X → categoría Y» | CA-08 (reglas) |
| SPEC-0008 | Sincronización local-first (diseño de fusión y conflictos) | CA-11, CA-13 |
| SPEC-0009 | Panel | CA-09, CA-10 |
| SPEC-0010 | Asistente de importación para BBVA y MyInvestor (pantallas) | CA-04, CA-05, CA-07, CA-20, CA-21 (comprobación de saldo, de extremo a extremo), CA-11 (importar sin conexión), CA-16 |
| SPEC-0019 | Historial de importaciones y deshacer (pantallas) | CA-21 (deshacer, de extremo a extremo), CA-16 |
| SPEC-0017 | Mapeo de columnas y plantillas para otros bancos (pantallas) | CA-06 (de extremo a extremo), CA-16 |
| SPEC-0002 … SPEC-0019 | Cada spec, al refinarse | CA-18 (incremental; se cierra con la última) |

## Fuera de alcance
- Conexión bancaria de cualquier tipo (PSD2, agregadores). **Descartado del producto.**
- Gestión de cartera: compra/venta, plusvalías, cotizaciones en vivo. **Descartado del producto.**
- En el MVP (candidatos a futuro): fiscalidad, app móvil nativa, inmuebles y bienes, deudas y tarjetas de crédito (el propietario solo usa débito), multimoneda, varios usuarios u hogar, presupuestos, gastos recurrentes, objetivos de ahorro y previsión.
- Elegir tecnología concreta (lenguaje, framework, base de datos local, librería de cifrado, alojamiento): SPEC-0002.
- Paleta, tipografía y componentes: SPEC-0003.
- Esquema de datos: SPEC-0004. Detalle de formatos de importación: SPEC-0011 y SPEC-0012. Pantallas de importación: SPEC-0010, SPEC-0017 (mapeo) y SPEC-0019 (historial).
- Ficheros Excel antiguos (`.xls`): no se leen; se guardan antes como `.xlsx` (decisión del propietario, ADR-0004).
- Custodia de claves y token de GitHub: SPEC-0005. Recuperación, CSP y repositorio de datos: SPEC-0014. Exportación, borrado y aviso de privacidad: SPEC-0013.

## Criterios de aceptación
Criterios del MVP. CA-01 a CA-18 y CA-20 a CA-22 se verifican en la spec responsable (tabla «Trazabilidad»); CA-19 lo valida el propietario.
1. **CA-01** · Las cuentas de tipo corriente, ahorro, efectivo e inversión se crean al importar, y se pueden editar, agrupar, archivar y borrar si están vacías. En corriente, ahorro y efectivo, saldo = saldo inicial + movimientos; en inversión, valor = última valoración + aportaciones − retiradas posteriores.
2. **CA-02** · Los movimientos importados se pueden editar (concepto, nota y categoría; importe, fecha y cuenta con aviso) y borrar. No hay alta manual.
3. **CA-03** · Un traspaso entre dos cuentas de cualquier tipo (incluida una de inversión) mantiene el patrimonio total sin cambios y no se registra como ingreso ni gasto.
4. **CA-04** · Un informe sintético con el formato de BBVA y dos productos se importa sin mapeo manual de columnas, y los movimientos de cada producto aparecen en la cuenta de Míre asociada.
5. **CA-05** · Un fichero sintético de movimientos de MyInvestor se importa en su cuenta de efectivo, y un extracto PDF sintético con su tabla «Posiciones» actualiza la valoración de cada cuenta de inversión (un fondo por cuenta) y del grupo.
6. **CA-06** · Un CSV o `.xlsx` de un banco sin formato predefinido se importa mediante mapeo de columnas, y el mapeo se puede guardar y reutilizar.
7. **CA-07** · Antes de confirmar una importación se muestra una previsualización; reimportar el mismo fichero no crea movimientos duplicados; un traspaso importado en ambas cuentas se puede emparejar y no se duplica.
8. **CA-08** · Existe una lista predefinida de categorías de dos niveles, editable; una regla por texto del concepto categoriza automáticamente los movimientos importados que coinciden.
9. **CA-09** · El panel muestra el patrimonio total como suma de saldos de cuentas, efectivo y valor de las cuentas de inversión según CA-01, con desglose por cuenta y tipo y evolución mensual.
10. **CA-10** · El panel muestra el resumen mensual de ingresos y gastos por categoría, excluyendo traspasos y aportaciones externas.
11. **CA-11** · La app funciona sin conexión: con la red cortada se pueden importar y editar datos, y se sincronizan al recuperarla.
12. **CA-12** · En el repositorio de datos de GitHub no aparece en claro ningún importe, concepto, nombre de cuenta ni categoría, ni en el contenido ni en nombres de fichero ni en mensajes de commit. Los metadatos inevitables (tamaño, fechas y frecuencia de commits) quedan fuera de esta garantía.
13. **CA-13** · Con cambios pendientes, la sincronización ocurre en ≤ 5 minutos y al pulsar «sincronizar ahora». Un cambio hecho en un dispositivo aparece en otro tras sincronizar ambos; los cambios concurrentes en dispositivos distintos no hacen perder datos sin aviso.
14. **CA-14** · Las credenciales e integraciones de GitHub usadas por Claude Code no tienen permisos (ni de lectura ni de escritura) sobre el repositorio de datos.
15. **CA-15** · La interfaz se puede cambiar entre español e inglés; importes y fechas se muestran en formato es-ES por defecto.
16. **CA-16** · Las pantallas del MVP se pueden usar en un móvil (≈ 375 px de ancho) sin scroll horizontal.
17. **CA-17** · Ningún servicio usado en el MVP, alojamiento de la web incluido, tiene coste.
18. **CA-18** · Cada spec de SPEC-0002 a SPEC-0019 lista `SPEC-0001` en `refs`, y su sección «Fuera de alcance» no incluye nada que esta spec ponga dentro del MVP.
19. **CA-19** · **Criterio de éxito** (lo valida el propietario): usa Míre durante un mes real, importa y categoriza todas sus cuentas y consulta su patrimonio sin necesitar otra herramienta.
20. **CA-20** · Un movimiento marcado como aportación externa suma al patrimonio y no aparece como ingreso.
21. **CA-21** · Tras importar, si el fichero trae saldo (MyInvestor) o el usuario indica el saldo real (BBVA), Míre muestra la diferencia con el saldo calculado cuando no coinciden; una importación completa se puede deshacer.
22. **CA-22** · El propietario puede exportar todos sus datos en un formato legible y borrar todos los datos de un dispositivo; la guía explica cómo eliminar la copia remota.

## Riesgos y preguntas abiertas
### Riesgos
- **Sincronización multidispositivo**: fusionar cambios y resolver conflictos es la parte más compleja del MVP. Mitigación: la librería se elige en SPEC-0002 y el diseño de fusión y conflictos se hace en SPEC-0008 (p. ej. registro de operaciones en lugar de copias completas).
- **Sincronización al cerrar**: en web, y sobre todo en móvil, el navegador no garantiza ejecutar código al cerrar. Mitigación: la garantía real es el intervalo de 5 min y el botón; cómo se verifica se concreta en SPEC-0008.
- **Pérdida de la clave de cifrado**: los datos serían irrecuperables. Mitigación: copia de seguridad de la clave (SPEC-0005).
- **Token de GitHub en el navegador**: si se filtra, da acceso al repositorio de datos (cifrados). Mitigación: token cifrado (SPEC-0005) con permisos mínimos sobre un solo repositorio (SPEC-0014).
- **Acceso de Claude Code al repositorio de datos**: depende de los permisos de sus tokens y apps de GitHub; se verifica con CA-14.
- **Coste del alojamiento de la web**: algunas opciones gratuitas (p. ej. GitHub Pages) exigen repositorio público o plan de pago. Se resuelve en SPEC-0002 (CA-17).
- **Crecimiento del repositorio y ruido de commits** con sincronización cada 5 min. Mitigación: subir solo con cambios, agrupar y compactar.
- **Uso de GitHub como almacén de datos**: depende de las condiciones del plan gratuito y de los límites de la API; se verifica en SPEC-0002.
- **Formatos de banco cambiantes**: BBVA o MyInvestor pueden cambiar sus extractos. Mitigación: el mapeo manual (CA-06) sirve de respaldo.
- **Datos reales en desarrollo**: prohibido. Los formatos de BBVA y MyInvestor se construyen con extractos de muestra anonimizados o sintéticos (SPEC-0011 y SPEC-0012).
- **Alcance vs. plan Claude Pro**: siete funciones más la sincronización cifrada es mucho trabajo; por eso se trocea en las specs de la tabla «Trazabilidad».

### Preguntas abiertas (para specs posteriores)
- Autenticación con GitHub desde web y móvil: SPEC-0002. Estrategia de conflictos (último cambio gana o preguntar): SPEC-0008.
- Alojamiento gratuito de la web: SPEC-0002.
- Resuelto en SPEC-0006: en una cuenta de inversión se admite cualquier movimiento importado, que suma a su valor hasta la siguiente valoración.
- Contenido de la lista inicial de categorías: SPEC-0007.
- Resuelto (2026-10-24):
  - custodia de la clave y desbloqueo en SPEC-0005;
  - recuperación, ajustes y repositorio `mire-datos` en SPEC-0014;
  - exportación, borrado local y aviso de privacidad en SPEC-0013;
  - borrado remoto efectivo: eliminar el repositorio `mire-datos` (guía en SPEC-0014), con aviso a otros dispositivos en SPEC-0008.
