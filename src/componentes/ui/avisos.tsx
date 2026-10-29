import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './base'

interface Toast {
  id: number
  texto: string
  tono: 'ok' | 'error'
}

const Ctx = createContext<((texto: string, tono?: Toast['tono']) => void) | null>(null)

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([])
  const sig = useRef(0)

  const avisar = useCallback((texto: string, tono: Toast['tono'] = 'ok') => {
    const id = ++sig.current
    setLista((l) => [...l.slice(-2), { id, texto, tono }])
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), tono === 'error' ? 5000 : 2800)
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
