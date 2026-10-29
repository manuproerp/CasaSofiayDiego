import { Plus, Trash, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, BotonIcono, Campo, cx, Entrada } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { useBorrarReceta, useGuardarReceta, type IngredienteNuevo } from '@/datos/consultas'
import { adivinarSeccion, COMIDAS, SECCIONES, UNIDADES } from '@/lib/cocina'
import { parsearMonto } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { Comida, Receta } from '@/lib/tipos'

interface FilaIng {
  clave: number
  nombre: string
  cantidad: string
  extra: string
  unidad: string
  seccion: string
  basico: boolean
}

let sig = 0
const filaVacia = (): FilaIng => ({ clave: ++sig, nombre: '', cantidad: '', extra: '', unidad: 'unidad', seccion: 'Otros', basico: false })

const claseMini =
  'h-11 w-full rounded-[12px] border border-borde-fuerte bg-superficie px-3 text-base text-texto outline-none focus:border-primario'

export function FormReceta({ receta, onCerrar }: { receta?: Receta; onCerrar: (id?: string) => void }) {
  const avisar = useAvisar()
  const guardar = useGuardarReceta()
  const borrar = useBorrarReceta()

  const [nombre, setNombre] = useState(receta?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(receta?.descripcion ?? '')
  const [comidas, setComidas] = useState<Comida[]>(receta?.comidas ?? ['almuerzo'])
  const [tiempo, setTiempo] = useState(receta?.tiempo_min ? String(receta.tiempo_min) : '')
  const [etiquetas, setEtiquetas] = useState((receta?.etiquetas ?? []).join(', '))
  const [pasos, setPasos] = useState((receta?.pasos ?? []).join('\n'))
  const [ings, setIngs] = useState<FilaIng[]>(() =>
    receta?.receta_ingredientes.length
      ? receta.receta_ingredientes.map((i) => ({
          clave: ++sig,
          nombre: i.nombre,
          cantidad: i.cantidad != null ? String(i.cantidad) : '',
          extra: i.cantidad_extra ? String(i.cantidad_extra) : '',
          unidad: i.unidad ?? '',
          seccion: i.seccion,
          basico: i.basico,
        }))
      : [filaVacia(), filaVacia()],
  )
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cambiar = (clave: number, cambios: Partial<FilaIng>) =>
    setIngs((l) =>
      l.map((f) => {
        if (f.clave !== clave) return f
        const nueva = { ...f, ...cambios }
        // Si cambia el nombre y la sección no se tocó a mano, la adivinamos
        if (cambios.nombre !== undefined && (f.seccion === 'Otros' || f.seccion === adivinarSeccion(f.nombre))) {
          nueva.seccion = adivinarSeccion(cambios.nombre)
        }
        return nueva
      }),
    )

  const enviar = async () => {
    if (!nombre.trim()) {
      setError('Ponle nombre a la receta')
      return
    }
    setError(null)
    const ingredientes: IngredienteNuevo[] = ings
      .filter((f) => f.nombre.trim())
      .map((f, n) => ({
        orden: n + 1,
        nombre: f.nombre.trim(),
        cantidad: f.cantidad.trim() ? parsearMonto(f.cantidad) : null,
        cantidad_extra: f.extra.trim() ? (parsearMonto(f.extra) ?? 0) : 0,
        unidad: f.unidad || null,
        seccion: f.seccion,
        basico: f.basico,
      }))
    try {
      const id = await guardar.mutateAsync({
        id: receta?.id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        comidas,
        tiempo_min: tiempo ? Number(tiempo) || null : null,
        etiquetas: etiquetas
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
        pasos: pasos
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean),
        ingredientes,
      })
      avisar(receta ? 'Receta guardada' : 'Receta creada')
      onCerrar(id)
    } catch (e) {
      setError(mensajeError(e).includes('recetas_nombre_unico') ? 'Ya existe una receta con ese nombre.' : mensajeError(e))
    }
  }

  const eliminar = async () => {
    if (!receta) return
    try {
      await borrar.mutateAsync(receta.id)
      avisar('Receta eliminada')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja
      abierta
      onCerrar={() => onCerrar()}
      titulo={receta ? 'Editar receta' : 'Nueva receta'}
      ancho="lg"
      pie={
        confirmar ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-texto-2">Se quita también de los menús.</p>
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
            {receta ? (
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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_140px]">
          <Campo etiqueta="Nombre">
            {(id) => <Entrada id={id} data-autofoco value={nombre} onChange={(e) => setNombre(e.target.value)} />}
          </Campo>
          <Campo etiqueta="Minutos">
            {(id) => <Entrada id={id} inputMode="numeric" className="num" value={tiempo} onChange={(e) => setTiempo(e.target.value.replace(/\D/g, ''))} />}
          </Campo>
        </div>
        <Campo etiqueta="Descripción (opcional)">
          {(id) => <Entrada id={id} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />}
        </Campo>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto-2">Sirve para</span>
          <div className="flex flex-wrap gap-2">
            {COMIDAS.map((c) => {
              const on = comidas.includes(c.valor)
              return (
                <button
                  key={c.valor}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setComidas((l) => (on ? l.filter((x) => x !== c.valor) : [...l, c.valor]))}
                  className={cx(
                    'pulsable h-11 rounded-full border px-4 text-sm font-medium',
                    on ? 'border-primario bg-primario-suave text-primario' : 'border-borde-fuerte text-texto-2',
                  )}
                >
                  {c.texto}
                </button>
              )
            })}
          </div>
        </div>
        <Campo etiqueta="Etiquetas (separadas por coma)">
          {(id) => <Entrada id={id} value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="Alta en proteína, Para lonchera" />}
        </Campo>

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">Ingredientes por plato</h3>
            <p className="text-[13px] text-texto-3">
              «Extra» es lo que se suma en la porción alta en proteína. Marca «despensa» para lo que no va a la lista del súper (sal, especias).
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {ings.map((f) => (
              <li key={f.clave} className="grid grid-cols-[1fr_auto] gap-2 rounded-[16px] border border-borde p-3 md:grid-cols-[minmax(0,2fr)_72px_72px_110px_minmax(0,1.3fr)_auto_auto] md:items-center md:border-0 md:p-0">
                <input aria-label="Ingrediente" placeholder="Ingrediente" className={cx(claseMini, 'col-span-1')} value={f.nombre} onChange={(e) => cambiar(f.clave, { nombre: e.target.value })} />
                <BotonIcono icono={X} etiqueta="Quitar ingrediente" tamano={44} className="md:order-last" onClick={() => setIngs((l) => l.filter((x) => x.clave !== f.clave))} />
                <div className="col-span-2 grid grid-cols-3 gap-2 md:contents">
                  <input aria-label="Cantidad" placeholder="Cant." inputMode="decimal" className={cx(claseMini, 'num')} value={f.cantidad} onChange={(e) => cambiar(f.clave, { cantidad: e.target.value })} />
                  <input aria-label="Extra proteína" placeholder="Extra" inputMode="decimal" className={cx(claseMini, 'num')} value={f.extra} onChange={(e) => cambiar(f.clave, { extra: e.target.value })} />
                  <select aria-label="Unidad" className={claseMini} value={f.unidad} onChange={(e) => cambiar(f.clave, { unidad: e.target.value })}>
                    <option value="">al gusto</option>
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <select aria-label="Sección" className={cx(claseMini, 'col-span-2 md:col-span-1')} value={f.seccion} onChange={(e) => cambiar(f.clave, { seccion: e.target.value })}>
                  {SECCIONES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <label className="col-span-2 flex h-11 items-center gap-2 text-sm text-texto-2 md:col-span-1">
                  <input type="checkbox" className="size-5 accent-[var(--primario)]" checked={f.basico} onChange={(e) => cambiar(f.clave, { basico: e.target.checked })} />
                  despensa
                </label>
              </li>
            ))}
          </ul>
          <Boton variante="suave" tamano="sm" icono={Plus} className="self-start" onClick={() => setIngs((l) => [...l, filaVacia()])}>
            Ingrediente
          </Boton>
        </section>

        <Campo etiqueta="Preparación (un paso por línea)">
          {(id) => (
            <textarea
              id={id}
              rows={6}
              value={pasos}
              onChange={(e) => setPasos(e.target.value)}
              className="w-full rounded-control border border-borde-fuerte bg-superficie px-4 py-3 text-base leading-relaxed outline-none focus:border-primario focus:ring-2 focus:ring-primario/15"
            />
          )}
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
