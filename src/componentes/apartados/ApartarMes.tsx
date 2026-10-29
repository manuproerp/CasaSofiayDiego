import { CalendarCheck, Check, Target } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Aviso, Boton, cx } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { useAportar, useTCActual } from '@/datos/consultas'
import type { EstadoFondo } from '@/lib/calculos'
import { aLempiras, dinero, nombreMes, parsearMonto } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'

/** Un toque al mes: aparta la cuota sugerida de cada anual y meta (editable) */
export function ApartarMes({
  fondos,
  anio,
  mes,
  onCerrar,
}: {
  fondos: EstadoFondo[]
  anio: number
  mes: number
  onCerrar: () => void
}) {
  const avisar = useAvisar()
  const aportar = useAportar()
  const { tc } = useTCActual()

  // Lo que falta por apartar este mes según la sugerencia
  const candidatos = useMemo(
    () =>
      fondos
        .map((e) => ({ e, falta: e.cuotaSugerida != null ? Math.max(0, Math.round(e.cuotaSugerida - e.aportadoMes)) : 0 }))
        .filter((x) => x.e.falta > 0)
        .sort((a, b) => Number(b.falta > 0) - Number(a.falta > 0) || (a.e.dias ?? 1e9) - (b.e.dias ?? 1e9)),
    [fondos],
  )

  const [montos, setMontos] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidatos.map((c) => [c.e.fondo.id, c.falta ? String(c.falta) : ''])),
  )
  const [activos, setActivos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(candidatos.map((c) => [c.e.fondo.id, c.falta > 0])),
  )
  const [error, setError] = useState<string | null>(null)

  const seleccion = candidatos
    .filter((c) => activos[c.e.fondo.id])
    .map((c) => ({ c, monto: parsearMonto(montos[c.e.fondo.id] ?? '') }))
    .filter((x) => !!x.monto) as { c: (typeof candidatos)[number]; monto: number }[]

  const totalL = seleccion.reduce((s, x) => s + aLempiras(x.monto, x.c.e.fondo.moneda, tc?.valor), 0)

  const enviar = async () => {
    if (!seleccion.length) return
    setError(null)
    try {
      await aportar.mutateAsync(seleccion.map((x) => ({ fondo_id: x.c.e.fondo.id, monto: x.monto, anio, mes })))
      avisar(`Apartado ${dinero(totalL, 'HNL', { corto: true })} de ${nombreMes(mes, false)}`)
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={`Apartar cuotas de ${nombreMes(mes, false)}`}
      subtitulo="Montos sugeridos para llegar a tiempo. Puedes cambiarlos."
      pie={
        <Boton tamano="lg" ancho disabled={!seleccion.length} cargando={aportar.isPending} onClick={enviar}>
          Apartar {seleccion.length ? dinero(totalL, 'HNL', { corto: true }) : ''}
        </Boton>
      }
    >
      {candidatos.length === 0 ? (
        <Aviso tono="ok">No hay apartados pendientes por completar.</Aviso>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {candidatos.map(({ e, falta }) => {
            const id = e.fondo.id
            const on = !!activos[id]
            const I = e.fondo.tipo === 'anual' ? CalendarCheck : Target
            return (
              <li key={id} className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={e.fondo.nombre}
                  onClick={() => setActivos((a) => ({ ...a, [id]: !a[id] }))}
                  className={cx(
                    'pulsable flex size-12 shrink-0 items-center justify-center rounded-[14px] border-2',
                    on ? 'border-primario bg-primario text-sobre-primario' : 'border-borde-fuerte text-texto-3',
                  )}
                >
                  {on ? <Check size={22} weight="bold" /> : <I size={20} />}
                </button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{e.fondo.nombre}</span>
                  <span className="truncate text-[12px] text-texto-3">
                    {falta > 0
                      ? `Sugerido ${dinero(falta, e.fondo.moneda, { corto: true })}`
                      : e.cuotaSugerida != null
                        ? 'Al día este mes'
                        : 'Sin fecha: tú decides'}
                    {e.aportadoMes > 0 && ` · ya apartaron ${dinero(e.aportadoMes, e.fondo.moneda, { corto: true })}`}
                  </span>
                </div>
                <div className="relative w-32">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-texto-3">
                    {e.fondo.moneda === 'USD' ? '$' : 'L'}
                  </span>
                  <input
                    inputMode="decimal"
                    aria-label={`Monto para ${e.fondo.nombre}`}
                    value={montos[id] ?? ''}
                    disabled={!on}
                    onChange={(ev) => setMontos((m) => ({ ...m, [id]: ev.target.value }))}
                    className="num h-12 w-full rounded-control border border-borde-fuerte bg-superficie pr-3 pl-8 text-right text-base outline-none focus:border-primario disabled:opacity-40"
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-rojo">
          {error}
        </p>
      )}
    </Hoja>
  )
}
