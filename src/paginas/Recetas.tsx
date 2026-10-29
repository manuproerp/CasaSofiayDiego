import { BookOpen, Clock, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { DetalleReceta } from '@/componentes/cocina/DetalleReceta'
import { DialogoAgregarReceta } from '@/componentes/cocina/DialogosMenu'
import { FormReceta } from '@/componentes/cocina/FormReceta'
import { TabsCocina } from '@/componentes/shell/TabsDinero'
import { Boton, cx, Entrada, Esqueleto, ErrorEnLinea, Tarjeta, Vacio } from '@/componentes/ui/base'
import { useRecetas } from '@/datos/consultas'
import { COMIDAS, NOMBRE_COMIDA } from '@/lib/cocina'
import type { Comida, Receta } from '@/lib/tipos'

export function Recetas() {
  const { data: recetas = [], isLoading, error, refetch } = useRecetas()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Comida | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [editar, setEditar] = useState<{ receta?: Receta } | null>(null)
  const [alMenu, setAlMenu] = useState<Receta | null>(null)

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return recetas.filter(
      (r) =>
        (!filtro || r.comidas.includes(filtro)) &&
        (!t || r.nombre.toLowerCase().includes(t) || r.receta_ingredientes.some((i) => i.nombre.toLowerCase().includes(t))),
    )
  }, [recetas, q, filtro])

  const receta = recetas.find((r) => r.id === abierta)

  if (error) return <ErrorEnLinea error={error} reintentar={() => refetch()} />

  return (
    <div className="flex flex-col gap-5">
      <TabsCocina />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <MagnifyingGlass size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-texto-3" />
          <Entrada aria-label="Buscar" placeholder="Buscar por nombre o ingrediente" className="pl-11" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:flex-1 md:px-0">
          <div className="flex w-max gap-2">
            {COMIDAS.map((c) => (
              <button
                key={c.valor}
                type="button"
                aria-pressed={filtro === c.valor}
                onClick={() => setFiltro((f) => (f === c.valor ? null : c.valor))}
                className={cx(
                  'pulsable h-11 rounded-full border px-4 text-sm font-medium',
                  filtro === c.valor ? 'border-primario bg-primario-suave text-primario' : 'border-borde bg-superficie text-texto-2',
                )}
              >
                {c.texto}
              </button>
            ))}
          </div>
        </div>
        <Boton icono={Plus} onClick={() => setEditar({})} className="md:ml-auto">
          Nueva receta
        </Boton>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Esqueleto key={i} className="h-24 rounded-tarjeta" />
          ))}
        </div>
      ) : recetas.length === 0 ? (
        <Tarjeta className="px-6">
          <Vacio
            icono={BookOpen}
            titulo="Sin recetas"
            texto="Agreguen las que cocinan seguido. Con ingredientes por plato, el menú arma solo la lista del súper."
            accion={
              <Boton icono={Plus} onClick={() => setEditar({})}>
                Agregar receta
              </Boton>
            }
          />
        </Tarjeta>
      ) : lista.length === 0 ? (
        <p className="py-8 text-sm text-texto-2">Nada con ese filtro.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {lista.map((r) => {
            const proteina = r.receta_ingredientes.find((i) => i.seccion === 'Carnes y pollo') ?? r.receta_ingredientes[0]
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setAbierta(r.id)}
                  className="pulsable flex w-full flex-col gap-2 rounded-tarjeta border border-borde/70 bg-superficie p-5 text-left shadow-tarjeta hover:border-borde-fuerte"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[17px] leading-snug font-semibold tracking-tight">{r.nombre}</span>
                    {r.tiempo_min && (
                      <span className="num flex shrink-0 items-center gap-1 text-[13px] text-texto-3">
                        <Clock size={14} /> {r.tiempo_min}′
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-1 text-sm text-texto-2">
                    {r.comidas.map((c) => NOMBRE_COMIDA[c]).join(' · ')}
                    {proteina && ` — ${proteina.nombre.toLowerCase()}`}
                  </span>
                  {r.etiquetas.length > 0 && (
                    <span className="flex flex-wrap gap-1.5 pt-1">
                      {r.etiquetas.map((e) => (
                        <span key={e} className="rounded-full bg-primario-suave px-2.5 py-0.5 text-[12px] font-medium text-primario">
                          {e}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {receta && (
        <DetalleReceta
          receta={receta}
          onCerrar={() => setAbierta(null)}
          onEditar={() => {
            setAbierta(null)
            setEditar({ receta })
          }}
          onAgregarAlMenu={() => {
            setAbierta(null)
            setAlMenu(receta)
          }}
        />
      )}
      {editar && (
        <FormReceta
          receta={editar.receta}
          onCerrar={(id) => {
            setEditar(null)
            if (id) setAbierta(id)
          }}
        />
      )}
      {alMenu && <DialogoAgregarReceta receta={alMenu} onCerrar={() => setAlMenu(null)} />}
    </div>
  )
}
