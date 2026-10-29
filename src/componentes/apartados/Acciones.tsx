import { Minus, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { useCallback, useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Aviso, Boton, BotonIcono, Campo, cx, Entrada, Segmentado, Selector } from '@/componentes/ui/base'
import { Avatar, Barra, Monto } from '@/componentes/ui/datos'
import { Hoja } from '@/componentes/ui/hoja'
import { Teclado } from '@/componentes/ui/teclado'
import { useAportar, useBorrarAporte, useCategorias, usePagarFondo, usePersonas, useTCActual, useYo } from '@/datos/consultas'
import { useMes } from '@/datos/mes'
import type { EstadoFondo } from '@/lib/calculos'
import { dinero, fechaCorta, hoyISO, nombreMes, parsearMonto, partesHoy } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { Moneda } from '@/lib/tipos'
import { FormFondo } from './FormFondo'

type Accion = { tipo: 'aportar' | 'pagar' | 'detalle' | 'editar'; e: EstadoFondo }

/** Controla los diálogos de un apartado. Devuelve el elemento a renderizar y la función para abrirlos. */
export function useAccionesFondo() {
  const [accion, setAccion] = useState<Accion | null>(null)
  const cerrar = useCallback(() => setAccion(null), [])
  const abrir = useCallback((tipo: Accion['tipo'], e: EstadoFondo) => setAccion({ tipo, e }), [])

  const elemento = accion ? (
    accion.tipo === 'aportar' ? (
      <DialogoAportar e={accion.e} onCerrar={cerrar} />
    ) : accion.tipo === 'pagar' ? (
      <DialogoPagar e={accion.e} onCerrar={cerrar} />
    ) : accion.tipo === 'editar' ? (
      <FormFondo fondo={accion.e.fondo} onCerrar={cerrar} />
    ) : (
      <DetalleFondo e={accion.e} onCerrar={cerrar} onAccion={(t) => setAccion({ tipo: t, e: accion.e })} />
    )
  ) : null

  return { abrir, elemento }
}

// ───────────── Aportar ─────────────

function DialogoAportar({ e, onCerrar }: { e: EstadoFondo; onCerrar: () => void }) {
  const avisar = useAvisar()
  const { anio, mes } = useMes()
  const aportar = useAportar()
  const f = e.fondo
  const sugerido = e.cuotaSugerida != null ? Math.max(0, e.cuotaSugerida - e.aportadoMes) : null
  const [modo, setModo] = useState<'aportar' | 'retirar'>('aportar')
  const [txt, setTxt] = useState(sugerido ? String(Math.round(sugerido)) : '')
  const [error, setError] = useState<string | null>(null)
  const monto = parsearMonto(txt)

  const tecla = useCallback((t: string) => {
    setError(null)
    setTxt((m) => {
      if (t === 'borrar') return m.slice(0, -1)
      if (t === '.') return m.includes('.') ? m : (m || '0') + '.'
      if (m.split('.')[1]?.length >= 2) return m
      return m === '0' ? t : m + t
    })
  }, [])

  const enviar = async () => {
    if (!monto) return
    if (modo === 'retirar' && monto > e.apartado) {
      setError('No puedes retirar más de lo apartado')
      return
    }
    try {
      await aportar.mutateAsync([
        { fondo_id: f.id, monto: modo === 'retirar' ? -monto : monto, anio, mes, nota: modo === 'retirar' ? 'Retiro' : null },
      ])
      avisar(modo === 'retirar' ? 'Retiro registrado' : `Apartado ${dinero(monto, f.moneda)}`)
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={f.nombre}
      subtitulo={`Apartado: ${dinero(e.apartado, f.moneda)} de ${dinero(f.monto_objetivo, f.moneda)}`}
      ancho="sm"
      pie={
        <Boton tamano="lg" ancho disabled={!monto} cargando={aportar.isPending} onClick={enviar}>
          {modo === 'retirar' ? 'Retirar' : 'Apartar'} {monto ? dinero(monto, f.moneda) : ''}
        </Boton>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmentado
          className="w-full"
          valor={modo}
          onChange={setModo}
          opciones={[
            { valor: 'aportar', texto: 'Apartar', icono: Plus },
            { valor: 'retirar', texto: 'Retirar', icono: Minus },
          ]}
        />
        <div className="num flex items-baseline gap-2 rounded-[20px] bg-superficie-2/60 px-5 py-4 text-[40px] leading-none font-semibold tracking-tighter">
          <span className="text-[22px] text-texto-3">{f.moneda === 'USD' ? '$' : 'L'}</span>
          <span className={cx(!txt && 'text-texto-3')}>{txt || '0'}</span>
        </div>
        {sugerido != null && sugerido > 0 && modo === 'aportar' && (
          <button
            type="button"
            onClick={() => setTxt(String(Math.round(sugerido)))}
            className="self-start text-[13px] font-medium text-primario hover:underline"
          >
            Usar la cuota sugerida de {nombreMes(mes, false)}: {dinero(Math.round(sugerido), f.moneda, { corto: true })}
          </button>
        )}
        <Teclado onTecla={tecla} conPunto />
        {error && (
          <p role="alert" className="text-sm text-rojo">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  )
}

// ───────────── Pagar / comprar ─────────────

function DialogoPagar({ e, onCerrar }: { e: EstadoFondo; onCerrar: () => void }) {
  const avisar = useAvisar()
  const { yo } = useYo()
  const { personas } = usePersonas()
  const { data: categorias = [] } = useCategorias()
  const { tc } = useTCActual()
  const pagar = usePagarFondo()
  const f = e.fondo

  const [txt, setTxt] = useState(String(f.monto_objetivo))
  const [moneda, setMoneda] = useState<Moneda>(f.moneda)
  const [tcTxt, setTcTxt] = useState(tc ? String(tc.valor) : '')
  const [persona, setPersona] = useState(yo?.rol === 'persona' ? yo.id : (personas[0]?.id ?? ''))
  const [categoria, setCategoria] = useState(f.categoria_id ?? '')
  const [fecha, setFecha] = useState(hoyISO())
  const [error, setError] = useState<string | null>(null)

  const monto = parsearMonto(txt)
  const tcValor = moneda === 'USD' ? parsearMonto(tcTxt) : null
  const valido = !!monto && !!persona && !!categoria && (moneda === 'HNL' || !!tcValor)
  const esAnualRecurrente = f.tipo === 'anual' && f.recurrente

  const enviar = async () => {
    if (!valido || !monto) return
    setError(null)
    try {
      await pagar.mutateAsync({
        fondo: f.id,
        monto,
        moneda,
        tipo_cambio: tcValor,
        fecha,
        persona,
        categoria: categoria || null,
        descripcion: f.nombre,
      })
      avisar(f.tipo === 'anual' ? 'Pago registrado' : '¡Compra registrada!')
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={f.tipo === 'anual' ? `Pagar ${f.nombre}` : `Comprar ${f.nombre}`}
      subtitulo={`Apartado: ${dinero(e.apartado, f.moneda)}`}
      pie={
        <Boton tamano="lg" ancho disabled={!valido} cargando={pagar.isPending} onClick={enviar}>
          Registrar {f.tipo === 'anual' ? 'pago' : 'compra'}
        </Boton>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Campo etiqueta="Monto pagado">
            {(id) => <Entrada id={id} inputMode="decimal" className="num text-lg font-semibold" value={txt} onChange={(ev) => setTxt(ev.target.value)} />}
          </Campo>
          <Segmentado
            valor={moneda}
            onChange={setMoneda}
            className="mb-0.5"
            opciones={[
              { valor: 'HNL', texto: 'L' },
              { valor: 'USD', texto: 'US$' },
            ]}
          />
        </div>
        {moneda === 'USD' && (
          <Campo etiqueta="Tipo de cambio (L por US$)">
            {(id) => <Entrada id={id} inputMode="decimal" className="num" value={tcTxt} onChange={(ev) => setTcTxt(ev.target.value)} />}
          </Campo>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto-2">Pagó</span>
          <div className="grid grid-cols-2 gap-2">
            {personas.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersona(p.id)}
                className={cx(
                  'pulsable flex h-14 items-center gap-3 rounded-control border-2 px-3 font-medium',
                  persona === p.id ? 'border-primario bg-primario-suave' : 'border-borde',
                )}
              >
                <Avatar persona={p} indice={i} tamano={32} className="!ring-0" />
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Campo etiqueta="Categoría del gasto">
            {(id) => (
              <Selector id={id} value={categoria} onChange={(ev) => setCategoria(ev.target.value)}>
                <option value="">Elegir…</option>
                {categorias
                  .filter((c) => c.activa || c.id === f.categoria_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
              </Selector>
            )}
          </Campo>
          <Campo etiqueta="Fecha">
            {(id) => <Entrada id={id} type="date" value={fecha} max={hoyISO()} onChange={(ev) => setFecha(ev.target.value || hoyISO())} />}
          </Campo>
        </div>
        <Aviso tono="ok">
          Sale del apartado: no cuenta como gasto del mes ni pide aprobación.
          {esAnualRecurrente && ' Después empieza a ahorrarse el del próximo año.'}
        </Aviso>
        {error && (
          <p role="alert" className="text-sm text-rojo">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  )
}

// ───────────── Detalle ─────────────

function DetalleFondo({
  e,
  onCerrar,
  onAccion,
}: {
  e: EstadoFondo
  onCerrar: () => void
  onAccion: (t: 'aportar' | 'pagar' | 'editar') => void
}) {
  const avisar = useAvisar()
  const borrar = useBorrarAporte()
  const f = e.fondo
  const hoy = partesHoy()
  const actuales = e.aportes.filter((a) => a.ciclo === f.ciclo)
  const anteriores = e.aportes.filter((a) => a.ciclo !== f.ciclo)

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={f.nombre}
      subtitulo={f.tipo === 'anual' ? `Gasto anual${f.recurrente ? ' · se repite' : ''}` : 'Meta'}
      izquierda={undefined}
      pie={
        f.estado === 'activo' ? (
          <div className="flex items-center justify-between gap-2">
            <Boton variante="fantasma" icono={PencilSimple} className="-ml-3" onClick={() => onAccion('editar')}>
              Editar
            </Boton>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={() => onAccion('aportar')}>
                Aportar
              </Boton>
              <Boton onClick={() => onAccion('pagar')}>{f.tipo === 'anual' ? 'Pagar' : 'Comprar'}</Boton>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <Monto valor={e.apartado} moneda={f.moneda} className="text-4xl font-semibold tracking-tighter" />
            <span className="num pb-1 text-texto-2">de {dinero(f.monto_objetivo, f.moneda)}</span>
          </div>
          <Barra real={e.apartado} total={f.monto_objetivo} className="h-2.5" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-texto-3">{f.tipo === 'anual' ? 'Vence' : 'Fecha objetivo'}</span>
              <span className="font-medium">{f.fecha_objetivo ? fechaCorta(f.fecha_objetivo) : 'Sin fecha'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-texto-3">Cuota sugerida de {nombreMes(hoy.mes, false)}</span>
              <span className="num font-medium">{e.cuotaSugerida != null ? dinero(e.cuotaSugerida, f.moneda) : '—'}</span>
            </div>
          </div>
          {f.nota && <p className="text-sm text-texto-2">{f.nota}</p>}
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Aportes de este ciclo</h3>
          {actuales.length === 0 ? (
            <p className="text-sm text-texto-3">Todavía no hay aportes.</p>
          ) : (
            <ul className="divide-y divide-borde">
              {actuales.map((a) => (
                <li key={a.id} className="flex min-h-12 items-center gap-3 py-1.5 text-sm">
                  <span className="flex-1">
                    {fechaCorta(a.fecha)}
                    {a.mes !== Number(a.fecha.slice(5, 7)) && <span className="text-texto-3"> · para {nombreMes(a.mes, false)}</span>}
                    {a.nota && <span className="text-texto-3"> · {a.nota}</span>}
                  </span>
                  <Monto valor={a.monto} moneda={f.moneda} className={cx('font-medium', a.monto < 0 && 'text-rojo')} />
                  {f.estado === 'activo' && (
                    <BotonIcono
                      icono={Trash}
                      etiqueta="Borrar aporte"
                      tamano={40}
                      onClick={async () => {
                        try {
                          await borrar.mutateAsync(a.id)
                          avisar('Aporte borrado')
                        } catch (err) {
                          avisar(mensajeError(err), 'error')
                        }
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {anteriores.length > 0 && (
          <p className="text-[13px] text-texto-3">
            Ciclos anteriores: {anteriores.length} aportes por {dinero(anteriores.reduce((s, a) => s + a.monto, 0), f.moneda)}.
          </p>
        )}
      </div>
    </Hoja>
  )
}
