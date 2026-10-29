import { CheckCircle, ListChecks, Plus, Suitcase } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TabsCasa } from '@/componentes/shell/TabsDinero'
import { FilaHecha, FilaPendiente, IconoTarea, InsigniaRacha, TarjetaRacha, textoModo, useAccionesTarea, useTareasHoy, type Columna } from '@/componentes/tareas/comun'
import { DetalleTarea, FormTarea } from '@/componentes/tareas/Dialogos'
import { Boton, cx, Esqueleto, ErrorEnLinea, Tarjeta, TituloSeccion, Vacio } from '@/componentes/ui/base'
import { Avatar } from '@/componentes/ui/datos'
import { diaLargo } from '@/lib/cocina'
import { fechaRelativa } from '@/lib/formato'
import { diasEntre, frecuenciaTexto } from '@/lib/tareas'
import type { Tarea } from '@/lib/tipos'

function ColumnaHoy({ col, nombreDe, onAbrir }: { col: Columna; nombreDe: (t: Tarea) => string | null; onAbrir: (t: Tarea) => void }) {
  const { hecha, quitar } = useAccionesTarea()
  const total = col.pendientes.length + col.hechas.length
  return (
    <Tarjeta className={cx('flex flex-col gap-2 p-3 md:p-4', col.ausencia && 'bg-superficie/60')}>
      <div className="flex items-center gap-3 px-2 pt-1 pb-2">
        <Avatar persona={col.persona} indice={col.indice} tamano={32} className="!ring-0" />
        <h3 className="flex-1 font-semibold tracking-tight">{col.persona.nombre}</h3>
        <InsigniaRacha racha={col.racha} className="md:hidden" />
        <span className="num text-sm text-texto-3 max-md:hidden">
          {col.ausencia ? 'Fuera' : total ? `${col.hechas.length}/${total}` : ''}
        </span>
      </div>
      {col.ausencia ? (
        <p className="flex items-center gap-2.5 px-2 pb-3 text-sm text-texto-2">
          <Suitcase size={20} className="shrink-0 text-v500" />
          Fuera hasta el {diaLargo(col.ausencia.hasta).toLowerCase()}. Sus tareas las cubre la otra persona.
        </p>
      ) : total === 0 ? (
        <p className="flex items-center gap-2.5 px-2 pb-3 text-sm text-texto-2">
          <CheckCircle size={20} weight="fill" className="shrink-0 text-v500" />
          Nada para hoy.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {col.pendientes.map((p) => (
            <FilaPendiente key={p.tarea.id} p={p} ausente={nombreDe(p.tarea)} onHecha={() => hecha(p.tarea)} onAbrir={() => onAbrir(p.tarea)} />
          ))}
          {col.pendientes.length === 0 && (
            <li className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-primario">
              <CheckCircle size={20} weight="fill" /> Todo hecho por hoy
            </li>
          )}
          {col.hechas.map((h) => (
            <FilaHecha key={h.hecha.id} tarea={h.tarea} deshacible={h.deshacible} onDeshacer={() => quitar(h.hecha.id, h.tarea.nombre)} />
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

export function Tareas() {
  const datos = useTareasHoy()
  const { columnas, sinNadie, proximas, personas, hoy, tareas, cargando, cargandoRachas, error, reintentar } = datos
  const [abierta, setAbierta] = useState<string | null>(null)
  const [editar, setEditar] = useState<{ tarea?: Tarea } | null>(null)

  if (error) return <ErrorEnLinea error={error} reintentar={reintentar} />

  const nombre = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? null
  const indice = (id: string | null) => Math.max(0, personas.findIndex((p) => p.id === id))
  // Para "Cubre a …": la dueña natural de la tarea
  const nombreDe = (t: Tarea) => nombre(t.modo === 'fija' ? t.asignada_a : t.le_toca)
  const tarea = tareas.find((t) => t.id === abierta)
  const ausentes = columnas.filter((c) => c.ausencia)

  // Próximos 7 días agrupados por fecha
  const semana = proximas.filter((p) => diasEntre(hoy, p.tarea.proxima_fecha) <= 7)
  const fechas = [...new Set(semana.map((p) => p.tarea.proxima_fecha))]

  return (
    <div className="flex flex-col gap-6">
      <TabsCasa />

      {cargando ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Esqueleto className="h-36 rounded-tarjeta" />
            <Esqueleto className="h-36 rounded-tarjeta" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Esqueleto className="h-72 rounded-tarjeta" />
            <Esqueleto className="h-72 rounded-tarjeta" />
          </div>
        </div>
      ) : tareas.length === 0 ? (
        <Tarjeta className="px-6">
          <Vacio
            icono={ListChecks}
            titulo="Sin tareas"
            texto="Agreguen las tareas de la casa: cada cuánto se hacen y si rotan o siempre las hace la misma persona."
            accion={
              <Boton icono={Plus} onClick={() => setEditar({})}>
                Agregar tarea
              </Boton>
            }
          />
        </Tarjeta>
      ) : (
        <>
          {ausentes.length > 0 && (
            <Link to="/ausencias" className="flex items-center gap-3 rounded-[18px] bg-primario-suave px-4 py-3 text-sm text-primario hover:brightness-[0.98]">
              <Suitcase size={20} className="shrink-0" />
              <span>
                {ausentes.map((c) => `${c.persona.nombre} está fuera hasta el ${diaLargo(c.ausencia!.hasta).toLowerCase()}`).join(' · ')}. Su racha está congelada.
              </span>
            </Link>
          )}

          <div className="hidden grid-cols-2 gap-4 md:grid">
            {columnas.map((c) => (
              <TarjetaRacha key={c.persona.id} col={c} cargando={cargandoRachas} />
            ))}
          </div>

          <section className="flex flex-col gap-3">
            <TituloSeccion className="max-md:hidden">Hoy</TituloSeccion>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
              {columnas.map((c) => (
                <ColumnaHoy key={c.persona.id} col={c} nombreDe={nombreDe} onAbrir={(t) => setAbierta(t.id)} />
              ))}
            </div>
            {sinNadie.length > 0 && (
              <Tarjeta className="flex flex-col gap-1 p-3">
                <p className="px-2 py-1 text-sm text-texto-2">Los dos están fuera. Quedan pendientes:</p>
                <ul>
                  {sinNadie.map((p) => (
                    <FilaPendiente key={p.tarea.id} p={p} onHecha={() => setAbierta(p.tarea.id)} onAbrir={() => setAbierta(p.tarea.id)} />
                  ))}
                </ul>
              </Tarjeta>
            )}
          </section>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="flex flex-col gap-3">
              <TituloSeccion>Próximos días</TituloSeccion>
              <Tarjeta className="p-2">
                {fechas.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-texto-2">Nada más en los próximos 7 días.</p>
                ) : (
                  <ul className="flex flex-col">
                    {fechas.map((f) => (
                      <li key={f} className="flex flex-col border-b border-borde px-2 pt-3 pb-2 last:border-b-0">
                        <span className="px-2 pb-1 text-[12px] font-semibold tracking-[0.08em] text-texto-3 uppercase">{fechaRelativa(f) === 'Hoy' ? 'Hoy' : diaLargo(f)}</span>
                        <ul className="flex flex-col">
                          {semana
                            .filter((p) => p.tarea.proxima_fecha === f)
                            .map((p) => (
                              <li key={p.tarea.id}>
                                <button
                                  type="button"
                                  onClick={() => setAbierta(p.tarea.id)}
                                  className="flex min-h-12 w-full items-center gap-3 rounded-[14px] px-2 text-left hover:bg-superficie-2/70"
                                >
                                  <IconoTarea nombre={p.tarea.nombre} size={20} className="shrink-0 text-texto-3" />
                                  <span className="flex-1 truncate font-medium">{p.tarea.nombre}</span>
                                  {p.persona && (
                                    <span className="flex items-center gap-2 text-sm text-texto-2">
                                      {p.cubre && <span className="text-[12px] text-texto-3">cubre</span>}
                                      <Avatar persona={personas.find((x) => x.id === p.persona)} indice={indice(p.persona)} tamano={28} className="!ring-0" />
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>
            </section>

            <section className="flex flex-col gap-3">
              <TituloSeccion
                accion={
                  <Boton variante="suave" tamano="sm" icono={Plus} onClick={() => setEditar({})}>
                    Nueva
                  </Boton>
                }
              >
                Todas las tareas
              </TituloSeccion>
              <Tarjeta className="p-2">
                <ul className="flex flex-col">
                  {tareas.map((t) => {
                    const m = textoModo(t, personas)
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setEditar({ tarea: t })}
                          className={cx('flex min-h-14 w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left hover:bg-superficie-2/70', !t.activa && 'opacity-55')}
                        >
                          <IconoTarea nombre={t.nombre} size={20} className="shrink-0 text-texto-3" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">{t.nombre}</span>
                            <span className="flex items-center gap-1.5 truncate text-[13px] text-texto-3">
                              <m.icono size={13} className="shrink-0" />
                              {frecuenciaTexto(t.cada_dias)} · {m.texto}
                              {!t.activa && ' · pausada'}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </Tarjeta>
            </section>
          </div>
        </>
      )}

      {tarea && (
        <DetalleTarea
          tarea={tarea}
          hechas={datos.hechasTodas}
          ausencias={datos.ausencias}
          onCerrar={() => setAbierta(null)}
          onEditar={() => {
            setAbierta(null)
            setEditar({ tarea })
          }}
        />
      )}
      {editar && <FormTarea tarea={editar.tarea} onCerrar={() => setEditar(null)} />}
    </div>
  )
}
