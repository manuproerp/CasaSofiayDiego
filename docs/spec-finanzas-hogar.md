# Casa Sofía y Diego — Especificación (v3, 28-oct-2026)

Fuente de verdad del sistema. Reconstruida a partir de la spec v1 (ago-2026), la fase 3 de presupuesto (ago-2026), el plan de rediseño v3 (19-oct-2026) y las decisiones del 28-oct-2026. Todo cambio de alcance se integra aquí antes de construir.

---

## 1. Propósito y contexto

- Sistema para administrar la casa de Diego y Sofía: finanzas, compras, cocina, tareas y más, en una interfaz compartida siempre encendida.
- Pantalla principal: **iPad Air (2022)** en modo kiosco (Acceso guiado + app en pantalla de inicio). También se usa desde el celular de cada uno.
- Idioma: español en toda la app y la documentación. Zona horaria: America/Tegucigalpa.
- Monedas: lempiras (L, `HNL`) y dólares (`USD`).

## 2. Modelo financiero

- Ingresos de ambos → cuenta conjunta.
- **Mesada** mensual por persona para gasto libre; no requiere aprobación.
- **Umbral de aprobación** configurable (en lempiras): un gasto del hogar ≥ umbral queda *pendiente* hasta que ambos lo aprueban. Quien lo registra cuenta como primera aprobación. Si alguien rechaza, queda *rechazado*.
- **Tipo de cambio** editable; se guarda por día en `tipo_cambio` y **por gasto** en `gastos.tipo_cambio`. Nunca se recalcula un gasto histórico.
- Apartados (anuales y metas): **virtuales** — control en la app, el dinero sigue en la cuenta normal. (Decidido 28-oct.)
- **Lo que cuenta en el mes es el aporte, no el pago** (decidido 28-oct): un gasto pagado desde un apartado (anual o meta) no suma al gastado del mes, porque el dinero ya se apartó mes a mes. Así no se cuenta doble.
- Gastos que nacen de algo ya aprobado (pago de un apartado o compra de un item aprobado de la wishlist) no vuelven a pedir aprobación.

## 3. Infraestructura

| Pieza | Valor |
|---|---|
| Repo | `manuproerp/CasaSofiayDiego` |
| Supabase | proyecto **Casa Diego y Sofia** (`wqhnnjsmunkiacuhdmng`, us-east-1), org ManuPro. Separado del ERP |
| Netlify | sitio `casa-sofia-y-diego` (team ManuPro). Separado del ERP |
| Frontend | React 19 + Vite + TypeScript + Tailwind v4, TanStack Query, React Router, Phosphor Icons, Geist |
| Tiempo real | Supabase Realtime en todas las tablas del bloque 1 |

## 4. Acceso y personas

- Solo correos en `correos_permitidos` pueden crear cuenta (trigger en `auth.users`).
  - Diego: `davo72699@gmail.com` · Sofía: `sofiasalgado63@gmail.com`
  - Opcional: una cuenta **Casa** (rol `casa`) para la tablet, p. ej. el Gmail compartido.
- **PIN** de 4–6 dígitos por persona (`perfiles_pin`, con bcrypt, nunca expuesto por la API). Bloqueo de 5 min tras 5 intentos fallidos.
- **Modo tablet** (preferencia del dispositivo): aprobar siempre pide el PIN de quien aprueba. La cuenta Casa siempre se comporta así.
- En el celular, cada quien aprueba lo suyo sin PIN; decidir por otra persona exige su PIN (validado en el servidor).

## 5. Alcance por módulos

| Módulo | Qué hace | Bloque |
|---|---|---|
| Design system + shell responsive | Tokens, navegación, estados | **1 · hecho** |
| Gastos | Registro rápido (monto → categoría → quién), moneda y TC, mesadas, edición, aprobaciones | **1 · hecho** |
| Presupuesto · Mensual | Fijo / variable; vista por mes: presupuesto vs real + apartados del mes | **1 · hecho**, ajustado en 2 |
| Inicio | Dashboard bento | **1 · hecho** (con lo existente) |
| Ajustes | Cuenta, PIN, mesadas, umbral, TC, categorías, dispositivo, acceso | **1 · hecho** |
| Presupuesto · Anuales | Absorbe a los antiguos *eventuales*. Gastos de un mes específico con ahorro mensual sugerido | **2 · hecho** |
| Wishlist | Compras no usuales; aprobación de ambos solo si superan el umbral | **2 · hecho** |
| Metas | Objetivo + aportes; nace de wishlist aprobada o manual. Comparte motor con Anuales (`fondos`) | **2 · hecho** |
| Por aprobar | Bandeja única de gastos y wishlist pendientes | **2 · hecho** |
| Recetas → Menú semanal → Súper | Lista de súper compartida, generada desde el menú (consolida, marca origen) | 3 |
| Chores + Ausencias | Rotación con rachas; una ausencia saca a la persona de la rotación y congela la racha | 4 |
| Mantenimiento, Documentos, Inventario | Dentro de **Casa** | 5 |
| Salud, Mascotas | Dentro de **Casa** (decidido 28-oct: sin sección Familia) | 5 |

Fuera de alcance permanente: calendario compartido general, proyectos/reformas. Futuro: Alexa.

## 6. Arquitectura de información

Final (al completar los bloques):

- **Inicio**
- **Dinero** — Presupuesto (Mensual / Anuales) · Gastos · Wishlist · Metas
- **Cocina** — Recetas · Menú semanal · Súper
- **Casa** — Chores (+ Ausencias) · Mantenimiento · Inventario · Documentos · Salud · Mascotas
- **Ajustes**

Navegación:

| Dispositivo | Patrón |
|---|---|
| iPad (≥768 px) | Barra lateral verde bosque fija. Riel con ícono + etiqueta en vertical; barra ancha en horizontal (≥1024) |
| Celular | Barra inferior con botón central [+]. Desde el bloque 2: Inicio · Dinero · [+] · Por aprobar · Ajustes; Dinero tiene pestañas arriba (Gastos · Presupuesto · Wishlist · Metas). Al llegar Cocina y Casa se reorganiza a Inicio · Dinero · [+] · Cocina · Casa |

## 7. Sistema visual

- Guía: skill `design-taste-frontend-v1`, ajustada: VARIANCE 5 · MOTION 3 · DENSITY 5 (kiosco siempre encendido → rendimiento).
- Paleta: verde bosque `#1F4D3A` (único acento) · fondo **crema** `#F6F4EE` (decidido) · superficies blancas · texto `#1C1F1D` · ámbar = cerca del límite · rojo terroso = excedido · gráficos en escala tonal de verdes.
- Tipografía: Geist + Geist Mono, cifras tabulares. Sin serif, sin Inter. Íconos Phosphor, sin emojis.
- Radios 20–24 px, sombra difusa teñida, tarjeta hero verde sólida. Áreas táctiles ≥ 48 px.
- Tema: Claro / Nocturno (oscuro de 7 p. m. a 6 a. m.) / Oscuro, por dispositivo.
- Estados obligatorios: skeleton, vacíos con acción, errores en línea.

## 8. Base de datos (bloques 1 y 2, implementado)

Migraciones en `supabase/migrations/`. RLS en todas las tablas: solo miembros (`es_miembro()`).

```
correos_permitidos (email PK, nombre, rol persona|casa)
perfiles           (id = auth.users.id, nombre, email, rol, color, mesada L, creado_en)
perfiles_pin       (perfil_id PK, pin_hash, intentos_fallidos, bloqueado_hasta)   -- sin políticas: inaccesible por API
configuracion      (id=1, umbral_aprobacion L | null, actualizado_en, actualizado_por)
tipo_cambio        (id, fecha UNIQUE, valor L/USD, registrado_por)
categorias         (id, nombre UNIQUE ci, icono, orden, activa)
presupuesto        (id, categoria_id, tipo fijo|variable, descripcion, monto, moneda, activo)
gastos             (id, fecha, monto, moneda, tipo_cambio, monto_lempiras GENERATED,
                    tipo hogar|mesada, categoria_id (requerida si hogar), persona_id, registrado_por,
                    estado aprobado|pendiente|rechazado, descripcion,
                    fondo_id (pagado desde un apartado), wishlist_id (compra de la wishlist))
aprobaciones       (gasto_id, persona_id, decision, decidido_en)  PK(gasto_id, persona_id)

-- Bloque 2: motor compartido de apartados
fondos             (id, tipo anual|meta, nombre, categoria_id, monto_objetivo, moneda,
                    fecha_objetivo (vencimiento / fecha meta), recurrente (anual), ciclo,
                    estado activo|pagado|cancelado, wishlist_id, nota)
fondos_aportes     (id, fondo_id, ciclo, fecha, anio, mes, monto (≠0; negativo = retiro), nota, registrado_por)
wishlist           (id, nombre, nota, enlace, monto_estimado, moneda, prioridad alta|media|baja,
                    propuesto_por, estado pendiente|aprobada|en_meta|comprada|rechazada, fondo_id, gasto_id)
wishlist_aprobaciones (item_id, persona_id, decision, decidido_en)
```

Reglas en la base (triggers / funciones):

- `gastos_antes`: fija `registrado_por = auth.uid()`; calcula `estado` al insertar según umbral; el cliente no puede cambiar `estado`; si un gasto aprobado sube de monto y pasa el umbral, vuelve a pendiente.
- `gastos_despues`: al quedar pendiente registra la aprobación implícita de quien registra.
- `decidir_gasto(gasto, persona, decision, pin)`: exige PIN si se decide por otra persona; devuelve `aprobado | pendiente | rechazado | pin_incorrecto`.
- `establecer_pin`, `verificar_pin`, `personas_con_pin`.
- `wishlist_antes/despues` + `decidir_wishlist(...)`: mismo esquema de aprobación que gastos.
- `pagar_fondo(...)`: registra el gasto vinculado (sin aprobación). Si es anual recurrente, abre el siguiente ciclo (+1 año) y pasa el sobrante como primer aporte; si no, cierra el apartado. Si el apartado vino de la wishlist, marca el item como comprado.
- `crear_meta_desde_wishlist(...)`: item aprobado → meta.

Cálculos del mes (cliente, `src/lib/calculos.ts`):

- Presupuesto por categoría = fijos + variables (USD convertidos con el TC más reciente).
- Real = gastos del hogar **aprobados** del mes que **no** salen de un apartado. Pendientes se muestran aparte.
- Semáforo: excedido si real > presupuesto; "cerca" (≥ 85 %) solo para categorías con tope variable.
- Apartado de un fondo = suma de aportes de su ciclo actual.
- Cuota sugerida del mes = (objetivo − apartado antes de este mes) / meses que faltan (incluye el mes del vencimiento, mínimo 1). Metas sin fecha: sin sugerencia.
- "Apartar cuotas del mes": un toque, con montos sugeridos editables; registra un aporte por fondo con su año y mes.

## 9. Flujos clave

- **Gasto (3 toques)**: monto (teclado propio, L/US$, TC por defecto) → categoría (cuadrícula) → quién (guarda). Mesada salta la categoría. Nota y fecha opcionales.
- **Aprobación**: bandeja "Por aprobar" (gastos + wishlist); en la tablet con PIN.
- **Wishlist → Meta → Gasto**: item → si ≥ umbral, aprobación de ambos; si no, aprobado directo → "Ahorrar para esto" crea la meta con monto y fecha, o "Ya lo compramos" registra el gasto → aportes → "Comprar" paga desde la meta y la cierra.
- **Anuales**: nombre, categoría, monto, moneda, vencimiento, recurrente. Aparece con aviso cuando se acerca su mes. "Pagar" registra el gasto desde el apartado y reinicia el ciclo si es recurrente.
- **Cocina** (bloque 3): Recetas → Menú → "Generar lista de súper" (consolida, sin duplicados, marca origen). Preferencias de la casa: comida fuerte al mediodía; lonchera para Diego.
- **Chores** (bloque 4): rotación entre perfiles, racha por persona; ausencias pausan la rotación y congelan la racha.

## 10. Limitaciones conocidas del bloque 1

- Las partidas fijo/variable aplican a todos los meses (sin vigencia por fecha). Cambiar un monto afecta también los meses pasados.
- Partidas y apartados en USD se convierten con el TC más reciente, no el del mes.
- El diseño visual se rehace sobre las fotos de referencia (*No Spend*, *Quixotic*, ref. móvil) en cuanto Diego las comparta de nuevo.
- Sin service worker (a propósito): la tablet siempre carga la versión más nueva.

## 11. Orden de construcción

1. ~~A. Design system + shell · B. Gastos y Presupuesto mensual · C. Inicio~~ (bloque 1, 28-oct-2026)
2. ~~Presupuesto Anuales + Wishlist + Metas~~ (bloque 2, 28-oct-2026) → rediseño visual con las fotos de referencia
3. Cocina
4. Chores + Ausencias
5. Mantenimiento, Documentos, Inventario, Salud, Mascotas

Antes de cada bloque: actualizar esta spec.
