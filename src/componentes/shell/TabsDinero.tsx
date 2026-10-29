import { NavLink } from 'react-router-dom'
import { cx } from '@/componentes/ui/base'

const TABS = [
  { a: '/gastos', texto: 'Gastos' },
  { a: '/presupuesto', texto: 'Presupuesto' },
  { a: '/wishlist', texto: 'Wishlist' },
  { a: '/metas', texto: 'Metas' },
]

/** Pestañas de Dinero en el celular (en iPad la barra lateral ya las muestra) */
export function TabsDinero() {
  return (
    <nav aria-label="Dinero" className="-mx-4 -mt-1 overflow-x-auto px-4 md:hidden">
      <div className="flex w-max gap-1.5">
        {TABS.map((t) => (
          <NavLink
            key={t.a}
            to={t.a}
            className={({ isActive }) =>
              cx(
                'flex h-10 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap',
                isActive ? 'bg-texto text-fondo' : 'bg-superficie-2 text-texto-2',
              )
            }
          >
            {t.texto}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
