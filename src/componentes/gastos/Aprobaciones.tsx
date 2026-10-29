import { Check, CheckCircle, Clock, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, cx, Esqueleto, ErrorEnLinea } from '@/componentes/ui/base'
import { Monto } from '@/componentes/ui/datos'
import { IconoCategoria } from '@/componentes/ui/iconos'
import {
  useAprobaciones,
  useDecidirGasto,
  useMapaCategorias,
  usePendientes,
  usePersonas,
  usePines,
  useVerificarPin,
  useYo,
} from '@/datos/consultas'
import { usePrefsDispositivo } from '@/lib/dispositivo'
import { fechaRelativa } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { Gasto, Perfil } from '@/lib/tipos'
import { DialogoPin } from './DialogoPin'

type Decision = 'aprobado' | 'rechazado'

interface Pedido {
  gasto: Gasto
  persona: Perfil
  decision: Decision
}

/** Lista de gastos pendientes con botones para aprobar o rechazar */
export function ListaAprobaciones({ limite, compacta }: { limite?: number; compacta?: boolean }) {
  const avisar = useAvisar()
  const prefs = usePrefsDispositivo()
  const { yo } = useYo()
  // La cuenta Casa siempre se comporta como tablet
  const modoTablet = prefs.modoTablet || yo?.rol === 'casa'
  const { personas } = usePersonas()
  const { data: pines } = usePines()
  const { mapa: categorias } = useMapaCategorias()
  const pendientes = usePendientes()
  const lista = (pendientes.data ?? []).slice(0, limite)
  const aprobaciones = useAprobaciones(lista.map((g) => g.id))
  const decidir = useDecidirGasto()
  const verificar = useVerificarPin()
  const [pedido, setPedido] = useState<Pedido | null>(null)

  const indice = (id: string) => Math.max(0, personas.findIndex((p) => p.id === id))

  const ejecutar = async (p: Pedido, pin?: string) => {
    const r = await decidir.mutateAsync({ gasto: p.gasto.id, persona: p.persona.id, decision: p.decision, pin })
    if (r === 'pin_incorrecto') return false
    avisar(
      r === 'aprobado' ? 'Gasto aprobado' : r === 'rechazado' ? 'Gasto rechazado' : `Listo. Falta la otra aprobación`,
    )
    return true
  }

  const pedir = async (p: Pedido) => {
    const esYo = p.persona.id === yo?.id
    // En el cel, cada quien aprueba lo suyo sin PIN. En la tablet siempre se pide.
    if (esYo && !modoTablet) {
      try {
        await ejecutar(p)
      } catch (e) {
        avisar(mensajeError(e), 'error')
      }
      return
    }
    setPedido(p)
  }

  const confirmarPin = async (pin: string) => {
    if (!pedido) return false
    try {
      if (pedido.persona.id === yo?.id) {
        const ok = await verificar.mutateAsync({ persona: pedido.persona.id, pin })
        if (!ok) return false
        await ejecutar(pedido)
      } else {
        const ok = await ejecutar(pedido, pin)
        if (!ok) return false
      }
      setPedido(null)
      return true
    } catch (e) {
      throw new Error(mensajeError(e))
    }
  }

  if (pendientes.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
      </div>
    )
  }
  if (pendientes.error) return <ErrorEnLinea error={pendientes.error} reintentar={() => pendientes.refetch()} />
  if (lista.length === 0) {
    return (
      <div className="flex items-center gap-3 py-2 text-sm text-texto-2">
        <CheckCircle size={22} className="text-v500" weight="fill" />
        Nada pendiente de aprobar.
      </div>
    )
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-borde">
        {lista.map((g) => {
          const deEste = (aprobaciones.data ?? []).filter((a) => a.gasto_id === g.id)
          const cat = g.categoria_id ? categorias.get(g.categoria_id) : undefined
          const quien = personas.find((p) => p.id === g.persona_id)
          return (
            <li key={g.id} className={cx('flex flex-col gap-3', compacta ? 'py-3 first:pt-0 last:pb-0' : 'py-4 first:pt-0 last:pb-0')}>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-ambar-suave text-ambar">
                  <IconoCategoria nombre={cat?.icono} size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium tracking-tight">{g.descripcion || cat?.nombre || 'Gasto'}</span>
                  <span className="text-[13px] text-texto-3">
                    {quien?.nombre} · {fechaRelativa(g.fecha)}
                    {g.descripcion && cat ? ` · ${cat.nombre}` : ''}
                  </span>
                </div>
                <Monto valor={g.monto} moneda={g.moneda} className="font-semibold" />
              </div>

              {(() => {
                const faltan = personas.filter((p) => !deEste.some((a) => a.persona_id === p.id))
                const listos = personas.filter((p) => deEste.some((a) => a.persona_id === p.id && a.decision === 'aprobado'))
                const accionables = faltan.filter((p) => p.id === yo?.id || (modoTablet && pines?.has(p.id)))
                return (
                  <div className="flex flex-col gap-2.5 pl-[52px]">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                      {listos.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1 font-medium text-primario">
                          <Check size={14} weight="bold" /> {p.nombre}
                        </span>
                      ))}
                      {faltan.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1 text-texto-2">
                          <Clock size={14} /> Falta {p.nombre}
                        </span>
                      ))}
                    </p>
                    {accionables.map((p) => {
                      const propio = p.id === yo?.id && !modoTablet
                      return (
                        <div key={p.id} className={cx('flex items-center gap-2', compacta && '-ml-[52px]')}>
                          <Boton
                            tamano="sm"
                            variante="suave"
                            icono={Check}
                            className="flex-1 sm:flex-none"
                            onClick={() => pedir({ gasto: g, persona: p, decision: 'aprobado' })}
                          >
                            {propio ? 'Aprobar' : `Aprueba ${p.nombre}`}
                          </Boton>
                          <Boton
                            tamano="sm"
                            variante="secundario"
                            icono={X}
                            aria-label={`Rechazar como ${p.nombre}`}
                            title="Rechazar"
                            className={compacta ? 'w-10 !px-0' : ''}
                            onClick={() => pedir({ gasto: g, persona: p, decision: 'rechazado' })}
                          >
                            {!compacta && 'Rechazar'}
                          </Boton>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </li>
          )
        })}
      </ul>
      {modoTablet && personas.some((p) => !pines?.has(p.id)) && (
        <p className="mt-3 text-[13px] text-texto-3">
          Para aprobar desde la tablet, cada uno crea su PIN en Ajustes.
        </p>
      )}
      <DialogoPin
        persona={pedido?.persona ?? null}
        indice={pedido ? indice(pedido.persona.id) : 0}
        titulo={pedido?.decision === 'rechazado' ? 'Rechazar gasto' : 'Aprobar gasto'}
        textoAccion={pedido?.decision === 'rechazado' ? 'Rechazar' : 'Aprobar'}
        onConfirmar={confirmarPin}
        onCerrar={() => setPedido(null)}
      />
    </>
  )
}
