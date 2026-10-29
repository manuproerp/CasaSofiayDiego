import { CalendarCheck, ChartPieSlice, CheckCircle, GearSix, ListBullets, Plus, Repeat } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRegistrarGasto } from '@/componentes/gastos/RegistroGasto'
import { FormPartida } from '@/componentes/presupuesto/FormPartida'
import { Aviso, Boton, cx, Esqueleto, ErrorEnLinea, Etiqueta, Tarjeta, TituloSeccion, Vacio } from '@/componentes/ui/base'
import { Barra, Monto } from '@/componentes/ui/datos'
import { Hoja } from '@/componentes/ui/hoja'
import { IconoCategoria } from '@/componentes/ui/iconos'
import { useMes } from '@/datos/mes'
import { useResumenMes } from '@/datos/resumen'
import { semaforo, type EventualMes, type FilaCategoria } from '@/lib/calculos'
import { dinero, fechaCorta, nombreMes } from '@/lib/formato'
import type { ItemPresupuesto, TipoPresupuesto } from '@/lib/tipos'

const TEXTO_SEMAFORO = {
  ok: 'text-texto-2',
  cerca: 'text-ambar',
  excedido: 'text-rojo',
  sin: 'text-texto-2',
}

function Fila({ f }: { f: FilaCategoria }) {
  const disponible = f.presupuesto - f.real
  const tipos = [f.fijo > 0 && 'Fijo', f.variable > 0 && 'Variable', f.eventual > 0 && 'Eventual'].filter(Boolean) as string[]
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

function Eventual({ e, onPagar }: { e: EventualMes; onPagar: () => void }) {
  return (
    <li className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
      <span
        className={cx(
          'flex size-10 shrink-0 items-center justify-center rounded-[12px]',
          e.pago ? 'bg-primario-suave text-primario' : 'bg-ambar-suave text-ambar',
        )}
      >
        {e.pago ? <CheckCircle size={22} weight="fill" /> : <CalendarCheck size={20} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium tracking-tight">{e.item.descripcion}</span>
        <span className="flex items-center gap-1.5 truncate text-[12px] text-texto-3">
          {e.categoria?.nombre}
          {e.item.recurrente && <Repeat size={12} aria-label="Cada año" />}
          {e.pago && ` · pagado ${fechaCorta(e.pago.fecha)}`}
        </span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Monto valor={e.item.monto} moneda={e.item.moneda} className="font-semibold" />
        {!e.pago && (
          <button onClick={onPagar} className="h-8 text-[13px] font-semibold text-primario hover:underline">
            Registrar pago
          </button>
        )}
      </div>
    </li>
  )
}

/** Lista de todas las partidas para administrarlas */
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
    { tipo: 'eventual', titulo: 'Eventuales · mes específico' },
  ]
  return (
    <Hoja abierta onCerrar={onCerrar} titulo="Partidas del presupuesto" subtitulo="Aplican a todos los meses salvo los eventuales." ancho="lg">
      <div className="flex flex-col gap-7">
        {grupos.map((g) => {
          const lista = items
            .filter((i) => i.tipo === g.tipo)
            .sort((a, b) => (a.mes ?? 0) - (b.mes ?? 0) || b.monto - a.monto)
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
                            <span className="truncate text-[12px] text-texto-3">
                              {p.descripcion ? c?.nombre : ''}
                              {p.tipo === 'eventual' && `${p.descripcion ? ' · ' : ''}${nombreMes(p.mes ?? 1)}${p.recurrente ? ', cada año' : ` ${p.anio}`}`}
                            </span>
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

export function Presupuesto() {
  const { anio, mes } = useMes()
  const navegar = useNavigate()
  const registrar = useRegistrarGasto()
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
  const sinPartidas = items.length === 0
  const disponible = resumen.presupuestoTotal - resumen.realTotal
  const estado = semaforo(resumen.realTotal, resumen.presupuestoTotal)

  if (sinPartidas) {
    return (
      <Tarjeta className="px-6 md:px-10">
        <Vacio
          icono={ChartPieSlice}
          titulo="Arma el presupuesto de la casa"
          texto={
            sinCategorias
              ? 'Primero crea las categorías en Ajustes (súper, luz, renta…). Después agregas cuánto le toca a cada una.'
              : 'Agrega lo fijo (renta, internet), los topes variables (súper, gasolina) y los eventuales con su mes (matrícula, impuestos).'
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
        {form && <FormPartida partida={form.partida} tipoInicial={form.tipo} onCerrar={() => setForm(null)} />}
      </Tarjeta>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        {/* Resumen del mes */}
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
          {resumen.pendienteTotal > 0 && (
            <p className="text-[13px] text-texto-2">
              Hay {dinero(resumen.pendienteTotal)} esperando aprobación que todavía no cuentan.
            </p>
          )}
          {resumen.faltaTC && (
            <Aviso tono="ambar">Hay partidas en dólares y no hay tipo de cambio registrado. Agrégalo en Ajustes.</Aviso>
          )}
        </Tarjeta>

        {/* Por categoría */}
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
          {resumen.filas.length === 0 ? (
            <p className="text-sm text-texto-2">No hay partidas que apliquen a {nombreMes(mes, false)}.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {resumen.filas.map((f) => (
                <Fila key={f.categoria.id} f={f} />
              ))}
            </ul>
          )}
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
      </div>

      {/* Eventuales del mes */}
      <aside className="flex flex-col gap-6 lg:sticky lg:top-[100px]">
        <Tarjeta className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold tracking-tight">Eventuales de {nombreMes(mes, false)}</h2>
            {resumen.eventuales.length > 0 && (
              <Etiqueta tono={resumen.eventuales.every((e) => e.pago) ? 'verde' : 'ambar'}>
                {resumen.eventuales.filter((e) => e.pago).length}/{resumen.eventuales.length} pagados
              </Etiqueta>
            )}
          </div>
          {resumen.eventuales.length === 0 ? (
            <Vacio
              compacto
              icono={CalendarCheck}
              titulo="Nada especial este mes"
              texto="Los gastos de un mes específico (matrícula, impuestos) aparecen aquí."
              accion={
                <Boton tamano="sm" variante="suave" icono={Plus} onClick={() => setForm({ tipo: 'eventual' })}>
                  Agregar eventual
                </Boton>
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {resumen.eventuales.map((e) => (
                <Eventual
                  key={e.item.id}
                  e={e}
                  onPagar={() =>
                    registrar({
                      monto: e.item.monto,
                      moneda: e.item.moneda,
                      categoria_id: e.item.categoria_id,
                      descripcion: e.item.descripcion,
                      presupuesto_id: e.item.id,
                      titulo: `Pagar ${e.item.descripcion}`,
                    })
                  }
                />
              ))}
            </ul>
          )}
        </Tarjeta>
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
      {form && <FormPartida partida={form.partida} tipoInicial={form.tipo} onCerrar={() => setForm(null)} />}
    </div>
  )
}
