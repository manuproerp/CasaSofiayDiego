import { Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Aviso, Boton, Campo, Entrada, Segmentado } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { useBorrarWishlist, useConfig, useGuardarWishlist, useTCActual } from '@/datos/consultas'
import { aLempiras, dinero, parsearMonto } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { ItemWishlist, Moneda, Prioridad } from '@/lib/tipos'

export function FormWishlist({ item, onCerrar }: { item?: ItemWishlist; onCerrar: () => void }) {
  const avisar = useAvisar()
  const { data: config } = useConfig()
  const { tc } = useTCActual()
  const guardar = useGuardarWishlist()
  const borrar = useBorrarWishlist()

  const [nombre, setNombre] = useState(item?.nombre ?? '')
  const [montoTxt, setMontoTxt] = useState(item ? String(item.monto_estimado) : '')
  const [moneda, setMoneda] = useState<Moneda>(item?.moneda ?? 'HNL')
  const [prioridad, setPrioridad] = useState<Prioridad>(item?.prioridad ?? 'media')
  const [enlace, setEnlace] = useState(item?.enlace ?? '')
  const [nota, setNota] = useState(item?.nota ?? '')
  const [confirmar, setConfirmar] = useState(false)
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monto = parsearMonto(montoTxt)
  const umbral = config?.umbral_aprobacion ?? null
  const montoL = monto ? aLempiras(monto, moneda, tc?.valor) : 0
  const pideAprobacion = !!umbral && (montoL >= umbral || (moneda === 'USD' && !tc))
  const editable = !item || item.estado === 'pendiente' || item.estado === 'aprobada'
  const errores = { nombre: !nombre.trim() ? '¿Qué quieren comprar?' : null, monto: !monto ? 'Un estimado basta' : null }

  const enviar = async () => {
    setTocado(true)
    if (errores.nombre || errores.monto || !monto) return
    setError(null)
    try {
      const r = await guardar.mutateAsync({
        id: item?.id,
        nombre: nombre.trim(),
        monto_estimado: monto,
        moneda,
        prioridad,
        enlace: enlace.trim() || null,
        nota: nota.trim() || null,
      })
      avisar(item ? 'Guardado' : r.estado === 'pendiente' ? 'Agregado · espera la aprobación de ambos' : 'Agregado y aprobado')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const eliminar = async () => {
    if (!item) return
    try {
      await borrar.mutateAsync(item.id)
      avisar('Quitado de la wishlist')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={item ? 'Editar deseo' : 'Algo que queremos'}
      pie={
        confirmar ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-texto-2">¿Quitarlo de la wishlist?</p>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={() => setConfirmar(false)}>
                No
              </Boton>
              <Boton variante="peligro" icono={Trash} cargando={borrar.isPending} onClick={eliminar}>
                Quitar
              </Boton>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            {item ? (
              <Boton variante="fantasma" icono={Trash} onClick={() => setConfirmar(true)} className="-ml-3 text-rojo hover:text-rojo">
                Quitar
              </Boton>
            ) : (
              <span />
            )}
            <Boton onClick={enviar} cargando={guardar.isPending}>
              {item ? 'Guardar' : 'Agregar'}
            </Boton>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <Campo etiqueta="Qué es" error={tocado ? errores.nombre : null}>
          {(id) => <Entrada id={id} data-autofoco value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Sillón, freidora de aire, viaje…" />}
        </Campo>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Campo etiqueta="Precio estimado" error={tocado ? errores.monto : null}>
            {(id) => (
              <Entrada
                id={id}
                inputMode="decimal"
                className="num text-lg font-semibold"
                value={montoTxt}
                disabled={!editable}
                onChange={(e) => setMontoTxt(e.target.value)}
                placeholder="0.00"
              />
            )}
          </Campo>
          <Segmentado
            valor={moneda}
            onChange={(m) => editable && setMoneda(m)}
            className="mb-0.5"
            opciones={[
              { valor: 'HNL', texto: 'L' },
              { valor: 'USD', texto: 'US$' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto-2">Prioridad</span>
          <Segmentado
            className="w-full"
            valor={prioridad}
            onChange={setPrioridad}
            opciones={[
              { valor: 'alta', texto: 'Alta' },
              { valor: 'media', texto: 'Media' },
              { valor: 'baja', texto: 'Baja' },
            ]}
          />
        </div>
        <Campo etiqueta="Enlace (opcional)">
          {(id) => <Entrada id={id} type="url" inputMode="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://" />}
        </Campo>
        <Campo etiqueta="Nota (opcional)">
          {(id) => <Entrada id={id} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Color, medidas, dónde lo vimos…" />}
        </Campo>
        {editable && monto && (
          <Aviso tono={pideAprobacion ? 'ambar' : 'ok'}>
            {pideAprobacion
              ? `Pasa del umbral (${dinero(umbral)}): quedará pendiente hasta que ambos lo aprueben.`
              : 'Está bajo el umbral: queda aprobado directo.'}
          </Aviso>
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
