import { aLempiras } from './formato'
import type { Aporte, Categoria, Fondo, Gasto, ItemPresupuesto, Perfil } from './tipos'

export type Semaforo = 'ok' | 'cerca' | 'excedido' | 'sin'

/**
 * conTope=false para montos fijos: llegar al 100 % es lo esperado,
 * así que solo se marca si se excede.
 */
export function semaforo(real: number, presupuesto: number, conTope = true): Semaforo {
  if (presupuesto <= 0) return real > 0 ? 'sin' : 'ok'
  if (real > presupuesto + 0.005) return 'excedido'
  if (conTope && real >= presupuesto * 0.85) return 'cerca'
  return 'ok'
}

// ───────────── Presupuesto mensual ─────────────

export interface FilaCategoria {
  categoria: Categoria
  fijo: number
  variable: number
  presupuesto: number
  real: number
  semaforo: Semaforo
}

export interface ResumenMes {
  filas: FilaCategoria[]
  sinPresupuesto: FilaCategoria[]
  presupuestoTotal: number
  realTotal: number
  pendienteTotal: number
  /** Pagado desde apartados este mes (no cuenta en realTotal) */
  pagadoDesdeApartados: number
  faltaTC: boolean
}

export function resumenMes(params: {
  categorias: Categoria[]
  items: ItemPresupuesto[]
  gastos: Gasto[]
  tc: number | null
}): ResumenMes {
  const { categorias, items, gastos, tc } = params
  let faltaTC = false
  const enL = (monto: number, moneda: ItemPresupuesto['moneda']) => {
    if (moneda === 'USD' && !tc) faltaTC = true
    return aLempiras(monto, moneda, tc)
  }

  const porCat = new Map<string, FilaCategoria>()
  const fila = (c: Categoria) => {
    let f = porCat.get(c.id)
    if (!f) {
      f = { categoria: c, fijo: 0, variable: 0, presupuesto: 0, real: 0, semaforo: 'ok' }
      porCat.set(c.id, f)
    }
    return f
  }
  const mapaCat = new Map(categorias.map((c) => [c.id, c]))

  for (const it of items) {
    const c = mapaCat.get(it.categoria_id)
    if (!c) continue
    if (it.tipo === 'fijo') fila(c).fijo += enL(it.monto, it.moneda)
    else fila(c).variable += enL(it.monto, it.moneda)
  }

  let realTotal = 0
  let pendienteTotal = 0
  let pagadoDesdeApartados = 0
  for (const g of gastos) {
    if (g.tipo !== 'hogar') continue
    if (g.estado === 'pendiente') pendienteTotal += g.monto_lempiras
    if (g.estado !== 'aprobado') continue
    // Lo pagado desde un apartado ya se contó mes a mes como aporte
    if (g.fondo_id) {
      pagadoDesdeApartados += g.monto_lempiras
      continue
    }
    realTotal += g.monto_lempiras
    const c = g.categoria_id ? mapaCat.get(g.categoria_id) : undefined
    if (c) fila(c).real += g.monto_lempiras
  }

  const todas = [...porCat.values()].map((f) => {
    f.presupuesto = f.fijo + f.variable
    f.semaforo = semaforo(f.real, f.presupuesto, f.variable > 0)
    return f
  })
  const orden = (a: FilaCategoria, b: FilaCategoria) =>
    a.categoria.orden - b.categoria.orden || a.categoria.nombre.localeCompare(b.categoria.nombre)

  return {
    filas: todas.filter((f) => f.presupuesto > 0).sort(orden),
    sinPresupuesto: todas.filter((f) => f.presupuesto === 0 && f.real > 0).sort((a, b) => b.real - a.real),
    presupuestoTotal: todas.reduce((s, f) => s + f.presupuesto, 0),
    realTotal,
    pendienteTotal,
    pagadoDesdeApartados,
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

// ───────────── Apartados (anuales y metas) ─────────────

const indiceMes = (anio: number, mes: number) => anio * 12 + (mes - 1)

export interface EstadoFondo {
  fondo: Fondo
  /** Suma de aportes del ciclo actual, en la moneda del fondo */
  apartado: number
  /** Apartado antes del mes consultado (para calcular la cuota) */
  apartadoAntes: number
  /** Aportado en el mes consultado */
  aportadoMes: number
  falta: number
  /** Meses que quedan incluyendo el del vencimiento; null si no hay fecha */
  mesesRestantes: number | null
  /** Cuota sugerida del mes consultado; null si no hay fecha */
  cuotaSugerida: number | null
  /** Días hasta la fecha objetivo (negativo si ya pasó) */
  dias: number | null
  pct: number
  aportes: Aporte[]
}

function diasHasta(iso: string, hoy: string) {
  const a = new Date(iso + 'T00:00:00')
  const b = new Date(hoy + 'T00:00:00')
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

export function estadoFondo(fondo: Fondo, aportes: Aporte[], anio: number, mes: number, hoy: string): EstadoFondo {
  const delCiclo = aportes.filter((a) => a.fondo_id === fondo.id && a.ciclo === fondo.ciclo)
  const ref = indiceMes(anio, mes)
  const apartado = delCiclo.reduce((s, a) => s + a.monto, 0)
  const apartadoAntes = delCiclo.filter((a) => indiceMes(a.anio, a.mes) < ref).reduce((s, a) => s + a.monto, 0)
  const aportadoMes = delCiclo.filter((a) => a.anio === anio && a.mes === mes).reduce((s, a) => s + a.monto, 0)
  const falta = Math.max(0, fondo.monto_objetivo - apartado)

  let mesesRestantes: number | null = null
  let cuotaSugerida: number | null = null
  if (fondo.fecha_objetivo) {
    const [fa, fm] = fondo.fecha_objetivo.split('-').map(Number)
    mesesRestantes = Math.max(1, indiceMes(fa, fm) - ref + 1)
    cuotaSugerida = Math.max(0, Math.ceil(((fondo.monto_objetivo - apartadoAntes) / mesesRestantes) * 100) / 100)
  }

  return {
    fondo,
    apartado,
    apartadoAntes,
    aportadoMes,
    falta,
    mesesRestantes,
    cuotaSugerida,
    dias: fondo.fecha_objetivo ? diasHasta(fondo.fecha_objetivo, hoy) : null,
    pct: fondo.monto_objetivo > 0 ? Math.min(100, (apartado / fondo.monto_objetivo) * 100) : 0,
    aportes: aportes.filter((a) => a.fondo_id === fondo.id),
  }
}

export interface ResumenApartados {
  fondos: EstadoFondo[]
  /** Totales del mes en lempiras */
  sugeridoMes: number
  aportadoMes: number
  faltaTC: boolean
}

export function resumenApartados(
  fondos: Fondo[],
  aportes: Aporte[],
  anio: number,
  mes: number,
  hoy: string,
  tc: number | null,
): ResumenApartados {
  let faltaTC = false
  const activos = fondos.filter((f) => f.estado === 'activo').map((f) => estadoFondo(f, aportes, anio, mes, hoy))
  const enL = (m: number, f: Fondo) => {
    if (f.moneda === 'USD' && !tc) faltaTC = true
    return aLempiras(m, f.moneda, tc)
  }
  return {
    fondos: activos,
    sugeridoMes: activos.reduce((s, e) => s + enL(e.cuotaSugerida ?? 0, e.fondo), 0),
    aportadoMes: activos.reduce((s, e) => s + enL(e.aportadoMes, e.fondo), 0),
    faltaTC,
  }
}
