import { Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, Campo, Entrada, Interruptor, Segmentado, Selector } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { useBorrarPresupuesto, useCategorias, useGuardarPresupuesto } from '@/datos/consultas'
import { useMes } from '@/datos/mes'
import { MESES, nombreMes, parsearMonto } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { ItemPresupuesto, Moneda, TipoPresupuesto } from '@/lib/tipos'

const AYUDA_TIPO: Record<TipoPresupuesto, string> = {
  fijo: 'Mismo monto todos los meses: renta, internet, cuota del carro.',
  variable: 'Cambia cada mes, pon un tope: súper, gasolina, salidas.',
  eventual: 'Cae en un mes específico: matrícula, declaración de impuestos.',
}

export function FormPartida({
  partida,
  tipoInicial = 'fijo',
  onCerrar,
}: {
  partida?: ItemPresupuesto
  tipoInicial?: TipoPresupuesto
  onCerrar: () => void
}) {
  const avisar = useAvisar()
  const { anio, mes } = useMes()
  const { data: categorias = [] } = useCategorias()
  const guardar = useGuardarPresupuesto()
  const borrar = useBorrarPresupuesto()

  const [tipo, setTipo] = useState<TipoPresupuesto>(partida?.tipo ?? tipoInicial)
  const [categoriaId, setCategoriaId] = useState(partida?.categoria_id ?? '')
  const [descripcion, setDescripcion] = useState(partida?.descripcion ?? '')
  const [montoTxt, setMontoTxt] = useState(partida ? String(partida.monto) : '')
  const [moneda, setMoneda] = useState<Moneda>(partida?.moneda ?? 'HNL')
  const [mesP, setMesP] = useState(partida?.mes ?? mes)
  const [recurrente, setRecurrente] = useState(partida?.recurrente ?? true)
  const [anioP, setAnioP] = useState(partida?.anio ?? anio)
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tocado, setTocado] = useState(false)

  const monto = parsearMonto(montoTxt)
  const errores = {
    categoria: !categoriaId ? 'Elige una categoría' : null,
    monto: !monto ? 'Escribe un monto mayor a cero' : null,
    descripcion: tipo === 'eventual' && !descripcion.trim() ? 'Ponle nombre (ej. Matrícula)' : null,
  }
  const valido = !errores.categoria && !errores.monto && !errores.descripcion

  const enviar = async () => {
    setTocado(true)
    if (!valido || !monto) return
    setError(null)
    try {
      await guardar.mutateAsync({
        id: partida?.id,
        categoria_id: categoriaId,
        tipo,
        descripcion: descripcion.trim() || null,
        monto,
        moneda,
        mes: tipo === 'eventual' ? mesP : null,
        recurrente: tipo === 'eventual' ? recurrente : false,
        anio: tipo === 'eventual' && !recurrente ? anioP : null,
      })
      avisar(partida ? 'Partida actualizada' : 'Partida agregada')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const eliminar = async () => {
    if (!partida) return
    try {
      await borrar.mutateAsync(partida.id)
      avisar('Partida eliminada')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={partida ? 'Editar partida' : 'Nueva partida'}
      pie={
        confirmar ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-texto-2">Los gastos vinculados se conservan.</p>
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
            {partida ? (
              <Boton variante="fantasma" icono={Trash} onClick={() => setConfirmar(true)} className="-ml-3 text-rojo hover:text-rojo">
                Eliminar
              </Boton>
            ) : (
              <span />
            )}
            <Boton onClick={enviar} cargando={guardar.isPending}>
              {partida ? 'Guardar' : 'Agregar'}
            </Boton>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Segmentado
            className="w-full"
            valor={tipo}
            onChange={setTipo}
            opciones={[
              { valor: 'fijo', texto: 'Fijo' },
              { valor: 'variable', texto: 'Variable' },
              { valor: 'eventual', texto: 'Eventual' },
            ]}
          />
          <p className="text-[13px] text-texto-3">{AYUDA_TIPO[tipo]}</p>
        </div>

        <Campo etiqueta="Categoría" error={tocado ? errores.categoria : null}>
          {(id) => (
            <Selector id={id} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Elegir…</option>
              {categorias
                .filter((c) => c.activa || c.id === partida?.categoria_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </Selector>
          )}
        </Campo>

        <Campo
          etiqueta={tipo === 'eventual' ? 'Nombre' : 'Detalle (opcional)'}
          error={tocado ? errores.descripcion : null}
        >
          {(id) => (
            <Entrada
              id={id}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={tipo === 'eventual' ? 'Matrícula, declaración de impuestos…' : 'Ej. Tigo hogar 100 Mbps'}
            />
          )}
        </Campo>

        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Campo etiqueta={tipo === 'variable' ? 'Tope mensual' : 'Monto'} error={tocado ? errores.monto : null}>
            {(id) => (
              <Entrada id={id} inputMode="decimal" className="num text-lg font-semibold" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} placeholder="0.00" />
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
        {moneda === 'USD' && <p className="-mt-3 text-[13px] text-texto-3">Se convierte a lempiras con el tipo de cambio más reciente.</p>}

        {tipo === 'eventual' && (
          <div className="flex flex-col gap-4 rounded-[18px] bg-superficie-2/60 p-4">
            <Campo etiqueta="Mes">
              {(id) => (
                <Selector id={id} value={mesP} onChange={(e) => setMesP(Number(e.target.value))}>
                  {MESES.map((_, i) => (
                    <option key={i} value={i + 1}>
                      {nombreMes(i + 1)}
                    </option>
                  ))}
                </Selector>
              )}
            </Campo>
            <Interruptor
              activo={recurrente}
              onChange={setRecurrente}
              etiqueta="Se repite cada año"
              descripcion={recurrente ? `Aparecerá todos los ${nombreMes(mesP, false)}.` : 'Solo para un año.'}
            />
            {!recurrente && (
              <Campo etiqueta="Año">
                {(id) => (
                  <Entrada id={id} type="number" inputMode="numeric" className="num" value={anioP} onChange={(e) => setAnioP(Number(e.target.value) || anio)} />
                )}
              </Campo>
            )}
          </div>
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
