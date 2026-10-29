export type Moneda = 'HNL' | 'USD'
export type Rol = 'persona' | 'casa'
export type TipoGasto = 'hogar' | 'mesada'
export type EstadoGasto = 'aprobado' | 'pendiente' | 'rechazado'
export type TipoPresupuesto = 'fijo' | 'variable'
export type TipoFondo = 'anual' | 'meta'
export type EstadoFondo = 'activo' | 'pagado' | 'cancelado'
export type EstadoWishlist = 'pendiente' | 'aprobada' | 'en_meta' | 'comprada' | 'rechazada'
export type Prioridad = 'alta' | 'media' | 'baja'

export interface Perfil {
  id: string
  nombre: string
  email: string
  rol: Rol
  color: string
  mesada: number | null
  creado_en: string
}

export interface Configuracion {
  id: number
  umbral_aprobacion: number | null
  actualizado_en: string
  actualizado_por: string | null
}

export interface TipoCambio {
  id: number
  fecha: string
  valor: number
  registrado_por: string | null
  creado_en: string
}

export interface Categoria {
  id: string
  nombre: string
  icono: string
  orden: number
  activa: boolean
  creado_en: string
}

export interface Gasto {
  id: string
  fecha: string
  monto: number
  moneda: Moneda
  tipo_cambio: number | null
  monto_lempiras: number
  tipo: TipoGasto
  categoria_id: string | null
  persona_id: string
  registrado_por: string | null
  estado: EstadoGasto
  descripcion: string | null
  fondo_id: string | null
  wishlist_id: string | null
  creado_en: string
}

export interface Aprobacion {
  gasto_id: string
  persona_id: string
  decision: 'aprobado' | 'rechazado'
  decidido_en: string
}

export interface ItemPresupuesto {
  id: string
  categoria_id: string
  tipo: TipoPresupuesto
  descripcion: string | null
  monto: number
  moneda: Moneda
  activo: boolean
  creado_en: string
}

export interface CorreoPermitido {
  email: string
  nombre: string
  rol: Rol
}

/** Apartado virtual: anual (vencimiento) o meta */
export interface Fondo {
  id: string
  tipo: TipoFondo
  nombre: string
  categoria_id: string | null
  monto_objetivo: number
  moneda: Moneda
  fecha_objetivo: string | null
  recurrente: boolean
  ciclo: number
  estado: EstadoFondo
  wishlist_id: string | null
  nota: string | null
  creado_por: string | null
  creado_en: string
}

export interface Aporte {
  id: string
  fondo_id: string
  ciclo: number
  fecha: string
  anio: number
  mes: number
  monto: number
  nota: string | null
  registrado_por: string | null
  creado_en: string
}

export interface ItemWishlist {
  id: string
  nombre: string
  nota: string | null
  enlace: string | null
  monto_estimado: number
  moneda: Moneda
  prioridad: Prioridad
  propuesto_por: string
  estado: EstadoWishlist
  fondo_id: string | null
  gasto_id: string | null
  creado_en: string
  decidido_en: string | null
}

export interface AprobacionWishlist {
  item_id: string
  persona_id: string
  decision: 'aprobado' | 'rechazado'
  decidido_en: string
}
