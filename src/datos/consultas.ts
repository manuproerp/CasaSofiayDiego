import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { rangoMes } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import type {
  Aprobacion,
  Categoria,
  Configuracion,
  CorreoPermitido,
  Gasto,
  ItemPresupuesto,
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

/** Gastos del año con vínculo a un eventual (para saber si ya se pagó) */
export function usePagosEventuales(anio: number) {
  return useQuery({
    queryKey: [...CLAVES.gastos, 'eventuales', anio],
    queryFn: async () => {
      const filas = await datos<Gasto[]>(
        supabase
          .from('gastos')
          .select('*')
          .not('presupuesto_id', 'is', null)
          .neq('estado', 'rechazado')
          .gte('fecha', `${anio}-01-01`)
          .lte('fecha', `${anio}-12-31`),
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
  'fecha' | 'monto' | 'moneda' | 'tipo_cambio' | 'tipo' | 'categoria_id' | 'persona_id' | 'descripcion' | 'presupuesto_id'
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
    mutationFn: async ({ id, ...p }: Pick<Perfil, 'id'> & Partial<Pick<Perfil, 'nombre' | 'mesada' | 'color'>>) =>
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
