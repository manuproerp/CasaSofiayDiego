import { sumarDias } from './cocina'
import type { Ausencia, DiaTareas, Perfil, Tarea } from './tipos'

const MS_DIA = 86_400_000

function utc(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

/** Días de `desde` a `hasta` (positivo si `hasta` es después) */
export function diasEntre(desde: string, hasta: string) {
  return Math.round((utc(hasta) - utc(desde)) / MS_DIA)
}

export const FRECUENCIAS = [
  { valor: 1, texto: 'Diario' },
  { valor: 2, texto: 'Cada 2 días' },
  { valor: 3, texto: 'Cada 3 días' },
  { valor: 4, texto: 'Cada 4 días' },
  { valor: 7, texto: 'Semanal' },
  { valor: 14, texto: 'Cada 2 semanas' },
  { valor: 30, texto: 'Mensual' },
]

export function frecuenciaTexto(n: number) {
  return FRECUENCIAS.find((f) => f.valor === n)?.texto ?? `Cada ${n} días`
}

export function ausenciaEn(personaId: string | null | undefined, fecha: string, ausencias: Ausencia[]) {
  if (!personaId) return null
  return ausencias.find((a) => a.persona_id === personaId && a.desde <= fecha && fecha <= a.hasta) ?? null
}

/** Dueña/o natural de la tarea (sin contar ausencias) */
export function duenaDe(t: Tarea) {
  return t.modo === 'fija' ? t.asignada_a : t.le_toca
}

/**
 * A quién le cae una tarea un día: la misma regla que `cubrir()` en la base.
 * Si la persona está ausente, la cubre la otra; si las dos están fuera, nadie.
 */
export function responsableEn(t: Tarea, fecha: string, ausencias: Ausencia[], personas: Perfil[]) {
  const base = duenaDe(t) ?? personas[0]?.id ?? null
  if (!ausenciaEn(base, fecha, ausencias)) return { persona: base, cubre: false }
  const otra = personas.find((p) => p.id !== base)?.id ?? null
  if (!otra || ausenciaEn(otra, fecha, ausencias)) return { persona: null, cubre: false }
  return { persona: otra, cubre: true }
}

/** "Atrasada 2 días", "Hoy", "Mañana", "En 3 días" */
export function vencimiento(proxima: string, hoy: string) {
  const d = diasEntre(hoy, proxima)
  if (d < 0) return { texto: d === -1 ? 'Atrasada desde ayer' : `Atrasada ${-d} días`, atrasada: true, dias: d }
  if (d === 0) return { texto: 'Hoy', atrasada: false, dias: d }
  if (d === 1) return { texto: 'Mañana', atrasada: false, dias: d }
  return { texto: `En ${d} días`, atrasada: false, dias: d }
}

export interface Racha {
  actual: number
  mejor: number
  /** Últimos días cerrados, del más viejo al más nuevo, + hoy al final */
  ultimos: { fecha: string; estado: DiaTareas['estado'] | 'hoy' | 'sin_dato' }[]
  congelada: boolean
}

/**
 * Racha: días seguidos sin tareas vencidas al cerrar el día. Los días de ausencia
 * no suman ni rompen. Hoy suma en cuanto la persona ya no tiene nada pendiente.
 */
export function calcularRacha(dias: DiaTareas[], personaId: string, hoy: string, hoyAlDia: boolean, ausenteHoy: boolean): Racha {
  const propios = dias.filter((d) => d.persona_id === personaId).sort((a, b) => a.fecha.localeCompare(b.fecha))
  let corrida = 0
  let mejor = 0
  for (const d of propios) {
    if (d.estado === 'cumplido') corrida += 1
    else if (d.estado === 'fallado') corrida = 0
    mejor = Math.max(mejor, corrida)
  }
  const actual = corrida + (hoyAlDia && !ausenteHoy ? 1 : 0)
  mejor = Math.max(mejor, actual)

  const porFecha = new Map(propios.map((d) => [d.fecha, d.estado]))
  const ultimos: Racha['ultimos'] = []
  for (let i = 6; i >= 1; i--) {
    const f = sumarDias(hoy, -i)
    ultimos.push({ fecha: f, estado: porFecha.get(f) ?? 'sin_dato' })
  }
  ultimos.push({ fecha: hoy, estado: 'hoy' })
  return { actual, mejor, ultimos, congelada: ausenteHoy }
}
