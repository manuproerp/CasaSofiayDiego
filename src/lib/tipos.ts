export type Moneda = 'HNL' | 'USD'
export type Rol = 'persona' | 'casa'
export type TipoGasto = 'hogar' | 'mesada'
export type EstadoGasto = 'aprobado' | 'pendiente' | 'rechazado'
export type TipoPresupuesto = 'fijo' | 'variable' | 'eventual'

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
  presupuesto_id: string | null
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
  mes: number | null
  anio: number | null
  recurrente: boolean
  activo: boolean
  creado_en: string
}

export interface CorreoPermitido {
  email: string
  nombre: string
  rol: Rol
}
