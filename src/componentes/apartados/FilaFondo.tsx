import { CalendarCheck, Repeat, Target } from '@phosphor-icons/react'
import { Boton, cx } from '@/componentes/ui/base'
import { Barra, Monto } from '@/componentes/ui/datos'
import type { EstadoFondo } from '@/lib/calculos'
import { dinero, fechaCorta, plazo } from '@/lib/formato'

/** Fila de un apartado: progreso, cuota del mes y acciones */
export function FilaFondo({
  e,
  onAbrir,
  onAportar,
  onPagar,
  compacta,
}: {
  e: EstadoFondo
  onAbrir?: () => void
  onAportar?: () => void
  onPagar?: () => void
  compacta?: boolean
}) {
  const f = e.fondo
  const completo = e.apartado >= f.monto_objetivo
  const urgente = e.dias != null && e.dias <= 45 && !completo
  const vencido = e.dias != null && e.dias < 0
  const I = f.tipo === 'anual' ? CalendarCheck : Target

  const sub = f.fecha_objetivo
    ? `${f.tipo === 'anual' ? 'Vence' : 'Para'} ${fechaCorta(f.fecha_objetivo)} · ${plazo(e.dias)}`
    : 'Sin fecha'

  return (
    <div className={cx('flex flex-col gap-3', compacta ? 'py-3' : 'py-4')}>
      <button type="button" onClick={onAbrir} className="pulsable flex w-full items-start gap-3 text-left">
        <span
          className={cx(
            'flex size-10 shrink-0 items-center justify-center rounded-[12px]',
            vencido ? 'bg-rojo-suave text-rojo' : urgente ? 'bg-ambar-suave text-ambar' : 'bg-primario-suave text-primario',
          )}
        >
          <I size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 truncate font-medium tracking-tight">
            {f.nombre}
            {f.recurrente && <Repeat size={14} className="shrink-0 text-texto-3" aria-label="Cada año" />}
          </span>
          <span className={cx('truncate text-[13px]', vencido ? 'text-rojo' : urgente ? 'text-ambar' : 'text-texto-3')}>{sub}</span>
        </span>
        <span className="flex flex-col items-end">
          <Monto valor={e.apartado} moneda={f.moneda} decimales={false} className="font-semibold" />
          <span className="num text-[12px] text-texto-3">de {dinero(f.monto_objetivo, f.moneda, { corto: true })}</span>
        </span>
      </button>

      <div className="pl-[52px]">
        <Barra real={e.apartado} total={f.monto_objetivo} semaforo="ok" />
      </div>

      {!compacta && (onAportar || onPagar) && (
        <div className="flex flex-col gap-2 pl-[52px] sm:flex-row sm:items-center sm:gap-4">
          <span className="text-[13px] text-texto-2 sm:flex-1">
            {completo ? (
              <span className="font-medium text-primario">Completo</span>
            ) : e.cuotaSugerida != null ? (
              <>
                Este mes: <span className="num font-medium text-texto">{dinero(e.cuotaSugerida, f.moneda, { corto: true })}</span>
                {e.aportadoMes > 0 && <span className="num"> · llevan {dinero(e.aportadoMes, f.moneda, { corto: true })}</span>}
              </>
            ) : (
              <>Faltan {dinero(e.falta, f.moneda, { corto: true })}</>
            )}
          </span>
          <div className="flex gap-2">
            {onAportar && (
              <Boton tamano="sm" variante="secundario" onClick={onAportar}>
                Aportar
              </Boton>
            )}
            {onPagar && (
              <Boton tamano="sm" variante={completo || urgente ? 'suave' : 'fantasma'} onClick={onPagar}>
                {f.tipo === 'anual' ? 'Pagar' : 'Comprar'}
              </Boton>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
