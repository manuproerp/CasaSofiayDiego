import { ArrowRight, CalendarCheck, CheckCircle, GearSix, Plus, Receipt, ShoppingCart, Target, Wallet } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListaAprobaciones, usePorAprobar } from '@/componentes/gastos/Aprobaciones'
import { EditarGasto } from '@/componentes/gastos/EditarGasto'
import { FilaGasto } from '@/componentes/gastos/FilaGasto'
import { useIndicePersona, useRegistrarGasto } from '@/componentes/gastos/RegistroGasto'
import { TipoCambioRapido } from '@/componentes/TipoCambioRapido'
import { Boton, cx, Esqueleto, ErrorEnLinea, Etiqueta, Tarjeta, Vacio } from '@/componentes/ui/base'
import { Avatar, Barra, Monto } from '@/componentes/ui/datos'
import { IconoCategoria } from '@/componentes/ui/iconos'
import { useMapaCategorias, useMenuRango, usePersonas, useRecetas, useSuper, useYo } from '@/datos/consultas'
import { useMes } from '@/datos/mes'
import { useApartados, useResumenMes } from '@/datos/resumen'
import { semaforo } from '@/lib/calculos'
import { COMIDAS } from '@/lib/cocina'
import { diasEnMes, dinero, fechaLarga, hoyISO, nombreMes, partesHoy, plazo, saludo } from '@/lib/formato'
import type { Gasto } from '@/lib/tipos'

function Titulo({ children, a, texto = 'Ver todo' }: { children: React.ReactNode; a?: string; texto?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold tracking-tight">{children}</h2>
      {a && (
        <Link to={a} className="flex h-9 items-center gap-1 text-[13px] font-medium text-texto-2 hover:text-primario">
          {texto} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  )
}

export function Inicio() {
  const { anio, mes, esMesActual } = useMes()
  const navegar = useNavigate()
  const registrar = useRegistrarGasto()
  const { yo } = useYo()
  const { personas } = usePersonas()
  const indice = useIndicePersona()
  const { mapa: categorias } = useMapaCategorias()
  const { items: porAprobar } = usePorAprobar()
  const { resumen, mesadas, gastos, cargando, error, reintentar } = useResumenMes(anio, mes)
  const apartados = useApartados(anio, mes)
  const hoyIso = hoyISO()
  const menuHoy = useMenuRango(hoyIso, hoyIso)
  const { data: recetas = [] } = useRecetas()
  const { data: listaSuper = [] } = useSuper()
  const superPendientes = listaSuper.filter((i) => !i.comprado).length
  const [editando, setEditando] = useState<Gasto | null>(null)

  const hoy = partesHoy()
  const diasRestantes = esMesActual ? diasEnMes(anio, mes) - hoy.dia + 1 : 0

  const alertas = useMemo(
    () =>
      (resumen?.filas ?? [])
        .filter((f) => f.semaforo === 'cerca' || f.semaforo === 'excedido')
        .sort((a, b) => b.real / b.presupuesto - a.real / a.presupuesto)
        .slice(0, 4),
    [resumen],
  )
  const recientes = gastos.slice(0, 6)
  const hayPendientes = porAprobar.length > 0
  const proximos = (apartados.resumen?.fondos ?? [])
    .filter((e) => e.fondo.fecha_objetivo && e.apartado < e.fondo.monto_objetivo)
    .sort((a, b) => (a.dias ?? 1e9) - (b.dias ?? 1e9))
    .slice(0, 3)
  const faltaApartar = Math.max(0, (apartados.resumen?.sugeridoMes ?? 0) - (apartados.resumen?.aportadoMes ?? 0))

  if (error) return <ErrorEnLinea error={error} reintentar={reintentar} />

  const presupuesto = resumen?.presupuestoTotal ?? 0
  const real = resumen?.realTotal ?? 0
  const disponible = presupuesto - real
  const estado = semaforo(real, presupuesto)
  const porDia = diasRestantes > 0 && disponible > 0 ? disponible / diasRestantes : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] font-medium text-texto-3">{fechaLarga()}</p>
        <h2 className="text-2xl font-semibold tracking-tight md:text-[28px]">
          {saludo()}
          {yo?.rol === 'persona' ? `, ${yo.nombre}` : ''}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-6">
        {/* Hero: el mes */}
        <section className="entrar relative flex min-h-[260px] flex-col justify-between gap-6 overflow-hidden rounded-[26px] bg-hero p-6 text-sobre-hero shadow-flotante md:p-8">
          <svg className="pointer-events-none absolute -top-16 -right-16 size-72 opacity-[0.10]" viewBox="0 0 200 200" aria-hidden>
            {[95, 75, 55, 35].map((r) => (
              <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="1.2" />
            ))}
          </svg>
          <div className="relative flex items-start justify-between gap-4">
            <span className="text-sm text-sobre-hero-2">Gastado del hogar · {nombreMes(mes, false)}</span>
            {presupuesto > 0 && (
              <span
                className={cx(
                  'rounded-full px-3 py-1 text-[12px] font-semibold',
                  estado === 'excedido' ? 'bg-rojo-barra text-white' : estado === 'cerca' ? 'bg-ambar-barra text-white' : 'bg-sobre-hero/12 text-sobre-hero',
                )}
              >
                {estado === 'excedido' ? 'Excedido' : estado === 'cerca' ? 'Cerca del límite' : 'En orden'}
              </span>
            )}
          </div>

          {cargando ? (
            <div className="flex flex-col gap-3">
              <div className="h-12 w-56 animate-pulse rounded-xl bg-sobre-hero/10" />
              <div className="h-2.5 w-full animate-pulse rounded-full bg-sobre-hero/10" />
            </div>
          ) : (
            <div className="relative flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                <Monto valor={real} className="text-5xl leading-none font-semibold tracking-tighter md:text-6xl" />
                {presupuesto > 0 && (
                  <span className="num pb-1 text-sobre-hero-2">de {dinero(presupuesto, 'HNL', { corto: true })}</span>
                )}
              </div>
              {presupuesto > 0 ? (
                <>
                  <Barra real={real} total={presupuesto} semaforo={estado} sobreHero className="h-2.5" />
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                    <div className="flex flex-col">
                      <span className="text-sobre-hero-2">{disponible >= 0 ? 'Disponible' : 'Excedido'}</span>
                      <Monto valor={Math.abs(disponible)} decimales={false} className="text-lg font-semibold" />
                    </div>
                    {esMesActual && (
                      <div className="flex flex-col">
                        <span className="text-sobre-hero-2">
                          {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'} restantes
                        </span>
                        <span className="num text-lg font-semibold">{porDia > 0 ? `${dinero(porDia, 'HNL', { corto: true })}/día` : '—'}</span>
                      </div>
                    )}
                    {(resumen?.pendienteTotal ?? 0) > 0 && (
                      <div className="flex flex-col">
                        <span className="text-sobre-hero-2">Por aprobar</span>
                        <Monto valor={resumen!.pendienteTotal} decimales={false} className="text-lg font-semibold" />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-sobre-hero-2">Sin presupuesto para este mes todavía.</p>
                  <button
                    onClick={() => navegar('/presupuesto')}
                    className="pulsable flex h-10 items-center gap-1.5 rounded-full bg-sobre-hero/12 px-4 text-sm font-medium hover:bg-sobre-hero/20"
                  >
                    Armar presupuesto <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Aprobaciones */}
        <Tarjeta
          className={cx('entrar flex flex-col gap-4 p-6', hayPendientes && 'ring-2 ring-ambar-barra/40')}
          style={{ ['--i' as string]: 1 }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold tracking-tight">Por aprobar</h2>
            {hayPendientes && <Etiqueta tono="ambar">{porAprobar.length}</Etiqueta>}
          </div>
          <ListaAprobaciones limite={3} compacta />
          {porAprobar.length > 3 && (
            <Link to="/aprobaciones" className="text-[13px] font-medium text-primario hover:underline">
              Ver los {porAprobar.length}
            </Link>
          )}
        </Tarjeta>

        {/* Categorías en alerta */}
        <Tarjeta className="entrar flex flex-col gap-4 p-6 max-md:order-3" style={{ ['--i' as string]: 2 }}>
          <Titulo a="/presupuesto" texto="Presupuesto">
            Cómo van las categorías
          </Titulo>
          {cargando ? (
            <div className="flex flex-col gap-4">
              <Esqueleto className="h-10" />
              <Esqueleto className="h-10" />
            </div>
          ) : (resumen?.filas.length ?? 0) === 0 ? (
            <p className="text-sm text-texto-2">Cuando armen el presupuesto, aquí verán las categorías que se están pasando.</p>
          ) : alertas.length === 0 ? (
            <div className="flex items-center gap-3 text-sm text-texto-2">
              <CheckCircle size={22} weight="fill" className="text-v500" />
              Todas las categorías van dentro del presupuesto.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {alertas.map((f) => (
                <li key={f.categoria.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <IconoCategoria nombre={f.categoria.icono} size={20} className={f.semaforo === 'excedido' ? 'text-rojo' : 'text-ambar'} />
                    <span className="flex-1 truncate font-medium">{f.categoria.nombre}</span>
                    <span className={cx('num text-sm font-semibold', f.semaforo === 'excedido' ? 'text-rojo' : 'text-ambar')}>
                      {Math.round((f.real / f.presupuesto) * 100)}%
                    </span>
                  </div>
                  <Barra real={f.real} total={f.presupuesto} semaforo={f.semaforo} />
                  <span className="num text-[12px] text-texto-3">
                    {dinero(f.real, 'HNL', { corto: true })} de {dinero(f.presupuesto, 'HNL', { corto: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        {/* Hoy en la cocina */}
        <Tarjeta className="entrar flex flex-col gap-4 p-6 max-md:order-1" style={{ ['--i' as string]: 3 }}>
          <Titulo a="/menu" texto="Menú">
            Hoy se come
          </Titulo>
          {menuHoy.isLoading ? (
            <Esqueleto className="h-24" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {COMIDAS.map((c) => {
                const e = (menuHoy.data ?? []).filter((m) => m.comida === c.valor)
                if (!e.length && c.valor === 'lonchera') return null
                return (
                  <li key={c.valor} className="grid grid-cols-[72px_1fr] items-baseline gap-2 text-sm">
                    <span className="text-[12px] font-medium text-texto-3">{c.texto}</span>
                    <span className={cx('font-medium', !e.length && 'font-normal text-texto-3')}>
                      {e.length
                        ? e.map((m) => (m.receta_id ? (recetas.find((r) => r.id === m.receta_id)?.nombre ?? '—') : m.texto)).join(' / ')
                        : 'Sin definir'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <Link
            to="/super"
            className="flex items-center justify-between rounded-control bg-superficie-2 px-4 py-3 text-sm hover:bg-borde"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-v500" />
              {superPendientes ? (
                <span>
                  <span className="num font-semibold">{superPendientes}</span> en la lista del súper
                </span>
              ) : (
                'Lista del súper al día'
              )}
            </span>
            <ArrowRight size={16} />
          </Link>
        </Tarjeta>

        {/* Mesadas */}
        <Tarjeta className="entrar flex flex-col gap-4 p-6 max-md:order-5" style={{ ['--i' as string]: 3 }}>
          <h2 className="font-semibold tracking-tight">Mesadas</h2>
          {mesadas.length === 0 ? (
            <Esqueleto className="h-16" />
          ) : (
            <ul className="flex flex-col gap-4">
              {mesadas.map((m) => {
                const quedan = (m.asignada ?? 0) - m.gastada
                return (
                  <li key={m.persona.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar persona={m.persona} indice={indice(m.persona.id)} tamano={32} className="!ring-0" />
                      <span className="flex-1 font-medium">{m.persona.nombre}</span>
                      {m.asignada ? (
                        <span className={cx('num text-sm font-semibold', quedan < 0 ? 'text-rojo' : 'text-texto')}>
                          {quedan >= 0 ? `Quedan ${dinero(quedan, 'HNL', { corto: true })}` : `−${dinero(-quedan, 'HNL', { corto: true })}`}
                        </span>
                      ) : (
                        <span className="num text-sm text-texto-2">{dinero(m.gastada, 'HNL', { corto: true })} usados</span>
                      )}
                    </div>
                    {m.asignada ? (
                      <Barra real={m.gastada} total={m.asignada} semaforo={semaforo(m.gastada, m.asignada)} />
                    ) : null}
                  </li>
                )
              })}
              {mesadas.every((m) => !m.asignada) && (
                <li>
                  <Link to="/ajustes#mesadas" className="flex items-center gap-1.5 text-[13px] font-medium text-primario hover:underline">
                    <GearSix size={16} /> Definir mesadas
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Tarjeta>

        {/* Últimos gastos */}
        <Tarjeta className="entrar flex flex-col gap-3 p-6 max-md:order-6 md:row-span-2" style={{ ['--i' as string]: 4 }}>
          <Titulo a="/gastos">Últimos gastos</Titulo>
          {cargando ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Esqueleto key={i} className="h-12" />
              ))}
            </div>
          ) : recientes.length === 0 ? (
            <Vacio
              compacto
              icono={Receipt}
              titulo={`Sin gastos en ${nombreMes(mes, false)}`}
              texto="Lleva 3 toques: monto, categoría y quién."
              accion={
                <Boton icono={Plus} onClick={() => registrar()}>
                  Registrar gasto
                </Boton>
              }
            />
          ) : (
            <div className="-mx-1 flex flex-col divide-y divide-borde/70">
              {recientes.map((g) => (
                <FilaGasto
                  key={g.id}
                  compacta
                  gasto={g}
                  categoria={g.categoria_id ? categorias.get(g.categoria_id) : undefined}
                  persona={personas.find((p) => p.id === g.persona_id)}
                  indicePersona={indice(g.persona_id)}
                  onClick={() => setEditando(g)}
                />
              ))}
            </div>
          )}
        </Tarjeta>

        {/* Apartados: próximos vencimientos y metas */}
        <Tarjeta className="entrar flex flex-col gap-4 p-6 max-md:order-2" style={{ ['--i' as string]: 5 }}>
          <Titulo a="/presupuesto?vista=anuales" texto="Anuales">
            Lo que viene
          </Titulo>
          {apartados.cargando ? (
            <Esqueleto className="h-24" />
          ) : proximos.length === 0 ? (
            <p className="flex items-center gap-2.5 text-sm text-texto-2">
              <CalendarCheck size={20} className="text-v500" />
              {(apartados.resumen?.fondos.length ?? 0) > 0 ? 'Todo apartado a tiempo.' : 'Sin gastos anuales ni metas todavía.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {proximos.map((e) => {
                const urgente = e.dias != null && e.dias <= 45
                return (
                  <li key={e.fondo.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                      <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-[10px]', urgente ? 'bg-ambar-suave text-ambar' : 'bg-primario-suave text-primario')}>
                        {e.fondo.tipo === 'anual' ? <CalendarCheck size={18} /> : <Target size={18} />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{e.fondo.nombre}</span>
                        <span className={cx('text-[12px]', urgente ? 'text-ambar' : 'text-texto-3')}>{plazo(e.dias)}</span>
                      </span>
                      <span className="num text-sm font-semibold">{Math.round(e.pct)}%</span>
                    </div>
                    <div className="pl-12">
                      <Barra real={e.apartado} total={e.fondo.monto_objetivo} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {faltaApartar > 0 && (
            <Link
              to="/presupuesto?vista=anuales"
              className="flex items-center justify-between rounded-control bg-superficie-2 px-4 py-3 text-sm hover:bg-borde"
            >
              <span>
                Falta apartar <span className="num font-semibold">{dinero(faltaApartar, 'HNL', { corto: true })}</span> este mes
              </span>
              <ArrowRight size={16} />
            </Link>
          )}
        </Tarjeta>

        <Tarjeta className="entrar flex flex-col gap-4 p-6 max-md:order-7" style={{ ['--i' as string]: 6 }}>
          <TipoCambioRapido />
          <div className="flex items-center gap-3 border-t border-borde pt-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-primario-suave text-primario">
              <Wallet size={20} />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-[13px] text-texto-3">Mesadas · {nombreMes(mes, false)}</span>
              <Monto valor={mesadas.reduce((s, m) => s + m.gastada, 0)} className="font-semibold" />
            </div>
          </div>
        </Tarjeta>
      </div>

      {editando && <EditarGasto gasto={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}
