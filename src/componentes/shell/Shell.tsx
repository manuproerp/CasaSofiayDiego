import { Armchair, BookOpen, CalendarBlank, ChartPieSlice, CookingPot, GearSix, House, ListChecks, ListHeart, Plus, Receipt, ShoppingCart, Suitcase, Target, Tray, Wallet, type Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { usePorAprobar } from '@/componentes/gastos/Aprobaciones'
import { useRegistrarGasto } from '@/componentes/gastos/RegistroGasto'
import { Boton, cx } from '@/componentes/ui/base'
import { Avatar } from '@/componentes/ui/datos'
import { usePersonas, useYo } from '@/datos/consultas'
import { SelectorMes } from './SelectorMes'

interface ItemNav {
  a: string
  texto: string
  icono: Icon
  grupo?: string
  conMes?: boolean
  insignia?: boolean
}

/** Navegación. Casa crece en el bloque 5 (mantenimiento, inventario…). */
const NAV: ItemNav[] = [
  { a: '/', texto: 'Inicio', icono: House, conMes: true },
  { a: '/aprobaciones', texto: 'Por aprobar', icono: Tray, insignia: true },
  { a: '/gastos', texto: 'Gastos', icono: Receipt, grupo: 'Dinero', conMes: true },
  { a: '/presupuesto', texto: 'Presupuesto', icono: ChartPieSlice, grupo: 'Dinero', conMes: true },
  { a: '/wishlist', texto: 'Wishlist', icono: ListHeart, grupo: 'Dinero' },
  { a: '/metas', texto: 'Metas', icono: Target, grupo: 'Dinero', conMes: true },
  { a: '/menu', texto: 'Menú', icono: CalendarBlank, grupo: 'Cocina' },
  { a: '/recetas', texto: 'Recetas', icono: BookOpen, grupo: 'Cocina' },
  { a: '/super', texto: 'Súper', icono: ShoppingCart, grupo: 'Cocina' },
  { a: '/tareas', texto: 'Tareas', icono: ListChecks, grupo: 'Casa' },
  { a: '/ausencias', texto: 'Ausencias', icono: Suitcase, grupo: 'Casa' },
]
const RUTAS_DINERO = ['/gastos', '/presupuesto', '/wishlist', '/metas']
const RUTAS_COCINA = ['/menu', '/recetas', '/super']
const RUTAS_CASA = ['/tareas', '/ausencias']

function Insignia({ n, className }: { n: number; className?: string }) {
  if (!n) return null
  return (
    <span
      className={cx(
        'num inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ambar-barra px-1.5 text-[11px] font-semibold text-white',
        className,
      )}
    >
      {n}
    </span>
  )
}
const AJUSTES: ItemNav = { a: '/ajustes', texto: 'Ajustes', icono: GearSix }

function Marca({ compacta }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-sobre-hero/10 text-[15px] font-semibold tracking-tight text-sobre-hero ring-1 ring-sobre-hero/15">
        S<span className="text-sobre-hero-2">&</span>D
      </span>
      {!compacta && (
        <span className="hidden flex-col leading-tight lg:flex">
          <span className="text-[15px] font-semibold tracking-tight text-sobre-hero">Casa</span>
          <span className="text-[13px] text-sobre-hero-2">Sofía y Diego</span>
        </span>
      )}
    </div>
  )
}

function EnlaceLateral({ item, n = 0 }: { item: ItemNav; n?: number }) {
  return (
    <NavLink
      to={item.a}
      end={item.a === '/'}
      className={({ isActive }) =>
        cx(
          'pulsable group flex min-h-14 flex-col items-center justify-center gap-1 rounded-[16px] px-2 text-[12px] font-medium',
          'lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3.5 lg:text-[15px]',
          isActive ? 'bg-sobre-hero text-hero' : 'text-sobre-hero-2 hover:bg-sobre-hero/10 hover:text-sobre-hero',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <item.icono size={24} weight={isActive ? 'fill' : 'regular'} />
            {item.insignia && <Insignia n={n} className="absolute -top-2 -right-3 lg:hidden" />}
          </span>
          <span className="text-center leading-tight lg:flex-1 lg:text-left">{item.texto}</span>
          {item.insignia && n > 0 && (
            <span className="hidden lg:inline-flex">
              <Insignia n={n} />
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function BarraLateral() {
  const { yo } = useYo()
  const { items: pendientes } = usePorAprobar()
  const { personas } = usePersonas()
  const grupos = [...new Set(NAV.map((n) => n.grupo ?? ''))]
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[96px] shrink-0 flex-col bg-hero px-3 pt-5 pb-4 md:flex lg:w-[248px] lg:px-4">
      <Marca />
      <nav className="-mx-1 mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1 pb-4 [mask-image:linear-gradient(to_bottom,black_calc(100%-20px),transparent)]" aria-label="Principal">
        {grupos.map((g) => (
          <div key={g} className="flex flex-col gap-1">
            {g && (
              <span className="mt-2 hidden px-3.5 pb-0.5 text-[11px] font-semibold tracking-[0.12em] text-sobre-hero-2/70 uppercase lg:block">
                {g}
              </span>
            )}
            {g && <span className="mx-auto my-2 h-px w-8 bg-sobre-hero/15 lg:hidden" aria-hidden />}
            {NAV.filter((n) => (n.grupo ?? '') === g).map((n) => (
              <EnlaceLateral key={n.a} item={n} n={n.insignia ? pendientes.length : 0} />
            ))}
          </div>
        ))}
      </nav>
      <NavLink
        to="/ajustes"
        className={({ isActive }) =>
          cx(
            'pulsable mt-1 flex min-h-14 flex-col items-center justify-center gap-1 rounded-[16px] border-t border-sobre-hero/10 px-2 pt-3 pb-2 text-[12px] font-medium',
            'lg:flex-row lg:justify-start lg:gap-3 lg:px-2.5',
            isActive ? 'bg-sobre-hero text-hero' : 'text-sobre-hero-2 hover:bg-sobre-hero/10 hover:text-sobre-hero',
          )
        }
      >
        {yo ? (
          <Avatar persona={yo} indice={Math.max(0, personas.findIndex((p) => p.id === yo.id))} tamano={34} className="!ring-sobre-hero/20" />
        ) : (
          <GearSix size={24} />
        )}
        <span className="flex min-w-0 flex-col leading-tight lg:flex-1">
          <span className="hidden truncate text-sm font-medium lg:block">{yo?.nombre ?? 'Ajustes'}</span>
          <span className="truncate text-center lg:text-left lg:text-[12px] lg:opacity-80">Ajustes</span>
        </span>
        <GearSix size={20} className="hidden shrink-0 opacity-70 lg:block" />
      </NavLink>
    </aside>
  )
}

function BarraInferior() {
  const registrar = useRegistrarGasto()
  const { pathname } = useLocation()
  const items: ({ a: string; texto: string; icono: Icon; activo: boolean; n?: number } | null)[] = [
    { a: '/', texto: 'Inicio', icono: House, activo: pathname === '/' },
    { a: '/gastos', texto: 'Dinero', icono: Wallet, activo: RUTAS_DINERO.some((r) => pathname.startsWith(r)) },
    null,
    { a: '/menu', texto: 'Cocina', icono: CookingPot, activo: RUTAS_COCINA.some((r) => pathname.startsWith(r)) },
    { a: '/tareas', texto: 'Casa', icono: Armchair, activo: RUTAS_CASA.some((r) => pathname.startsWith(r)) },
  ]
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid h-[68px] grid-cols-5 items-center px-2">
        {items.map((n, i) =>
          n ? (
            <Link
              key={n.a}
              to={n.a}
              aria-current={n.activo ? 'page' : undefined}
              className={cx(
                'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium',
                n.activo ? 'text-primario' : 'text-texto-3',
              )}
            >
              <span className="relative">
                <n.icono size={24} weight={n.activo ? 'fill' : 'regular'} />
                {!!n.n && <Insignia n={n.n} className="absolute -top-1.5 -right-3" />}
              </span>
              {n.texto}
            </Link>
          ) : (
            <div key={i} className="flex justify-center">
              <button
                type="button"
                aria-label="Registrar gasto"
                onClick={() => registrar()}
                className="pulsable -mt-6 flex size-[60px] items-center justify-center rounded-[20px] bg-primario text-sobre-primario shadow-flotante"
              >
                <Plus size={28} weight="bold" />
              </button>
            </div>
          ),
        )}
      </div>
    </nav>
  )
}

/** En el celular, Ajustes se abre desde el avatar del encabezado */
function AvatarAjustes() {
  const { yo } = useYo()
  const { personas } = usePersonas()
  const { pathname } = useLocation()
  return (
    <Link
      to="/ajustes"
      aria-label="Ajustes"
      aria-current={pathname.startsWith('/ajustes') ? 'page' : undefined}
      className="flex size-11 shrink-0 items-center justify-center rounded-full md:hidden"
    >
      {yo ? (
        <Avatar persona={yo} indice={Math.max(0, personas.findIndex((p) => p.id === yo.id))} tamano={34} className="!ring-0" />
      ) : (
        <GearSix size={24} className="text-texto-2" />
      )}
    </Link>
  )
}

/** Campana de aprobaciones para el encabezado del celular */
function CampanaAprobar() {
  const { items } = usePorAprobar()
  return (
    <Link
      to="/aprobaciones"
      aria-label={`Por aprobar${items.length ? `: ${items.length}` : ''}`}
      className="relative flex size-11 items-center justify-center rounded-full text-texto-2 hover:bg-superficie-2 md:hidden"
    >
      <Tray size={24} />
      {items.length > 0 && <Insignia n={items.length} className="absolute top-0.5 right-0" />}
    </Link>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const registrar = useRegistrarGasto()
  const actual = [...NAV, AJUSTES].find((n) => (n.a === '/' ? pathname === '/' : pathname.startsWith(n.a)))

  return (
    <div className="flex min-h-[100dvh]">
      <BarraLateral />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-borde/60 bg-fondo/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-3 px-4 md:h-[76px] md:px-8">
            <div className="flex min-w-0 flex-col leading-tight">
              {actual?.grupo && <span className="text-[12px] font-medium text-texto-3">{actual.grupo}</span>}
              <h1 className="truncate text-xl font-semibold tracking-tight md:text-2xl">{actual?.texto ?? 'Casa'}</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              {actual?.conMes && <SelectorMes className="-mr-2 md:mr-0" />}
              {!actual?.conMes && pathname !== '/aprobaciones' && <CampanaAprobar />}
              {pathname !== '/ajustes' && <AvatarAjustes />}
              <div className="hidden md:block">
                <Boton icono={Plus} onClick={() => registrar()}>
                  Registrar gasto
                </Boton>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-5 pb-[calc(112px+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-12">
          {children}
        </main>
      </div>
      <BarraInferior />
    </div>
  )
}
