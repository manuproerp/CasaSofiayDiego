import { Backspace } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { cx } from './base'

/** Teclado numérico grande para la tablet. Acepta también el teclado físico. */
export function Teclado({
  onTecla,
  conPunto = false,
  className,
}: {
  onTecla: (t: string) => void
  conPunto?: boolean
  className?: string
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return
      if (/^[0-9]$/.test(e.key)) onTecla(e.key)
      else if (conPunto && (e.key === '.' || e.key === ',')) onTecla('.')
      else if (e.key === 'Backspace') onTecla('borrar')
    }
    document.addEventListener('keydown', f)
    return () => document.removeEventListener('keydown', f)
  }, [onTecla, conPunto])

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', conPunto ? '.' : '', '0', 'borrar']
  return (
    <div className={cx('grid grid-cols-3 gap-2', className)}>
      {teclas.map((t, i) =>
        t === '' ? (
          <span key={i} />
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => onTecla(t)}
            aria-label={t === 'borrar' ? 'Borrar' : t}
            className="pulsable num flex h-14 items-center [@media(max-height:860px)]:h-12 justify-center rounded-[16px] bg-superficie-2 text-[22px] font-medium hover:bg-borde active:bg-borde-fuerte"
          >
            {t === 'borrar' ? <Backspace size={24} /> : t}
          </button>
        ),
      )}
    </div>
  )
}

/** Puntos del PIN */
export function PuntosPin({ largo, total = 4, error }: { largo: number; total?: number; error?: boolean }) {
  return (
    <div className={cx('flex justify-center gap-3.5 py-2', error && '[animation:temblar_.35s_ease-in-out]')}>
      {Array.from({ length: Math.max(total, largo) }).map((_, i) => (
        <span
          key={i}
          className={cx(
            'size-3.5 rounded-full border-2 transition-colors duration-150',
            error ? 'border-rojo bg-rojo' : i < largo ? 'border-primario bg-primario' : 'border-borde-fuerte',
          )}
        />
      ))}
    </div>
  )
}
