import { X } from '@phosphor-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BotonIcono, cx } from './base'

/**
 * Hoja modal: sube desde abajo en el celular, aparece centrada en tablet/desktop.
 */
export function Hoja({
  abierta,
  onCerrar,
  titulo,
  subtitulo,
  children,
  pie,
  ancho = 'md',
  izquierda,
}: {
  abierta: boolean
  onCerrar: () => void
  titulo: ReactNode
  subtitulo?: ReactNode
  children: ReactNode
  pie?: ReactNode
  ancho?: 'sm' | 'md' | 'lg'
  izquierda?: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierta) return
    const previo = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Solo cierra la hoja de más arriba cuando hay varias abiertas
      const dialogos = document.querySelectorAll('[role="dialog"]')
      if (dialogos[dialogos.length - 1] === panel.current) onCerrar()
    }
    document.addEventListener('keydown', alTeclear)
    requestAnimationFrame(() => {
      const foco = panel.current?.querySelector<HTMLElement>('[data-autofoco]')
      ;(foco ?? panel.current)?.focus()
    })
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', alTeclear)
      previo?.focus?.()
    }
  }, [abierta, onCerrar])

  if (!abierta) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div
        className="absolute inset-0 bg-[#0d1410]/40 backdrop-blur-[2px] [animation:entrar_.25s_ease-out_both]"
        onClick={onCerrar}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-superficie shadow-flotante outline-none',
          'pb-[env(safe-area-inset-bottom)] [animation:subir_.38s_var(--ease-suave)_both]',
          'md:rounded-[28px] md:pb-0 md:[animation:aparecer_.3s_var(--ease-suave)_both]',
          { sm: 'md:max-w-md', md: 'md:max-w-xl', lg: 'md:max-w-3xl' }[ancho],
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-borde-fuerte md:hidden" aria-hidden />
        <header className="flex items-start gap-2 px-6 pt-4 pb-2 md:pt-6">
          {izquierda}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1.5">
            <h2 className="truncate text-xl font-semibold tracking-tight">{titulo}</h2>
            {subtitulo && <p className="text-sm text-texto-2">{subtitulo}</p>}
          </div>
          <BotonIcono icono={X} etiqueta="Cerrar" onClick={onCerrar} className="-mr-2" />
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-6">{children}</div>
        {pie && <footer className="border-t border-borde px-6 py-4">{pie}</footer>}
      </div>
    </div>,
    document.body,
  )
}
