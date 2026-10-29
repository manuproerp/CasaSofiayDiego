import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { CLAVES } from './consultas'

const TABLAS: Record<string, readonly (readonly string[])[]> = {
  gastos: [CLAVES.gastos, CLAVES.aprobaciones],
  aprobaciones: [CLAVES.aprobaciones, CLAVES.gastos],
  presupuesto: [CLAVES.presupuesto],
  categorias: [CLAVES.categorias],
  configuracion: [CLAVES.config],
  tipo_cambio: [CLAVES.tc],
  perfiles: [CLAVES.perfiles],
  fondos: [CLAVES.fondos, CLAVES.wishlist],
  fondos_aportes: [CLAVES.aportes],
  wishlist: [CLAVES.wishlist, CLAVES.wishlistAprobaciones],
  wishlist_aprobaciones: [CLAVES.wishlistAprobaciones, CLAVES.wishlist],
  recetas: [CLAVES.recetas],
  receta_ingredientes: [CLAVES.recetas],
  menu: [CLAVES.menu],
  super_items: [CLAVES.super],
}

/** Mantiene la tablet y los celulares sincronizados sin recargar */
export function useTiempoReal(activo: boolean) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!activo) return
    let canal = supabase.channel('casa')
    for (const tabla of Object.keys(TABLAS)) {
      canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, () => {
        for (const clave of TABLAS[tabla]) qc.invalidateQueries({ queryKey: clave })
      })
    }
    canal.subscribe()

    // Al volver a la app (o al despertar la tablet) refresca todo
    const alVolver = () => {
      if (document.visibilityState === 'visible') qc.invalidateQueries()
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      supabase.removeChannel(canal)
    }
  }, [activo, qc])
}
