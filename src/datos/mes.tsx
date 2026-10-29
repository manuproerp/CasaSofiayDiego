import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { partesHoy } from '@/lib/formato'

interface EstadoMes {
  anio: number
  mes: number
  esMesActual: boolean
  irA: (anio: number, mes: number) => void
  mover: (delta: number) => void
  irAHoy: () => void
}

const Ctx = createContext<EstadoMes | null>(null)

export function ProveedorMes({ children }: { children: ReactNode }) {
  const hoy = partesHoy()
  const [sel, setSel] = useState({ anio: hoy.anio, mes: hoy.mes })

  const mover = useCallback((delta: number) => {
    setSel(({ anio, mes }) => {
      const total = anio * 12 + (mes - 1) + delta
      return { anio: Math.floor(total / 12), mes: (total % 12) + 1 }
    })
  }, [])

  const valor = useMemo<EstadoMes>(() => {
    const h = partesHoy()
    return {
      ...sel,
      esMesActual: sel.anio === h.anio && sel.mes === h.mes,
      irA: (anio, mes) => setSel({ anio, mes }),
      mover,
      irAHoy: () => setSel({ anio: h.anio, mes: h.mes }),
    }
  }, [sel, mover])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useMes() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useMes fuera de ProveedorMes')
  return v
}
