import { CaretDown, CheckCircle, WarningCircle, type Icon } from '@phosphor-icons/react'
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

// ───────────── Botón ─────────────

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'suave'
type Tamano = 'sm' | 'md' | 'lg'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-primario text-sobre-primario hover:bg-primario-hover',
  secundario: 'bg-superficie text-texto border border-borde-fuerte hover:bg-superficie-2',
  fantasma: 'text-texto-2 hover:bg-superficie-2 hover:text-texto',
  peligro: 'bg-rojo-suave text-rojo hover:brightness-95',
  suave: 'bg-primario-suave text-primario hover:brightness-[0.97]',
}
const TAMANOS: Record<Tamano, string> = {
  sm: 'h-10 px-3.5 text-sm gap-1.5 rounded-[12px]',
  md: 'h-12 px-5 text-[15px] gap-2 rounded-control',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-control',
}

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamano?: Tamano
  icono?: Icon
  cargando?: boolean
  ancho?: boolean
}

export const Boton = forwardRef<HTMLButtonElement, PropsBoton>(function Boton(
  { variante = 'primario', tamano = 'md', icono: I, cargando, ancho, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || cargando}
      className={cx(
        'pulsable inline-flex select-none items-center justify-center font-medium tracking-tight disabled:opacity-50',
        VARIANTES[variante],
        TAMANOS[tamano],
        ancho && 'w-full',
        className,
      )}
      {...rest}
    >
      {cargando ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      ) : (
        I && <I size={tamano === 'sm' ? 18 : 20} weight="bold" aria-hidden />
      )}
      {children}
    </button>
  )
})

export function BotonIcono({
  icono: I,
  etiqueta,
  className,
  tamano = 48,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icono: Icon; etiqueta: string; tamano?: number }) {
  return (
    <button
      aria-label={etiqueta}
      title={etiqueta}
      className={cx(
        'pulsable inline-flex shrink-0 items-center justify-center rounded-full text-texto-2 hover:bg-superficie-2 hover:text-texto disabled:opacity-40',
        className,
      )}
      style={{ width: tamano, height: tamano }}
      {...rest}
    >
      <I size={22} />
    </button>
  )
}

// ───────────── Formularios ─────────────

interface PropsCampo {
  etiqueta: string
  ayuda?: ReactNode
  error?: string | null
  children: (id: string) => ReactNode
  className?: string
}

export function Campo({ etiqueta, ayuda, error, children, className }: PropsCampo) {
  const id = useId()
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-sm font-medium text-texto-2">
        {etiqueta}
      </label>
      {children(id)}
      {ayuda && !error && <p className="text-[13px] leading-snug text-texto-3">{ayuda}</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-[13px] text-rojo" role="alert">
          <WarningCircle size={16} /> {error}
        </p>
      )}
    </div>
  )
}

const claseControl =
  'h-12 w-full rounded-control border border-borde-fuerte bg-superficie px-4 text-base text-texto placeholder:text-texto-3 outline-none transition focus:border-primario focus:ring-2 focus:ring-primario/15'

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(claseControl, className)} {...rest} />
})

export function Selector({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx('relative', className)}>
      <select className={cx(claseControl, 'appearance-none pr-10')} {...rest}>
        {children}
      </select>
      <CaretDown size={16} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-texto-3" />
    </div>
  )
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  className,
  etiqueta,
}: {
  opciones: { valor: T; texto: string; icono?: Icon }[]
  valor: T
  onChange: (v: T) => void
  className?: string
  etiqueta?: string
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className={cx('inline-flex rounded-[14px] bg-superficie-2 p-1', className)}>
      {opciones.map((o) => {
        const activo = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(o.valor)}
            className={cx(
              'pulsable flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-4 text-sm font-medium',
              activo ? 'bg-superficie text-texto shadow-[0_1px_2px_rgb(0_0_0/0.08)]' : 'text-texto-2 hover:text-texto',
            )}
          >
            {o.icono && <o.icono size={18} weight={activo ? 'fill' : 'regular'} />}
            {o.texto}
          </button>
        )
      })}
    </div>
  )
}

export function Interruptor({
  activo,
  onChange,
  etiqueta,
  descripcion,
}: {
  activo: boolean
  onChange: (v: boolean) => void
  etiqueta: string
  descripcion?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onChange(!activo)}
      className="flex min-h-12 w-full items-center justify-between gap-4 text-left"
    >
      <span className="flex flex-col">
        <span className="text-[15px] font-medium">{etiqueta}</span>
        {descripcion && <span className="text-[13px] leading-snug text-texto-3">{descripcion}</span>}
      </span>
      <span
        className={cx(
          'relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-300',
          activo ? 'bg-primario' : 'bg-borde-fuerte',
        )}
      >
        <span
          className={cx(
            'absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform duration-300 ease-suave',
            activo && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}

// ───────────── Superficies y estados ─────────────

export function Tarjeta({
  children,
  className,
  as: Tag = 'section',
  style,
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
  style?: React.CSSProperties
}) {
  return (
    <Tag style={style} className={cx('rounded-tarjeta border border-borde/70 bg-superficie shadow-tarjeta', className)}>
      {children}
    </Tag>
  )
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx('esqueleto', className)} aria-hidden />
}

export function Vacio({
  icono: I,
  titulo,
  texto,
  accion,
  compacto,
}: {
  icono: Icon
  titulo: string
  texto?: string
  accion?: ReactNode
  compacto?: boolean
}) {
  return (
    <div className={cx('flex flex-col items-start gap-3', compacto ? 'py-4' : 'py-10')}>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primario-suave text-primario">
        <I size={24} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold tracking-tight">{titulo}</p>
        {texto && <p className="max-w-[42ch] text-sm leading-relaxed text-texto-2">{texto}</p>}
      </div>
      {accion}
    </div>
  )
}

export function ErrorEnLinea({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  const msg = typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error)
  return (
    <div role="alert" className="flex items-start gap-3 rounded-control bg-rojo-suave p-4 text-sm text-rojo">
      <WarningCircle size={20} className="mt-px shrink-0" />
      <div className="flex flex-1 flex-col gap-2">
        <p>No se pudo cargar: {msg}</p>
        {reintentar && (
          <button onClick={reintentar} className="self-start font-semibold underline underline-offset-2">
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}

export function Aviso({ tono = 'info', children }: { tono?: 'info' | 'ambar' | 'ok'; children: ReactNode }) {
  const clases = {
    info: 'bg-superficie-2 text-texto-2',
    ambar: 'bg-ambar-suave text-ambar',
    ok: 'bg-primario-suave text-primario',
  }[tono]
  const I = tono === 'ok' ? CheckCircle : WarningCircle
  return (
    <div className={cx('flex items-start gap-2.5 rounded-control px-4 py-3 text-sm leading-snug', clases)}>
      <I size={18} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function Etiqueta({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'ambar' | 'rojo' | 'verde' }) {
  const c = {
    neutro: 'bg-superficie-2 text-texto-2',
    ambar: 'bg-ambar-suave text-ambar',
    rojo: 'bg-rojo-suave text-rojo',
    verde: 'bg-primario-suave text-primario',
  }[tono]
  return <span className={cx('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium', c)}>{children}</span>
}

export function TituloSeccion({ children, accion, className }: { children: ReactNode; accion?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center justify-between gap-3', className)}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-texto-3">{children}</h2>
      {accion}
    </div>
  )
}
