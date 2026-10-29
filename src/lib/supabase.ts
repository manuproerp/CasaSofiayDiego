import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Convierte errores de Supabase/Postgres en mensajes legibles */
export function mensajeError(e: unknown): string {
  const msg =
    typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (msg.includes('Email not confirmed')) return 'Falta confirmar el correo. Revisa tu bandeja de entrada.'
  if (msg.includes('Database error saving new user')) return 'Este correo no tiene acceso a la casa.'
  if (msg.includes('User already registered')) return 'Ese correo ya tiene cuenta. Inicia sesión.'
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (msg.includes('rate limit')) return 'Demasiados intentos. Espera un momento.'
  if (msg.includes('categorias_nombre_unico')) return 'Ya existe una categoría con ese nombre.'
  if (msg.includes('violates foreign key') && msg.includes('categoria')) {
    return 'Esa categoría tiene gastos registrados. Desactívala en lugar de borrarla.'
  }
  if (msg.includes('tipo_cambio_fecha_key')) return 'Ya hay un tipo de cambio para esa fecha.'
  if (msg.includes('Failed to fetch')) return 'Sin conexión. Revisa el internet.'
  return msg
}
