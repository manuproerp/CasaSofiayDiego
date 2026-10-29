import type { Semaforo } from '@/lib/calculos'
import { dinero } from '@/lib/formato'
import type { Moneda, Perfil } from '@/lib/tipos'
import { cx } from './base'

/** Monto con símbolo pequeño y cifras tabulares */
export function Monto({
  valor,
  moneda = 'HNL',
  className,
  decimales = true,
}: {
  valor: number
  moneda?: Moneda
  className?: string
  decimales?: boolean
}) {
  const txt = dinero(valor, moneda, { corto: !decimales })
  const [simbolo, ...resto] = txt.split(' ')
  return (
    <span className={cx('num whitespace-nowrap', className)}>
      <span className="mr-[0.18em] text-[0.72em] font-medium opacity-60">{simbolo}</span>
      {resto.join(' ')}
    </span>
  )
}

const TONO_BARRA: Record<Semaforo, string> = {
  ok: 'bg-v500',
  cerca: 'bg-ambar-barra',
  excedido: 'bg-rojo-barra',
  sin: 'bg-texto-3',
}

/** Barra presupuesto vs real. Si se excede, el excedente se muestra al final. */
export function Barra({
  real,
  total,
  semaforo = 'ok',
  className,
  sobreHero,
}: {
  real: number
  total: number
  semaforo?: Semaforo
  className?: string
  sobreHero?: boolean
}) {
  const pct = total > 0 ? Math.min(100, (real / total) * 100) : real > 0 ? 100 : 0
  return (
    <div
      className={cx('h-2 w-full overflow-hidden rounded-full', sobreHero ? 'bg-white/15' : 'bg-superficie-2', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx(
          'h-full rounded-full transition-[transform] duration-700 ease-suave origin-left',
          sobreHero && semaforo === 'ok' ? 'bg-sobre-hero' : TONO_BARRA[semaforo],
        )}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  )
}

/** Disco con inicial; tono oscuro o claro según el orden de la persona */
export function Avatar({
  persona,
  indice = 0,
  tamano = 36,
  className,
}: {
  persona: Pick<Perfil, 'nombre'> | null | undefined
  indice?: number
  tamano?: number
  className?: string
}) {
  const oscuro = indice % 2 === 0
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight ring-2 ring-superficie',
        oscuro ? 'bg-v700 text-sobre-primario' : 'bg-v200 text-v900',
        className,
      )}
      style={{ width: tamano, height: tamano, fontSize: tamano * 0.42 }}
      aria-label={persona?.nombre}
    >
      {(persona?.nombre ?? '?').charAt(0).toUpperCase()}
    </span>
  )
}
