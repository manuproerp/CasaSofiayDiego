import { ArrowLeft, CalendarBlank, CaretDown, GearSix, NotePencil, Tag, WarningCircle } from '@phosphor-icons/react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAvisar } from '@/componentes/ui/avisos'
import { Aviso, Boton, BotonIcono, Campo, cx, Entrada, Segmentado, Vacio } from '@/componentes/ui/base'
import { Avatar, Monto } from '@/componentes/ui/datos'
import { Hoja } from '@/componentes/ui/hoja'
import { IconoCategoria } from '@/componentes/ui/iconos'
import { Teclado } from '@/componentes/ui/teclado'
import {
  useCategorias,
  useConfig,
  useGuardarGasto,
  usePersonas,
  useTCActual,
  useYo,
  type NuevoGasto,
} from '@/datos/consultas'
import { aLempiras, dinero, fechaCorta, hoyISO, parsearMonto } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { Moneda, TipoGasto } from '@/lib/tipos'

export interface InicialGasto {
  monto?: number
  moneda?: Moneda
  tipo?: TipoGasto
  categoria_id?: string | null
  descripcion?: string | null
  presupuesto_id?: string | null
  titulo?: string
}

const Ctx = createContext<((inicial?: InicialGasto) => void) | null>(null)

export function useRegistrarGasto() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRegistrarGasto fuera de ProveedorRegistroGasto')
  return v
}

export function ProveedorRegistroGasto({ children }: { children: ReactNode }) {
  const [inicial, setInicial] = useState<InicialGasto | null>(null)
  const abrir = useCallback((i?: InicialGasto) => setInicial(i ?? {}), [])
  const cerrar = useCallback(() => setInicial(null), [])
  return (
    <Ctx.Provider value={abrir}>
      {children}
      {inicial && <FlujoGasto inicial={inicial} onCerrar={cerrar} />}
    </Ctx.Provider>
  )
}

type Paso = 'monto' | 'categoria' | 'quien'

/** Registro rápido: monto → categoría → quién (el último toque guarda) */
function FlujoGasto({ inicial, onCerrar }: { inicial: InicialGasto; onCerrar: () => void }) {
  const avisar = useAvisar()
  const navegar = useNavigate()
  const { yo } = useYo()
  const { personas } = usePersonas()
  const { data: categorias = [], isLoading: cargandoCats } = useCategorias()
  const { data: config } = useConfig()
  const { tc } = useTCActual()
  const guardar = useGuardarGasto()

  const [paso, setPaso] = useState<Paso>('monto')
  const [tipo, setTipo] = useState<TipoGasto>(inicial.tipo ?? 'hogar')
  const [montoTxt, setMontoTxt] = useState(inicial.monto ? String(inicial.monto) : '')
  const [moneda, setMoneda] = useState<Moneda>(inicial.moneda ?? 'HNL')
  const [tcTxt, setTcTxt] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(inicial.categoria_id ?? null)
  const [fecha, setFecha] = useState(hoyISO())
  const [descripcion, setDescripcion] = useState(inicial.descripcion ?? '')
  const [detalles, setDetalles] = useState(!!inicial.descripcion)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (tc && !tcTxt) setTcTxt(String(tc.valor))
  }, [tc, tcTxt])

  const monto = parsearMonto(montoTxt)
  const tcValor = moneda === 'USD' ? parsearMonto(tcTxt) : null
  const montoL = monto ? aLempiras(monto, moneda, tcValor) : 0
  const umbral = config?.umbral_aprobacion ?? null
  const requiereAprobacion = tipo === 'hogar' && !!umbral && montoL >= umbral
  const activas = categorias.filter((c) => c.activa)
  const categoria = categorias.find((c) => c.id === categoriaId)
  const indice = (id: string) => personas.findIndex((p) => p.id === id)

  const tecla = useCallback((t: string) => {
    setError(null)
    setMontoTxt((m) => {
      if (t === 'borrar') return m.slice(0, -1)
      if (t === '.') return m.includes('.') ? m : (m || '0') + '.'
      const [ent, dec] = m.split('.')
      if (dec !== undefined && dec.length >= 2) return m
      if (dec === undefined && ent.length >= 9) return m
      if (m === '0') return t
      return m + t
    })
  }, [])

  const puedeSeguir = !!monto && (moneda === 'HNL' || !!tcValor)

  useEffect(() => {
    if (paso !== 'monto') return
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') siguienteRef.current()
    }
    document.addEventListener('keydown', f)
    return () => document.removeEventListener('keydown', f)
  }, [paso])

  const siguiente = () => {
    if (!puedeSeguir) return
    if (tipo === 'mesada' || inicial.categoria_id) setPaso('quien')
    else setPaso('categoria')
  }

  const siguienteRef = useRef(siguiente)
  siguienteRef.current = siguiente

  const atras = () => {
    if (paso === 'quien') setPaso(tipo === 'mesada' || inicial.categoria_id ? 'monto' : 'categoria')
    else if (paso === 'categoria') setPaso('monto')
  }

  const guardarCon = async (personaId: string) => {
    if (!monto) return
    setError(null)
    const g: NuevoGasto = {
      fecha,
      monto,
      moneda,
      tipo_cambio: moneda === 'USD' ? tcValor : null,
      tipo,
      categoria_id: tipo === 'hogar' ? categoriaId : null,
      persona_id: personaId,
      descripcion: descripcion.trim() || null,
      presupuesto_id: tipo === 'hogar' ? (inicial.presupuesto_id ?? null) : null,
    }
    try {
      const r = await guardar.mutateAsync(g)
      avisar(r.estado === 'pendiente' ? 'Gasto registrado · pendiente de aprobación' : 'Gasto registrado')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const titulo =
    inicial.titulo ?? (paso === 'monto' ? 'Nuevo gasto' : paso === 'categoria' ? '¿En qué?' : tipo === 'mesada' ? '¿De quién es la mesada?' : '¿Quién lo pagó?')

  const resumen = monto ? (
    <span className="flex items-center gap-2">
      <Monto valor={monto} moneda={moneda} className="font-semibold text-texto" />
      {categoria && tipo === 'hogar' && <span className="text-texto-3">· {categoria.nombre}</span>}
      {tipo === 'mesada' && <span className="text-texto-3">· Mesada</span>}
    </span>
  ) : undefined

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={titulo}
      subtitulo={paso !== 'monto' ? resumen : undefined}
      izquierda={paso !== 'monto' ? <BotonIcono icono={ArrowLeft} etiqueta="Atrás" onClick={atras} className="-ml-3" /> : undefined}
      pie={
        paso === 'monto' ? (
          <Boton tamano="lg" ancho disabled={!puedeSeguir} onClick={siguiente}>
            Siguiente
          </Boton>
        ) : undefined
      }
    >
      {paso === 'monto' && (
        <div className="flex flex-col gap-5">
          <Segmentado
            etiqueta="Tipo de gasto"
            className="w-full"
            valor={tipo}
            onChange={setTipo}
            opciones={[
              { valor: 'hogar', texto: 'Del hogar' },
              { valor: 'mesada', texto: 'De mesada' },
            ]}
          />

          <div className="flex flex-col items-start gap-1 rounded-[20px] bg-superficie-2/60 px-5 py-4">
            <div className="flex w-full items-center justify-between gap-3">
              <div className="num flex min-w-0 items-baseline gap-2 text-[44px] leading-none font-semibold tracking-tighter">
                <span className="text-[24px] text-texto-3">{moneda === 'USD' ? '$' : 'L'}</span>
                <span className={cx('truncate', !montoTxt && 'text-texto-3')}>{montoTxt || '0'}</span>
              </div>
              <Segmentado
                etiqueta="Moneda"
                valor={moneda}
                onChange={setMoneda}
                opciones={[
                  { valor: 'HNL', texto: 'L' },
                  { valor: 'USD', texto: 'US$' },
                ]}
              />
            </div>
            {moneda === 'USD' && (
              <div className="mt-3 flex w-full flex-wrap items-center gap-x-3 gap-y-2 text-sm text-texto-2">
                <label className="flex items-center gap-2">
                  Tipo de cambio
                  <input
                    inputMode="decimal"
                    value={tcTxt}
                    onChange={(e) => setTcTxt(e.target.value)}
                    placeholder="24.70"
                    className="num h-10 w-28 rounded-[10px] text-base border border-borde-fuerte bg-superficie px-2.5 text-texto outline-none focus:border-primario"
                  />
                </label>
                {monto && tcValor ? (
                  <span className="num">≈ {dinero(montoL)}</span>
                ) : (
                  !tcValor && <span className="text-ambar">Escribe el tipo de cambio</span>
                )}
              </div>
            )}
          </div>

          <Teclado onTecla={tecla} conPunto />

          {requiereAprobacion && (
            <Aviso tono="ambar">
              Supera el umbral de {dinero(umbral)}. Quedará pendiente hasta que ambos lo aprueben.
            </Aviso>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setDetalles((d) => !d)}
              className="flex h-10 items-center gap-2 self-start text-sm font-medium text-texto-2 hover:text-texto"
            >
              <NotePencil size={18} />
              {detalles ? 'Ocultar detalles' : 'Agregar nota o cambiar fecha'}
              <CaretDown size={14} className={cx('transition-transform', detalles && 'rotate-180')} />
            </button>
            {detalles && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
                <Campo etiqueta="Nota">
                  {(id) => (
                    <Entrada id={id} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. pago de luz de octubre" />
                  )}
                </Campo>
                <Campo etiqueta="Fecha">
                  {(id) => <Entrada id={id} type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value || hoyISO())} />}
                </Campo>
              </div>
            )}
            {!detalles && fecha !== hoyISO() && (
              <p className="flex items-center gap-1.5 text-sm text-texto-2">
                <CalendarBlank size={16} /> {fechaCorta(fecha)}
              </p>
            )}
          </div>

        </div>
      )}

      {paso === 'categoria' && (
        <div className="flex flex-col gap-4">
          {cargandoCats ? (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="esqueleto h-[92px] rounded-[18px]" />
              ))}
            </div>
          ) : activas.length === 0 ? (
            <Vacio
              icono={Tag}
              titulo="Todavía no hay categorías"
              texto="Créalas una vez en Ajustes (súper, luz, gasolina…) y aparecerán aquí."
              accion={
                <Boton
                  variante="suave"
                  icono={GearSix}
                  onClick={() => {
                    onCerrar()
                    navegar('/ajustes#categorias')
                  }}
                >
                  Ir a Ajustes
                </Boton>
              }
            />
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {activas.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  style={{ ['--i' as string]: i }}
                  onClick={() => {
                    setCategoriaId(c.id)
                    setPaso('quien')
                  }}
                  className={cx(
                    'pulsable entrar flex min-h-[92px] flex-col items-start justify-between gap-2 rounded-[18px] border p-3.5 text-left',
                    c.id === categoriaId
                      ? 'border-primario bg-primario-suave text-primario'
                      : 'border-borde bg-superficie hover:border-borde-fuerte hover:bg-superficie-2/60',
                  )}
                >
                  <IconoCategoria nombre={c.icono} size={24} className={c.id === categoriaId ? '' : 'text-v500'} />
                  <span className="line-clamp-2 text-[14px] leading-tight font-medium">{c.nombre}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {paso === 'quien' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={guardar.isPending}
                onClick={() => guardarCon(p.id)}
                className={cx(
                  'pulsable flex min-h-[140px] flex-col items-start justify-between rounded-[22px] border-2 p-5 text-left disabled:opacity-60',
                  p.id === yo?.id ? 'border-primario bg-primario-suave' : 'border-borde bg-superficie hover:border-borde-fuerte',
                )}
              >
                <Avatar persona={p} indice={indice(p.id)} tamano={52} />
                <span className="flex w-full items-center justify-between">
                  <span className="text-lg font-semibold tracking-tight">{p.nombre}</span>
                  {guardar.isPending && guardar.variables?.persona_id === p.id && (
                    <span className="size-4 animate-spin rounded-full border-2 border-primario border-r-transparent" />
                  )}
                </span>
              </button>
            ))}
          </div>
          {requiereAprobacion && (
            <p className="text-sm text-texto-2">
              Quien lo registre cuenta como la primera aprobación.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-rojo">
          <WarningCircle size={18} className="mt-px shrink-0" /> {error}
        </p>
      )}
    </Hoja>
  )
}

export function useIndicePersona() {
  const { personas } = usePersonas()
  return useMemo(() => {
    const m = new Map(personas.map((p, i) => [p.id, i]))
    return (id: string | null | undefined) => (id ? (m.get(id) ?? 0) : 0)
  }, [personas])
}
