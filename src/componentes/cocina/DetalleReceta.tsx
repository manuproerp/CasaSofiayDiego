import { CalendarPlus, Clock, PencilSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { Boton, cx, Etiqueta, Segmentado } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { usePersonas } from '@/datos/consultas'
import { cantidadBonita, NOMBRE_COMIDA } from '@/lib/cocina'
import type { Porcion, Receta } from '@/lib/tipos'

export function DetalleReceta({
  receta,
  onCerrar,
  onEditar,
  onAgregarAlMenu,
}: {
  receta: Receta
  onCerrar: () => void
  onEditar: () => void
  onAgregarAlMenu: () => void
}) {
  const { personas } = usePersonas()
  const [vista, setVista] = useState<Porcion | 'ambos'>('ambos')
  const ingredientes = receta.receta_ingredientes

  // Cantidad para la vista elegida: un plato estándar, uno alto en proteína, o lo de toda la casa
  const cantidad = (c: number | null, extra: number) => {
    if (c == null) return null
    if (vista === 'estandar') return c
    if (vista === 'alta_proteina') return c + extra
    return personas.reduce((s, p) => s + c + (p.porcion === 'alta_proteina' ? extra : 0), 0) || c * 2
  }

  const quien = (p: Porcion) =>
    personas
      .filter((x) => x.porcion === p)
      .map((x) => x.nombre)
      .join(' y ')

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={receta.nombre}
      subtitulo={receta.descripcion ?? undefined}
      ancho="lg"
      pie={
        <div className="flex items-center justify-between gap-2">
          <Boton variante="fantasma" icono={PencilSimple} className="-ml-3" onClick={onEditar}>
            Editar
          </Boton>
          <Boton icono={CalendarPlus} onClick={onAgregarAlMenu}>
            Agregar al menú
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          {receta.tiempo_min && (
            <span className="mr-1 flex items-center gap-1.5 text-sm text-texto-2">
              <Clock size={16} /> {receta.tiempo_min} min
            </span>
          )}
          {receta.comidas.map((c) => (
            <Etiqueta key={c}>{NOMBRE_COMIDA[c]}</Etiqueta>
          ))}
          {receta.etiquetas.map((e) => (
            <Etiqueta key={e} tono="verde">
              {e}
            </Etiqueta>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Ingredientes</h3>
              <Segmentado
                className="w-full"
                valor={vista}
                onChange={setVista}
                opciones={[
                  { valor: 'ambos', texto: 'Los dos' },
                  { valor: 'estandar', texto: quien('estandar') || 'Estándar' },
                  { valor: 'alta_proteina', texto: quien('alta_proteina') || '+ Proteína' },
                ]}
              />
              <p className="text-[12px] text-texto-3">
                {vista === 'ambos'
                  ? 'Total para un plato de cada uno.'
                  : vista === 'estandar'
                    ? 'Un plato, porción estándar (baja en grasa).'
                    : 'Un plato con proteína extra.'}
              </p>
            </div>
            <ul className="flex flex-col divide-y divide-borde">
              {ingredientes.map((i) => {
                const c = cantidad(i.cantidad, i.cantidad_extra)
                const tieneExtra = i.cantidad_extra > 0 && vista !== 'estandar'
                return (
                  <li key={i.id} className={cx('flex items-baseline justify-between gap-3 py-2.5 text-[15px]', i.basico && 'text-texto-3')}>
                    <span>{i.nombre}</span>
                    <span className={cx('num shrink-0 text-right', tieneExtra ? 'font-semibold text-primario' : 'text-texto-2')}>
                      {cantidadBonita(c, i.unidad)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Preparación</h3>
            <ol className="flex flex-col gap-4">
              {receta.pasos.map((p, n) => (
                <li key={n} className="flex gap-3">
                  <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-primario-suave text-[13px] font-semibold text-primario">
                    {n + 1}
                  </span>
                  <p className="pt-0.5 text-[15px] leading-relaxed">{p}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </Hoja>
  )
}
