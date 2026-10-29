export type Moneda = 'HNL' | 'USD'
export type Rol = 'persona' | 'casa'
export type TipoGasto = 'hogar' | 'mesada'
export type EstadoGasto = 'aprobado' | 'pendiente' | 'rechazado'
export type TipoPresupuesto = 'fijo' | 'variable'
export type TipoFondo = 'anual' | 'meta'
export type EstadoFondo = 'activo' | 'pagado' | 'cancelado'
export type EstadoWishlist = 'pendiente' | 'aprobada' | 'en_meta' | 'comprada' | 'rechazada'
export type Prioridad = 'alta' | 'media' | 'baja'
export type Porcion = 'estandar' | 'alta_proteina'
export type Comida = 'desayuno' | 'almuerzo' | 'cena' | 'lonchera'

export interface Perfil {
  id: string
  nombre: string
  email: string
  rol: Rol
  color: string
  mesada: number | null
  porcion: Porcion
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

export interface Ingrediente {
  id: string
  receta_id: string
  orden: number
  nombre: string
  cantidad: number | null
  cantidad_extra: number
  unidad: string | null
  seccion: string
  basico: boolean
}

export interface Receta {
  id: string
  nombre: string
  descripcion: string | null
  comidas: Comida[]
  tiempo_min: number | null
  etiquetas: string[]
  pasos: string[]
  creado_por: string | null
  creado_en: string
  actualizado_en: string
  receta_ingredientes: Ingrediente[]
}

export interface EntradaMenu {
  id: string
  fecha: string
  comida: Comida
  receta_id: string | null
  texto: string | null
  para_persona: string | null
  porciones_extra: number
  nota: string | null
  creado_por: string | null
  creado_en: string
}

export interface ItemSuper {
  id: string
  nombre: string
  cantidad: number | null
  unidad: string | null
  seccion: string
  comprado: boolean
  comprado_en: string | null
  comprado_por: string | null
  origen: 'manual' | 'menu'
  semana: string | null
  recetas: string | null
  nota: string | null
  agregado_por: string | null
  creado_en: string
}

export type ModoTarea = 'fija' | 'rotativa'

export interface Tarea {
  id: string
  nombre: string
  cada_dias: number
  modo: ModoTarea
  asignada_a: string | null
  le_toca: string | null
  proxima_fecha: string
  activa: boolean
  orden: number
  creado_por: string | null
  creado_en: string
}

export interface TareaHecha {
  id: string
  tarea_id: string
  fecha: string
  hecha_por: string | null
  registrado_por: string | null
  proxima_anterior: string
  le_tocaba_anterior: string | null
  creado_en: string
}

export interface Ausencia {
  id: string
  persona_id: string
  desde: string
  hasta: string
  motivo: string | null
  creado_por: string | null
  creado_en: string
}

export interface DiaTareas {
  persona_id: string
  fecha: string
  estado: 'cumplido' | 'fallado' | 'congelado'
  pendientes: number
  hechas: number
}
