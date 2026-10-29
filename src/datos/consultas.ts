import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { rangoMes } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import type {
  Aporte,
  Aprobacion,
  AprobacionWishlist,
  Categoria,
  Configuracion,
  CorreoPermitido,
  EntradaMenu,
  Fondo,
  Gasto,
  ItemPresupuesto,
  ItemSuper,
  ItemWishlist,
  Moneda,
  Receta,
  Perfil,
  TipoCambio,
} from '@/lib/tipos'
import { useSesion } from './sesion'

/** Claves de caché por tabla, para invalidar desde Realtime */
export const CLAVES = {
  perfiles: ['perfiles'],
  correos: ['correos'],
  pines: ['pines'],
  config: ['config'],
  tc: ['tipo_cambio'],
  categorias: ['categorias'],
  presupuesto: ['presupuesto'],
  gastos: ['gastos'],
  aprobaciones: ['aprobaciones'],
  fondos: ['fondos'],
  aportes: ['aportes'],
  wishlist: ['wishlist'],
  wishlistAprobaciones: ['wishlist_aprobaciones'],
  recetas: ['recetas'],
  menu: ['menu'],
  super: ['super'],
} as const

async function datos<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data as T
}

const num = (v: unknown) => (v == null ? null : Number(v))

// ───────────── Perfiles ─────────────

export function usePerfiles() {
  return useQuery({
    queryKey: CLAVES.perfiles,
    queryFn: async () => {
      const filas = await datos<Perfil[]>(supabase.from('perfiles').select('*').order('creado_en'))
      return filas.map((p) => ({ ...p, mesada: num(p.mesada) }))
    },
  })
}

/** Personas (Diego y Sofía), excluye la cuenta Casa */
export function usePersonas() {
  const q = usePerfiles()
  const personas = useMemo(
    () => (q.data ?? []).filter((p) => p.rol === 'persona').sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [q.data],
  )
  return { ...q, personas }
}

export function useYo() {
  const { sesion } = useSesion()
  const q = usePerfiles()
  return { ...q, yo: q.data?.find((p) => p.id === sesion?.user.id) ?? null }
}

export function usePines() {
  return useQuery({
    queryKey: CLAVES.pines,
    queryFn: async () => new Set(await datos<string[]>(supabase.rpc('personas_con_pin'))),
  })
}

export function useCorreos() {
  return useQuery({
    queryKey: CLAVES.correos,
    queryFn: () => datos<CorreoPermitido[]>(supabase.from('correos_permitidos').select('*').order('nombre')),
  })
}

// ───────────── Configuración y tipo de cambio ─────────────

export function useConfig() {
  return useQuery({
    queryKey: CLAVES.config,
    queryFn: async () => {
      const c = await datos<Configuracion>(supabase.from('configuracion').select('*').eq('id', 1).single())
      return { ...c, umbral_aprobacion: num(c.umbral_aprobacion) }
    },
  })
}

export function useTiposCambio() {
  return useQuery({
    queryKey: CLAVES.tc,
    queryFn: async () => {
      const filas = await datos<TipoCambio[]>(
        supabase.from('tipo_cambio').select('*').order('fecha', { ascending: false }).limit(30),
      )
      return filas.map((t) => ({ ...t, valor: Number(t.valor) }))
    },
  })
}

/** Tipo de cambio más reciente (o null si nunca se ha registrado) */
export function useTCActual() {
  const q = useTiposCambio()
  return { ...q, tc: q.data?.[0] ?? null }
}

// ───────────── Categorías ─────────────

export function useCategorias() {
  return useQuery({
    queryKey: CLAVES.categorias,
    queryFn: () =>
      datos<Categoria[]>(supabase.from('categorias').select('*').order('orden').order('nombre')),
  })
}

export function useMapaCategorias() {
  const q = useCategorias()
  const mapa = useMemo(() => new Map((q.data ?? []).map((c) => [c.id, c])), [q.data])
  return { ...q, mapa }
}

// ───────────── Presupuesto ─────────────

export function usePresupuesto() {
  return useQuery({
    queryKey: CLAVES.presupuesto,
    queryFn: async () => {
      const filas = await datos<ItemPresupuesto[]>(
        supabase.from('presupuesto').select('*').eq('activo', true).order('creado_en'),
      )
      return filas.map((p) => ({ ...p, monto: Number(p.monto) }))
    },
  })
}

// ───────────── Gastos ─────────────

function normalizarGasto(g: Gasto): Gasto {
  return {
    ...g,
    monto: Number(g.monto),
    monto_lempiras: Number(g.monto_lempiras),
    tipo_cambio: num(g.tipo_cambio),
  }
}

export function useGastosMes(anio: number, mes: number) {
  return useQuery({
    queryKey: [...CLAVES.gastos, 'mes', anio, mes],
    queryFn: async () => {
      const { ini, fin } = rangoMes(anio, mes)
      const filas = await datos<Gasto[]>(
        supabase
          .from('gastos')
          .select('*')
          .gte('fecha', ini)
          .lte('fecha', fin)
          .order('fecha', { ascending: false })
          .order('creado_en', { ascending: false }),
      )
      return filas.map(normalizarGasto)
    },
  })
}

export function usePendientes() {
  return useQuery({
    queryKey: [...CLAVES.gastos, 'pendientes'],
    queryFn: async () => {
      const filas = await datos<Gasto[]>(
        supabase.from('gastos').select('*').eq('estado', 'pendiente').order('creado_en', { ascending: false }),
      )
      return filas.map(normalizarGasto)
    },
  })
}

export function useAprobaciones(gastoIds: string[]) {
  const clave = gastoIds.slice().sort().join(',')
  return useQuery({
    queryKey: [...CLAVES.aprobaciones, clave],
    enabled: gastoIds.length > 0,
    queryFn: () => datos<Aprobacion[]>(supabase.from('aprobaciones').select('*').in('gasto_id', gastoIds)),
  })
}

// ───────────── Mutaciones ─────────────

export type NuevoGasto = Pick<
  Gasto,
  'fecha' | 'monto' | 'moneda' | 'tipo_cambio' | 'tipo' | 'categoria_id' | 'persona_id' | 'descripcion' | 'wishlist_id'
>

export function useGuardarGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...g }: NuevoGasto & { id?: string }) => {
      const q = id
        ? supabase.from('gastos').update(g).eq('id', id).select().single()
        : supabase.from('gastos').insert(g).select().single()
      return normalizarGasto(await datos<Gasto>(q))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLAVES.gastos })
      qc.invalidateQueries({ queryKey: CLAVES.aprobaciones })
      qc.invalidateQueries({ queryKey: CLAVES.wishlist })
    },
  })
}

export function useBorrarGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => datos(supabase.from('gastos').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.gastos }),
  })
}

export function useDecidirGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { gasto: string; persona: string; decision: 'aprobado' | 'rechazado'; pin?: string }) =>
      datos<string>(
        supabase.rpc('decidir_gasto', {
          p_gasto: v.gasto,
          p_persona: v.persona,
          p_decision: v.decision,
          p_pin: v.pin ?? null,
        }),
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: CLAVES.gastos })
      qc.invalidateQueries({ queryKey: CLAVES.aprobaciones })
    },
  })
}

export function useVerificarPin() {
  return useMutation({
    mutationFn: async (v: { persona: string; pin: string }) =>
      datos<boolean>(supabase.rpc('verificar_pin', { p_persona: v.persona, p_pin: v.pin })),
  })
}

export function useEstablecerPin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pin: string) => datos(supabase.rpc('establecer_pin', { p_pin: pin })),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.pines }),
  })
}

export function useGuardarPresupuesto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...p }: Partial<ItemPresupuesto> & { id?: string }) => {
      const q = id
        ? supabase.from('presupuesto').update(p).eq('id', id)
        : supabase.from('presupuesto').insert(p as ItemPresupuesto)
      return datos(q)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.presupuesto }),
  })
}

export function useBorrarPresupuesto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => datos(supabase.from('presupuesto').delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLAVES.presupuesto })
      qc.invalidateQueries({ queryKey: CLAVES.gastos })
    },
  })
}

export function useGuardarCategoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...c }: Partial<Categoria> & { id?: string }) => {
      const q = id
        ? supabase.from('categorias').update(c).eq('id', id)
        : supabase.from('categorias').insert(c as Categoria)
      return datos(q)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.categorias }),
  })
}

export function useBorrarCategoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => datos(supabase.from('categorias').delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLAVES.categorias })
      qc.invalidateQueries({ queryKey: CLAVES.presupuesto })
    },
  })
}

export function useGuardarConfig() {
  const qc = useQueryClient()
  const { sesion } = useSesion()
  return useMutation({
    mutationFn: async (c: Partial<Configuracion>) =>
      datos(
        supabase
          .from('configuracion')
          .update({ ...c, actualizado_en: new Date().toISOString(), actualizado_por: sesion?.user.id })
          .eq('id', 1),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.config }),
  })
}

export function useGuardarTC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: { fecha: string; valor: number }) =>
      datos(supabase.from('tipo_cambio').upsert(t, { onConflict: 'fecha' })),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.tc }),
  })
}

export function useGuardarPerfil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...p }: Pick<Perfil, 'id'> & Partial<Pick<Perfil, 'nombre' | 'mesada' | 'color' | 'porcion'>>) =>
      datos(supabase.from('perfiles').update(p).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.perfiles }),
  })
}

export function useAgregarCorreo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: CorreoPermitido) =>
      datos(supabase.from('correos_permitidos').insert({ ...c, email: c.email.trim().toLowerCase() })),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.correos }),
  })
}

export function useQuitarCorreo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => datos(supabase.from('correos_permitidos').delete().eq('email', email)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.correos }),
  })
}

// ───────────── Apartados (anuales y metas) ─────────────

function normalizarFondo(f: Fondo): Fondo {
  return { ...f, monto_objetivo: Number(f.monto_objetivo) }
}

export function useFondos() {
  return useQuery({
    queryKey: CLAVES.fondos,
    queryFn: async () => {
      const filas = await datos<Fondo[]>(
        supabase.from('fondos').select('*').order('fecha_objetivo', { ascending: true, nullsFirst: false }).order('creado_en'),
      )
      return filas.map(normalizarFondo)
    },
  })
}

export function useAportes() {
  return useQuery({
    queryKey: CLAVES.aportes,
    queryFn: async () => {
      const filas = await datos<Aporte[]>(
        supabase.from('fondos_aportes').select('*').order('fecha', { ascending: false }).order('creado_en', { ascending: false }),
      )
      return filas.map((a) => ({ ...a, monto: Number(a.monto) }))
    },
  })
}

export type NuevoFondo = Pick<
  Fondo,
  'tipo' | 'nombre' | 'categoria_id' | 'monto_objetivo' | 'moneda' | 'fecha_objetivo' | 'recurrente' | 'nota'
>

export function useGuardarFondo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...f }: Partial<NuevoFondo> & { id?: string; estado?: Fondo['estado'] }) => {
      const q = id ? supabase.from('fondos').update(f).eq('id', id) : supabase.from('fondos').insert(f as NuevoFondo)
      return datos(q)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.fondos }),
  })
}

export function useBorrarFondo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => datos(supabase.from('fondos').delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLAVES.fondos })
      qc.invalidateQueries({ queryKey: CLAVES.aportes })
      qc.invalidateQueries({ queryKey: CLAVES.wishlist })
    },
  })
}

export function useAportar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lista: { fondo_id: string; monto: number; anio: number; mes: number; fecha?: string; nota?: string | null }[]) =>
      datos(supabase.from('fondos_aportes').insert(lista)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.aportes }),
  })
}

export function useBorrarAporte() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => datos(supabase.from('fondos_aportes').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.aportes }),
  })
}

export function usePagarFondo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      fondo: string
      monto: number
      moneda: Moneda
      tipo_cambio: number | null
      fecha: string
      persona: string
      categoria: string | null
      descripcion: string | null
    }) =>
      datos<string>(
        supabase.rpc('pagar_fondo', {
          p_fondo: v.fondo,
          p_monto: v.monto,
          p_moneda: v.moneda,
          p_tipo_cambio: v.tipo_cambio,
          p_fecha: v.fecha,
          p_persona: v.persona,
          p_categoria: v.categoria,
          p_descripcion: v.descripcion,
        }),
      ),
    onSuccess: () => {
      for (const c of [CLAVES.fondos, CLAVES.aportes, CLAVES.gastos, CLAVES.wishlist]) qc.invalidateQueries({ queryKey: c })
    },
  })
}

// ───────────── Wishlist ─────────────

export function useWishlist() {
  return useQuery({
    queryKey: CLAVES.wishlist,
    queryFn: async () => {
      const filas = await datos<ItemWishlist[]>(supabase.from('wishlist').select('*').order('creado_en', { ascending: false }))
      return filas.map((w) => ({ ...w, monto_estimado: Number(w.monto_estimado) }))
    },
  })
}

export function useAprobacionesWishlist() {
  return useQuery({
    queryKey: CLAVES.wishlistAprobaciones,
    queryFn: () => datos<AprobacionWishlist[]>(supabase.from('wishlist_aprobaciones').select('*')),
  })
}

export type NuevoItemWishlist = Pick<ItemWishlist, 'nombre' | 'nota' | 'enlace' | 'monto_estimado' | 'moneda' | 'prioridad'> & {
  propuesto_por?: string
}

export function useGuardarWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...w }: Partial<NuevoItemWishlist> & { id?: string }) => {
      const q = id
        ? supabase.from('wishlist').update(w).eq('id', id).select().single()
        : supabase.from('wishlist').insert(w as NuevoItemWishlist).select().single()
      return datos<ItemWishlist>(q)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLAVES.wishlist })
      qc.invalidateQueries({ queryKey: CLAVES.wishlistAprobaciones })
    },
  })
}

export function useBorrarWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => datos(supabase.from('wishlist').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.wishlist }),
  })
}

export function useDecidirWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { item: string; persona: string; decision: 'aprobado' | 'rechazado'; pin?: string }) =>
      datos<string>(
        supabase.rpc('decidir_wishlist', { p_item: v.item, p_persona: v.persona, p_decision: v.decision, p_pin: v.pin ?? null }),
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: CLAVES.wishlist })
      qc.invalidateQueries({ queryKey: CLAVES.wishlistAprobaciones })
    },
  })
}

export function useCrearMetaDesdeWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { item: string; fecha: string | null; categoria: string | null }) =>
      datos<string>(
        supabase.rpc('crear_meta_desde_wishlist', { p_item: v.item, p_fecha_objetivo: v.fecha, p_categoria: v.categoria }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLAVES.wishlist })
      qc.invalidateQueries({ queryKey: CLAVES.fondos })
    },
  })
}

// ───────────── Cocina ─────────────

const numN = (v: unknown) => (v == null ? null : Number(v))

export function useRecetas() {
  return useQuery({
    queryKey: CLAVES.recetas,
    queryFn: async () => {
      const filas = await datos<Receta[]>(
        supabase.from('recetas').select('*, receta_ingredientes(*)').order('nombre'),
      )
      return filas.map((r) => ({
        ...r,
        receta_ingredientes: (r.receta_ingredientes ?? [])
          .map((i) => ({ ...i, cantidad: numN(i.cantidad), cantidad_extra: Number(i.cantidad_extra ?? 0) }))
          .sort((a, b) => a.orden - b.orden),
      }))
    },
  })
}

export type IngredienteNuevo = Omit<import('@/lib/tipos').Ingrediente, 'id' | 'receta_id'>
export type RecetaNueva = Pick<Receta, 'nombre' | 'descripcion' | 'comidas' | 'tiempo_min' | 'etiquetas' | 'pasos'>

export function useGuardarReceta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ingredientes, ...r }: RecetaNueva & { id?: string; ingredientes: IngredienteNuevo[] }) => {
      let recetaId = id
      if (id) {
        await datos(supabase.from('recetas').update({ ...r, actualizado_en: new Date().toISOString() }).eq('id', id))
        await datos(supabase.from('receta_ingredientes').delete().eq('receta_id', id))
      } else {
        const nueva = await datos<{ id: string }>(supabase.from('recetas').insert(r).select('id').single())
        recetaId = nueva.id
      }
      if (ingredientes.length) {
        await datos(
          supabase.from('receta_ingredientes').insert(ingredientes.map((i, n) => ({ ...i, orden: n + 1, receta_id: recetaId }))),
        )
      }
      return recetaId as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.recetas }),
  })
}

export function useBorrarReceta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => datos(supabase.from('recetas').delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLAVES.recetas })
      qc.invalidateQueries({ queryKey: CLAVES.menu })
    },
  })
}

export function useMenuRango(desde: string, hasta: string) {
  return useQuery({
    queryKey: [...CLAVES.menu, desde, hasta],
    queryFn: () =>
      datos<EntradaMenu[]>(
        supabase.from('menu').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('creado_en'),
      ),
  })
}

export type EntradaNueva = Pick<EntradaMenu, 'fecha' | 'comida' | 'receta_id' | 'texto' | 'para_persona' | 'porciones_extra' | 'nota'>

export function useGuardarEntradaMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...e }: Partial<EntradaNueva> & { id?: string }) =>
      datos(id ? supabase.from('menu').update(e).eq('id', id) : supabase.from('menu').insert(e as EntradaNueva)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.menu }),
  })
}

export function useInsertarMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lista: EntradaNueva[]) => datos(supabase.from('menu').insert(lista)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.menu }),
  })
}

export function useBorrarEntradaMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => datos(supabase.from('menu').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.menu }),
  })
}

export function useSuper() {
  return useQuery({
    queryKey: CLAVES.super,
    queryFn: async () => {
      const filas = await datos<ItemSuper[]>(supabase.from('super_items').select('*').order('creado_en'))
      return filas.map((i) => ({ ...i, cantidad: numN(i.cantidad) }))
    },
  })
}

export type ItemSuperNuevo = Pick<ItemSuper, 'nombre' | 'cantidad' | 'unidad' | 'seccion' | 'nota'>

export function useGuardarItemSuper() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...i }: Partial<ItemSuperNuevo> & { id?: string; comprado?: boolean }) =>
      datos(id ? supabase.from('super_items').update(i).eq('id', id) : supabase.from('super_items').insert(i as ItemSuperNuevo)),
    onMutate: async (v) => {
      // Marcar comprado se siente instantáneo
      if (!v.id || v.comprado === undefined) return
      await qc.cancelQueries({ queryKey: CLAVES.super })
      const previo = qc.getQueryData<ItemSuper[]>(CLAVES.super)
      qc.setQueryData<ItemSuper[]>(CLAVES.super, (l) => l?.map((x) => (x.id === v.id ? { ...x, comprado: !!v.comprado } : x)))
      return { previo }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previo) qc.setQueryData(CLAVES.super, ctx.previo)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CLAVES.super }),
  })
}

export function useBorrarItemsSuper() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => datos(supabase.from('super_items').delete().in('id', ids)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.super }),
  })
}

export function useGenerarSuper() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lunes: string) => datos<number>(supabase.rpc('generar_super', { p_lunes: lunes })),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVES.super }),
  })
}
