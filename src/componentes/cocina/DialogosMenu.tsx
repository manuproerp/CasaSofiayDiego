import { MagnifyingGlass, Minus, Plus, Trash } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, BotonIcono, Campo, cx, Entrada, Segmentado } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import {
  useBorrarEntradaMenu,
  useGuardarEntradaMenu,
  usePersonas,
  useRecetas,
  useYo,
} from '@/datos/consultas'
import { COMIDAS, diaLargo, NOMBRE_COMIDA, sumarDias } from '@/lib/cocina'
import { hoyISO } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { Comida, EntradaMenu, Receta } from '@/lib/tipos'

/** Opciones comunes: para quién y porciones extra */
function Opciones({
  para,
  setPara,
  extra,
  setExtra,
}: {
  para: string
  setPara: (v: string) => void
  extra: number
  setExtra: (n: number) => void
}) {
  const { personas } = usePersonas()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-texto-2">Para</span>
        <Segmentado
          className="w-full"
          valor={para}
          onChange={setPara}
          opciones={[{ valor: '', texto: 'Los dos' }, ...personas.map((p) => ({ valor: p.id, texto: p.nombre }))]}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-texto-2">Porciones extra</span>
          <span className="text-[12px] text-texto-3">Para guardar, visitas o la lonchera del día siguiente</span>
        </div>
        <div className="flex items-center gap-1">
          <BotonIcono icono={Minus} etiqueta="Menos" tamano={44} disabled={extra <= 0} onClick={() => setExtra(Math.max(0, extra - 1))} className="border border-borde" />
          <span className="num w-8 text-center text-lg font-semibold">{extra}</span>
          <BotonIcono icono={Plus} etiqueta="Más" tamano={44} disabled={extra >= 6} onClick={() => setExtra(Math.min(6, extra + 1))} className="border border-borde" />
        </div>
      </div>
    </div>
  )
}

function ListaRecetas({ comida, onElegir, elegida }: { comida: Comida; onElegir: (r: Receta) => void; elegida?: string }) {
  const { data: recetas = [], isLoading } = useRecetas()
  const [q, setQ] = useState('')
  const [todas, setTodas] = useState(false)
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return recetas
      .filter((r) => (todas || t ? true : r.comidas.includes(comida)))
      .filter((r) => !t || r.nombre.toLowerCase().includes(t))
  }, [recetas, q, todas, comida])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <MagnifyingGlass size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-texto-3" />
        <Entrada aria-label="Buscar receta" placeholder="Buscar receta" className="pl-11" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? (
        <div className="esqueleto h-40" />
      ) : (
        <ul className="flex max-h-[38dvh] flex-col overflow-y-auto rounded-[16px] border border-borde">
          {lista.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onElegir(r)}
                className={cx(
                  'flex min-h-12 w-full items-center justify-between gap-3 border-b border-borde px-4 py-2.5 text-left last:border-b-0',
                  elegida === r.id ? 'bg-primario-suave text-primario' : 'hover:bg-superficie-2/60',
                )}
              >
                <span className="font-medium">{r.nombre}</span>
                {r.tiempo_min && <span className="num shrink-0 text-[13px] text-texto-3">{r.tiempo_min} min</span>}
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-3 text-sm text-texto-3">Nada con ese nombre.</li>}
        </ul>
      )}
      {!q && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="self-start text-[13px] font-medium text-primario hover:underline">
          {todas ? `Solo recetas de ${NOMBRE_COMIDA[comida].toLowerCase()}` : 'Ver todas las recetas'}
        </button>
      )}
    </div>
  )
}

/** Editar una casilla del menú (día + comida) */
export function DialogoComida({
  fecha,
  comida,
  entradas,
  onCerrar,
}: {
  fecha: string
  comida: Comida
  entradas: EntradaMenu[]
  onCerrar: () => void
}) {
  const avisar = useAvisar()
  const { yo } = useYo()
  const { personas } = usePersonas()
  const { data: recetas = [] } = useRecetas()
  const guardar = useGuardarEntradaMenu()
  const borrar = useBorrarEntradaMenu()
  const [modo, setModo] = useState<'receta' | 'texto'>('receta')
  const [receta, setReceta] = useState<Receta | null>(null)
  const [texto, setTexto] = useState('')
  const [para, setPara] = useState(comida === 'lonchera' && yo?.rol === 'persona' ? yo.id : '')
  const [extra, setExtra] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const nombreReceta = (id: string | null) => recetas.find((r) => r.id === id)?.nombre
  const valido = modo === 'receta' ? !!receta : !!texto.trim()

  const enviar = async () => {
    if (!valido) return
    setError(null)
    try {
      await guardar.mutateAsync({
        fecha,
        comida,
        receta_id: modo === 'receta' ? receta!.id : null,
        texto: modo === 'texto' ? texto.trim() : null,
        para_persona: para || null,
        porciones_extra: modo === 'receta' ? extra : 0,
        nota: null,
      })
      avisar('Agregado al menú')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={NOMBRE_COMIDA[comida]}
      subtitulo={diaLargo(fecha)}
      pie={
        <Boton tamano="lg" ancho disabled={!valido} cargando={guardar.isPending} onClick={enviar}>
          Agregar
        </Boton>
      }
    >
      <div className="flex flex-col gap-5">
        {entradas.length > 0 && (
          <ul className="flex flex-col divide-y divide-borde rounded-[16px] bg-superficie-2/60 px-4">
            {entradas.map((e) => (
              <li key={e.id} className="flex min-h-12 items-center gap-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{e.receta_id ? (nombreReceta(e.receta_id) ?? 'Receta borrada') : e.texto}</span>
                  <span className="text-[12px] text-texto-3">
                    {e.para_persona ? `Para ${personas.find((p) => p.id === e.para_persona)?.nombre ?? ''}` : 'Para los dos'}
                    {e.porciones_extra > 0 && ` · +${e.porciones_extra} porción${e.porciones_extra > 1 ? 'es' : ''}`}
                  </span>
                </span>
                <BotonIcono
                  icono={Trash}
                  etiqueta="Quitar"
                  tamano={40}
                  onClick={async () => {
                    try {
                      await borrar.mutateAsync(e.id)
                    } catch (err) {
                      avisar(mensajeError(err), 'error')
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        <Segmentado
          className="w-full"
          valor={modo}
          onChange={setModo}
          opciones={[
            { valor: 'receta', texto: 'Una receta' },
            { valor: 'texto', texto: 'Otra cosa' },
          ]}
        />

        {modo === 'receta' ? (
          <ListaRecetas comida={comida} onElegir={setReceta} elegida={receta?.id} />
        ) : (
          <Campo etiqueta="¿Qué van a comer?" ayuda="No suma nada a la lista del súper.">
            {(id) => <Entrada id={id} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comemos fuera, sobras, baleadas…" />}
          </Campo>
        )}

        <Opciones para={para} setPara={setPara} extra={modo === 'receta' ? extra : 0} setExtra={setExtra} />

        {error && (
          <p role="alert" className="text-sm text-rojo">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  )
}

/** Desde una receta: elegir día y comida */
export function DialogoAgregarReceta({ receta, onCerrar }: { receta: Receta; onCerrar: () => void }) {
  const avisar = useAvisar()
  const guardar = useGuardarEntradaMenu()
  const hoy = hoyISO()
  const dias = Array.from({ length: 10 }, (_, i) => sumarDias(hoy, i))
  const [fecha, setFecha] = useState(hoy)
  const [comida, setComida] = useState<Comida>(receta.comidas[0] ?? 'almuerzo')
  const [para, setPara] = useState('')
  const [extra, setExtra] = useState(0)

  const enviar = async () => {
    try {
      await guardar.mutateAsync({ fecha, comida, receta_id: receta.id, texto: null, para_persona: para || null, porciones_extra: extra, nota: null })
      avisar(`${receta.nombre} → ${NOMBRE_COMIDA[comida].toLowerCase()} del ${diaLargo(fecha).toLowerCase()}`)
      onCerrar()
    } catch (e) {
      avisar(mensajeError(e), 'error')
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo="Agregar al menú"
      subtitulo={receta.nombre}
      pie={
        <Boton tamano="lg" ancho cargando={guardar.isPending} onClick={enviar}>
          Agregar
        </Boton>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto-2">Día</span>
          <div className="-mx-6 overflow-x-auto px-6">
            <div className="flex w-max gap-2">
              {dias.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={fecha === d}
                  onClick={() => setFecha(d)}
                  className={cx(
                    'pulsable flex h-14 min-w-16 flex-col items-center justify-center rounded-[14px] border px-3 text-sm',
                    fecha === d ? 'border-primario bg-primario text-sobre-primario' : 'border-borde text-texto-2',
                  )}
                >
                  <span className="font-semibold">{i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : diaLargo(d).split(' ')[0]}</span>
                  <span className="num text-[12px] opacity-80">{Number(d.slice(8))}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto-2">Comida</span>
          <Segmentado className="w-full" valor={comida} onChange={setComida} opciones={COMIDAS} />
        </div>
        <Opciones para={para} setPara={setPara} extra={extra} setExtra={setExtra} />
      </div>
    </Hoja>
  )
}
