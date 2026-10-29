import { CaretLeft, CaretRight, Copy, Plus, ShoppingCart } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DialogoComida } from '@/componentes/cocina/DialogosMenu'
import { TabsCocina } from '@/componentes/shell/TabsDinero'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, BotonIcono, cx, Esqueleto, ErrorEnLinea, Tarjeta } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { useGenerarSuper, useInsertarMenu, useMenuRango, usePersonas, useRecetas } from '@/datos/consultas'
import { COMIDAS, diaCorto, diasDeSemana, lunesDe, rangoSemana, sumarDias } from '@/lib/cocina'
import { hoyISO } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { Comida, EntradaMenu } from '@/lib/tipos'

function Casilla({
  entradas,
  nombre,
  onAbrir,
  compacta,
}: {
  entradas: EntradaMenu[]
  nombre: (e: EntradaMenu) => { titulo: string; sub: string | null }
  onAbrir: () => void
  compacta?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cx(
        'pulsable group flex w-full flex-col items-start gap-1.5 rounded-[14px] border text-left',
        compacta ? 'min-h-12 px-3 py-2' : 'min-h-[76px] p-3',
        entradas.length ? 'border-borde bg-superficie hover:border-borde-fuerte' : 'border-dashed border-borde-fuerte/70 hover:bg-superficie',
      )}
    >
      {entradas.length === 0 ? (
        <span className="flex items-center gap-1.5 text-[13px] text-texto-3 group-hover:text-texto-2">
          <Plus size={14} /> Agregar
        </span>
      ) : (
        entradas.map((e) => {
          const n = nombre(e)
          return (
            <span key={e.id} className="flex w-full flex-col">
              <span className="line-clamp-2 text-[14px] leading-snug font-medium">{n.titulo}</span>
              {n.sub && <span className="text-[12px] text-texto-3">{n.sub}</span>}
            </span>
          )
        })
      )}
    </button>
  )
}

export function Menu() {
  const avisar = useAvisar()
  const navegar = useNavigate()
  const hoy = hoyISO()
  const [lunes, setLunes] = useState(lunesDe(hoy))
  const dias = diasDeSemana(lunes)
  const domingo = dias[6]
  const menu = useMenuRango(sumarDias(lunes, -7), domingo)
  const { data: recetas = [] } = useRecetas()
  const { personas } = usePersonas()
  const generar = useGenerarSuper()
  const insertar = useInsertarMenu()
  const [casilla, setCasilla] = useState<{ fecha: string; comida: Comida } | null>(null)
  const [confirmarGenerar, setConfirmarGenerar] = useState(false)

  const deSemana = useMemo(() => (menu.data ?? []).filter((e) => e.fecha >= lunes && e.fecha <= domingo), [menu.data, lunes, domingo])
  const semanaAnterior = useMemo(() => (menu.data ?? []).filter((e) => e.fecha < lunes), [menu.data, lunes])
  const de = (fecha: string, comida: Comida) => deSemana.filter((e) => e.fecha === fecha && e.comida === comida)
  const mapaRecetas = useMemo(() => new Map(recetas.map((r) => [r.id, r])), [recetas])

  const nombre = (e: EntradaMenu) => ({
    titulo: e.receta_id ? (mapaRecetas.get(e.receta_id)?.nombre ?? 'Receta borrada') : (e.texto ?? ''),
    sub: [
      e.para_persona ? personas.find((p) => p.id === e.para_persona)?.nombre : null,
      e.porciones_extra ? `+${e.porciones_extra}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || null,
  })

  const copiarAnterior = async () => {
    if (!semanaAnterior.length) return
    try {
      await insertar.mutateAsync(
        semanaAnterior.map((e) => ({
          fecha: sumarDias(e.fecha, 7),
          comida: e.comida,
          receta_id: e.receta_id,
          texto: e.texto,
          para_persona: e.para_persona,
          porciones_extra: e.porciones_extra,
          nota: e.nota,
        })),
      )
      avisar('Copiada la semana anterior')
    } catch (err) {
      avisar(mensajeError(err), 'error')
    }
  }

  const generarLista = async () => {
    try {
      const n = await generar.mutateAsync(lunes)
      setConfirmarGenerar(false)
      avisar(n ? `${n} productos en la lista del súper` : 'No hubo nada nuevo que agregar')
      navegar('/super')
    } catch (err) {
      avisar(mensajeError(err), 'error')
    }
  }

  if (menu.error) return <ErrorEnLinea error={menu.error} reintentar={() => menu.refetch()} />

  const conRecetas = deSemana.some((e) => e.receta_id)
  const entradasCasilla = casilla ? de(casilla.fecha, casilla.comida) : []

  return (
    <div className="flex flex-col gap-5">
      <TabsCocina />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <BotonIcono icono={CaretLeft} etiqueta="Semana anterior" onClick={() => setLunes(sumarDias(lunes, -7))} />
          <button
            type="button"
            onClick={() => setLunes(lunesDe(hoy))}
            className="flex h-12 flex-col items-center justify-center rounded-[12px] px-3 leading-none hover:bg-superficie-2"
          >
            <span className="text-[15px] font-semibold tracking-tight">{rangoSemana(lunes)}</span>
            <span className="mt-1 text-[12px] text-texto-3">{lunes === lunesDe(hoy) ? 'Esta semana' : 'Ir a esta semana'}</span>
          </button>
          <BotonIcono icono={CaretRight} etiqueta="Semana siguiente" onClick={() => setLunes(sumarDias(lunes, 7))} />
        </div>
        <div className="flex flex-wrap gap-2">
          {deSemana.length === 0 && semanaAnterior.length > 0 && (
            <Boton variante="secundario" icono={Copy} cargando={insertar.isPending} onClick={copiarAnterior}>
              Copiar la semana anterior
            </Boton>
          )}
          <Boton icono={ShoppingCart} disabled={!conRecetas} onClick={() => setConfirmarGenerar(true)}>
            Generar lista del súper
          </Boton>
        </div>
      </div>

      {menu.isLoading ? (
        <Esqueleto className="h-[480px] rounded-tarjeta" />
      ) : (
        <>
          {/* iPad y escritorio: filas por día, columnas por comida */}
          <Tarjeta className="hidden overflow-hidden md:block">
            <div className="grid grid-cols-[84px_repeat(4,minmax(0,1fr))] border-b border-borde bg-superficie-2/50">
              <span />
              {COMIDAS.map((c) => (
                <span key={c.valor} className="px-2 py-3 text-[12px] font-semibold tracking-[0.08em] text-texto-3 uppercase">
                  {c.texto}
                </span>
              ))}
            </div>
            {dias.map((d) => {
              const esHoy = d === hoy
              return (
                <div key={d} className={cx('grid grid-cols-[84px_repeat(4,minmax(0,1fr))] gap-2 border-b border-borde px-2 py-2 last:border-b-0', esHoy && 'bg-primario-suave/50')}>
                  <div className="flex flex-col justify-center pl-2">
                    <span className={cx('text-sm font-semibold', esHoy && 'text-primario')}>{diaCorto(d)}</span>
                    <span className="num text-[12px] text-texto-3">{esHoy ? 'Hoy' : Number(d.slice(8))}</span>
                  </div>
                  {COMIDAS.map((c) => (
                    <Casilla key={c.valor} entradas={de(d, c.valor)} nombre={nombre} onAbrir={() => setCasilla({ fecha: d, comida: c.valor })} />
                  ))}
                </div>
              )
            })}
          </Tarjeta>

          {/* Celular: un día por tarjeta */}
          <div className="flex flex-col gap-3 md:hidden">
            {dias.map((d) => {
              const esHoy = d === hoy
              return (
                <Tarjeta key={d} className={cx('flex flex-col gap-2 p-4', esHoy && 'ring-2 ring-primario/30')}>
                  <div className="flex items-baseline justify-between">
                    <span className={cx('font-semibold', esHoy && 'text-primario')}>
                      {diaCorto(d)} {Number(d.slice(8))}
                    </span>
                    {esHoy && <span className="text-[12px] font-medium text-primario">Hoy</span>}
                  </div>
                  {COMIDAS.map((c) => (
                    <div key={c.valor} className="grid grid-cols-[76px_1fr] items-center gap-2">
                      <span className="text-[12px] font-medium text-texto-3">{c.texto}</span>
                      <Casilla compacta entradas={de(d, c.valor)} nombre={nombre} onAbrir={() => setCasilla({ fecha: d, comida: c.valor })} />
                    </div>
                  ))}
                </Tarjeta>
              )
            })}
          </div>
        </>
      )}

      {casilla && <DialogoComida fecha={casilla.fecha} comida={casilla.comida} entradas={entradasCasilla} onCerrar={() => setCasilla(null)} />}
      {confirmarGenerar && (
        <Hoja
          abierta
          onCerrar={() => setConfirmarGenerar(false)}
          titulo="Generar lista del súper"
          subtitulo={`Semana ${rangoSemana(lunes)}`}
          ancho="sm"
          pie={
            <Boton tamano="lg" ancho cargando={generar.isPending} onClick={generarLista}>
              Generar
            </Boton>
          }
        >
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-texto-2">
            <li>Suma los ingredientes de todas las recetas de la semana, con la porción de cada uno.</li>
            <li>Lo que ya estaba generado y no han comprado se reemplaza; lo agregado a mano se queda.</li>
            <li>Sal, especias y spray no se agregan.</li>
          </ul>
        </Hoja>
      )}
    </div>
  )
}
