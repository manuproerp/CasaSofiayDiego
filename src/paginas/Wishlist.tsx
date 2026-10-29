import { ArrowSquareOut, CheckCircle, ListHeart, Plus, ShoppingBagOpen, Target, XCircle } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListaAprobaciones } from '@/componentes/gastos/Aprobaciones'
import { useRegistrarGasto } from '@/componentes/gastos/RegistroGasto'
import { TabsDinero } from '@/componentes/shell/TabsDinero'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, Campo, cx, Entrada, Esqueleto, ErrorEnLinea, Etiqueta, Selector, Tarjeta, TituloSeccion, Vacio } from '@/componentes/ui/base'
import { Barra, Monto } from '@/componentes/ui/datos'
import { Hoja } from '@/componentes/ui/hoja'
import { FormWishlist } from '@/componentes/wishlist/FormWishlist'
import { useCategorias, useCrearMetaDesdeWishlist, usePersonas, useWishlist } from '@/datos/consultas'
import { useMes } from '@/datos/mes'
import { useApartados } from '@/datos/resumen'
import { dinero, fechaCorta, hoyISO } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { ItemWishlist } from '@/lib/tipos'

const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 }

function DialogoMeta({ item, onCerrar }: { item: ItemWishlist; onCerrar: () => void }) {
  const avisar = useAvisar()
  const { data: categorias = [] } = useCategorias()
  const crear = useCrearMetaDesdeWishlist()
  const [fecha, setFecha] = useState('')
  const [categoria, setCategoria] = useState('')
  const [error, setError] = useState<string | null>(null)

  const enviar = async () => {
    try {
      await crear.mutateAsync({ item: item.id, fecha: fecha || null, categoria: categoria || null })
      avisar('Meta creada. Ya pueden apartar para esto.')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={`Ahorrar para ${item.nombre}`}
      subtitulo={`Meta de ${dinero(item.monto_estimado, item.moneda)}`}
      ancho="sm"
      pie={
        <Boton tamano="lg" ancho cargando={crear.isPending} onClick={enviar}>
          Crear meta
        </Boton>
      }
    >
      <div className="flex flex-col gap-5">
        <Campo etiqueta="¿Para cuándo? (opcional)" ayuda="Con fecha, la app sugiere cuánto apartar cada mes.">
          {(id) => <Entrada id={id} type="date" min={hoyISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} />}
        </Campo>
        <Campo etiqueta="Categoría del gasto al comprarlo (opcional)">
          {(id) => (
            <Selector id={id} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Elegir después</option>
              {categorias
                .filter((c) => c.activa)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </Selector>
          )}
        </Campo>
        {error && (
          <p role="alert" className="text-sm text-rojo">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  )
}

function TarjetaDeseo({
  item,
  quien,
  children,
  onEditar,
}: {
  item: ItemWishlist
  quien?: string
  children?: React.ReactNode
  onEditar: () => void
}) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onEditar} className="pulsable flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-primario-suave text-primario">
            <ListHeart size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium tracking-tight">{item.nombre}</span>
              {item.prioridad === 'alta' && <Etiqueta tono="verde">Prioridad alta</Etiqueta>}
            </span>
            <span className="truncate text-[13px] text-texto-3">
              {quien && `Propuso ${quien}`}
              {item.nota && ` · ${item.nota}`}
            </span>
          </span>
        </button>
        <div className="flex flex-col items-end gap-1">
          <Monto valor={item.monto_estimado} moneda={item.moneda} className="font-semibold" />
          {item.enlace && (
            <a
              href={item.enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 items-center gap-1 text-[13px] font-medium text-primario hover:underline"
            >
              Ver <ArrowSquareOut size={14} />
            </a>
          )}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2 pl-[52px]">{children}</div>}
    </li>
  )
}

export function Wishlist() {
  const { anio, mes } = useMes()
  const registrar = useRegistrarGasto()
  const { data = [], isLoading, error, refetch } = useWishlist()
  const { personas } = usePersonas()
  const { resumen } = useApartados(anio, mes)
  const [form, setForm] = useState<{ item?: ItemWishlist } | null>(null)
  const [meta, setMeta] = useState<ItemWishlist | null>(null)
  const [verHistorial, setVerHistorial] = useState(false)

  const nombre = (id: string) => personas.find((p) => p.id === id)?.nombre
  const grupos = useMemo(() => {
    const por = (e: ItemWishlist['estado']) =>
      data.filter((w) => w.estado === e).sort((a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad])
    return {
      pendientes: por('pendiente'),
      aprobadas: por('aprobada'),
      enMeta: por('en_meta'),
      historial: data.filter((w) => w.estado === 'comprada' || w.estado === 'rechazada'),
    }
  }, [data])

  if (error) return <ErrorEnLinea error={error} reintentar={() => refetch()} />

  const vacia = !isLoading && data.length === 0

  return (
    <div className="flex flex-col gap-5">
      <TabsDinero />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Tarjeta className="flex flex-col gap-4 p-6 md:p-8">
            <TituloSeccion
              accion={
                <Boton tamano="sm" icono={Plus} onClick={() => setForm({})}>
                  Agregar
                </Boton>
              }
            >
              Aprobadas
            </TituloSeccion>
            {isLoading ? (
              <div className="flex flex-col gap-3">
                <Esqueleto className="h-16" />
                <Esqueleto className="h-16" />
              </div>
            ) : vacia ? (
              <Vacio
                icono={ListHeart}
                titulo="La wishlist está vacía"
                texto="Lo que no es del día a día: un sillón, una freidora de aire, un viaje. Si pasa del umbral, lo aprueban los dos; después deciden si ahorran para eso o si ya lo compran."
                accion={
                  <Boton icono={Plus} onClick={() => setForm({})}>
                    Agregar el primero
                  </Boton>
                }
              />
            ) : grupos.aprobadas.length === 0 ? (
              <p className="text-sm text-texto-2">Nada aprobado por ahora.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {grupos.aprobadas.map((w) => (
                  <TarjetaDeseo key={w.id} item={w} quien={nombre(w.propuesto_por)} onEditar={() => setForm({ item: w })}>
                    <Boton tamano="sm" variante="suave" icono={Target} onClick={() => setMeta(w)}>
                      Ahorrar para esto
                    </Boton>
                    <Boton
                      tamano="sm"
                      variante="secundario"
                      icono={ShoppingBagOpen}
                      onClick={() =>
                        registrar({
                          monto: w.monto_estimado,
                          moneda: w.moneda,
                          descripcion: w.nombre,
                          wishlist_id: w.id,
                          titulo: `Compra: ${w.nombre}`,
                        })
                      }
                    >
                      Ya lo compramos
                    </Boton>
                  </TarjetaDeseo>
                ))}
              </ul>
            )}
          </Tarjeta>

          {grupos.enMeta.length > 0 && (
            <Tarjeta className="flex flex-col gap-4 p-6 md:p-8">
              <TituloSeccion
                accion={
                  <Link to="/metas" className="h-9 text-[13px] font-medium text-texto-2 hover:text-primario">
                    Ver metas
                  </Link>
                }
              >
                Ahorrando
              </TituloSeccion>
              <ul className="flex flex-col gap-4">
                {grupos.enMeta.map((w) => {
                  const e = resumen?.fondos.find((f) => f.fondo.id === w.fondo_id)
                  return (
                    <li key={w.id} className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <Target size={20} className="text-v500" />
                        <span className="flex-1 truncate font-medium">{w.nombre}</span>
                        <span className="num text-sm text-texto-2">
                          {e ? `${dinero(e.apartado, e.fondo.moneda, { corto: true })} de ${dinero(e.fondo.monto_objetivo, e.fondo.moneda, { corto: true })}` : '—'}
                        </span>
                      </div>
                      {e && (
                        <div className="pl-8">
                          <Barra real={e.apartado} total={e.fondo.monto_objetivo} />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Tarjeta>
          )}

          {grupos.historial.length > 0 && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setVerHistorial((v) => !v)}
                className="flex h-10 items-center gap-2 self-start px-1 text-sm font-medium text-texto-2 hover:text-texto"
              >
                {verHistorial ? 'Ocultar' : 'Ver'} historial ({grupos.historial.length})
              </button>
              {verHistorial && (
                <Tarjeta className="p-6">
                  <ul className="flex flex-col divide-y divide-borde">
                    {grupos.historial.map((w) => (
                      <li key={w.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        {w.estado === 'comprada' ? (
                          <CheckCircle size={20} weight="fill" className="text-v500" />
                        ) : (
                          <XCircle size={20} className="text-texto-3" />
                        )}
                        <span className={cx('flex-1 truncate', w.estado === 'rechazada' && 'text-texto-3 line-through')}>{w.nombre}</span>
                        <span className="text-[13px] text-texto-3">
                          {w.estado === 'comprada' ? 'Comprado' : 'Rechazado'}
                          {w.decidido_en && ` · ${fechaCorta(w.decidido_en.slice(0, 10))}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Tarjeta>
              )}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-6 max-lg:order-first lg:sticky lg:top-[100px]">
          {(grupos.pendientes.length > 0 || isLoading) && (
            <Tarjeta className="flex flex-col gap-4 p-6 ring-2 ring-ambar-barra/40">
              <h2 className="font-semibold tracking-tight">Esperan aprobación</h2>
              <ListaAprobaciones solo="wishlist" compacta />
            </Tarjeta>
          )}
          <p className="px-2 text-[13px] leading-relaxed text-texto-3">
            Bajo el umbral de aprobación, un deseo queda aprobado directo. Arriba del umbral lo aprueban los dos.
          </p>
        </aside>
      </div>

      {form && <FormWishlist item={form.item} onCerrar={() => setForm(null)} />}
      {meta && <DialogoMeta item={meta} onCerrar={() => setMeta(null)} />}
    </div>
  )
}
