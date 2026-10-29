import { Plus, Receipt } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { ListaAprobaciones } from '@/componentes/gastos/Aprobaciones'
import { EditarGasto } from '@/componentes/gastos/EditarGasto'
import { FilaGasto } from '@/componentes/gastos/FilaGasto'
import { useIndicePersona, useRegistrarGasto } from '@/componentes/gastos/RegistroGasto'
import { Boton, cx, Esqueleto, ErrorEnLinea, Segmentado, Selector, Tarjeta, Vacio } from '@/componentes/ui/base'
import { Avatar, Monto } from '@/componentes/ui/datos'
import { useGastosMes, useMapaCategorias, usePersonas } from '@/datos/consultas'
import { useMes } from '@/datos/mes'
import { fechaRelativa, nombreMes } from '@/lib/formato'
import type { Gasto } from '@/lib/tipos'

type Filtro = 'todos' | 'hogar' | 'mesada' | 'pendientes'

export function Gastos() {
  const { anio, mes } = useMes()
  const registrar = useRegistrarGasto()
  const gastos = useGastosMes(anio, mes)
  const { mapa: categorias, data: listaCats = [] } = useMapaCategorias()
  const { personas } = usePersonas()
  const indice = useIndicePersona()

  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [persona, setPersona] = useState<string | null>(null)
  const [categoria, setCategoria] = useState('')
  const [editando, setEditando] = useState<Gasto | null>(null)

  const visibles = useMemo(() => {
    return (gastos.data ?? []).filter((g) => {
      if (filtro === 'hogar' && g.tipo !== 'hogar') return false
      if (filtro === 'mesada' && g.tipo !== 'mesada') return false
      if (filtro === 'pendientes' && g.estado !== 'pendiente') return false
      if (persona && g.persona_id !== persona) return false
      if (categoria && g.categoria_id !== categoria) return false
      return true
    })
  }, [gastos.data, filtro, persona, categoria])

  const porDia = useMemo(() => {
    const m = new Map<string, Gasto[]>()
    for (const g of visibles) m.set(g.fecha, [...(m.get(g.fecha) ?? []), g])
    return [...m.entries()]
  }, [visibles])

  const totales = useMemo(() => {
    const t = { hogar: 0, mesada: 0, pendientes: 0, visibles: 0 }
    for (const g of gastos.data ?? []) {
      if (g.estado === 'pendiente') t.pendientes++
      if (g.estado !== 'aprobado') continue
      if (g.tipo === 'hogar') t.hogar += g.monto_lempiras
      else t.mesada += g.monto_lempiras
    }
    for (const g of visibles) if (g.estado === 'aprobado') t.visibles += g.monto_lempiras
    return t
  }, [gastos.data, visibles])

  const hayFiltros = filtro !== 'todos' || !!persona || !!categoria

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Totales del mes */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          <Tarjeta className="flex flex-col gap-1 p-4">
            <span className="text-[13px] text-texto-3">Hogar</span>
            <Monto valor={totales.hogar} className="text-lg font-semibold" decimales={false} />
          </Tarjeta>
          <Tarjeta className="flex flex-col gap-1 p-4">
            <span className="text-[13px] text-texto-3">Mesadas</span>
            <Monto valor={totales.mesada} className="text-lg font-semibold" decimales={false} />
          </Tarjeta>
        </div>

        {/* Filtros */}
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <Segmentado
              etiqueta="Filtrar por tipo"
              valor={filtro}
              onChange={setFiltro}
              opciones={[
                { valor: 'todos', texto: 'Todos' },
                { valor: 'hogar', texto: 'Hogar' },
                { valor: 'mesada', texto: 'Mesadas' },
                { valor: 'pendientes', texto: totales.pendientes ? `Pendientes · ${totales.pendientes}` : 'Pendientes' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={persona === p.id}
                onClick={() => setPersona((x) => (x === p.id ? null : p.id))}
                className={cx(
                  'pulsable flex h-12 items-center gap-2 rounded-full border pr-4 pl-1.5 text-sm font-medium',
                  persona === p.id ? 'border-primario bg-primario-suave text-primario' : 'border-borde bg-superficie text-texto-2',
                )}
              >
                <Avatar persona={p} indice={indice(p.id)} tamano={34} className="!ring-0" />
                {p.nombre}
              </button>
            ))}
            {listaCats.length > 0 && (
              <Selector
                aria-label="Filtrar por categoría"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="min-w-0 flex-1 md:w-52 md:flex-none"
              >
                <option value="">Todas las categorías</option>
                {listaCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            )}
          </div>
        </div>

        {/* Lista */}
        <Tarjeta className="overflow-hidden">
          {gastos.isLoading ? (
            <div className="flex flex-col gap-4 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3.5">
                  <Esqueleto className="size-11 rounded-[14px]" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Esqueleto className="h-3.5 w-2/5" />
                    <Esqueleto className="h-3 w-1/4" />
                  </div>
                  <Esqueleto className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : gastos.error ? (
            <div className="p-6">
              <ErrorEnLinea error={gastos.error} reintentar={() => gastos.refetch()} />
            </div>
          ) : porDia.length === 0 ? (
            <div className="px-6">
              <Vacio
                icono={Receipt}
                titulo={hayFiltros ? 'Nada con esos filtros' : `Sin gastos en ${nombreMes(mes, false)}`}
                texto={hayFiltros ? 'Prueba quitando algún filtro.' : 'Registra el primero; se verá aquí al instante en la tablet y en los celulares.'}
                accion={
                  hayFiltros ? (
                    <Boton
                      variante="secundario"
                      onClick={() => {
                        setFiltro('todos')
                        setPersona(null)
                        setCategoria('')
                      }}
                    >
                      Quitar filtros
                    </Boton>
                  ) : (
                    <Boton icono={Plus} onClick={() => registrar()}>
                      Registrar gasto
                    </Boton>
                  )
                }
              />
            </div>
          ) : (
            <div className="flex flex-col">
              {porDia.map(([fecha, lista]) => {
                const totalDia = lista.filter((g) => g.estado === 'aprobado').reduce((s, g) => s + g.monto_lempiras, 0)
                return (
                  <section key={fecha} className="border-b border-borde last:border-b-0">
                    <header className="flex items-center justify-between bg-superficie-2/50 px-5 py-2.5 md:px-6">
                      <h3 className="text-[13px] font-semibold text-texto-2">{fechaRelativa(fecha)}</h3>
                      {totalDia > 0 && <Monto valor={totalDia} className="text-[13px] text-texto-3" />}
                    </header>
                    <div className="divide-y divide-borde/70">
                      {lista.map((g) => (
                        <FilaGasto
                          key={g.id}
                          gasto={g}
                          categoria={g.categoria_id ? categorias.get(g.categoria_id) : undefined}
                          persona={personas.find((p) => p.id === g.persona_id)}
                          indicePersona={indice(g.persona_id)}
                          onClick={() => setEditando(g)}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
              {hayFiltros && (
                <div className="flex items-center justify-between px-5 py-4 text-sm md:px-6">
                  <span className="text-texto-2">Total filtrado (aprobado)</span>
                  <Monto valor={totales.visibles} className="font-semibold" />
                </div>
              )}
            </div>
          )}
        </Tarjeta>
      </div>

      {/* Columna lateral (tablet horizontal / desktop) */}
      <aside className={cx('flex flex-col gap-5 lg:sticky lg:top-[100px]', totales.pendientes > 0 && 'max-lg:order-first')}>
        <Tarjeta className="hidden flex-col gap-4 p-6 md:flex">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-texto-3">Gastado del hogar · {nombreMes(mes, false)}</span>
            <Monto valor={totales.hogar} className="text-3xl font-semibold tracking-tight" />
          </div>
          <div className="flex items-center justify-between border-t border-borde pt-4 text-sm">
            <span className="text-texto-2">Mesadas</span>
            <Monto valor={totales.mesada} className="font-medium" />
          </div>
        </Tarjeta>
        <Tarjeta className="flex flex-col gap-4 p-5 md:p-6">
          <h2 className="font-semibold tracking-tight">Por aprobar</h2>
          <ListaAprobaciones compacta />
        </Tarjeta>
      </aside>

      {editando && <EditarGasto gasto={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}
