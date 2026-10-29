import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface EstadoSesion {
  sesion: Session | null
  cargando: boolean
  /** true cuando el usuario llegó desde el correo de "olvidé mi contraseña" */
  recuperando: boolean
  terminarRecuperacion: () => void
}

const Ctx = createContext<EstadoSesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSesion(s)
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <Ctx.Provider value={{ sesion, cargando, recuperando, terminarRecuperacion: () => setRecuperando(false) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSesion() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSesion fuera de ProveedorSesion')
  return v
}
