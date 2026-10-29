import { Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, Campo, Entrada, Interruptor, Segmentado, Selector } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { useBorrarFondo, useCategorias, useGuardarFondo } from '@/datos/consultas'
import { hoyISO, parsearMonto } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { Fondo, Moneda, TipoFondo } from '@/lib/tipos'

/** Crear o editar un anual o una meta */
export function FormFondo({ fondo, tipo: tipoInicial = 'anual', onCerrar }: { fondo?: Fondo; tipo?: TipoFondo; onCerrar: () => void }) {
  const avisar = useAvisar()
  const { data: categorias = [] } = useCategorias()
  const guardar = useGuardarFondo()
  const borrar = useBorrarFondo()
  const tipo = fondo?.tipo ?? tipoInicial

  const [nombre, setNombre] = useState(fondo?.nombre ?? '')
  const [categoriaId, setCategoriaId] = useState(fondo?.categoria_id ?? '')
  const [montoTxt, setMontoTxt] = useState(fondo ? String(fondo.monto_objetivo) : '')
  const [moneda, setMoneda] = useState<Moneda>(fondo?.moneda ?? 'HNL')
  const [fecha, setFecha] = useState(fondo?.fecha_objetivo ?? '')
  const [recurrente, setRecurrente] = useState(fondo?.recurrente ?? tipo === 'anual')
  const [nota, setNota] = useState(fondo?.nota ?? '')
  const [confirmar, setConfirmar] = useState(false)
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monto = parsearMonto(montoTxt)
  const errores = {
    nombre: !nombre.trim() ? 'Ponle nombre' : null,
    monto: !monto ? 'Escribe un monto mayor a cero' : null,
    fecha: tipo === 'anual' && !fecha ? 'Elige la fecha de vencimiento' : null,
    categoria: tipo === 'anual' && !categoriaId ? 'Elige la categoría con la que se paga' : null,
  }
  const valido = Object.values(errores).every((x) => !x)

  const enviar = async () => {
    setTocado(true)
    if (!valido || !monto) return
    setError(null)
    try {
      await guardar.mutateAsync({
        id: fondo?.id,
        tipo,
        nombre: nombre.trim(),
        categoria_id: categoriaId || null,
        monto_objetivo: monto,
        moneda,
        fecha_objetivo: fecha || null,
        recurrente: tipo === 'anual' ? recurrente : false,
        nota: nota.trim() || null,
      })
      avisar(fondo ? 'Guardado' : tipo === 'anual' ? 'Gasto anual agregado' : 'Meta creada')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const eliminar = async () => {
    if (!fondo) return
    try {
      await borrar.mutateAsync(fondo.id)
      avisar('Eliminado')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const titulo = fondo ? `Editar ${tipo === 'anual' ? 'gasto anual' : 'meta'}` : tipo === 'anual' ? 'Nuevo gasto anual' : 'Nueva meta'

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={titulo}
      pie={
        confirmar ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-texto-2">Se borran también sus aportes. Los gastos ya pagados se conservan.</p>
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
            {fondo ? (
              <Boton variante="fantasma" icono={Trash} onClick={() => setConfirmar(true)} className="-ml-3 text-rojo hover:text-rojo">
                Eliminar
              </Boton>
            ) : (
              <span />
            )}
            <Boton onClick={enviar} cargando={guardar.isPending}>
              {fondo ? 'Guardar' : 'Agregar'}
            </Boton>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <Campo etiqueta="Nombre" error={tocado ? errores.nombre : null}>
          {(id) => (
            <Entrada
              id={id}
              data-autofoco
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={tipo === 'anual' ? 'Matrícula del carro, Netflix anual…' : 'Viaje a Roatán, sillón…'}
            />
          )}
        </Campo>

        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Campo etiqueta={tipo === 'anual' ? 'Monto a pagar' : 'Monto objetivo'} error={tocado ? errores.monto : null}>
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Campo
            etiqueta={tipo === 'anual' ? 'Vence el' : 'Fecha objetivo (opcional)'}
            error={tocado ? errores.fecha : null}
            ayuda={tipo === 'meta' ? 'Con fecha, la app sugiere cuánto apartar cada mes.' : undefined}
          >
            {(id) => <Entrada id={id} type="date" value={fecha} min={fondo ? undefined : hoyISO()} onChange={(e) => setFecha(e.target.value)} />}
          </Campo>
          <Campo etiqueta={tipo === 'anual' ? 'Categoría' : 'Categoría (opcional)'} error={tocado ? errores.categoria : null}>
            {(id) => (
              <Selector id={id} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">{tipo === 'anual' ? 'Elegir…' : 'Sin categoría'}</option>
                {categorias
                  .filter((c) => c.activa || c.id === fondo?.categoria_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
              </Selector>
            )}
          </Campo>
        </div>

        {tipo === 'anual' && (
          <Interruptor
            activo={recurrente}
            onChange={setRecurrente}
            etiqueta="Se repite cada año"
            descripcion={recurrente ? 'Al pagarlo, empieza a ahorrarse el del año siguiente.' : 'Al pagarlo, se cierra.'}
          />
        )}

        <Campo etiqueta="Nota (opcional)">
          {(id) => <Entrada id={id} value={nota} onChange={(e) => setNota(e.target.value)} />}
        </Campo>

        {error && (
          <p role="alert" className="text-sm text-rojo">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  )
}
