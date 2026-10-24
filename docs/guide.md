# Guía de trabajo — NÖM

Este repositorio trabaja con **A.R.D.A.** (Analizar · Refinar · Decidir · Actuar), la metodología de Doriath Technologies, y su estructura agéntica la ha generado **daeron-core 1.0.0**.

## El principio que no se negocia
**Primero se itera sobre la solución; después se implanta.** Nada de código, configuración o estructura sin una spec **aprobada por una persona**. Los hooks de Claude Code y la CI (`arda-gate`) lo hacen cumplir.

## El ciclo en el día a día
| Paso | Qué haces tú | Qué hace la IA |
|---|---|---|
| `/analizar` | Cuentas qué quieres | Resume la intención, busca contexto en el índice y propone una spec |
| `/refinar` | Respondes preguntas | Escribe la spec (`docs/specs/`), la revisa andreth y se itera |
| `/decidir` | **Apruebas**: cambias `status: draft` → `status: approved` y haces commit | Te resume la spec y, tras tu aprobación, la activa |
| *(sesión nueva)* `/actuar` | Revisas y fusionas el PR | Implementa solo lo aprobado, pasa los checks, la revisa andreth y abre el PR |

**Cómo aprobar desde Claude Code en la web:** abre la spec en GitHub, en la rama de trabajo, edítala con el lápiz, cambia el `status` y haz commit. Después dile a Claude "aprobado".

## Los agentes
NÖM toma su nombre de *Nóm*, "Sabiduría": así llamó el pueblo de Bëor a Finrod Felagund, el primer elfo que encontraron los Hombres y que les enseñó y veló por su futuro. Sus agentes vienen de esa misma historia.

| Agente | Rol | Modelo | Lore |
|---|---|---|---|
| Sesión principal | Orquestador: conduce el ciclo con las skills `/analizar`, `/refinar`, `/decidir`, `/actuar` | Sonnet | — |
| **balan** | Explorador (solo lectura): mapea código, specs y dependencias; devuelve como máximo 10 hallazgos | Haiku | *Balan*, primer nombre de Bëor el Viejo, guió a los primeros Hombres a través de las Montañas Azules hasta Beleriand: abre camino en territorio desconocido |
| **andreth** | Inspectora (solo lectura): revisa specs y cambios frente a la spec aprobada y A.R.D.A.; veredicto APROBADO / RECHAZADO | Sonnet | *Andreth*, la sabia de la Casa de Bëor que cuestionó a Finrod con rigor en la *Athrabeth*: no da por bueno lo que no se sostiene |

## Estructura del repositorio
| Ruta | Qué es | Propiedad |
|---|---|---|
| `CLAUDE.md`, `.claude/` | Instrucciones, agentes, skills y hooks | núcleo (daeron-core) |
| `.arda/tools/`, `.github/workflows/arda-gate.yml` | Herramientas y CI de A.R.D.A. | núcleo |
| `.arda/manifest.yaml` | Qué instaló daeron-core y sus huellas | núcleo |
| `docs/project-context.md` | Contexto del proyecto para la IA | proyecto |
| `docs/specs/`, `docs/decisions/` | Specs vivas y decisiones | proyecto |
| `.arda/checks.sh` | Checks del proyecto (lint, tests) — se crea al decidir el stack | proyecto |
| `spikes/` | Prototipos desechables; nunca se fusionan | proyecto |

Los ficheros del **núcleo** no se modifican en el proyecto: si algo falla en ellos, se reporta en una sesión de daeron-core y llega como actualización por PR.

## Configuración pendiente en GitHub (una vez)
1. *Settings → Branches*: proteger `main` y marcar el check **`arda-gate`** como obligatorio.
2. No permitir *push* directo a `main`.

## Consejos para el límite de uso
- Empieza `/actuar` en una sesión nueva: la spec aprobada es todo el contexto necesario.
- Pide exploraciones a balan en lugar de leer medio repositorio.
- Los checks deterministas (`.arda/checks.sh`) se ejecutan antes que el inspector.
