import { CalendarCheck, ChartPieSlice, GearSix, HandCoins, ListBullets, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAccionesFondo } from '@/componentes/apartados/Acciones'
import { ApartarMes } from '@/componentes/apartados/ApartarMes'
import { FilaFondo } from '@/componentes/apartados/FilaFondo'
import { FormFondo } from '@/componentes/apartados/FormFondo'
import { FormPartida } from '@/componentes/presupuesto/FormPartida'
import { TabsDinero } from '@/componentes/shell/TabsDinero'
import { Aviso, Boton, cx, Esqueleto, ErrorEnLinea, Segmentado, Tarjeta, TituloSeccion, Vacio } from '@/componentes/ui/base'
import { Barra, Monto } from '@/componentes/ui/datos'
import { Hoja } from '@/componentes/ui/hoja'
import { IconoCategoria } from '@/componentes/ui/iconos'
import { useTCActual } from '@/datos/consultas'
import { useMes } from '@/datos/mes'
import { useApartados, useResumenMes } from '@/datos/resumen'
import { semaforo, type FilaCategoria } from '@/lib/calculos'
import { aLempiras, dinero, nombreMes } from '@/lib/formato'
import type { ItemPresupuesto, TipoPresupuesto } from '@/lib/tipos'

const TEXTO_SEMAFORO = {
  ok: 'text-texto-2',
  cerca: 'text-ambar',
  excedido: 'text-rojo',
  sin: 'text-texto-2',
}

function Fila({ f }: { f: FilaCategoria }) {
  const disponible = f.presupuesto - f.real
  const tipos = [f.fijo > 0 && 'Fijo', f.variable > 0 && 'Variable'].filter(Boolean) as string[]
  return (
    <li className="flex flex-col gap-2.5 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-primario-suave text-primario">
          <IconoCategoria nombre={f.categoria.icono} size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium tracking-tight">{f.categoria.nombre}</span>
          <span className="truncate text-[12px] text-texto-3">{tipos.join(' · ')}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[15px] font-semibold">
            <Monto valor={f.real} decimales={false} />
            <span className="font-normal text-texto-3"> / </span>
            <Monto valor={f.presupuesto} decimales={false} className="font-normal text-texto-3" />
          </span>
          <span className={cx('num text-[12px] font-medium', TEXTO_SEMAFORO[f.semaforo])}>
            {disponible < -0.005
              ? `Excedido ${dinero(-disponible, 'HNL', { corto: true })}`
              : Math.abs(disponible) < 0.005
                ? 'Completo'
                : `Quedan ${dinero(disponible, 'HNL', { corto: true })}`}
          </span>
        </div>
      </div>
      <div className="pl-[52px]">
        <Barra real={f.real} total={f.presupuesto} semaforo={f.semaforo} />
      </div>
    </li>
  )
}

/** Lista de partidas fijas y variables */
function Partidas({
  items,
  categorias,
  onEditar,
  onNueva,
  onCerrar,
}: {
  items: ItemPresupuesto[]
  categorias: Map<string, { nombre: string; icono: string }>
  onEditar: (p: ItemPresupuesto) => void
  onNueva: (t: TipoPresupuesto) => void
  onCerrar: () => void
}) {
  const grupos: { tipo: TipoPresupuesto; titulo: string }[] = [
    { tipo: 'fijo', titulo: 'Fijos · cada mes' },
    { tipo: 'variable', titulo: 'Variables · tope mensual' },
  ]
  return (
    <Hoja abierta onCerrar={onCerrar} titulo="Partidas del presupuesto" subtitulo="Aplican a todos los meses." ancho="lg">
      <div className="flex flex-col gap-7">
        {grupos.map((g) => {
          const lista = items.filter((i) => i.tipo === g.tipo).sort((a, b) => b.monto - a.monto)
          return (
            <section key={g.tipo} className="flex flex-col gap-2">
              <TituloSeccion
                accion={
                  <Boton tamano="sm" variante="suave" icono={Plus} onClick={() => onNueva(g.tipo)}>
                    Agregar
                  </Boton>
                }
              >
                {g.titulo}
              </TituloSeccion>
              {lista.length === 0 ? (
                <p className="py-2 text-sm text-texto-3">Sin partidas.</p>
              ) : (
                <ul className="divide-y divide-borde rounded-[18px] border border-borde">
                  {lista.map((p) => {
                    const c = categorias.get(p.categoria_id)
                    return (
                      <li key={p.id}>
                        <button onClick={() => onEditar(p)} className="pulsable flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-superficie-2/60">
                          <IconoCategoria nombre={c?.icono} size={20} className="text-v500" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">{p.descripcion || c?.nombre}</span>
                            {p.descripcion && <span className="truncate text-[12px] text-texto-3">{c?.nombre}</span>}
                          </span>
                          <Monto valor={p.monto} moneda={p.moneda} className="font-semibold" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </Hoja>
  )
}

/** Tarjeta de apartados del mes (anuales + metas) */
function ApartadosDelMes() {
  const { anio, mes } = useMes()
  const [, setParams] = useSearchParams()
  const { resumen, cargando } = useApartados(anio, mes)
  const [apartar, setApartar] = useState(false)

  if (cargando || !resumen) return <Esqueleto className="h-56 rounded-tarjeta" />

  const proximos = resumen.fondos
    .filter((e) => e.fondo.tipo === 'anual' && e.dias != null && e.dias <= 90)
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0))
    .slice(0, 3)
  const pendiente = Math.max(0, resumen.sugeridoMes - resumen.aportadoMes)

  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight">Apartados de {nombreMes(mes, false)}</h2>
        <button onClick={() => setParams({ vista: 'anuales' })} className="h-9 text-[13px] font-medium text-texto-2 hover:text-primario">
          Ver anuales
        </button>
      </div>
      {resumen.fondos.length === 0 ? (
        <Vacio
          compacto
          icono={CalendarCheck}
          titulo="Sin apartados todavía"
          texto="Agrega los gastos anuales (matrículas, suscripciones) y la app sugiere cuánto apartar cada mes."
          accion={
            <Boton tamano="sm" variante="suave" icono={Plus} onClick={() => setParams({ vista: 'anuales' })}>
              Agregar anual
            </Boton>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <span className="text-[13px] text-texto-3">Sugerido</span>
              <Monto valor={resumen.sugeridoMes} decimales={false} className="text-xl font-semibold" />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] text-texto-3">Apartado</span>
              <Monto valor={resumen.aportadoMes} decimales={false} className={cx('text-xl font-semibold', pendiente <= 0 && 'text-primario')} />
            </div>
          </div>
          <Barra real={resumen.aportadoMes} total={resumen.sugeridoMes} />
          <Boton icono={HandCoins} variante={pendiente > 0 ? 'primario' : 'secundario'} onClick={() => setApartar(true)}>
            {pendiente > 0 ? `Apartar ${dinero(pendiente, 'HNL', { corto: true })}` : 'Apartar más'}
          </Boton>
          {proximos.length > 0 && (
            <ul className="flex flex-col divide-y divide-borde border-t border-borde">
              {proximos.map((e) => (
                <li key={e.fondo.id} className="flex items-center gap-3 py-3 text-sm">
                  <CalendarCheck size={18} className={e.dias != null && e.dias <= 30 ? 'text-ambar' : 'text-v500'} />
                  <span className="flex-1 truncate font-medium">{e.fondo.nombre}</span>
                  <span className="num text-texto-2">
                    {Math.round(e.pct)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          {resumen.faltaTC && <Aviso tono="ambar">Hay apartados en dólares sin tipo de cambio registrado.</Aviso>}
        </>
      )}
      {apartar && <ApartarMes fondos={resumen.fondos} anio={anio} mes={mes} onCerrar={() => setApartar(false)} />}
    </Tarjeta>
  )
}

function Mensual() {
  const { anio, mes } = useMes()
  const navegar = useNavigate()
  const { resumen, items, categorias, cargando, error, reintentar } = useResumenMes(anio, mes)
  const [verPartidas, setVerPartidas] = useState(false)
  const [form, setForm] = useState<{ partida?: ItemPresupuesto; tipo?: TipoPresupuesto } | null>(null)
  const mapaCat = new Map(categorias.map((c) => [c.id, c]))

  if (error) return <ErrorEnLinea error={error} reintentar={reintentar} />
  if (cargando || !resumen) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <Esqueleto className="h-40 rounded-tarjeta" />
          <Esqueleto className="h-96 rounded-tarjeta" />
        </div>
        <Esqueleto className="h-72 rounded-tarjeta" />
      </div>
    )
  }

  const sinCategorias = categorias.length === 0
  const disponible = resumen.presupuestoTotal - resumen.realTotal
  const estado = semaforo(resumen.realTotal, resumen.presupuestoTotal)

  const formulario = form && <FormPartida partida={form.partida} tipoInicial={form.tipo} onCerrar={() => setForm(null)} />

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        {items.length === 0 ? (
          <Tarjeta className="px-6 md:px-10">
            <Vacio
              icono={ChartPieSlice}
              titulo="Arma el presupuesto de la casa"
              texto={
                sinCategorias
                  ? 'Primero crea las categorías en Ajustes (súper, luz, renta…). Después agregas cuánto le toca a cada una.'
                  : 'Agrega lo fijo (renta, internet) y los topes variables (súper, gasolina). Lo anual va en la pestaña Anuales.'
              }
              accion={
                sinCategorias ? (
                  <Boton icono={GearSix} onClick={() => navegar('/ajustes#categorias')}>
                    Crear categorías
                  </Boton>
                ) : (
                  <Boton icono={Plus} onClick={() => setForm({ tipo: 'fijo' })}>
                    Agregar partida
                  </Boton>
                )
              }
            />
          </Tarjeta>
        ) : (
          <>
            <Tarjeta className="flex flex-col gap-5 p-6 md:p-8">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-[1.4fr_1fr_1fr]">
                <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
                  <span className="text-[13px] text-texto-3">Gastado de {nombreMes(mes, false)}</span>
                  <Monto valor={resumen.realTotal} className="text-4xl font-semibold tracking-tighter" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-texto-3">Presupuesto</span>
                  <Monto valor={resumen.presupuestoTotal} className="text-xl font-semibold" decimales={false} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-texto-3">{disponible >= 0 ? 'Disponible' : 'Excedido'}</span>
                  <Monto
                    valor={Math.abs(disponible)}
                    decimales={false}
                    className={cx('text-xl font-semibold', disponible < 0 ? 'text-rojo' : estado === 'cerca' ? 'text-ambar' : 'text-primario')}
                  />
                </div>
              </div>
              <Barra real={resumen.realTotal} total={resumen.presupuestoTotal} semaforo={estado} className="h-2.5" />
              {(resumen.pendienteTotal > 0 || resumen.pagadoDesdeApartados > 0) && (
                <div className="flex flex-col gap-1 text-[13px] text-texto-2">
                  {resumen.pendienteTotal > 0 && <p>{dinero(resumen.pendienteTotal)} esperan aprobación y todavía no cuentan.</p>}
                  {resumen.pagadoDesdeApartados > 0 && (
                    <p>{dinero(resumen.pagadoDesdeApartados)} se pagaron desde apartados y no cuentan aquí.</p>
                  )}
                </div>
              )}
              {resumen.faltaTC && <Aviso tono="ambar">Hay partidas en dólares sin tipo de cambio registrado. Agrégalo en Ajustes.</Aviso>}
            </Tarjeta>

            <Tarjeta className="flex flex-col gap-5 p-6 md:p-8">
              <TituloSeccion
                accion={
                  <Boton tamano="sm" variante="secundario" icono={ListBullets} onClick={() => setVerPartidas(true)}>
                    Partidas
                  </Boton>
                }
              >
                Por categoría
              </TituloSeccion>
              <ul className="flex flex-col divide-y divide-borde">
                {resumen.filas.map((f) => (
                  <Fila key={f.categoria.id} f={f} />
                ))}
              </ul>
              {resumen.sinPresupuesto.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-dashed border-borde-fuerte pt-5">
                  <span className="text-[13px] font-medium text-texto-2">Gastado sin presupuesto</span>
                  <ul className="flex flex-col gap-2">
                    {resumen.sinPresupuesto.map((f) => (
                      <li key={f.categoria.id} className="flex items-center gap-3 text-sm">
                        <IconoCategoria nombre={f.categoria.icono} size={18} className="text-texto-3" />
                        <span className="flex-1">{f.categoria.nombre}</span>
                        <Monto valor={f.real} className="font-medium" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Tarjeta>
          </>
        )}
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-[100px]">
        <ApartadosDelMes />
      </aside>

      {verPartidas && (
        <Partidas
          items={items}
          categorias={mapaCat}
          onCerrar={() => setVerPartidas(false)}
          onEditar={(p) => setForm({ partida: p })}
          onNueva={(t) => setForm({ tipo: t })}
        />
      )}
      {formulario}
    </div>
  )
}

function Anuales() {
  const { anio, mes } = useMes()
  const { resumen, todos, cargando, error, reintentar } = useApartados(anio, mes)
  const { tc } = useTCActual()
  const acciones = useAccionesFondo()
  const [nuevo, setNuevo] = useState(false)
  const [apartar, setApartar] = useState(false)

  if (error) return <ErrorEnLinea error={error} reintentar={reintentar} />
  if (cargando || !resumen) return <Esqueleto className="h-96 rounded-tarjeta" />

  const anuales = resumen.fondos.filter((e) => e.fondo.tipo === 'anual').sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0))
  const sugeridoAnuales = anuales.reduce((s, e) => s + aLempiras(e.cuotaSugerida ?? 0, e.fondo.moneda, tc?.valor), 0)
  const pagados = todos.filter((f) => f.tipo === 'anual' && f.estado === 'pagado')

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <Tarjeta className="flex flex-col px-6 pt-5 pb-3 md:px-8">
        <TituloSeccion
          className="pb-1"
          accion={
            <Boton tamano="sm" variante="suave" icono={Plus} onClick={() => setNuevo(true)}>
              Nuevo anual
            </Boton>
          }
        >
          Gastos anuales
        </TituloSeccion>
        {anuales.length === 0 ? (
          <Vacio
            icono={CalendarCheck}
            titulo="Nada anual todavía"
            texto="Matrícula del carro, seguro, suscripciones anuales, impuestos. Pon el monto y la fecha, y la app sugiere cuánto apartar cada mes para llegar sin sustos."
            accion={
              <Boton icono={Plus} onClick={() => setNuevo(true)}>
                Agregar el primero
              </Boton>
            }
          />
        ) : (
          <div className="flex flex-col divide-y divide-borde">
            {anuales.map((e) => (
              <FilaFondo
                key={e.fondo.id}
                e={e}
                onAbrir={() => acciones.abrir('detalle', e)}
                onAportar={() => acciones.abrir('aportar', e)}
                onPagar={() => acciones.abrir('pagar', e)}
              />
            ))}
          </div>
        )}
      </Tarjeta>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-[100px]">
        <Tarjeta className="flex flex-col gap-4 p-6">
          <h2 className="font-semibold tracking-tight">{nombreMes(mes)}</h2>
          <div className="flex flex-col">
            <span className="text-[13px] text-texto-3">Sugerido para anuales</span>
            <Monto valor={sugeridoAnuales} decimales={false} className="text-2xl font-semibold" />
          </div>
          <p className="text-[13px] leading-relaxed text-texto-2">
            Cuota = lo que falta ÷ meses hasta el vencimiento. Se recalcula sola si un mes apartan menos o más.
          </p>
          <Boton icono={HandCoins} onClick={() => setApartar(true)} disabled={resumen.fondos.length === 0}>
            Apartar cuotas del mes
          </Boton>
        </Tarjeta>
        {pagados.length > 0 && (
          <p className="px-2 text-[13px] text-texto-3">{pagados.length} anuales no recurrentes ya pagados.</p>
        )}
      </aside>

      {nuevo && <FormFondo tipo="anual" onCerrar={() => setNuevo(false)} />}
      {apartar && <ApartarMes fondos={resumen.fondos} anio={anio} mes={mes} onCerrar={() => setApartar(false)} />}
      {acciones.elemento}
    </div>
  )
}

export function Presupuesto() {
  const [params, setParams] = useSearchParams()
  const vista = params.get('vista') === 'anuales' ? 'anuales' : 'mensual'

  return (
    <div className="flex flex-col gap-5">
      <TabsDinero />
      <Segmentado
        etiqueta="Vista del presupuesto"
        className="self-start"
        valor={vista}
        onChange={(v) => setParams(v === 'anuales' ? { vista: 'anuales' } : {})}
        opciones={[
          { valor: 'mensual', texto: 'Mensual' },
          { valor: 'anuales', texto: 'Anuales' },
        ]}
      />
      {vista === 'mensual' ? <Mensual /> : <Anuales />}
    </div>
  )
}
