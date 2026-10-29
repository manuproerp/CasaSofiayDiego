import { NavLink } from 'react-router-dom'
import { cx } from '@/componentes/ui/base'

const DINERO = [
  { a: '/gastos', texto: 'Gastos' },
  { a: '/presupuesto', texto: 'Presupuesto' },
  { a: '/wishlist', texto: 'Wishlist' },
  { a: '/metas', texto: 'Metas' },
]

const COCINA = [
  { a: '/menu', texto: 'Menú' },
  { a: '/recetas', texto: 'Recetas' },
  { a: '/super', texto: 'Súper' },
]

/** Pestañas de sección en el celular (en iPad la barra lateral ya las muestra) */
function Tabs({ tabs, etiqueta }: { tabs: { a: string; texto: string }[]; etiqueta: string }) {
  return (
    <nav aria-label={etiqueta} className="-mx-4 -mt-1 overflow-x-auto px-4 md:hidden">
      <div className="flex w-max gap-1.5">
        {tabs.map((t) => (
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

export function TabsDinero() {
  return <Tabs tabs={DINERO} etiqueta="Dinero" />
}

export function TabsCocina() {
  return <Tabs tabs={COCINA} etiqueta="Cocina" />
}
