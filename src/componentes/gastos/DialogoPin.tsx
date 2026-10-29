import { useCallback, useEffect, useState } from 'react'
import { Boton } from '@/componentes/ui/base'
import { Avatar } from '@/componentes/ui/datos'
import { Hoja } from '@/componentes/ui/hoja'
import { PuntosPin, Teclado } from '@/componentes/ui/teclado'
import type { Perfil } from '@/lib/tipos'

/**
 * Pide el PIN de una persona. onConfirmar debe devolver true si el PIN fue aceptado.
 */
export function DialogoPin({
  persona,
  indice,
  titulo,
  textoAccion,
  onConfirmar,
  onCerrar,
}: {
  persona: Perfil | null
  indice: number
  titulo: string
  textoAccion: string
  onConfirmar: (pin: string) => Promise<boolean>
  onCerrar: () => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    setPin('')
    setError(null)
  }, [persona?.id])

  const tecla = useCallback((t: string) => {
    setError(null)
    setPin((p) => (t === 'borrar' ? p.slice(0, -1) : p.length >= 6 ? p : p + t))
  }, [])

  const enviar = async () => {
    if (pin.length < 4) return
    setEnviando(true)
    try {
      const ok = await onConfirmar(pin)
      if (!ok) {
        setError('PIN incorrecto')
        setPin('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Hoja abierta={!!persona} onCerrar={onCerrar} titulo={titulo} ancho="sm">
      {persona && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar persona={persona} indice={indice} tamano={44} />
            <div>
              <p className="font-semibold tracking-tight">PIN de {persona.nombre}</p>
              <p className="text-sm text-texto-2">Solo {persona.nombre} debería escribirlo.</p>
            </div>
          </div>
          <PuntosPin largo={pin.length} error={!!error} />
          <p className="-mt-3 min-h-5 text-center text-sm text-rojo" role="alert">
            {error}
          </p>
          <Teclado onTecla={tecla} />
          <Boton tamano="lg" ancho disabled={pin.length < 4} cargando={enviando} onClick={enviar}>
            {textoAccion}
          </Boton>
        </div>
      )}
    </Hoja>
  )
}
