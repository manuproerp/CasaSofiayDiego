import { CheckCircle, HandCoins, Plus, Target } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAccionesFondo } from '@/componentes/apartados/Acciones'
import { ApartarMes } from '@/componentes/apartados/ApartarMes'
import { FilaFondo } from '@/componentes/apartados/FilaFondo'
import { FormFondo } from '@/componentes/apartados/FormFondo'
import { TabsDinero } from '@/componentes/shell/TabsDinero'
import { Boton, Esqueleto, ErrorEnLinea, Tarjeta, TituloSeccion, Vacio } from '@/componentes/ui/base'
import { Monto } from '@/componentes/ui/datos'
import { useTCActual } from '@/datos/consultas'
import { useMes } from '@/datos/mes'
import { useApartados } from '@/datos/resumen'
import { aLempiras, dinero, fechaCorta } from '@/lib/formato'

export function Metas() {
  const { anio, mes } = useMes()
  const { resumen, todos, cargando, error, reintentar } = useApartados(anio, mes)
  const { tc } = useTCActual()
  const acciones = useAccionesFondo()
  const [nueva, setNueva] = useState(false)
  const [apartar, setApartar] = useState(false)

  if (error) return <ErrorEnLinea error={error} reintentar={reintentar} />

  const metas = (resumen?.fondos ?? [])
    .filter((e) => e.fondo.tipo === 'meta')
    .sort((a, b) => (a.dias ?? 1e9) - (b.dias ?? 1e9))
  const logradas = todos.filter((f) => f.tipo === 'meta' && f.estado === 'pagado')
  const totalApartado = metas.reduce((s, e) => s + aLempiras(e.apartado, e.fondo.moneda, tc?.valor), 0)
  const totalObjetivo = metas.reduce((s, e) => s + aLempiras(e.fondo.monto_objetivo, e.fondo.moneda, tc?.valor), 0)

  return (
    <div className="flex flex-col gap-5">
      <TabsDinero />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <Tarjeta className="flex flex-col px-6 pt-5 pb-3 md:px-8">
          <TituloSeccion
            className="pb-1"
            accion={
              <Boton tamano="sm" variante="suave" icono={Plus} onClick={() => setNueva(true)}>
                Nueva meta
              </Boton>
            }
          >
            Metas activas
          </TituloSeccion>
          {cargando ? (
            <div className="flex flex-col gap-3 py-4">
              <Esqueleto className="h-20" />
              <Esqueleto className="h-20" />
            </div>
          ) : metas.length === 0 ? (
            <Vacio
              icono={Target}
              titulo="Sin metas por ahora"
              texto="Créalas aquí o desde la Wishlist con «Ahorrar para esto». Con fecha, la app sugiere cuánto apartar cada mes."
              accion={
                <Boton icono={Plus} onClick={() => setNueva(true)}>
                  Crear meta
                </Boton>
              }
            />
          ) : (
            <div className="flex flex-col divide-y divide-borde">
              {metas.map((e) => (
                <FilaFondo
                  key={e.fondo.id}
                  e={e}
                  onAbrir={() => acciones.abrir('detalle', e)}
                  onAportar={() => acciones.abrir('aportar', e)}
                  onPagar={() => acciones.abrir('pagar', e)}
                />
              ))}
            </div>
          )}
        </Tarjeta>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-[100px]">
          {metas.length > 0 && (
            <Tarjeta className="flex flex-col gap-4 p-6">
              <div className="flex flex-col">
                <span className="text-[13px] text-texto-3">Apartado en metas</span>
                <Monto valor={totalApartado} decimales={false} className="text-2xl font-semibold" />
                <span className="num text-[13px] text-texto-3">de {dinero(totalObjetivo, 'HNL', { corto: true })}</span>
              </div>
              <Boton icono={HandCoins} onClick={() => setApartar(true)}>
                Apartar cuotas del mes
              </Boton>
            </Tarjeta>
          )}
          {logradas.length > 0 && (
            <Tarjeta className="flex flex-col gap-3 p-6">
              <h2 className="font-semibold tracking-tight">Logradas</h2>
              <ul className="flex flex-col gap-2.5">
                {logradas.map((f) => (
                  <li key={f.id} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle size={18} weight="fill" className="text-v500" />
                    <span className="flex-1 truncate">{f.nombre}</span>
                    <span className="text-[12px] text-texto-3">{fechaCorta(f.creado_en.slice(0, 10))}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </aside>
      </div>

      {nueva && <FormFondo tipo="meta" onCerrar={() => setNueva(false)} />}
      {apartar && resumen && <ApartarMes fondos={resumen.fondos} anio={anio} mes={mes} onCerrar={() => setApartar(false)} />}
      {acciones.elemento}
    </div>
  )
}
