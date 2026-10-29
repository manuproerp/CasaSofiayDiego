import type { Moneda } from './tipos'

const ZONA = 'America/Tegucigalpa'

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const fmtNum = new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNumCorto = new Intl.NumberFormat('es-HN', { maximumFractionDigits: 0 })

/** L 1,234.50 · $ 89.00 */
export function dinero(valor: number | null | undefined, moneda: Moneda = 'HNL', opciones?: { corto?: boolean }) {
  const v = Number(valor ?? 0)
  const simbolo = moneda === 'USD' ? '$' : 'L'
  const cuerpo = opciones?.corto ? fmtNumCorto.format(v) : fmtNum.format(v)
  return `${v < 0 ? '−' : ''}${simbolo} ${cuerpo.replace('-', '')}`
}

export function simbolo(moneda: Moneda) {
  return moneda === 'USD' ? '$' : 'L'
}

/** Fecha de hoy en Honduras, formato YYYY-MM-DD */
export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}

export function partesHoy() {
  const [a, m, d] = hoyISO().split('-').map(Number)
  return { anio: a, mes: m, dia: d }
}

export function diasEnMes(anio: number, mes: number) {
  return new Date(anio, mes, 0).getDate()
}

export function rangoMes(anio: number, mes: number) {
  const ini = `${anio}-${String(mes).padStart(2, '0')}-01`
  const fin = `${anio}-${String(mes).padStart(2, '0')}-${String(diasEnMes(anio, mes)).padStart(2, '0')}`
  return { ini, fin }
}

export function nombreMes(mes: number, conMayuscula = true) {
  const n = MESES[mes - 1] ?? ''
  return conMayuscula ? n.charAt(0).toUpperCase() + n.slice(1) : n
}

function fechaLocal(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** "Hoy", "Ayer", "lunes 27 oct" */
export function fechaRelativa(iso: string) {
  const hoy = fechaLocal(hoyISO())
  const f = fechaLocal(iso)
  const dif = Math.round((hoy.getTime() - f.getTime()) / 86_400_000)
  if (dif === 0) return 'Hoy'
  if (dif === 1) return 'Ayer'
  const txt = new Intl.DateTimeFormat('es-HN', { weekday: 'long', day: 'numeric', month: 'short' }).format(f)
  return txt.charAt(0).toUpperCase() + txt.slice(1).replace('.', '')
}

export function fechaCorta(iso: string) {
  return new Intl.DateTimeFormat('es-HN', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(fechaLocal(iso))
    .replace('.', '')
}

export function fechaLarga(d = new Date()) {
  const txt = new Intl.DateTimeFormat('es-HN', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

export function saludo() {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/** Parsea "1,234.5" o "1234,5" de forma tolerante */
export function parsearMonto(txt: string): number | null {
  const limpio = txt.replace(/[^\d.,]/g, '')
  if (!limpio) return null
  const normal = limpio.includes('.') ? limpio.replace(/,/g, '') : limpio.replace(',', '.')
  const n = Number(normal)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

export function aLempiras(monto: number, moneda: Moneda, tc: number | null | undefined) {
  if (moneda === 'HNL') return monto
  return tc ? Math.round(monto * tc * 100) / 100 : 0
}

export function porcentaje(parte: number, total: number) {
  if (!total) return 0
  return Math.round((parte / total) * 1000) / 10
}
