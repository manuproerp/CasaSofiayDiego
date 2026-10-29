import {
  ArrowsClockwise,
  Bed,
  Broom,
  Check,
  CookingPot,
  DotsThree,
  Drop,
  Fire,
  PushPin,
  ShoppingCart,
  Snowflake,
  Sparkle,
  Toilet,
  Trash,
  TShirt,
  WashingMachine,
  type Icon,
} from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { cx } from '@/componentes/ui/base'
import { Avatar } from '@/componentes/ui/datos'
import { useAusencias, useCompletarTarea, useDeshacerTarea, useDiasTareas, usePersonas, useTareas, useTareasHechas } from '@/datos/consultas'
import { hoyISO } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import { ausenciaEn, calcularRacha, frecuenciaTexto, responsableEn, vencimiento, type Racha } from '@/lib/tareas'
import type { Ausencia, Perfil, Tarea, TareaHecha } from '@/lib/tipos'

// ───────────── Íconos ─────────────

const ICONOS: [RegExp, Icon][] = [
  [/cocin/i, CookingPot],
  [/plato|traste/i, Drop],
  [/basura/i, Trash],
  [/barr|trape|aspir/i, Broom],
  [/lavadora|ropa/i, WashingMachine],
  [/planch|dobl/i, TShirt],
  [/baño|inodoro/i, Toilet],
  [/s[uú]per|compra/i, ShoppingCart],
  [/s[aá]bana|cama/i, Bed],
]

export function IconoTarea({ nombre, size = 22, className }: { nombre: string; size?: number; className?: string }) {
  const I = ICONOS.find(([r]) => r.test(nombre))?.[1] ?? Sparkle
  return <I size={size} className={className} />
}

// ───────────── Datos de hoy ─────────────

export interface Pendiente {
  tarea: Tarea
  cubre: boolean
  venc: ReturnType<typeof vencimiento>
}

export interface Columna {
  persona: Perfil
  indice: number
  ausencia: Ausencia | null
  pendientes: Pendiente[]
  hechas: { hecha: TareaHecha; tarea: Tarea; deshacible: boolean }[]
  racha: Racha
}

export function useTareasHoy() {
  const hoy = hoyISO()
  const tareas = useTareas()
  const hechas = useTareasHechas()
  const ausencias = useAusencias()
  const dias = useDiasTareas()
  const { personas, isLoading: cargandoPersonas } = usePersonas()

  const datos = useMemo(() => {
    const lista = (tareas.data ?? []).filter((t) => t.activa)
    const aus = ausencias.data ?? []
    const todasHechas = hechas.data ?? []
    const mapaTareas = new Map((tareas.data ?? []).map((t) => [t.id, t]))
    // La última vez de cada tarea es la única que se puede deshacer
    const ultima = new Map<string, string>()
    for (const h of todasHechas) if (!ultima.has(h.tarea_id)) ultima.set(h.tarea_id, h.id)

    const columnas: Columna[] = personas.map((persona, indice) => ({
      persona,
      indice,
      ausencia: ausenciaEn(persona.id, hoy, aus),
      pendientes: [],
      hechas: [],
      racha: calcularRacha([], persona.id, hoy, false, false),
    }))
    const sinNadie: Pendiente[] = []

    for (const t of lista) {
      if (t.proxima_fecha > hoy) continue
      const r = responsableEn(t, hoy, aus, personas)
      const p: Pendiente = { tarea: t, cubre: r.cubre, venc: vencimiento(t.proxima_fecha, hoy) }
      const col = columnas.find((c) => c.persona.id === r.persona)
      if (col) col.pendientes.push(p)
      else sinNadie.push(p)
    }
    for (const h of todasHechas) {
      if (h.fecha !== hoy) continue
      const t = mapaTareas.get(h.tarea_id)
      const col = columnas.find((c) => c.persona.id === h.hecha_por)
      if (t && col) col.hechas.push({ hecha: h, tarea: t, deshacible: ultima.get(t.id) === h.id })
    }
    for (const c of columnas) {
      c.pendientes.sort((a, b) => a.venc.dias - b.venc.dias || a.tarea.orden - b.tarea.orden)
      c.hechas.sort((a, b) => a.tarea.orden - b.tarea.orden)
      c.racha = calcularRacha(dias.data ?? [], c.persona.id, hoy, c.pendientes.length === 0, !!c.ausencia)
    }

    const proximas = lista
      .filter((t) => t.proxima_fecha > hoy)
      .sort((a, b) => a.proxima_fecha.localeCompare(b.proxima_fecha) || a.orden - b.orden)
      .map((t) => ({ tarea: t, ...responsableEn(t, t.proxima_fecha, aus, personas) }))

    return { columnas, sinNadie, proximas, mapaTareas }
  }, [tareas.data, hechas.data, ausencias.data, dias.data, personas, hoy])

  return {
    ...datos,
    hoy,
    tareas: tareas.data ?? [],
    hechasTodas: hechas.data ?? [],
    ausencias: ausencias.data ?? [],
    personas,
    cargando: tareas.isLoading || hechas.isLoading || ausencias.isLoading || cargandoPersonas,
    cargandoRachas: dias.isLoading,
    error: tareas.error ?? hechas.error ?? ausencias.error,
    reintentar: () => {
      tareas.refetch()
      hechas.refetch()
      ausencias.refetch()
    },
  }
}

/** Marcar hecha con aviso y "Deshacer" */
export function useAccionesTarea() {
  const avisar = useAvisar()
  const completar = useCompletarTarea()
  const deshacer = useDeshacerTarea()
  const { personas } = usePersonas()

  const quitar = async (hechaId: string, nombre: string) => {
    try {
      await deshacer.mutateAsync(hechaId)
      avisar(`${nombre}: otra vez pendiente`)
    } catch (e) {
      avisar(mensajeError(e), 'error')
    }
  }

  const hecha = async (tarea: Tarea, persona?: string | null) => {
    try {
      const id = await completar.mutateAsync({ tarea, persona })
      const quien = persona ? personas.find((p) => p.id === persona)?.nombre : null
      avisar(quien ? `${tarea.nombre} · la hizo ${quien}` : `Listo: ${tarea.nombre}`, 'ok', {
        texto: 'Deshacer',
        alPulsar: () => quitar(id, tarea.nombre),
      })
      return true
    } catch (e) {
      avisar(mensajeError(e), 'error')
      return false
    }
  }

  return { hecha, quitar, ocupado: completar.isPending || deshacer.isPending }
}

// ───────────── Filas ─────────────

export function FilaPendiente({
  p,
  ausente,
  onHecha,
  onAbrir,
  compacta,
}: {
  p: Pendiente
  ausente?: string | null
  onHecha: () => void
  onAbrir?: () => void
  compacta?: boolean
}) {
  const t = p.tarea
  const sub = [
    p.venc.atrasada ? p.venc.texto : null,
    p.cubre && ausente ? `Cubre a ${ausente}` : null,
    !compacta && !p.venc.atrasada && !p.cubre ? frecuenciaTexto(t.cada_dias) : null,
  ].filter(Boolean)
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onHecha}
        className={cx(
          'pulsable group flex min-w-0 flex-1 items-center gap-3 rounded-[16px] text-left hover:bg-superficie-2/70',
          compacta ? 'min-h-14 px-2 py-1.5' : 'min-h-[68px] px-3 py-2',
        )}
      >
        <span
          className={cx(
            'flex shrink-0 items-center justify-center rounded-full border-2 text-transparent group-hover:text-primario/40',
            compacta ? 'size-10' : 'size-12',
            p.venc.atrasada ? 'border-rojo/60' : 'border-borde-fuerte',
          )}
        >
          <Check size={compacta ? 18 : 22} weight="bold" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cx('truncate font-medium', compacta ? 'text-[15px]' : 'text-[17px]')}>{t.nombre}</span>
          {sub.length > 0 && (
            <span className={cx('truncate text-[13px]', p.venc.atrasada ? 'text-rojo' : 'text-texto-3')}>{sub.join(' · ')}</span>
          )}
        </span>
        {!compacta && <IconoTarea nombre={t.nombre} className="hidden shrink-0 text-texto-3 sm:block" />}
      </button>
      {onAbrir && (
        <button
          type="button"
          onClick={onAbrir}
          aria-label={`Opciones de ${t.nombre}`}
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-texto-3 hover:bg-superficie-2 hover:text-texto"
        >
          <DotsThree size={24} weight="bold" />
        </button>
      )}
    </li>
  )
}

export function FilaHecha({
  tarea,
  deshacible,
  onDeshacer,
  compacta,
}: {
  tarea: Tarea
  deshacible: boolean
  onDeshacer: () => void
  compacta?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        disabled={!deshacible}
        onClick={onDeshacer}
        aria-label={`${tarea.nombre}, hecha. Tocar para deshacer`}
        className={cx(
          'flex w-full items-center gap-3 rounded-[16px] text-left enabled:hover:bg-superficie-2/70',
          compacta ? 'min-h-12 px-2 py-1' : 'min-h-14 px-3 py-1.5',
        )}
      >
        <span
          className={cx(
            'flex shrink-0 items-center justify-center rounded-full bg-primario text-sobre-primario',
            compacta ? 'size-10' : 'size-12',
          )}
        >
          <Check size={compacta ? 18 : 22} weight="bold" />
        </span>
        <span className={cx('min-w-0 flex-1 truncate text-texto-3 line-through decoration-texto-3/50', compacta ? 'text-[15px]' : 'text-[17px]')}>
          {tarea.nombre}
        </span>
      </button>
    </li>
  )
}

// ───────────── Racha ─────────────

const LETRAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

function letraDia(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return LETRAS[new Date(a, m - 1, d).getDay()]
}

export function PuntosRacha({ racha, alDia }: { racha: Racha; alDia: boolean }) {
  return (
    <ol className="flex items-end gap-2" aria-label="Últimos 7 días">
      {racha.ultimos.map((d) => {
        const clase =
          d.estado === 'cumplido'
            ? 'bg-primario'
            : d.estado === 'fallado'
              ? 'bg-rojo-suave ring-1 ring-rojo/50'
              : d.estado === 'congelado'
                ? 'bg-v100 ring-1 ring-v300'
                : d.estado === 'hoy'
                  ? alDia
                    ? 'bg-primario ring-2 ring-primario/30 ring-offset-2 ring-offset-superficie'
                    : 'ring-2 ring-primario/60'
                  : 'bg-superficie-2'
        const texto =
          d.estado === 'cumplido' ? 'cumplido' : d.estado === 'fallado' ? 'quedó pendiente' : d.estado === 'congelado' ? 'fuera' : d.estado === 'hoy' ? 'hoy' : 'sin dato'
        return (
          <li key={d.fecha} className="flex flex-col items-center gap-1.5" title={`${d.fecha}: ${texto}`}>
            <span className={cx('size-3.5 rounded-full', clase)} />
            <span className={cx('text-[11px] font-medium', d.estado === 'hoy' ? 'text-texto' : 'text-texto-3')}>{letraDia(d.fecha)}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function TarjetaRacha({ col, cargando }: { col: Columna; cargando?: boolean }) {
  const total = col.pendientes.length + col.hechas.length
  const alDia = col.pendientes.length === 0
  return (
    <div className="flex flex-col gap-4 rounded-tarjeta border border-borde/70 bg-superficie p-5 shadow-tarjeta">
      <div className="flex items-center gap-3">
        <Avatar persona={col.persona} indice={col.indice} tamano={44} className="!ring-0" />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[17px] font-semibold tracking-tight">{col.persona.nombre}</span>
          <span className="text-[13px] text-texto-3">
            {col.ausencia
              ? `Fuera${col.ausencia.motivo ? ` · ${col.ausencia.motivo}` : ''}`
              : total === 0
                ? 'Nada para hoy'
                : alDia
                  ? `Todo hecho hoy`
                  : `${col.hechas.length} de ${total} hechas hoy`}
          </span>
        </div>
        <div className="flex flex-col items-end leading-none">
          {cargando ? (
            <span className="esqueleto h-8 w-12" />
          ) : (
            <span className={cx('num flex items-center gap-1 text-[32px] font-semibold tracking-tighter', col.racha.congelada ? 'text-v500' : col.racha.actual ? 'text-texto' : 'text-texto-3')}>
              {col.racha.congelada ? <Snowflake size={22} weight="bold" /> : <Fire size={22} weight="fill" className={col.racha.actual ? 'text-ambar-barra' : 'text-texto-3'} />}
              {col.racha.actual}
            </span>
          )}
          <span className="mt-1.5 text-[12px] text-texto-3">{col.racha.congelada ? 'racha congelada' : col.racha.actual === 1 ? 'día seguido' : 'días seguidos'}</span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <PuntosRacha racha={col.racha} alDia={alDia && !col.ausencia} />
        <span className="num text-[12px] text-texto-3">Mejor: {col.racha.mejor}</span>
      </div>
    </div>
  )
}

export function textoModo(t: Tarea, personas: Perfil[]) {
  const nombre = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? '—'
  return t.modo === 'fija'
    ? { icono: PushPin, texto: `Siempre ${nombre(t.asignada_a)}` }
    : { icono: ArrowsClockwise, texto: `Rotan · le toca a ${nombre(t.le_toca)}` }
}

export function InsigniaRacha({ racha, className }: { racha: Racha; className?: string }) {
  return (
    <span
      className={cx('num flex items-center gap-1 text-sm font-semibold', racha.congelada ? 'text-v500' : racha.actual ? 'text-texto' : 'text-texto-3', className)}
      title={racha.congelada ? 'Racha congelada' : `Racha: ${racha.actual} días seguidos`}
    >
      {racha.congelada ? <Snowflake size={16} weight="bold" /> : <Fire size={16} weight="fill" className={racha.actual ? 'text-ambar-barra' : ''} />}
      {racha.actual}
    </span>
  )
}
