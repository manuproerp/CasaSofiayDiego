import { Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Aviso, Boton, Campo, Entrada, Segmentado, Selector } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { useBorrarGasto, useCategorias, useConfig, useGuardarGasto, usePersonas } from '@/datos/consultas'
import { aLempiras, dinero, hoyISO, parsearMonto } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { Gasto, Moneda, TipoGasto } from '@/lib/tipos'

export function EditarGasto({ gasto, onCerrar }: { gasto: Gasto; onCerrar: () => void }) {
  const avisar = useAvisar()
  const { personas } = usePersonas()
  const { data: categorias = [] } = useCategorias()
  const { data: config } = useConfig()
  const guardar = useGuardarGasto()
  const borrar = useBorrarGasto()

  const [tipo, setTipo] = useState<TipoGasto>(gasto.tipo)
  const [montoTxt, setMontoTxt] = useState(String(gasto.monto))
  const [moneda, setMoneda] = useState<Moneda>(gasto.moneda)
  const [tcTxt, setTcTxt] = useState(gasto.tipo_cambio ? String(gasto.tipo_cambio) : '')
  const [categoriaId, setCategoriaId] = useState(gasto.categoria_id ?? '')
  const [personaId, setPersonaId] = useState(gasto.persona_id)
  const [fecha, setFecha] = useState(gasto.fecha)
  const [descripcion, setDescripcion] = useState(gasto.descripcion ?? '')
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monto = parsearMonto(montoTxt)
  const tc = moneda === 'USD' ? parsearMonto(tcTxt) : null
  const montoL = monto ? aLempiras(monto, moneda, tc) : 0
  const umbral = config?.umbral_aprobacion
  const vuelvePendiente =
    tipo === 'hogar' && !!umbral && montoL >= umbral && gasto.estado === 'aprobado' && montoL > gasto.monto_lempiras

  const errMonto = !monto ? 'Escribe un monto mayor a cero' : null
  const errTc = moneda === 'USD' && !tc ? 'Falta el tipo de cambio' : null
  const errCat = tipo === 'hogar' && !categoriaId ? 'Elige una categoría' : null
  const valido = !errMonto && !errTc && !errCat

  const enviar = async () => {
    if (!valido || !monto) return
    setError(null)
    try {
      await guardar.mutateAsync({
        id: gasto.id,
        fecha,
        monto,
        moneda,
        tipo_cambio: tc,
        tipo,
        categoria_id: tipo === 'hogar' ? categoriaId : null,
        persona_id: personaId,
        descripcion: descripcion.trim() || null,
        presupuesto_id: tipo === 'hogar' ? gasto.presupuesto_id : null,
      })
      avisar('Gasto actualizado')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const eliminar = async () => {
    try {
      await borrar.mutateAsync(gasto.id)
      avisar('Gasto eliminado')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo="Editar gasto"
      pie={
        confirmarBorrar ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-texto-2">¿Eliminar este gasto? No se puede deshacer.</p>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={() => setConfirmarBorrar(false)}>
                Cancelar
              </Boton>
              <Boton variante="peligro" icono={Trash} cargando={borrar.isPending} onClick={eliminar}>
                Eliminar
              </Boton>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <Boton variante="fantasma" icono={Trash} onClick={() => setConfirmarBorrar(true)} className="-ml-3 text-rojo hover:text-rojo">
              Eliminar
            </Boton>
            <Boton onClick={enviar} disabled={!valido} cargando={guardar.isPending}>
              Guardar cambios
            </Boton>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <Segmentado
          className="w-full"
          valor={tipo}
          onChange={setTipo}
          opciones={[
            { valor: 'hogar', texto: 'Del hogar' },
            { valor: 'mesada', texto: 'De mesada' },
          ]}
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Campo etiqueta="Monto" error={montoTxt ? errMonto : null}>
            {(id) => (
              <Entrada id={id} inputMode="decimal" className="num text-lg font-semibold" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} />
            )}
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
          <Campo etiqueta="Tipo de cambio (L por US$)" error={errTc} ayuda={monto && tc ? `≈ ${dinero(montoL)}` : undefined}>
            {(id) => <Entrada id={id} inputMode="decimal" className="num" value={tcTxt} onChange={(e) => setTcTxt(e.target.value)} />}
          </Campo>
        )}
        {tipo === 'hogar' && (
          <Campo etiqueta="Categoría" error={errCat}>
            {(id) => (
              <Selector id={id} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">Elegir…</option>
                {categorias
                  .filter((c) => c.activa || c.id === gasto.categoria_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
              </Selector>
            )}
          </Campo>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Campo etiqueta={tipo === 'mesada' ? 'Mesada de' : 'Pagó'}>
            {(id) => (
              <Selector id={id} value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            )}
          </Campo>
          <Campo etiqueta="Fecha">
            {(id) => <Entrada id={id} type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value || gasto.fecha)} />}
          </Campo>
        </div>
        <Campo etiqueta="Nota">
          {(id) => <Entrada id={id} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />}
        </Campo>
        {vuelvePendiente && <Aviso tono="ambar">Con este monto el gasto vuelve a quedar pendiente de aprobación.</Aviso>}
        {error && (
          <p role="alert" className="text-sm text-rojo">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  )
}
