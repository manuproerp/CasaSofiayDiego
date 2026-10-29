import { ListaAprobaciones } from '@/componentes/gastos/Aprobaciones'
import { Tarjeta } from '@/componentes/ui/base'

export function PorAprobar() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <Tarjeta className="p-6 md:p-8">
        <ListaAprobaciones />
      </Tarjeta>
      <p className="px-2 text-[13px] leading-relaxed text-texto-3">
        Aquí llegan los gastos del hogar y los deseos de la wishlist que pasan del umbral. Quien los registra cuenta como la
        primera aprobación; falta la del otro. En la tablet, cada quien aprueba con su PIN.
      </p>
    </div>
  )
}
