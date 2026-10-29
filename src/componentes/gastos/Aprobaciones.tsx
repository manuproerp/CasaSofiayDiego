import { Check, CheckCircle, Clock, ListHeart, X } from '@phosphor-icons/react'
import { useMemo, useState, type ReactNode } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, cx, Esqueleto, ErrorEnLinea, Etiqueta } from '@/componentes/ui/base'
import { Monto } from '@/componentes/ui/datos'
import { IconoCategoria } from '@/componentes/ui/iconos'
import {
  useAprobaciones,
  useAprobacionesWishlist,
  useDecidirGasto,
  useDecidirWishlist,
  useMapaCategorias,
  usePendientes,
  usePersonas,
  usePines,
  useVerificarPin,
  useWishlist,
  useYo,
} from '@/datos/consultas'
import { usePrefsDispositivo } from '@/lib/dispositivo'
import { fechaRelativa } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'
import type { Moneda, Perfil } from '@/lib/tipos'
import { DialogoPin } from './DialogoPin'

type Decision = 'aprobado' | 'rechazado'

export interface ItemAprobable {
  tipo: 'gasto' | 'wishlist'
  id: string
  titulo: string
  sub: string
  monto: number
  moneda: Moneda
  icono: ReactNode
  creado: string
  decisiones: { persona_id: string; decision: Decision }[]
}

/** Gastos y items de la wishlist que esperan aprobación */
export function usePorAprobar() {
  const { personas } = usePersonas()
  const { mapa: categorias } = useMapaCategorias()
  const gastos = usePendientes()
  const aprobGastos = useAprobaciones((gastos.data ?? []).map((g) => g.id))
  const wishlist = useWishlist()
  const aprobWishlist = useAprobacionesWishlist()

  const items = useMemo<ItemAprobable[]>(() => {
    const nombre = (id: string) => personas.find((p) => p.id === id)?.nombre ?? ''
    const deGastos: ItemAprobable[] = (gastos.data ?? []).map((g) => {
      const cat = g.categoria_id ? categorias.get(g.categoria_id) : undefined
      return {
        tipo: 'gasto',
        id: g.id,
        titulo: g.descripcion || cat?.nombre || 'Gasto',
        sub: [nombre(g.persona_id), fechaRelativa(g.fecha), g.descripcion ? cat?.nombre : null].filter(Boolean).join(' · '),
        monto: g.monto,
        moneda: g.moneda,
        icono: <IconoCategoria nombre={cat?.icono} size={20} />,
        creado: g.creado_en,
        decisiones: (aprobGastos.data ?? []).filter((a) => a.gasto_id === g.id),
      }
    })
    const deWishlist: ItemAprobable[] = (wishlist.data ?? [])
      .filter((w) => w.estado === 'pendiente')
      .map((w) => ({
        tipo: 'wishlist',
        id: w.id,
        titulo: w.nombre,
        sub: `Wishlist · propuso ${nombre(w.propuesto_por)}`,
        monto: w.monto_estimado,
        moneda: w.moneda,
        icono: <ListHeart size={20} />,
        creado: w.creado_en,
        decisiones: (aprobWishlist.data ?? []).filter((a) => a.item_id === w.id),
      }))
    return [...deGastos, ...deWishlist].sort((a, b) => b.creado.localeCompare(a.creado))
  }, [gastos.data, aprobGastos.data, wishlist.data, aprobWishlist.data, categorias, personas])

  return {
    items,
    cargando: gastos.isLoading || wishlist.isLoading,
    error: gastos.error ?? wishlist.error ?? null,
    reintentar: () => {
      gastos.refetch()
      wishlist.refetch()
    },
  }
}

interface Pedido {
  item: ItemAprobable
  persona: Perfil
  decision: Decision
}

/** Lista con botones para aprobar o rechazar */
export function ListaAprobaciones({
  limite,
  compacta,
  solo,
}: {
  limite?: number
  compacta?: boolean
  solo?: ItemAprobable['tipo']
}) {
  const avisar = useAvisar()
  const prefs = usePrefsDispositivo()
  const { yo } = useYo()
  // La cuenta Casa siempre se comporta como tablet
  const modoTablet = prefs.modoTablet || yo?.rol === 'casa'
  const { personas } = usePersonas()
  const { data: pines } = usePines()
  const { items, cargando, error, reintentar } = usePorAprobar()
  const lista = items.filter((i) => !solo || i.tipo === solo).slice(0, limite)
  const decidirGasto = useDecidirGasto()
  const decidirWishlist = useDecidirWishlist()
  const verificar = useVerificarPin()
  const [pedido, setPedido] = useState<Pedido | null>(null)

  const indice = (id: string) => Math.max(0, personas.findIndex((p) => p.id === id))

  const ejecutar = async (p: Pedido, pin?: string) => {
    const r =
      p.item.tipo === 'gasto'
        ? await decidirGasto.mutateAsync({ gasto: p.item.id, persona: p.persona.id, decision: p.decision, pin })
        : await decidirWishlist.mutateAsync({ item: p.item.id, persona: p.persona.id, decision: p.decision, pin })
    if (r === 'pin_incorrecto') return false
    avisar(
      r === 'aprobado' || r === 'aprobada'
        ? 'Aprobado'
        : r === 'rechazado' || r === 'rechazada'
          ? 'Rechazado'
          : 'Listo. Falta la otra aprobación',
    )
    return true
  }

  const pedir = async (p: Pedido) => {
    // En el cel, cada quien aprueba lo suyo sin PIN. En la tablet siempre se pide.
    if (p.persona.id === yo?.id && !modoTablet) {
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
      } else if (!(await ejecutar(pedido, pin))) {
        return false
      }
      setPedido(null)
      return true
    } catch (e) {
      throw new Error(mensajeError(e))
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-3">
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
      </div>
    )
  }
  if (error) return <ErrorEnLinea error={error} reintentar={reintentar} />
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
        {lista.map((it) => {
          const faltan = personas.filter((p) => !it.decisiones.some((a) => a.persona_id === p.id))
          const listos = personas.filter((p) => it.decisiones.some((a) => a.persona_id === p.id && a.decision === 'aprobado'))
          const accionables = faltan.filter((p) => p.id === yo?.id || (modoTablet && pines?.has(p.id)))
          return (
            <li key={`${it.tipo}-${it.id}`} className={cx('flex flex-col gap-3', compacta ? 'py-3 first:pt-0 last:pb-0' : 'py-4 first:pt-0 last:pb-0')}>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-ambar-suave text-ambar">{it.icono}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 truncate font-medium tracking-tight">
                    <span className="truncate">{it.titulo}</span>
                    {it.tipo === 'wishlist' && !compacta && <Etiqueta>Wishlist</Etiqueta>}
                  </span>
                  <span className="truncate text-[13px] text-texto-3">{it.sub}</span>
                </div>
                <Monto valor={it.monto} moneda={it.moneda} className="font-semibold" />
              </div>

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
                        onClick={() => pedir({ item: it, persona: p, decision: 'aprobado' })}
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
                        onClick={() => pedir({ item: it, persona: p, decision: 'rechazado' })}
                      >
                        {!compacta && 'Rechazar'}
                      </Boton>
                    </div>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
      {modoTablet && personas.some((p) => !pines?.has(p.id)) && (
        <p className="mt-3 text-[13px] text-texto-3">Para aprobar desde la tablet, cada uno crea su PIN en Ajustes.</p>
      )}
      <DialogoPin
        persona={pedido?.persona ?? null}
        indice={pedido ? indice(pedido.persona.id) : 0}
        titulo={pedido?.decision === 'rechazado' ? 'Rechazar' : 'Aprobar'}
        textoAccion={pedido?.decision === 'rechazado' ? 'Rechazar' : 'Aprobar'}
        onConfirmar={confirmarPin}
        onCerrar={() => setPedido(null)}
      />
    </>
  )
}
