import { aLempiras } from './formato'
import type { Categoria, Gasto, ItemPresupuesto, Perfil } from './tipos'

export type Semaforo = 'ok' | 'cerca' | 'excedido' | 'sin'

/**
 * conTope=false para montos fijos o eventuales: llegar al 100 % es lo esperado,
 * así que solo se marca si se excede.
 */
export function semaforo(real: number, presupuesto: number, conTope = true): Semaforo {
  if (presupuesto <= 0) return real > 0 ? 'sin' : 'ok'
  if (real > presupuesto + 0.005) return 'excedido'
  if (conTope && real >= presupuesto * 0.85) return 'cerca'
  return 'ok'
}

export interface FilaCategoria {
  categoria: Categoria
  fijo: number
  variable: number
  eventual: number
  presupuesto: number
  real: number
  semaforo: Semaforo
}

export interface EventualMes {
  item: ItemPresupuesto
  categoria: Categoria | undefined
  montoL: number
  pago: Gasto | undefined
}

export interface ResumenMes {
  filas: FilaCategoria[]
  sinPresupuesto: FilaCategoria[]
  eventuales: EventualMes[]
  presupuestoTotal: number
  realTotal: number
  pendienteTotal: number
  faltaTC: boolean
}

export function aplicaEventual(item: ItemPresupuesto, anio: number, mes: number) {
  return item.tipo === 'eventual' && item.mes === mes && (item.recurrente || item.anio === anio)
}

export function resumenMes(params: {
  anio: number
  mes: number
  categorias: Categoria[]
  items: ItemPresupuesto[]
  gastos: Gasto[]
  pagosAnio: Gasto[]
  tc: number | null
}): ResumenMes {
  const { anio, mes, categorias, items, gastos, pagosAnio, tc } = params
  let faltaTC = false
  const enL = (i: ItemPresupuesto) => {
    if (i.moneda === 'USD' && !tc) faltaTC = true
    return aLempiras(i.monto, i.moneda, tc)
  }

  const porCat = new Map<string, FilaCategoria>()
  const fila = (c: Categoria) => {
    let f = porCat.get(c.id)
    if (!f) {
      f = { categoria: c, fijo: 0, variable: 0, eventual: 0, presupuesto: 0, real: 0, semaforo: 'ok' }
      porCat.set(c.id, f)
    }
    return f
  }
  const mapaCat = new Map(categorias.map((c) => [c.id, c]))

  const eventuales: EventualMes[] = []
  for (const it of items) {
    const c = mapaCat.get(it.categoria_id)
    if (!c) continue
    if (it.tipo === 'fijo') fila(c).fijo += enL(it)
    else if (it.tipo === 'variable') fila(c).variable += enL(it)
    else if (aplicaEventual(it, anio, mes)) {
      const m = enL(it)
      fila(c).eventual += m
      eventuales.push({ item: it, categoria: c, montoL: m, pago: pagosAnio.find((g) => g.presupuesto_id === it.id) })
    }
  }

  let realTotal = 0
  let pendienteTotal = 0
  for (const g of gastos) {
    if (g.tipo !== 'hogar') continue
    if (g.estado === 'pendiente') pendienteTotal += g.monto_lempiras
    if (g.estado !== 'aprobado') continue
    realTotal += g.monto_lempiras
    const c = g.categoria_id ? mapaCat.get(g.categoria_id) : undefined
    if (c) fila(c).real += g.monto_lempiras
  }

  const todas = [...porCat.values()].map((f) => {
    f.presupuesto = f.fijo + f.variable + f.eventual
    f.semaforo = semaforo(f.real, f.presupuesto, f.variable > 0)
    return f
  })
  const orden = (a: FilaCategoria, b: FilaCategoria) =>
    a.categoria.orden - b.categoria.orden || a.categoria.nombre.localeCompare(b.categoria.nombre)

  eventuales.sort((a, b) => Number(!!a.pago) - Number(!!b.pago) || b.montoL - a.montoL)

  return {
    filas: todas.filter((f) => f.presupuesto > 0).sort(orden),
    sinPresupuesto: todas.filter((f) => f.presupuesto === 0 && f.real > 0).sort((a, b) => b.real - a.real),
    eventuales,
    presupuestoTotal: todas.reduce((s, f) => s + f.presupuesto, 0),
    realTotal,
    pendienteTotal,
    faltaTC,
  }
}

export interface Mesada {
  persona: Perfil
  asignada: number | null
  gastada: number
}

export function mesadas(personas: Perfil[], gastos: Gasto[]): Mesada[] {
  return personas.map((p) => ({
    persona: p,
    asignada: p.mesada,
    gastada: gastos
      .filter((g) => g.tipo === 'mesada' && g.persona_id === p.id && g.estado !== 'rechazado')
      .reduce((s, g) => s + g.monto_lempiras, 0),
  }))
}
