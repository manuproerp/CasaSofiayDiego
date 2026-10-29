# Instrucciones para Claude Code

- La fuente de verdad es `docs/spec-finanzas-hogar.md`. Antes de construir un bloque nuevo, actualízala.
- Todo en español: UI, nombres de archivos, variables de dominio y commits.
- Diseño: seguir los tokens de `src/index.css` y los componentes de `src/componentes/ui`. Un solo acento (verde bosque), fondo crema, Geist, Phosphor, sin emojis, áreas táctiles ≥ 48 px, MOTION bajo (kiosco siempre encendido).
- Cada pantalla necesita estados de carga (skeleton), vacío con acción y error en línea.
- Base de datos: cambios solo con migraciones nuevas en `supabase/migrations/`, RLS siempre activa (`es_miembro()`), reglas de negocio sensibles (estados, aprobaciones, PIN) en la base, no en el cliente.
- Este proyecto es independiente del ERP de ManuPro: nunca mezclar proyectos de Supabase ni de Netlify.
