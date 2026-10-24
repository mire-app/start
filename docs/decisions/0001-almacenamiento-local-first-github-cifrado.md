---
id: ADR-0001
title: Almacenamiento local-first con sincronización cifrada en GitHub
status: proposed       # proposed → accepted (solo una persona) → superseded
summary: Base de datos local por dispositivo y copia maestra cifrada en un repositorio privado de GitHub separado, sincronizada cada 5 min
---

# ADR-0001 · Almacenamiento local-first con sincronización cifrada en GitHub

## Contexto
NÖM guarda datos financieros personales (SPEC-0001). Requisitos del propietario:
- Coste 0 €.
- La web debe ir rápida y funcionar sin conexión.
- Uso desde varios dispositivos (ordenador y móvil).
- Datos bajo control exclusivo del propietario, fuera del repositorio del código y fuera del alcance de Claude Code.
- Datos financieros personales: el alcance concreto del RGPD se analiza en SPEC-0005.

## Decisión
1. **Local-first**: cada dispositivo tiene una base de datos local; la app lee y escribe siempre en ella.
2. **Copia maestra** en un **repositorio privado de GitHub**, separado de `nom-finance/app` y sin acceso para Claude Code.
3. **Cifrado en el dispositivo** antes de subir: en GitHub no hay datos financieros en claro (ni en el contenido ni en nombres de fichero ni en mensajes de commit). Quedan visibles solo los metadatos inevitables (tamaño, fechas y frecuencia de commits).
4. Las credenciales e integraciones de GitHub que usa Claude Code no tienen permisos sobre el repositorio de datos.
5. **Sincronización** cada 5 minutos si hay cambios pendientes, bajo demanda y al ocultar o cerrar la app en la medida en que el navegador lo permita; los cambios de varios dispositivos se fusionan.
6. El **cómo** se decide después: base de datos local, librería de sincronización y cifrado, alojamiento y autenticación con GitHub en SPEC-0002; diseño de fusión y conflictos en SPEC-0008; custodia de claves y del token en SPEC-0005.

## Alternativas consideradas
| Alternativa | Por qué no |
|---|---|
| Solo local + copia cifrada manual | No sincroniza entre dispositivos; riesgo de pérdida si se borra el navegador. |
| Fichero cifrado en nube personal (Google Drive, OneDrive, Dropbox) | Viable; el propietario prefiere GitHub (historial y versiones). Queda como alternativa si GitHub no encaja. |
| Base de datos gestionada con plan gratuito (Supabase, Firebase) | Límites gratuitos cambiantes, pausas por inactividad; el cifrado en cliente limita las consultas. Se reconsiderará con el hogar multiusuario. |
| Autoalojado (Raspberry Pi o NAS, con Tailscale) | Mantenimiento, copias y disponibilidad a cargo del propietario. |
| Fichero cifrado + Syncthing | Encaja mal con una aplicación web. |
| Datos en el mismo repositorio del código | Claude Code los vería; viola la regla de no usar datos reales. |

## Consecuencias
- **+** Coste cero, rapidez, funcionamiento sin conexión e historial de versiones.
- **+** El borrado efectivo es posible destruyendo o rotando la clave (*crypto-shredding*), aunque el historial de git sea permanente.
- **−** Hay que diseñar fusión y conflictos entre dispositivos (la parte más compleja del MVP).
- **−** Perder la clave hace los datos irrecuperables: requiere copia de seguridad de la clave.
- **−** Un token de GitHub en el navegador es un secreto a proteger (permisos mínimos, un solo repositorio).
- **−** Dependencia de las condiciones del plan gratuito y de los límites de la API de GitHub; hay que verificarlas en SPEC-0002.
- El ADR del stack tecnológico (SPEC-0002) pasa a ser **ADR-0002**.
