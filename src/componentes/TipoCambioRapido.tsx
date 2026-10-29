import { ArrowsClockwise, CurrencyDollar } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAvisar } from '@/componentes/ui/avisos'
import { Boton, Campo, Entrada, Esqueleto } from '@/componentes/ui/base'
import { Hoja } from '@/componentes/ui/hoja'
import { useGuardarTC, useTCActual } from '@/datos/consultas'
import { fechaRelativa, hoyISO, parsearMonto } from '@/lib/formato'
import { mensajeError } from '@/lib/supabase'

export function DialogoTC({ onCerrar }: { onCerrar: () => void }) {
  const avisar = useAvisar()
  const { tc } = useTCActual()
  const guardar = useGuardarTC()
  const [txt, setTxt] = useState(tc ? String(tc.valor) : '')
  const [error, setError] = useState<string | null>(null)
  const valor = parsearMonto(txt)

  const enviar = async () => {
    if (!valor) return
    try {
      await guardar.mutateAsync({ fecha: hoyISO(), valor })
      avisar('Tipo de cambio actualizado')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo="Tipo de cambio de hoy" ancho="sm">
      <div className="flex flex-col gap-5">
        <Campo etiqueta="Lempiras por 1 US$" ayuda="Se guarda con la fecha de hoy. Cada gasto en dólares guarda el suyo." error={error}>
          {(id) => (
            <Entrada
              id={id}
              data-autofoco
              inputMode="decimal"
              className="num text-lg font-semibold"
              value={txt}
              onChange={(e) => setTxt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="24.70"
            />
          )}
        </Campo>
        <Boton tamano="lg" ancho disabled={!valor} cargando={guardar.isPending} onClick={enviar}>
          Guardar
        </Boton>
      </div>
    </Hoja>
  )
}

/** Tarjetita para Inicio */
export function TipoCambioRapido() {
  const { tc, isLoading } = useTCActual()
  const [abierto, setAbierto] = useState(false)
  const esDeHoy = tc?.fecha === hoyISO()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-primario-suave text-primario">
        <CurrencyDollar size={20} />
      </span>
      <div className="flex min-w-[140px] flex-1 flex-col">
        <span className="text-[13px] whitespace-nowrap text-texto-3">Tipo de cambio</span>
        {isLoading ? (
          <Esqueleto className="mt-1 h-4 w-24" />
        ) : tc ? (
          <span className="num font-semibold tracking-tight whitespace-nowrap">
            L {tc.valor.toFixed(4).replace(/0{1,2}$/, '')}
            <span className="ml-1.5 text-[12px] font-normal text-texto-3">{esDeHoy ? 'hoy' : fechaRelativa(tc.fecha).toLowerCase()}</span>
          </span>
        ) : (
          <span className="text-sm text-ambar">Sin registrar</span>
        )}
      </div>
      {!esDeHoy && (
        <Boton tamano="sm" variante="secundario" icono={ArrowsClockwise} onClick={() => setAbierto(true)}>
          Actualizar
        </Boton>
      )}
      {abierto && <DialogoTC onCerrar={() => setAbierto(false)} />}
    </div>
  )
}
