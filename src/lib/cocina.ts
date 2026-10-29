import type { Comida } from './tipos'

export const COMIDAS: { valor: Comida; texto: string }[] = [
  { valor: 'desayuno', texto: 'Desayuno' },
  { valor: 'almuerzo', texto: 'Almuerzo' },
  { valor: 'cena', texto: 'Cena' },
  { valor: 'lonchera', texto: 'Lonchera' },
]

export const NOMBRE_COMIDA: Record<Comida, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  cena: 'Cena',
  lonchera: 'Lonchera',
}

/** Orden en que se recorre el súper */
export const SECCIONES = [
  'Frutas y verduras',
  'Carnes y pollo',
  'Lácteos y huevos',
  'Panadería y tortillas',
  'Granos y abarrotes',
  'Especias y condimentos',
  'Congelados',
  'Bebidas',
  'Limpieza',
  'Higiene',
  'Otros',
]

export const UNIDADES = ['unidad', 'g', 'kg', 'lb', 'ml', 'l', 'taza', 'cda', 'cdta', 'diente', 'hoja', 'rama', 'paquete', 'bolsa', 'lata']

const PALABRAS: [RegExp, string][] = [
  [/pollo|pechuga|res|carne|cerdo|lomo|pavo|bistec|chuleta|costilla|jamón|salchicha|chorizo/i, 'Carnes y pollo'],
  [/huevo|clara|leche|queso|yogur|requesón|mantequilla|crema|quesillo/i, 'Lácteos y huevos'],
  [/tortilla|pan |pan$|baleada|tostada/i, 'Panadería y tortillas'],
  [/sal$|pimienta|comino|orégano|canela|achiote|consomé|albahaca|romero|paprika|curry/i, 'Especias y condimentos'],
  [/jabón|detergente|cloro|suavizante|desinfectante|esponja|bolsas de basura|papel toalla|lavaplatos|limpiador/i, 'Limpieza'],
  [/papel higiénico|shampoo|champú|pasta dental|cepillo|desodorante|toallas|jabón de baño|hilo dental/i, 'Higiene'],
  [/agua|jugo|café|té|refresco|soda|gaseosa/i, 'Bebidas'],
  [/congelad|helado|hielo/i, 'Congelados'],
  [/avena|garbanzo|frijol|aceite|vinagre|mostaza|salsa|harina|azúcar|atún|lata|chía|nueces|maní|almendra|granola|pasta|arroz/i, 'Granos y abarrotes'],
  [/tomate|cebolla|chile|lechuga|espinaca|zanahoria|papa|camote|pataste|güisquil|ayote|brócoli|coliflor|pepino|aguacate|limón|naranja|banano|plátano|fresa|manzana|piña|papaya|mango|culantro|ajo|apio|ejote|hongo|repollo|rábano|fruta|verdura/i, 'Frutas y verduras'],
]

/** Adivina la sección del súper por el nombre */
export function adivinarSeccion(nombre: string) {
  const n = ` ${nombre.trim().toLowerCase()} `
  for (const [re, sec] of PALABRAS) if (re.test(n.trim()) || re.test(n)) return sec
  return 'Otros'
}

// ───────────── Fechas de la semana ─────────────

function aISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function desdeISO(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function sumarDias(iso: string, dias: number) {
  const d = desdeISO(iso)
  d.setDate(d.getDate() + dias)
  return aISO(d)
}

/** Lunes de la semana de una fecha */
export function lunesDe(iso: string) {
  const d = desdeISO(iso)
  const dia = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dia)
  return aISO(d)
}

export function diasDeSemana(lunes: string) {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

const fmtDia = new Intl.DateTimeFormat('es-HN', { weekday: 'short' })
const fmtDiaLargo = new Intl.DateTimeFormat('es-HN', { weekday: 'long', day: 'numeric', month: 'short' })
const fmtCorto = new Intl.DateTimeFormat('es-HN', { day: 'numeric', month: 'short' })

export function diaCorto(iso: string) {
  const t = fmtDia.format(desdeISO(iso)).replace('.', '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
export function diaLargo(iso: string) {
  const t = fmtDiaLargo.format(desdeISO(iso)).replace('.', '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
export function rangoSemana(lunes: string) {
  return `${fmtCorto.format(desdeISO(lunes)).replace('.', '')} – ${fmtCorto.format(desdeISO(sumarDias(lunes, 6))).replace('.', '')}`
}

// ───────────── Cantidades ─────────────

const FRACCIONES: [number, string][] = [
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
  [0.33, '⅓'],
  [0.67, '⅔'],
]

function numeroBonito(n: number) {
  const entero = Math.floor(n)
  const resto = Math.round((n - entero) * 100) / 100
  if (resto === 0) return String(entero)
  const f = FRACCIONES.find(([v]) => Math.abs(v - resto) < 0.02)
  if (f) return entero ? `${entero} ${f[1]}` : f[1]
  return String(Math.round(n * 10) / 10)
}

/** "650 g", "1.3 kg", "½ taza", "3", "al gusto" */
export function cantidadBonita(cantidad: number | null | undefined, unidad: string | null | undefined) {
  if (cantidad == null) return unidad ? unidad : 'al gusto'
  let c = cantidad
  let u = unidad ?? ''
  if (u === 'g' && c >= 1000) {
    c = c / 1000
    u = 'kg'
  } else if (u === 'ml' && c >= 1000) {
    c = c / 1000
    u = 'l'
  }
  const n = u === 'g' || u === 'ml' ? String(Math.round(c)) : numeroBonito(c)
  if (!u || u === 'unidad') return n
  const plural = c > 1 && ['taza', 'diente', 'hoja', 'rama', 'paquete', 'bolsa', 'lata'].includes(u) ? `${u}s` : u
  return `${n} ${plural}`
}
