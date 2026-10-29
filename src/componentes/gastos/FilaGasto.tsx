import { Wallet } from '@phosphor-icons/react'
import { dinero } from '@/lib/formato'
import { cx, Etiqueta } from '@/componentes/ui/base'
import { Avatar, Monto } from '@/componentes/ui/datos'
import { IconoCategoria } from '@/componentes/ui/iconos'
import type { Categoria, Gasto, Perfil } from '@/lib/tipos'

export function FilaGasto({
  gasto,
  categoria,
  persona,
  indicePersona,
  onClick,
  compacta,
}: {
  gasto: Gasto
  categoria?: Categoria
  persona?: Perfil
  indicePersona: number
  onClick?: () => void
  compacta?: boolean
}) {
  const titulo = gasto.descripcion || (gasto.tipo === 'mesada' ? `Mesada de ${persona?.nombre ?? ''}` : categoria?.nombre ?? 'Gasto')
  const sub = gasto.tipo === 'mesada' ? 'Mesada' : gasto.descripcion ? categoria?.nombre : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'pulsable flex w-full items-center gap-3.5 text-left hover:bg-superficie-2/50',
        compacta ? 'min-h-14 px-1 py-2' : 'min-h-[68px] px-5 py-3 md:px-6',
        gasto.estado === 'rechazado' && 'opacity-55',
      )}
    >
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-primario-suave text-primario">
        {gasto.tipo === 'mesada' ? <Wallet size={22} /> : <IconoCategoria nombre={categoria?.icono} size={22} />}
        <Avatar persona={persona} indice={indicePersona} tamano={20} className="absolute -right-1 -bottom-1 !ring-[2.5px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cx('truncate text-[15px] font-medium tracking-tight', gasto.estado === 'rechazado' && 'line-through')}>
          {titulo}
        </span>
        <span className="flex items-center gap-2 text-[13px] text-texto-3">
          {sub && <span className="truncate">{sub}</span>}
          {gasto.estado === 'pendiente' && <Etiqueta tono="ambar">Pendiente</Etiqueta>}
          {gasto.estado === 'rechazado' && <Etiqueta tono="rojo">Rechazado</Etiqueta>}
        </span>
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <Monto valor={gasto.monto} moneda={gasto.moneda} className="text-[15px] font-semibold" />
        {gasto.moneda === 'USD' && (
          <span className="num text-[12px] text-texto-3">
            TC {gasto.tipo_cambio} · {dinero(gasto.monto_lempiras)}
          </span>
        )}
      </span>
    </button>
  )
}
