# Casa · Sofía y Diego

App de la casa: gastos, presupuesto y (próximamente) cocina, tareas y más. Corre en el iPad de la casa en modo kiosco y en el celular de cada uno.

La especificación completa está en [`docs/spec-finanzas-hogar.md`](docs/spec-finanzas-hogar.md).

## Desarrollo

```bash
cp .env.example .env   # llena VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

- Base de datos: Supabase, proyecto `wqhnnjsmunkiacuhdmng`. Migraciones en `supabase/migrations/`.
- Deploy: Netlify (`casa-sofia-y-diego`). Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Estructura

```
src/
  componentes/   ui (design system), shell, gastos, presupuesto, ajustes
  datos/         consultas (TanStack Query), sesión, mes seleccionado, tiempo real
  lib/           supabase, formato, cálculos, tipos, preferencias del dispositivo
  paginas/       Inicio, Gastos, Presupuesto, Ajustes, Acceso
```

## Poner el iPad en modo kiosco

1. Safari → la URL de la app → Compartir → **Agregar a pantalla de inicio**.
2. Abrir desde el ícono, iniciar sesión y en Ajustes activar **Modo tablet de la casa**.
3. Ajustes de iPadOS → Accesibilidad → **Acceso guiado** → activar. Abrir la app y triple clic al botón superior para fijarla.
4. Pantalla → Bloqueo automático → **Nunca** (con el cargador conectado).
