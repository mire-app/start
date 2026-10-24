---
id: ADR-0003
title: Sistema de diseño con Tailwind, shadcn/ui, Material Symbols Rounded, Sora autoalojada y Motion
status: accepted       # proposed → accepted (solo una persona) → superseded
summary: UI con Tailwind CSS y componentes shadcn/ui (Radix), iconos Material Symbols Rounded en SVG, Sora autoalojada vía Fontsource, y transiciones con View Transitions y Motion
---

# ADR-0003 · Sistema de diseño con Tailwind, shadcn/ui, Material Symbols Rounded, Sora autoalojada y Motion

## Contexto
SPEC-0003 define la identidad visual de Míre. El sistema de diseño debe cumplir:
- interfaz sobria y moderna, tema claro y oscuro, y WCAG 2.2 AA;
- funcionar sin conexión (PWA, SPEC-0002) y sin enviar datos a terceros, porque las fuentes de Google exponen la IP del usuario;
- transiciones serenas que respeten «reducir movimiento»;
- ser fácil de mantener: Claude escribe el código y el propietario lo revisa.

ADR-0002 dejó la librería de componentes para este punto.

## Decisión
| Ámbito | Elección |
|---|---|
| Estilos | **Tailwind CSS**. Los tokens de SPEC-0003 se definen como variables CSS (`--color-*`) y se exponen como utilidades de Tailwind. El tema oscuro va con el atributo `data-theme` en `<html>`. |
| Componentes | **shadcn/ui**: componentes accesibles sobre primitivas Radix, copiados al repositorio (`src/ui/`) y adaptados a los tokens. No es una dependencia de versión opaca. |
| Iconos | **Material Symbols Rounded** (Apache-2.0), del paquete `@material-symbols/svg-400`, importados como **SVG individuales** convertidos en componentes React con `vite-plugin-svgr`. Se descarta la fuente de iconos: así se incluyen solo los iconos usados y funcionan sin conexión. |
| Tipografía | **Sora** (OFL) **autoalojada** con `@fontsource/sora`: ficheros estáticos de subconjunto latino, pesos 400–700, incluidos en el *precache* de la PWA. Sin peticiones a Google Fonts. |
| Movimiento | **View Transitions API** para el cambio entre pantallas (deslizamiento direccional) y **Motion** (`motion`) para la entrada y salida de diálogos, menús y avisos. Si el navegador no soporta View Transitions, el cambio es instantáneo. |
| Logotipo | Generado con un script de build propio (`opentype.js`) a partir de la fuente Sora: SVG solo con trazados. |
| Utilidades | `class-variance-authority`, `clsx` y `tailwind-merge`, el trío estándar de shadcn/ui. |
| Verificación | `@axe-core/playwright` para auditar la accesibilidad en los e2e. |
| Versiones | Exactas, como en ADR-0002. Se elige la versión mayor estable vigente al implementar, compatible con React y Vite de ADR-0002. |

## Alternativas consideradas
| Alternativa | Por qué no |
|---|---|
| Mantine o MUI | Librerías completas, pero con un aspecto propio difícil de llevar a la marca; MUI se ve demasiado Material. |
| CSS Modules + Radix sin estilos | Más trabajo para el mismo resultado. |
| Material Symbols Outlined o Sharp | El propietario prefiere Rounded, que casa con Sora y con el tono sereno. |
| Lucide o Phosphor | El propietario eligió Material Symbols por su amplitud. |
| Fuente de iconos de Material Symbols | Descarga toda la fuente (MB) y depende de ligaduras; peor sin conexión. |
| Google Fonts | Petición a un tercero con la IP del usuario (RGPD) y no funciona sin conexión en la primera visita. |
| Solo CSS para el movimiento | Menos peso, pero las animaciones de entrada y salida de componentes son más laboriosas; el propietario prefiere Motion. |
| Storybook | Herramienta extra que mantener; la guía de estilo integrada en la app cubre la necesidad. |

## Consecuencias
- **+** Componentes accesibles de base (Radix), totalmente personalizables con la marca.
- **+** Sin dependencias de terceros en tiempo de ejecución: fuentes e iconos van dentro de la PWA.
- **+** Los tokens como variables CSS permiten cambiar de tema sin recargar y verificar el contraste en tests.
- **−** Los componentes de shadcn/ui copiados se mantienen a mano; no se actualizan con un `pnpm update`.
- **−** Motion añade decenas de KB; se importa solo donde se usa.
- **−** View Transitions no está en todos los navegadores. Chrome para Android, que es el objetivo del propietario, la soporta; en los demás no hay animación.
