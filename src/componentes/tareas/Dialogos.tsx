import { ArrowRight, CalendarPlus, PencilSimple, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, Campo, cx, Entrada, Interruptor, Segmentado } from '@/componentes/ui/base'
import { Avatar } from '@/componentes/ui/datos'
import { Hoja } from '@/componentes/ui/hoja'
import { useBorrarAusencia, useBorrarTarea, useGuardarAusencia, useGuardarTarea, usePersonas } from '@/datos/consultas'
import { sumarDias } from '@/lib/cocina'
import { fechaRelativa, hoyISO } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import { diasEntre, FRECUENCIAS, frecuenciaTexto, responsableEn, vencimiento } from '@/lib/tareas'
import type { Ausencia, Tarea, TareaHecha } from '@/lib/tipos'
import { IconoTarea, textoModo, useAccionesTarea } from './comun'

// ───────────── Detalle: quién la hizo, pasar a mañana, historial ─────────────

export function DetalleTarea({
  tarea,
  hechas,
  ausencias,
  onCerrar,
  onEditar,
}: {
  tarea: Tarea
  hechas: TareaHecha[]
  ausencias: Ausencia[]
  onCerrar: () => void
  onEditar: () => void
}) {
  const hoy = hoyISO()
  const avisar = useAvisar()
  const { personas } = usePersonas()
  const { hecha, ocupado } = useAccionesTarea()
  const guardar = useGuardarTarea()
  const r = responsableEn(tarea, hoy, ausencias, personas)
  const venc = vencimiento(tarea.proxima_fecha, hoy)
  const modo = textoModo(tarea, personas)
  const historial = hechas.filter((h) => h.tarea_id === tarea.id).slice(0, 6)
  const nombre = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? '—'
  const indice = (id: string | null) => Math.max(0, personas.findIndex((p) => p.id === id))
  const vence = tarea.proxima_fecha <= hoy

  const marcar = async (persona: string) => {
    if (await hecha(tarea, persona)) onCerrar()
  }

  const posponer = async () => {
    try {
      await guardar.mutateAsync({ id: tarea.id, proxima_fecha: sumarDias(hoy, 1) })
      avisar(`${tarea.nombre} pasa a mañana`)
      onCerrar()
    } catch (e) {
      avisar(mensajeError(e), 'error')
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={tarea.nombre}
      subtitulo={`${frecuenciaTexto(tarea.cada_dias)} · ${modo.texto}`}
      ancho="sm"
      pie={
        <Boton variante="secundario" icono={PencilSimple} ancho onClick={onEditar}>
          Editar tarea
        </Boton>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4 rounded-[18px] bg-superficie-2/70 p-4">
          <span className="flex size-12 items-center justify-center rounded-[14px] bg-superficie text-primario">
            <IconoTarea nombre={tarea.nombre} size={26} />
          </span>
          <div className="flex flex-col leading-snug">
            <span className={cx('font-semibold', venc.atrasada && 'text-rojo')}>{vence ? (venc.atrasada ? venc.texto : 'Toca hoy') : `Próxima: ${fechaRelativa(tarea.proxima_fecha).toLowerCase()}`}</span>
            <span className="text-sm text-texto-2">
              {r.persona ? `Le toca a ${nombre(r.persona)}` : 'Los dos están fuera'}
              {r.cubre && ` (cubre a ${nombre(tarea.modo === 'fija' ? tarea.asignada_a : tarea.le_toca)})`}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium text-texto-2">{vence ? '¿Quién la hizo?' : 'Hacerla antes'}</span>
          <div className="grid grid-cols-2 gap-2">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={ocupado}
                onClick={() => marcar(p.id)}
                className={cx(
                  'pulsable flex min-h-14 items-center gap-3 rounded-[16px] border px-3 text-left font-medium disabled:opacity-50',
                  p.id === r.persona ? 'border-primario bg-primario-suave text-primario' : 'border-borde-fuerte hover:bg-superficie-2',
                )}
              >
                <Avatar persona={p} indice={indice(p.id)} tamano={32} className="!ring-0" />
                {p.nombre}
              </button>
            ))}
          </div>
          {tarea.modo === 'rotativa' && <p className="text-[13px] text-texto-3">El siguiente turno será de la otra persona.</p>}
        </div>

        {vence && (
          <Boton variante="suave" icono={ArrowRight} onClick={posponer} cargando={guardar.isPending} className="self-start">
            Pasar a mañana
          </Boton>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-texto-2">Últimas veces</h3>
          {historial.length === 0 ? (
            <p className="text-sm text-texto-3">Todavía no se ha marcado.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {historial.map((h) => (
                <li key={h.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                  <span>{fechaRelativa(h.fecha)}</span>
                  <span className="flex items-center gap-2 text-texto-2">
                    <Avatar persona={personas.find((p) => p.id === h.hecha_por)} indice={indice(h.hecha_por)} tamano={24} className="!ring-0" />
                    {nombre(h.hecha_por)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Hoja>
  )
}

// ───────────── Crear / editar tarea ─────────────

export function FormTarea({ tarea, onCerrar }: { tarea?: Tarea; onCerrar: () => void }) {
  const avisar = useAvisar()
  const { personas } = usePersonas()
  const guardar = useGuardarTarea()
  const borrar = useBorrarTarea()
  const hoy = hoyISO()

  const [nombre, setNombre] = useState(tarea?.nombre ?? '')
  const [cada, setCada] = useState(String(tarea?.cada_dias ?? 7))
  // '' = rotan; un id = siempre esa persona
  const [quien, setQuien] = useState(tarea?.modo === 'fija' ? (tarea.asignada_a ?? '') : '')
  const [leToca, setLeToca] = useState(tarea?.le_toca ?? personas[0]?.id ?? '')
  const [proxima, setProxima] = useState(tarea?.proxima_fecha ?? hoy)
  const [activa, setActiva] = useState(tarea?.activa ?? true)
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const n = Number(cada)
  const enviar = async () => {
    if (!nombre.trim()) return setError('Ponle nombre a la tarea')
    if (!n || n < 1 || n > 365) return setError('La frecuencia va de 1 a 365 días')
    if (!proxima) return setError('Elige cuándo toca')
    setError(null)
    try {
      await guardar.mutateAsync({
        id: tarea?.id,
        nombre: nombre.trim(),
        cada_dias: n,
        modo: quien ? 'fija' : 'rotativa',
        asignada_a: quien || null,
        le_toca: quien || leToca || null,
        proxima_fecha: proxima,
        activa,
      })
      avisar(tarea ? 'Tarea guardada' : 'Tarea creada')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e).includes('tareas_nombre_unico') ? 'Ya existe una tarea con ese nombre.' : mensajeError(e))
    }
  }

  const eliminar = async () => {
    if (!tarea) return
    try {
      await borrar.mutateAsync(tarea.id)
      avisar('Tarea eliminada')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={tarea ? 'Editar tarea' : 'Nueva tarea'}
      pie={
        confirmar ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-texto-2">Se borra también su historial.</p>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={() => setConfirmar(false)}>
                Cancelar
              </Boton>
              <Boton variante="peligro" icono={Trash} cargando={borrar.isPending} onClick={eliminar}>
                Eliminar
              </Boton>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            {tarea ? (
              <Boton variante="fantasma" icono={Trash} onClick={() => setConfirmar(true)} className="-ml-3 text-rojo hover:text-rojo">
                Eliminar
              </Boton>
            ) : (
              <span />
            )}
            <Boton onClick={enviar} cargando={guardar.isPending}>
              Guardar
            </Boton>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-6">
        <Campo etiqueta="Nombre">
          {(id) => <Entrada id={id} data-autofoco={!tarea || undefined} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Regar las plantas" />}
        </Campo>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto-2">Cada cuánto</span>
          <div className="flex flex-wrap gap-2">
            {FRECUENCIAS.map((f) => (
              <button
                key={f.valor}
                type="button"
                aria-pressed={n === f.valor}
                onClick={() => setCada(String(f.valor))}
                className={cx(
                  'pulsable h-11 rounded-full border px-4 text-sm font-medium',
                  n === f.valor ? 'border-primario bg-primario-suave text-primario' : 'border-borde-fuerte text-texto-2',
                )}
              >
                {f.texto}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-texto-2">
            o cada
            <input
              inputMode="numeric"
              aria-label="Días"
              className="num h-11 w-20 rounded-[12px] border border-borde-fuerte bg-superficie px-3 text-center text-base text-texto outline-none focus:border-primario"
              value={cada}
              onChange={(e) => setCada(e.target.value.replace(/\D/g, '').slice(0, 3))}
            />
            días
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto-2">Quién la hace</span>
          <Segmentado
            className="w-full"
            valor={quien}
            onChange={setQuien}
            opciones={[{ valor: '', texto: 'Rotan' }, ...personas.map((p) => ({ valor: p.id, texto: `Siempre ${p.nombre}` }))]}
          />
          {!quien && (
            <div className="mt-2 flex flex-col gap-2">
              <span className="text-[13px] text-texto-3">Le toca la próxima vez a</span>
              <Segmentado className="w-full" valor={leToca} onChange={setLeToca} opciones={personas.map((p) => ({ valor: p.id, texto: p.nombre }))} />
            </div>
          )}
        </div>

        <Campo etiqueta="Próxima vez" ayuda={proxima < hoy ? 'Quedará atrasada.' : proxima === hoy ? 'Toca hoy.' : `En ${diasEntre(hoy, proxima)} días.`}>
          {(id) => <Entrada id={id} type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} />}
        </Campo>

        {tarea && <Interruptor activo={activa} onChange={setActiva} etiqueta="Activa" descripcion="Si la pausan, no aparece ni cuenta para la racha." />}

        {error && (
          <p role="alert" className="text-sm text-rojo">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  )
}

// ───────────── Ausencias ─────────────

export function FormAusencia({
  ausencia,
  inicial,
  tareas,
  onCerrar,
}: {
  ausencia?: Ausencia
  inicial?: { desde?: string; persona?: string }
  tareas: Tarea[]
  onCerrar: () => void
}) {
  const avisar = useAvisar()
  const { personas } = usePersonas()
  const guardar = useGuardarAusencia()
  const borrar = useBorrarAusencia()
  const hoy = hoyISO()
  const [persona, setPersona] = useState(ausencia?.persona_id ?? inicial?.persona ?? personas[0]?.id ?? '')
  const [desde, setDesde] = useState(ausencia?.desde ?? inicial?.desde ?? hoy)
  const [hasta, setHasta] = useState(ausencia?.hasta ?? inicial?.desde ?? hoy)
  const [motivo, setMotivo] = useState(ausencia?.motivo ?? '')
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otra = personas.find((p) => p.id !== persona)
  const fijas = tareas.filter((t) => t.activa && t.modo === 'fija' && t.asignada_a === persona).length
  const dias = desde && hasta && hasta >= desde ? diasEntre(desde, hasta) + 1 : 0

  const enviar = async () => {
    if (!persona || !desde || !hasta) return setError('Completa persona y fechas')
    if (hasta < desde) return setError('«Hasta» no puede ser antes de «desde»')
    setError(null)
    try {
      await guardar.mutateAsync({ id: ausencia?.id, persona_id: persona, desde, hasta, motivo: motivo.trim() || null })
      avisar(ausencia ? 'Ausencia guardada' : 'Ausencia agregada')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const eliminar = async () => {
    if (!ausencia) return
    try {
      await borrar.mutateAsync(ausencia.id)
      avisar('Ausencia eliminada')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={ausencia ? 'Editar ausencia' : 'Nueva ausencia'}
      ancho="sm"
      pie={
        confirmar ? (
          <div className="flex items-center justify-end gap-2">
            <Boton variante="secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </Boton>
            <Boton variante="peligro" icono={Trash} cargando={borrar.isPending} onClick={eliminar}>
              Eliminar
            </Boton>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            {ausencia ? (
              <Boton variante="fantasma" icono={Trash} onClick={() => setConfirmar(true)} className="-ml-3 text-rojo hover:text-rojo">
                Eliminar
              </Boton>
            ) : (
              <span />
            )}
            <Boton icono={CalendarPlus} onClick={enviar} cargando={guardar.isPending}>
              Guardar
            </Boton>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto-2">Quién</span>
          <Segmentado className="w-full" valor={persona} onChange={setPersona} opciones={personas.map((p) => ({ valor: p.id, texto: p.nombre }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Desde">
            {(id) => (
              <Entrada
                id={id}
                type="date"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value)
                  if (hasta < e.target.value) setHasta(e.target.value)
                }}
              />
            )}
          </Campo>
          <Campo etiqueta="Hasta">{(id) => <Entrada id={id} type="date" min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} />}</Campo>
        </div>
        <Campo etiqueta="Motivo (opcional)">
          {(id) => <Entrada id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Viaje de trabajo, donde mi mamá…" />}
        </Campo>
        {dias > 0 && otra && (
          <p className="rounded-[16px] bg-primario-suave px-4 py-3 text-sm leading-relaxed text-primario">
            {dias === 1 ? 'Ese día' : `Esos ${dias} días`}, {otra.nombre} cubre las tareas de {personas.find((p) => p.id === persona)?.nombre}
            {fijas ? ` (incluidas sus ${fijas} fijas)` : ''} y su racha queda congelada.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-rojo">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  )
}
