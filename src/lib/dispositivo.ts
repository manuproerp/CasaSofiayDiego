import { useSyncExternalStore } from 'react'

/** Preferencias guardadas solo en este dispositivo (no se sincronizan). */
export type Tema = 'claro' | 'oscuro' | 'nocturno'

interface PrefsDispositivo {
  modoTablet: boolean
  tema: Tema
}

const CLAVE = 'casa:dispositivo'
const POR_DEFECTO: PrefsDispositivo = { modoTablet: false, tema: 'claro' }

function leer(): PrefsDispositivo {
  try {
    const raw = localStorage.getItem(CLAVE)
    return raw ? { ...POR_DEFECTO, ...JSON.parse(raw) } : POR_DEFECTO
  } catch {
    return POR_DEFECTO
  }
}

let actual = leer()
const oyentes = new Set<() => void>()

export function guardarPrefs(cambios: Partial<PrefsDispositivo>) {
  actual = { ...actual, ...cambios }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual))
  } catch {
    /* sin almacenamiento: solo en memoria */
  }
  aplicarTema()
  oyentes.forEach((f) => f())
}

export function usePrefsDispositivo() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    () => actual,
  )
}

/** Nocturno: oscuro de 7 p. m. a 6 a. m. (hora de Honduras) */
function esDeNoche() {
  const h = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Tegucigalpa', hour: 'numeric', hourCycle: 'h23' }).format(new Date()),
  )
  return h >= 19 || h < 6
}

export function aplicarTema() {
  const oscuro = actual.tema === 'oscuro' || (actual.tema === 'nocturno' && esDeNoche())
  document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro'
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', oscuro ? '#0f1311' : '#f6f4ee')
}

aplicarTema()
setInterval(aplicarTema, 60_000)
