import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { BotonIcono, cx } from '@/componentes/ui/base'
import { useMes } from '@/datos/mes'
import { nombreMes } from '@/lib/formato'

export function SelectorMes({ className }: { className?: string }) {
  const { anio, mes, mover, esMesActual, irAHoy } = useMes()
  return (
    <div className={cx('flex items-center gap-1', className)}>
      <BotonIcono icono={CaretLeft} etiqueta="Mes anterior" onClick={() => mover(-1)} tamano={44} />
      <button
        type="button"
        onClick={irAHoy}
        title={esMesActual ? undefined : 'Volver al mes actual'}
        className="flex h-11 min-w-[108px] md:min-w-[148px] flex-col items-center justify-center rounded-[12px] px-2 leading-none hover:bg-superficie-2"
      >
        <span className="text-[15px] font-semibold tracking-tight">{nombreMes(mes)}</span>
        <span className="num mt-1 text-[12px] text-texto-3">{esMesActual ? anio : `${anio} · ir a hoy`}</span>
      </button>
      <BotonIcono icono={CaretRight} etiqueta="Mes siguiente" onClick={() => mover(1)} tamano={44} />
    </div>
  )
}
