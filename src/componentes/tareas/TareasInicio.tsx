import { ArrowRight, CheckCircle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Esqueleto } from '@/componentes/ui/base'
import { Avatar } from '@/componentes/ui/datos'
import { FilaHecha, FilaPendiente, InsigniaRacha, useAccionesTarea, useTareasHoy } from './comun'

/** Tareas de hoy para Inicio: una columna por persona, marcar con un toque */
export function TareasInicio() {
  const { columnas, personas, cargando, tareas } = useTareasHoy()
  const { hecha, quitar } = useAccionesTarea()
  const nombre = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold tracking-tight">Tareas de hoy</h2>
        <Link to="/tareas" className="flex h-9 items-center gap-1 text-[13px] font-medium text-texto-2 hover:text-primario">
          Tareas <ArrowRight size={14} />
        </Link>
      </div>
      {cargando ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Esqueleto className="h-32" />
          <Esqueleto className="h-32" />
        </div>
      ) : tareas.length === 0 ? (
        <p className="text-sm text-texto-2">
          Aún no hay tareas.{' '}
          <Link to="/tareas" className="font-medium text-primario hover:underline">
            Agregarlas
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          {columnas.map((c) => {
            const visibles = c.pendientes.slice(0, 4)
            const hechas = c.hechas.slice(0, Math.max(0, 4 - visibles.length))
            const resto = c.pendientes.length - visibles.length
            return (
              <div key={c.persona.id} className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2.5 pb-1">
                  <Avatar persona={c.persona} indice={c.indice} tamano={28} className="!ring-0" />
                  <span className="flex-1 font-medium">{c.persona.nombre}</span>
                  <InsigniaRacha racha={c.racha} />
                </div>
                {c.ausencia ? (
                  <p className="py-2 text-sm text-texto-3">Fuera hoy. Sus tareas las cubre la otra persona.</p>
                ) : visibles.length + hechas.length === 0 ? (
                  <p className="flex items-center gap-2 py-2 text-sm text-texto-2">
                    <CheckCircle size={18} weight="fill" className="text-v500" />
                    Nada para hoy
                  </p>
                ) : (
                  <ul className="-mx-2 flex flex-col">
                    {visibles.map((p) => (
                      <FilaPendiente
                        key={p.tarea.id}
                        compacta
                        p={p}
                        ausente={nombre(p.tarea.modo === 'fija' ? p.tarea.asignada_a : p.tarea.le_toca)}
                        onHecha={() => hecha(p.tarea)}
                      />
                    ))}
                    {hechas.map((h) => (
                      <FilaHecha key={h.hecha.id} compacta tarea={h.tarea} deshacible={h.deshacible} onDeshacer={() => quitar(h.hecha.id, h.tarea.nombre)} />
                    ))}
                    {resto > 0 && (
                      <li>
                        <Link to="/tareas" className="flex h-10 items-center px-2 text-[13px] font-medium text-primario hover:underline">
                          {resto} más
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
