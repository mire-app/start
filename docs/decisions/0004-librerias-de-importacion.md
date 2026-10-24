---
id: ADR-0004
title: Librerías de importación (ExcelJS, PapaParse, pdf.js) e identificadores UUIDv7
status: accepted       # proposed → accepted (solo una persona) → superseded
summary: .xlsx con ExcelJS (sin .xls), CSV con PapaParse, PDF con pdfjs-dist, todo en el navegador y cargado bajo demanda; ids UUIDv7, importes en céntimos y huellas SHA-256 con WebCrypto
---

# ADR-0004 · Librerías de importación (ExcelJS, PapaParse, pdf.js) e identificadores UUIDv7

## Contexto
SPEC-0011 y SPEC-0012 leen los extractos del propietario **en su navegador, sin enviarlos a ningún servidor**:
- BBVA: informe en `.xlsx`, que puede traer varias cuentas;
- MyInvestor: movimientos en `.xlsx` y cartera **solo en PDF**;
- otros bancos: CSV o `.xlsx` con mapeo manual.

Los datos se sincronizan entre dispositivos (ADR-0001), así que los identificadores deben generarse en cada dispositivo sin colisiones.

Lo comprobado el 2026-10-24:
- la versión de SheetJS publicada en npm (`xlsx` 0.18.5) tiene vulnerabilidades conocidas;
- las versiones corregidas solo están en `cdn.sheetjs.com`, que la red del entorno cloud bloquea.

## Decisión
| Ámbito | Elección |
|---|---|
| `.xlsx` | **ExcelJS** (MIT): lee celdas con su tipo (número, fecha, texto). **No se admite `.xls`**; el usuario lo guarda antes como `.xlsx` (decisión del propietario). |
| CSV | **PapaParse** (MIT): detecta el separador. La codificación se decodifica antes con `TextDecoder`: primero UTF-8 estricto y, si falla, `windows-1252`. |
| PDF | **pdfjs-dist** (Apache-2.0): extrae el texto con su posición (x, y), con el que se reconstruyen tablas de PDF con texto (no escaneados). Su *worker* entra en el *precache* para funcionar sin conexión. |
| Carga | Las tres librerías se cargan **bajo demanda** (`import()` dinámico) solo al importar, para no penalizar el arranque. |
| Identificadores | **UUIDv7** (paquete `uuid`): ordenables por tiempo y únicos entre dispositivos sin coordinación. |
| Importes | **Céntimos enteros** (`INTEGER`) en EUR, nunca coma flotante. Las participaciones de fondos se guardan como **texto decimal**, para no perder precisión. |
| Huellas | **SHA-256 con WebCrypto** (nativo): huella de cada movimiento para detectar duplicados y huella de cada fichero. |
| Ficheros de prueba | **pdf-lib** (MIT, solo desarrollo) genera el PDF sintético; ExcelJS genera los `.xlsx` sintéticos. |
| Scripts de `tools/` | **tsx** (MIT, solo desarrollo) ejecuta los scripts en TypeScript que importan código de `src/`. En Node, pdf.js usa su build `legacy`. |
| Dónde se ejecuta | La lectura, el plan y la confirmación se ejecutan **en el worker de la base de datos** (SPEC-0004); `uuid` y las tres librerías se cargan allí. |
| Versiones | Exactas, como en ADR-0002. |

Versiones de referencia (npm, 2026-10-24); se fijan exactas al implementar:

| Paquete | Versión | Licencia | Peso aproximado en la app (minificado) |
|---|---|---|---|
| `exceljs` | 4.4.0 | MIT | ~1 MB (build de navegador) |
| `papaparse` | 5.7.0 | MIT | ~20 KB |
| `pdfjs-dist` | 6.4.299 | Apache-2.0 | ~0,4 MB, más ~1 MB del *worker* |
| `uuid` | 14.0.3 | MIT | < 5 KB |
| `pdf-lib` | 1.17.1 | MIT | solo desarrollo |
| `tsx` | 4.23.15 | MIT | solo desarrollo |

En total, unos 2,5 MB más en el *precache* de la PWA. Se descargan una vez y se cargan solo al importar.

## Alternativas consideradas
| Alternativa | Por qué no |
|---|---|
| SheetJS actual (`cdn.sheetjs.com`, en `vendor/`) | Leería `.xls`, pero exige un paso manual de descarga o abrir la red; el propietario prefiere ExcelJS. |
| SheetJS 0.18.5 de npm | Vulnerabilidades conocidas y abandonada en npm. |
| Lector propio de `.xlsx` (zip + XML) | Reinventar ExcelJS, con más riesgo de errores. |
| Procesar ficheros en un servidor | Contradice ADR-0001 (datos solo en el dispositivo) y el coste 0 €. |
| Introducir la cartera a mano | El propietario prefiere importar el PDF. |
| IDs autoincrementales | Colisionan entre dispositivos al sincronizar. |
| `REAL` o decimal para importes | Errores de redondeo en sumas de dinero. |

## Consecuencias
- **+** Los extractos nunca salen del dispositivo.
- **+** Funciona sin conexión, una vez cargadas las librerías del *precache*.
- **+** Los importes en céntimos dan totales exactos, y UUIDv7 prepara la sincronización (SPEC-0008).
- **−** ExcelJS y pdf.js pesan (cientos de KB cada una); la carga bajo demanda lo mitiga.
- **−** Leer PDF depende de la maquetación de MyInvestor: si la cambian, hay que ajustar el lector.
- **−** Los `.xls` necesitan un paso manual del usuario (guardar como `.xlsx`).
- **−** ExcelJS 4.4.0 no publica versión nueva desde 2023. Es estable para leer `.xlsx`, pero si se abandona habrá que reevaluarlo (alternativa: SheetJS actual en `vendor/`).
- **Validado (spike del 2026-10-24)**: ExcelJS 4.4.0 y pdf.js 6.4.299 (`legacy`, `isEvalSupported: false`) leen `.xlsx` y PDF dentro de un Web Worker de módulo en Chromium con CSP estricta en cabecera, sin `unsafe-eval`. Plan B si cambia: leer en un worker propio y pasar solo el `ParsedFile`.
