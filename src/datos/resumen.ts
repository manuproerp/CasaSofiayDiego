import { useMemo } from 'react'
import { mesadas, resumenMes } from '@/lib/calculos'
import {
  useCategorias,
  useGastosMes,
  usePagosEventuales,
  usePersonas,
  usePresupuesto,
  useTCActual,
} from './consultas'

/** Todo lo necesario para "cómo vamos este mes" */
export function useResumenMes(anio: number, mes: number) {
  const categorias = useCategorias()
  const items = usePresupuesto()
  const gastos = useGastosMes(anio, mes)
  const pagos = usePagosEventuales(anio)
  const { tc, isLoading: cargandoTC } = useTCActual()
  const { personas, isLoading: cargandoPersonas } = usePersonas()

  const consultas = [categorias, items, gastos, pagos]
  const cargando = consultas.some((q) => q.isLoading) || cargandoTC || cargandoPersonas
  const error = consultas.find((q) => q.error)?.error ?? null

  const resumen = useMemo(() => {
    if (!categorias.data || !items.data || !gastos.data || !pagos.data) return null
    return resumenMes({
      anio,
      mes,
      categorias: categorias.data,
      items: items.data,
      gastos: gastos.data,
      pagosAnio: pagos.data,
      tc: tc?.valor ?? null,
    })
  }, [anio, mes, categorias.data, items.data, gastos.data, pagos.data, tc])

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
