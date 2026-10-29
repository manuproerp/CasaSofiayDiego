import { useMemo } from 'react'
import { mesadas, resumenApartados, resumenMes } from '@/lib/calculos'
import { hoyISO } from '@/lib/formato'
import {
  useAportes,
  useCategorias,
  useFondos,
  useGastosMes,
  usePersonas,
  usePresupuesto,
  useTCActual,
} from './consultas'

/** Todo lo necesario para "cómo vamos este mes" */
export function useResumenMes(anio: number, mes: number) {
  const categorias = useCategorias()
  const items = usePresupuesto()
  const gastos = useGastosMes(anio, mes)
  const { tc, isLoading: cargandoTC } = useTCActual()
  const { personas, isLoading: cargandoPersonas } = usePersonas()

  const consultas = [categorias, items, gastos]
  const cargando = consultas.some((q) => q.isLoading) || cargandoTC || cargandoPersonas
  const error = consultas.find((q) => q.error)?.error ?? null

  const resumen = useMemo(() => {
    if (!categorias.data || !items.data || !gastos.data) return null
    return resumenMes({ categorias: categorias.data, items: items.data, gastos: gastos.data, tc: tc?.valor ?? null })
  }, [categorias.data, items.data, gastos.data, tc])

  const listaMesadas = useMemo(() => mesadas(personas, gastos.data ?? []), [personas, gastos.data])

  return {
    resumen,
    mesadas: listaMesadas,
    gastos: gastos.data ?? [],
    items: items.data ?? [],
    categorias: categorias.data ?? [],
    cargando,
    error,
    reintentar: () => consultas.forEach((q) => q.refetch()),
  }
}

/** Estado de todos los apartados activos para un mes */
export function useApartados(anio: number, mes: number) {
  const fondos = useFondos()
  const aportes = useAportes()
  const { tc } = useTCActual()
  const resumen = useMemo(() => {
    if (!fondos.data || !aportes.data) return null
    return resumenApartados(fondos.data, aportes.data, anio, mes, hoyISO(), tc?.valor ?? null)
  }, [fondos.data, aportes.data, anio, mes, tc])
  return {
    resumen,
    todos: fondos.data ?? [],
    aportes: aportes.data ?? [],
    cargando: fondos.isLoading || aportes.isLoading,
    error: fondos.error ?? aportes.error ?? null,
    reintentar: () => {
      fondos.refetch()
      aportes.refetch()
    },
  }
}
