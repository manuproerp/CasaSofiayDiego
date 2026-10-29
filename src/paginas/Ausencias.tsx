import { CaretLeft, CaretRight, Plus, Suitcase } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { TabsCasa } from '@/componentes/shell/TabsDinero'
import { FormAusencia } from '@/componentes/tareas/Dialogos'
import { Boton, BotonIcono, cx, Esqueleto, ErrorEnLinea, Tarjeta, TituloSeccion, Vacio } from '@/componentes/ui/base'
import { Avatar } from '@/componentes/ui/datos'
import { useAusencias, usePersonas, useTareas } from '@/datos/consultas'
import { diaCorto, lunesDe, sumarDias } from '@/lib/cocina'
import { hoyISO, nombreMes } from '@/lib/formato'
import { diasEntre } from '@/lib/tareas'
import type { Ausencia } from '@/lib/tipos'

const fmt = new Intl.DateTimeFormat('es-HN', { day: 'numeric', month: 'short' })
function corta(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return fmt.format(new Date(a, m - 1, d)).replace('.', '')
}

function rango(a: Ausencia) {
  const n = diasEntre(a.desde, a.hasta) + 1
  return `${a.desde === a.hasta ? corta(a.desde) : `${corta(a.desde)} – ${corta(a.hasta)}`} · ${n} ${n === 1 ? 'día' : 'días'}`
}

const BARRA = ['bg-v700', 'bg-v300']

function Calendario({
  anio,
  mes,
  ausencias,
  indice,
  onDia,
}: {
  anio: number
  mes: number
  ausencias: Ausencia[]
  indice: (id: string) => number
  onDia: (iso: string) => void
}) {
  const hoy = hoyISO()
  const primero = `${anio}-${String(mes).padStart(2, '0')}-01`
  const inicio = lunesDe(primero)
  const ultimo = sumarDias(`${mes === 12 ? anio + 1 : anio}-${String(mes === 12 ? 1 : mes + 1).padStart(2, '0')}-01`, -1)
  const semanas = Math.ceil((diasEntre(inicio, ultimo) + 1) / 7)
  const dias = Array.from({ length: semanas * 7 }, (_, i) => sumarDias(inicio, i))

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-7 pb-1">
        {dias.slice(0, 7).map((d) => (
          <span key={d} className="text-center text-[12px] font-medium text-texto-3">
            {diaCorto(d)}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const delMes = d.slice(0, 7) === primero.slice(0, 7)
          const quienes = ausencias.filter((a) => a.desde <= d && d <= a.hasta)
          return (
            <button
              key={d}
              type="button"
              onClick={() => onDia(d)}
              aria-label={`${d}${quienes.length ? ', alguien fuera' : ''}`}
              className={cx(
                'flex min-h-14 flex-col items-center justify-start gap-1 rounded-[12px] pt-2 pb-1.5 hover:bg-superficie-2 md:min-h-16',
                !delMes && 'opacity-35',
                d === hoy && 'ring-2 ring-primario/40',
              )}
            >
              <span className={cx('num text-sm', d === hoy ? 'font-semibold text-primario' : 'text-texto')}>{Number(d.slice(8))}</span>
              <span className="flex w-full flex-col gap-0.5 px-1.5">
                {quienes.map((a) => (
                  <span key={a.id} className={cx('h-1.5 w-full rounded-full', BARRA[indice(a.persona_id) % 2])} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Ausencias() {
  const hoy = hoyISO()
  const { data: ausencias = [], isLoading, error, refetch } = useAusencias()
  const { personas } = usePersonas()
  const { data: tareas = [] } = useTareas()
  const [ym, setYm] = useState(() => ({ anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) }))
  const [form, setForm] = useState<{ ausencia?: Ausencia; desde?: string } | null>(null)

  const indice = (id: string) => Math.max(0, personas.findIndex((p) => p.id === id))
  const persona = (id: string) => personas.find((p) => p.id === id)

  const { vigentes, pasadas } = useMemo(() => {
    const v = ausencias.filter((a) => a.hasta >= hoy).sort((a, b) => a.desde.localeCompare(b.desde))
    const p = ausencias.filter((a) => a.hasta < hoy).slice(0, 10)
    return { vigentes: v, pasadas: p }
  }, [ausencias, hoy])

  const mover = (n: number) =>
    setYm(({ anio, mes }) => {
      const t = anio * 12 + (mes - 1) + n
      return { anio: Math.floor(t / 12), mes: (t % 12) + 1 }
    })

  if (error) return <ErrorEnLinea error={error} reintentar={() => refetch()} />

  const fila = (a: Ausencia) => {
    const ahora = a.desde <= hoy && hoy <= a.hasta
    return (
      <li key={a.id}>
        <button
          type="button"
          onClick={() => setForm({ ausencia: a })}
          className="flex min-h-16 w-full items-center gap-3 rounded-[16px] px-3 py-2 text-left hover:bg-superficie-2/70"
        >
          <Avatar persona={persona(a.persona_id)} indice={indice(a.persona_id)} tamano={36} className="!ring-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">
              {persona(a.persona_id)?.nombre}
              {a.motivo && <span className="font-normal text-texto-2"> · {a.motivo}</span>}
            </span>
            <span className="num text-[13px] text-texto-3">{rango(a)}</span>
          </span>
          {ahora && <span className="rounded-full bg-primario-suave px-2.5 py-1 text-[12px] font-semibold text-primario">Ahora</span>}
        </button>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <TabsCasa />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Tarjeta className="flex flex-col gap-4 p-4 md:p-6">
          <div className="flex items-center justify-between gap-2">
            <BotonIcono icono={CaretLeft} etiqueta="Mes anterior" onClick={() => mover(-1)} />
            <span className="text-[17px] font-semibold tracking-tight">
              {nombreMes(ym.mes)} {ym.anio}
            </span>
            <BotonIcono icono={CaretRight} etiqueta="Mes siguiente" onClick={() => mover(1)} />
          </div>
          {isLoading ? (
            <Esqueleto className="h-72" />
          ) : (
            <Calendario anio={ym.anio} mes={ym.mes} ausencias={ausencias} indice={indice} onDia={(d) => setForm({ desde: d })} />
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-borde pt-4 text-[13px] text-texto-2">
            {personas.map((p, i) => (
              <span key={p.id} className="flex items-center gap-2">
                <span className={cx('h-1.5 w-5 rounded-full', BARRA[i % 2])} />
                {p.nombre}
              </span>
            ))}
            <span className="text-texto-3">Toca un día para agregar</span>
          </div>
        </Tarjeta>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <TituloSeccion
              accion={
                <Boton tamano="sm" icono={Plus} onClick={() => setForm({})}>
                  Agregar
                </Boton>
              }
            >
              Ahora y próximas
            </TituloSeccion>
            {isLoading ? (
              <Esqueleto className="h-32 rounded-tarjeta" />
            ) : vigentes.length === 0 ? (
              <Tarjeta className="px-6">
                <Vacio
                  compacto
                  icono={Suitcase}
                  titulo="Nadie sale por ahora"
                  texto="Cuando alguien viaje, agréguenlo: la otra persona cubre sus tareas y su racha se congela."
                  accion={
                    <Boton variante="secundario" icono={Plus} onClick={() => setForm({})}>
                      Agregar ausencia
                    </Boton>
                  }
                />
              </Tarjeta>
            ) : (
              <Tarjeta className="p-2">
                <ul className="flex flex-col">
                  {vigentes.map(fila)}
                </ul>
              </Tarjeta>
            )}
          </section>

          {pasadas.length > 0 && (
            <section className="flex flex-col gap-3">
              <TituloSeccion>Pasadas</TituloSeccion>
              <Tarjeta className="p-2">
                <ul className="flex flex-col">
                  {pasadas.map(fila)}
                </ul>
              </Tarjeta>
            </section>
          )}
        </div>
      </div>

      {form && <FormAusencia ausencia={form.ausencia} inicial={{ desde: form.desde }} tareas={tareas} onCerrar={() => setForm(null)} />}
    </div>
  )
}
