import { Check, PencilSimple, Plus, ShoppingCart, Trash } from '@phosphor-icons/react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { TabsCocina } from '@/componentes/shell/TabsDinero'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, BotonIcono, Campo, cx, Entrada, Esqueleto, ErrorEnLinea, Selector, Tarjeta, Vacio } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { useBorrarItemsSuper, useGenerarSuper, useGuardarItemSuper, useSuper } from '@/datos/consultas'
import { adivinarSeccion, cantidadBonita, lunesDe, rangoSemana, SECCIONES, UNIDADES } from '@/lib/cocina'
import { hoyISO, parsearMonto } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { ItemSuper } from '@/lib/tipos'

const SINGULAR: Record<string, string> = {
  unidades: 'unidad',
  paquetes: 'paquete',
  bolsas: 'bolsa',
  latas: 'lata',
}

function EditarItem({ item, onCerrar }: { item: ItemSuper; onCerrar: () => void }) {
  const avisar = useAvisar()
  const guardar = useGuardarItemSuper()
  const borrar = useBorrarItemsSuper()
  const [nombre, setNombre] = useState(item.nombre)
  const [cantidad, setCantidad] = useState(item.cantidad != null ? String(item.cantidad) : '')
  const [unidad, setUnidad] = useState(item.unidad ?? '')
  const [seccion, setSeccion] = useState(item.seccion)
  const [nota, setNota] = useState(item.nota ?? '')

  const enviar = async () => {
    try {
      await guardar.mutateAsync({
        id: item.id,
        nombre: nombre.trim() || item.nombre,
        cantidad: cantidad.trim() ? parsearMonto(cantidad) : null,
        unidad: unidad || null,
        seccion,
        nota: nota.trim() || null,
      })
      onCerrar()
    } catch (e) {
      avisar(mensajeError(e), 'error')
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo="Editar producto"
      ancho="sm"
      pie={
        <div className="flex items-center justify-between gap-3">
          <Boton
            variante="fantasma"
            icono={Trash}
            className="-ml-3 text-rojo hover:text-rojo"
            onClick={async () => {
              await borrar.mutateAsync([item.id])
              onCerrar()
            }}
          >
            Quitar
          </Boton>
          <Boton onClick={enviar} cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Campo etiqueta="Producto">{(id) => <Entrada id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} />}</Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Cantidad">
            {(id) => <Entrada id={id} inputMode="decimal" className="num" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />}
          </Campo>
          <Campo etiqueta="Unidad">
            {(id) => (
              <Selector id={id} value={unidad} onChange={(e) => setUnidad(e.target.value)}>
                <option value="">—</option>
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Selector>
            )}
          </Campo>
        </div>
        <Campo etiqueta="Sección">
          {(id) => (
            <Selector id={id} value={seccion} onChange={(e) => setSeccion(e.target.value)}>
              {SECCIONES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
        <Campo etiqueta="Nota">{(id) => <Entrada id={id} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Marca, tamaño…" />}</Campo>
        {item.recetas && <p className="text-[13px] text-texto-3">Para: {item.recetas}</p>}
      </div>
    </Hoja>
  )
}

function Fila({ item, onEditar }: { item: ItemSuper; onEditar: () => void }) {
  const guardar = useGuardarItemSuper()
  return (
    <li className="flex items-center gap-1 pr-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.comprado}
        onClick={() => guardar.mutate({ id: item.id, comprado: !item.comprado })}
        className="pulsable flex min-h-14 flex-1 items-center gap-3.5 px-4 py-2 text-left md:px-5"
      >
        <span
          className={cx(
            'flex size-7 shrink-0 items-center justify-center rounded-[9px] border-2 transition-colors',
            item.comprado ? 'border-primario bg-primario text-sobre-primario' : 'border-borde-fuerte',
          )}
        >
          {item.comprado && <Check size={16} weight="bold" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cx('line-clamp-2 text-[16px] leading-snug', item.comprado && 'text-texto-3 line-through')}>{item.nombre}</span>
          {(item.recetas || item.nota) && !item.comprado && (
            <span className="truncate text-[12px] text-texto-3">{item.nota ?? item.recetas}</span>
          )}
        </span>
        {(item.cantidad != null || item.unidad) && (
          <span className={cx('num shrink-0 text-[15px] font-medium', item.comprado ? 'text-texto-3' : 'text-texto-2')}>
            {cantidadBonita(item.cantidad, item.unidad)}
          </span>
        )}
      </button>
      {!item.comprado && <BotonIcono icono={PencilSimple} etiqueta={`Editar ${item.nombre}`} tamano={44} onClick={onEditar} />}
    </li>
  )
}

export function Super() {
  const avisar = useAvisar()
  const { data = [], isLoading, error, refetch } = useSuper()
  const guardar = useGuardarItemSuper()
  const borrar = useBorrarItemsSuper()
  const generar = useGenerarSuper()
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<ItemSuper | null>(null)
  const [verComprados, setVerComprados] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const lunes = lunesDe(hoyISO())

  const pendientes = data.filter((i) => !i.comprado)
  const comprados = data.filter((i) => i.comprado)
  const porSeccion = useMemo(() => {
    const m = new Map<string, ItemSuper[]>()
    for (const i of pendientes) m.set(i.seccion, [...(m.get(i.seccion) ?? []), i])
    return SECCIONES.filter((s) => m.has(s))
      .map((s) => [s, m.get(s)!] as const)
      .concat([...m.entries()].filter(([s]) => !SECCIONES.includes(s)))
  }, [pendientes])

  const agregar = async (e: FormEvent) => {
    e.preventDefault()
    // "2 kg tomate" o "tomate"
    const m = nombre.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|lb|l|ml|unidades?|paquetes?|bolsas?|latas?)?\s+(.+)$/i)
    const texto = m ? m[3] : nombre.trim()
    if (!texto) return
    try {
      await guardar.mutateAsync({
        nombre: texto.charAt(0).toUpperCase() + texto.slice(1),
        cantidad: m ? parsearMonto(m[1]) : null,
        unidad: m?.[2] ? (SINGULAR[m[2].toLowerCase()] ?? m[2].toLowerCase()) : null,
        seccion: adivinarSeccion(texto),
        nota: null,
      })
      setNombre('')
      campo.current?.focus()
    } catch (err) {
      avisar(mensajeError(err), 'error')
    }
  }

  if (error) return <ErrorEnLinea error={error} reintentar={() => refetch()} />

  return (
    <div className="flex flex-col gap-5">
      <TabsCocina />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <form onSubmit={agregar} className="flex gap-2">
            <Entrada
              ref={campo}
              aria-label="Agregar producto"
              placeholder="Agregar… (ej. 2 kg tomate)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              enterKeyHint="done"
            />
            <Boton type="submit" icono={Plus} disabled={!nombre.trim()} cargando={guardar.isPending && !guardar.variables?.id}>
              <span className="hidden sm:inline">Agregar</span>
            </Boton>
          </form>

          {isLoading ? (
            <Esqueleto className="h-80 rounded-tarjeta" />
          ) : data.length === 0 ? (
            <Tarjeta className="px-6">
              <Vacio
                icono={ShoppingCart}
                titulo="La lista está vacía"
                texto="Agreguen cosas a mano o armen el menú de la semana y generen la lista desde ahí."
                accion={
                  <Boton variante="secundario" cargando={generar.isPending} onClick={async () => {
                    const n = await generar.mutateAsync(lunes)
                    avisar(n ? `${n} productos desde el menú` : 'El menú de esta semana no tiene recetas')
                  }}>
                    Generar desde el menú
                  </Boton>
                }
              />
            </Tarjeta>
          ) : (
            <>
              {pendientes.length === 0 ? (
                <Tarjeta className="flex items-center gap-3 p-5 text-texto-2">
                  <Check size={22} weight="bold" className="text-v500" /> Todo comprado.
                </Tarjeta>
              ) : (
                porSeccion.map(([seccion, items]) => (
                  <Tarjeta key={seccion} as="section" className="overflow-hidden">
                    <h2 className="flex items-center justify-between border-b border-borde bg-superficie-2/50 px-4 py-2.5 text-[13px] font-semibold text-texto-2 md:px-5">
                      {seccion}
                      <span className="num font-normal text-texto-3">{items.length}</span>
                    </h2>
                    <ul className="divide-y divide-borde/70">
                      {items.map((i) => (
                        <Fila key={i.id} item={i} onEditar={() => setEditando(i)} />
                      ))}
                    </ul>
                  </Tarjeta>
                ))
              )}

              {comprados.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <button type="button" onClick={() => setVerComprados((v) => !v)} className="h-10 text-sm font-medium text-texto-2 hover:text-texto">
                      {verComprados ? 'Ocultar' : 'Ver'} comprados ({comprados.length})
                    </button>
                    <Boton
                      tamano="sm"
                      variante="fantasma"
                      icono={Trash}
                      cargando={borrar.isPending}
                      onClick={async () => {
                        await borrar.mutateAsync(comprados.map((i) => i.id))
                        avisar('Lista limpia')
                      }}
                    >
                      Quitar comprados
                    </Boton>
                  </div>
                  {verComprados && (
                    <Tarjeta className="overflow-hidden">
                      <ul className="divide-y divide-borde/70">
                        {comprados.map((i) => (
                          <Fila key={i.id} item={i} onEditar={() => setEditando(i)} />
                        ))}
                      </ul>
                    </Tarjeta>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[100px]">
          <Tarjeta className="flex flex-col gap-3 p-6">
            <div className="flex flex-col">
              <span className="text-[13px] text-texto-3">Por comprar</span>
              <span className="num text-3xl font-semibold tracking-tight">{pendientes.length}</span>
            </div>
            <Boton
              variante="secundario"
              icono={ShoppingCart}
              cargando={generar.isPending}
              onClick={async () => {
                try {
                  const n = await generar.mutateAsync(lunes)
                  avisar(n ? `${n} productos desde el menú` : 'El menú de esta semana no tiene recetas')
                } catch (err) {
                  avisar(mensajeError(err), 'error')
                }
              }}
            >
              Generar desde el menú
            </Boton>
            <p className="text-[12px] leading-relaxed text-texto-3">Semana {rangoSemana(lunes)}. Lo agregado a mano no se toca.</p>
          </Tarjeta>
        </aside>
      </div>

      {editando && <EditarItem item={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}
