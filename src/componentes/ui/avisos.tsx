import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './base'

interface Accion {
  texto: string
  alPulsar: () => void
}

interface Toast {
  id: number
  texto: string
  tono: 'ok' | 'error'
  accion?: Accion
}

type Avisar = (texto: string, tono?: Toast['tono'], accion?: Accion) => void

const Ctx = createContext<Avisar | null>(null)

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([])
  const sig = useRef(0)

  const avisar = useCallback<Avisar>((texto, tono = 'ok', accion) => {
    const id = ++sig.current
    setLista((l) => [...l.slice(-2), { id, texto, tono, accion }])
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), tono === 'error' ? 5000 : accion ? 5000 : 2800)
  }, [])

  return (
    <Ctx.Provider value={avisar}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8"
        >
          {lista.map((t) => (
            <div
              key={t.id}
              className={cx(
                'flex items-center gap-2.5 rounded-full py-3 pr-5 pl-4 text-sm font-medium shadow-flotante [animation:aparecer_.3s_var(--ease-suave)_both]',
                t.tono === 'ok' ? 'bg-hero text-sobre-hero' : 'bg-rojo text-white',
              )}
            >
              {t.tono === 'ok' ? <CheckCircle size={20} weight="fill" /> : <WarningCircle size={20} weight="fill" />}
              {t.texto}
              {t.accion && (
                <button
                  type="button"
                  onClick={() => {
                    t.accion!.alPulsar()
                    setLista((l) => l.filter((x) => x.id !== t.id))
                  }}
                  className="pointer-events-auto -my-2 -mr-3 ml-1 h-10 rounded-full px-4 font-semibold underline-offset-2 hover:underline"
                >
                  {t.accion.texto}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  )
}

export function useAvisar() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAvisar fuera de ProveedorAvisos')
  return v
}
