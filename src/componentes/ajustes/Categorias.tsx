import { ArrowDown, ArrowUp, Plus, Tag, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, BotonIcono, Campo, cx, Entrada, Esqueleto, Interruptor, Vacio } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { ICONOS_CATEGORIA, IconoCategoria } from '@/componentes/ui/iconos'
import { useBorrarCategoria, useCategorias, useGuardarCategoria } from '@/datos/consultas'
import { mensajeError } from '@/lib/supabase'
import type { Categoria } from '@/lib/tipos'

function FormCategoria({ categoria, siguienteOrden, onCerrar }: { categoria?: Categoria; siguienteOrden: number; onCerrar: () => void }) {
  const avisar = useAvisar()
  const guardar = useGuardarCategoria()
  const borrar = useBorrarCategoria()
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [icono, setIcono] = useState(categoria?.icono ?? 'Tag')
  const [activa, setActiva] = useState(categoria?.activa ?? true)
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async () => {
    if (!nombre.trim()) return
    setError(null)
    try {
      await guardar.mutateAsync({
        id: categoria?.id,
        nombre: nombre.trim(),
        icono,
        activa,
        ...(categoria ? {} : { orden: siguienteOrden }),
      })
      avisar(categoria ? 'Categoría actualizada' : 'Categoría creada')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const eliminar = async () => {
    if (!categoria) return
    try {
      await borrar.mutateAsync(categoria.id)
      avisar('Categoría eliminada')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
      setConfirmar(false)
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={categoria ? 'Editar categoría' : 'Nueva categoría'}
      pie={
        confirmar ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-texto-2">También se borran sus partidas de presupuesto.</p>
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
            {categoria ? (
              <Boton variante="fantasma" icono={Trash} onClick={() => setConfirmar(true)} className="-ml-3 text-rojo hover:text-rojo">
                Eliminar
              </Boton>
            ) : (
              <span />
            )}
            <Boton onClick={enviar} disabled={!nombre.trim()} cargando={guardar.isPending}>
              {categoria ? 'Guardar' : 'Crear'}
            </Boton>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <Campo etiqueta="Nombre" error={error}>
          {(id) => (
            <Entrada
              id={id}
              data-autofoco
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="Súper, Luz, Gasolina…"
            />
          )}
        </Campo>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto-2">Ícono</span>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {Object.keys(ICONOS_CATEGORIA).map((k) => (
              <button
                key={k}
                type="button"
                aria-label={k}
                aria-pressed={icono === k}
                onClick={() => setIcono(k)}
                className={cx(
                  'pulsable flex aspect-square items-center justify-center rounded-[14px] border',
                  icono === k ? 'border-primario bg-primario text-sobre-primario' : 'border-borde text-texto-2 hover:bg-superficie-2',
                )}
              >
                <IconoCategoria nombre={k} size={22} />
              </button>
            ))}
          </div>
        </div>
        {categoria && (
          <Interruptor
            activo={activa}
            onChange={setActiva}
            etiqueta="Activa"
            descripcion="Las inactivas no aparecen al registrar gastos, pero conservan su historial."
          />
        )}
      </div>
    </Hoja>
  )
}

export function Categorias() {
  const { data = [], isLoading } = useCategorias()
  const guardar = useGuardarCategoria()
  const [form, setForm] = useState<{ categoria?: Categoria } | null>(null)

  const mover = async (i: number, d: -1 | 1) => {
    if (!data[i] || !data[i + d]) return
    const nueva = [...data]
    ;[nueva[i], nueva[i + d]] = [nueva[i + d], nueva[i]]
    // Reescribe el orden completo (0, 1, 2…) solo donde cambió
    await Promise.all(
      nueva.map((c, idx) => (c.orden !== idx ? guardar.mutateAsync({ id: c.id, orden: idx }) : null)),
    )
  }

  const siguiente = data.length ? Math.max(...data.map((c) => c.orden)) + 1 : 0

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Esqueleto className="h-12" />
          <Esqueleto className="h-12" />
        </div>
      ) : data.length === 0 ? (
        <Vacio
          compacto
          icono={Tag}
          titulo="Sin categorías"
          texto="Crea las que usan en la casa. Se pueden renombrar, reordenar o desactivar cuando quieran."
        />
      ) : (
        <ul className="divide-y divide-borde rounded-[18px] border border-borde">
          {data.map((c, i) => (
            <li key={c.id} className={cx('flex items-center gap-1 pr-2', !c.activa && 'opacity-55')}>
              <button onClick={() => setForm({ categoria: c })} className="pulsable flex min-h-14 flex-1 items-center gap-3 px-4 text-left hover:bg-superficie-2/50">
                <IconoCategoria nombre={c.icono} size={22} className="text-v500" />
                <span className="flex-1 font-medium">{c.nombre}</span>
                {!c.activa && <span className="text-[12px] text-texto-3">Inactiva</span>}
              </button>
              <BotonIcono icono={ArrowUp} etiqueta="Subir" tamano={40} disabled={i === 0 || guardar.isPending} onClick={() => mover(i, -1)} />
              <BotonIcono icono={ArrowDown} etiqueta="Bajar" tamano={40} disabled={i === data.length - 1 || guardar.isPending} onClick={() => mover(i, 1)} />
            </li>
          ))}
        </ul>
      )}
      <Boton variante="suave" icono={Plus} onClick={() => setForm({})} className="self-start">
        Nueva categoría
      </Boton>
      {form && <FormCategoria categoria={form.categoria} siguienteOrden={siguiente} onCerrar={() => setForm(null)} />}
    </div>
  )
}
