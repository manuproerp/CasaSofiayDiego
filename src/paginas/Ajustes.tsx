import { Check, DeviceTablet, Envelope, Key, Moon, Plus, SignOut, Sun, Trash, Clock } from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Categorias } from '@/componentes/ajustes/Categorias'
import { useIndicePersona } from '@/componentes/gastos/RegistroGasto'
import { DialogoTC } from '@/componentes/TipoCambioRapido'
import { useAvisar } from '@/componentes/ui/avisos'
import { Aviso, Boton, BotonIcono, Campo, Entrada, Esqueleto, Etiqueta, Interruptor, Segmentado, Tarjeta } from '@/componentes/ui/base'
import { Avatar } from '@/componentes/ui/datos'
import { Hoja } from '@/componentes/ui/hoja'
import { PuntosPin, Teclado } from '@/componentes/ui/teclado'
import {
  useAgregarCorreo,
  useConfig,
  useCorreos,
  useEstablecerPin,
  useGuardarConfig,
  useGuardarPerfil,
  usePersonas,
  usePines,
  useQuitarCorreo,
  useTiposCambio,
  useYo,
} from '@/datos/consultas'
import { guardarPrefs, usePrefsDispositivo, type Tema } from '@/lib/dispositivo'
import { dinero, fechaCorta, parsearMonto } from '@/lib/formato'
import { mensajeError, supabase } from '@/lib/supabase'

function Seccion({ id, titulo, descripcion, children }: { id?: string; titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <Tarjeta as="section" className="scroll-mt-28 p-6 md:p-8">
      <div id={id} className="mb-5 flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
        {descripcion && <p className="max-w-[60ch] text-sm leading-relaxed text-texto-2">{descripcion}</p>}
      </div>
      {children}
    </Tarjeta>
  )
}

// ───────────── PIN ─────────────

function DialogoCrearPin({ onCerrar }: { onCerrar: () => void }) {
  const avisar = useAvisar()
  const establecer = useEstablecerPin()
  const [primero, setPrimero] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const tecla = (t: string) => {
    setError(null)
    setPin((p) => (t === 'borrar' ? p.slice(0, -1) : p.length >= 6 ? p : p + t))
  }

  const continuar = async () => {
    if (pin.length < 4) return
    if (!primero) {
      setPrimero(pin)
      setPin('')
      return
    }
    if (pin !== primero) {
      setError('No coinciden. Empieza de nuevo.')
      setPrimero(null)
      setPin('')
      return
    }
    try {
      await establecer.mutateAsync(pin)
      avisar('PIN guardado')
      onCerrar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={primero ? 'Repite el PIN' : 'Crea tu PIN'} subtitulo="De 4 a 6 dígitos. Se usa para aprobar desde la tablet." ancho="sm">
      <div className="flex flex-col gap-5">
        <PuntosPin largo={pin.length} error={!!error} />
        <p className="-mt-3 min-h-5 text-center text-sm text-rojo" role="alert">
          {error}
        </p>
        <Teclado onTecla={tecla} />
        <Boton tamano="lg" ancho disabled={pin.length < 4} cargando={establecer.isPending} onClick={continuar}>
          {primero ? 'Guardar PIN' : 'Siguiente'}
        </Boton>
      </div>
    </Hoja>
  )
}

// ───────────── Secciones ─────────────

function Tu() {
  const avisar = useAvisar()
  const { yo } = useYo()
  const { data: pines } = usePines()
  const guardar = useGuardarPerfil()
  const indice = useIndicePersona()
  const [nombre, setNombre] = useState('')
  const [crearPin, setCrearPin] = useState(false)

  useEffect(() => {
    if (yo) setNombre(yo.nombre)
  }, [yo])

  if (!yo) return <Esqueleto className="h-40" />
  const tienePin = pines?.has(yo.id)

  return (
    <Seccion titulo="Tu cuenta">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar persona={yo} indice={indice(yo.id)} tamano={56} />
          <div className="flex min-w-0 flex-col">
            <span className="text-lg font-semibold tracking-tight">{yo.nombre}</span>
            <span className="truncate text-sm text-texto-2">{yo.email}</span>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Campo etiqueta="Cómo te llamamos">
            {(id) => <Entrada id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} />}
          </Campo>
          <Boton
            variante="secundario"
            disabled={!nombre.trim() || nombre.trim() === yo.nombre}
            cargando={guardar.isPending}
            onClick={async () => {
              await guardar.mutateAsync({ id: yo.id, nombre: nombre.trim() })
              avisar('Nombre actualizado')
            }}
          >
            Guardar
          </Boton>
        </div>
        {yo.rol === 'persona' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-superficie-2/60 p-4">
            <div className="flex items-center gap-3">
              <Key size={22} className="text-v500" />
              <div className="flex flex-col">
                <span className="font-medium">PIN para aprobar</span>
                <span className="text-[13px] text-texto-2">{tienePin ? 'Configurado' : 'Necesario para aprobar desde la tablet'}</span>
              </div>
            </div>
            <Boton tamano="sm" variante={tienePin ? 'secundario' : 'primario'} onClick={() => setCrearPin(true)}>
              {tienePin ? 'Cambiar PIN' : 'Crear PIN'}
            </Boton>
          </div>
        )}
        <Boton variante="fantasma" icono={SignOut} className="-ml-3 self-start" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </Boton>
      </div>
      {crearPin && <DialogoCrearPin onCerrar={() => setCrearPin(false)} />}
    </Seccion>
  )
}

function FilaMesada({ id, nombre, mesada, indice }: { id: string; nombre: string; mesada: number | null; indice: number }) {
  const avisar = useAvisar()
  const guardar = useGuardarPerfil()
  const [txt, setTxt] = useState(mesada ? String(mesada) : '')
  useEffect(() => setTxt(mesada ? String(mesada) : ''), [mesada])
  const valor = txt.trim() ? parsearMonto(txt) : null
  const cambio = (valor ?? null) !== (mesada ?? null)

  return (
    <div className="flex items-center gap-3">
      <Avatar persona={{ nombre }} indice={indice} tamano={40} className="!ring-0" />
      <span className="w-20 font-medium">{nombre}</span>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-texto-3">L</span>
        <Entrada aria-label={`Mesada de ${nombre}`} inputMode="decimal" className="num pl-9" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="0.00" />
      </div>
      <BotonIcono
        icono={Check}
        etiqueta="Guardar"
        disabled={!cambio || (!!txt.trim() && !valor)}
        className={cambio ? 'bg-primario text-sobre-primario hover:bg-primario-hover hover:text-sobre-primario' : ''}
        onClick={async () => {
          try {
            await guardar.mutateAsync({ id, mesada: valor })
            avisar(`Mesada de ${nombre} guardada`)
          } catch (e) {
            avisar(mensajeError(e), 'error')
          }
        }}
      />
    </div>
  )
}

function Mesadas() {
  const { personas, isLoading } = usePersonas()
  return (
    <Seccion id="mesadas" titulo="Mesadas" descripcion="Monto mensual en lempiras para gastos personales. No requieren aprobación.">
      {isLoading ? (
        <Esqueleto className="h-24" />
      ) : (
        <div className="flex flex-col gap-3">
          {personas.map((p, i) => (
            <FilaMesada key={p.id} id={p.id} nombre={p.nombre} mesada={p.mesada} indice={i} />
          ))}
          {personas.length < 2 && (
            <p className="text-[13px] text-texto-3">La otra persona aparecerá aquí cuando cree su cuenta.</p>
          )}
        </div>
      )}
    </Seccion>
  )
}

function Umbral() {
  const avisar = useAvisar()
  const { data: config, isLoading } = useConfig()
  const guardar = useGuardarConfig()
  const [txt, setTxt] = useState('')
  useEffect(() => setTxt(config?.umbral_aprobacion ? String(config.umbral_aprobacion) : ''), [config?.umbral_aprobacion])
  const valor = txt.trim() ? parsearMonto(txt) : null
  const cambio = (valor ?? null) !== (config?.umbral_aprobacion ?? null)

  return (
    <Seccion
      id="umbral"
      titulo="Umbral de aprobación"
      descripcion="Los gastos del hogar desde este monto quedan pendientes hasta que ambos los aprueben. Déjalo vacío para no pedir aprobación."
    >
      {isLoading ? (
        <Esqueleto className="h-12" />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-texto-3">L</span>
              <Entrada aria-label="Umbral en lempiras" inputMode="decimal" className="num pl-9 text-lg font-semibold" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Sin umbral" />
            </div>
            <Boton
              disabled={!cambio || (!!txt.trim() && !valor)}
              cargando={guardar.isPending}
              onClick={async () => {
                try {
                  await guardar.mutateAsync({ umbral_aprobacion: valor })
                  avisar('Umbral guardado')
                } catch (e) {
                  avisar(mensajeError(e), 'error')
                }
              }}
            >
              Guardar
            </Boton>
          </div>
          <p className="text-[13px] text-texto-3">
            {config?.umbral_aprobacion ? `Actual: ${dinero(config.umbral_aprobacion)}. Los gastos en dólares se comparan ya convertidos.` : 'Ahora mismo ningún gasto pide aprobación.'}
          </p>
        </div>
      )}
    </Seccion>
  )
}

function TipoCambio() {
  const { data = [], isLoading } = useTiposCambio()
  const [abierto, setAbierto] = useState(false)
  return (
    <Seccion titulo="Tipo de cambio" descripcion="Lempiras por dólar. Cada gasto en dólares guarda el tipo de cambio de ese día.">
      <div className="flex flex-col gap-4">
        <Boton variante="suave" icono={Plus} onClick={() => setAbierto(true)} className="self-start">
          Registrar el de hoy
        </Boton>
        {isLoading ? (
          <Esqueleto className="h-24" />
        ) : data.length === 0 ? (
          <p className="text-sm text-texto-3">Todavía no hay registros.</p>
        ) : (
          <ul className="divide-y divide-borde text-sm">
            {data.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <span className="text-texto-2">{fechaCorta(t.fecha)}</span>
                <span className="num font-medium">L {t.valor.toFixed(4)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {abierto && <DialogoTC onCerrar={() => setAbierto(false)} />}
    </Seccion>
  )
}

function Dispositivo() {
  const prefs = usePrefsDispositivo()
  return (
    <Seccion titulo="Este dispositivo" descripcion="Estas opciones solo aplican aquí; no cambian el cel de nadie.">
      <div className="flex flex-col gap-6">
        <Interruptor
          activo={prefs.modoTablet}
          onChange={(v) => guardarPrefs({ modoTablet: v })}
          etiqueta="Modo tablet de la casa"
          descripcion="Para la tablet compartida: aprobar siempre pide el PIN de quien aprueba."
        />
        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-medium">Apariencia</span>
          <Segmentado<Tema>
            className="w-full sm:w-auto"
            valor={prefs.tema}
            onChange={(t) => guardarPrefs({ tema: t })}
            opciones={[
              { valor: 'claro', texto: 'Claro', icono: Sun },
              { valor: 'nocturno', texto: 'Nocturno', icono: Clock },
              { valor: 'oscuro', texto: 'Oscuro', icono: Moon },
            ]}
          />
          <span className="text-[13px] text-texto-3">Nocturno: oscuro de 7 p. m. a 6 a. m.</span>
        </div>
      </div>
    </Seccion>
  )
}

function Acceso() {
  const avisar = useAvisar()
  const { data = [], isLoading } = useCorreos()
  const { data: perfiles } = usePersonas()
  const agregar = useAgregarCorreo()
  const quitar = useQuitarCorreo()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const registrados = new Set((perfiles ?? []).map((p) => p.email))

  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <Seccion
      titulo="Acceso"
      descripcion="Solo estos correos pueden crear cuenta. Si quieren una cuenta propia para la tablet, agréguenla como cuenta Casa."
    >
      <div className="flex flex-col gap-5">
        {isLoading ? (
          <Esqueleto className="h-24" />
        ) : (
          <ul className="divide-y divide-borde rounded-[18px] border border-borde">
            {data.map((c) => (
              <li key={c.email} className="flex min-h-14 items-center gap-3 px-4 py-2">
                {c.rol === 'casa' ? <DeviceTablet size={22} className="text-v500" /> : <Envelope size={22} className="text-v500" />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{c.email}</span>
                  <span className="text-[12px] text-texto-3">{c.nombre}</span>
                </span>
                {registrados.has(c.email) ? <Etiqueta tono="verde">Con cuenta</Etiqueta> : <Etiqueta>Sin cuenta</Etiqueta>}
                {c.rol === 'casa' && (
                  <BotonIcono icono={Trash} etiqueta="Quitar" tamano={40} onClick={() => quitar.mutate(c.email)} />
                )}
              </li>
            ))}
          </ul>
        )}
        {!data.some((c) => c.rol === 'casa') && (
          <div className="flex flex-col gap-3">
            <Campo etiqueta="Correo para la cuenta Casa (opcional)" error={error} ayuda="Por ejemplo, el Gmail compartido de la casa.">
              {(id) => <Entrada id={id} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="casa@gmail.com" />}
            </Campo>
            <Boton
              variante="secundario"
              icono={Plus}
              disabled={!valido}
              cargando={agregar.isPending}
              className="self-start"
              onClick={async () => {
                setError(null)
                try {
                  await agregar.mutateAsync({ email, nombre: 'Casa', rol: 'casa' })
                  setEmail('')
                  avisar('Correo agregado')
                } catch (e) {
                  setError(mensajeError(e))
                }
              }}
            >
              Permitir correo
            </Boton>
          </div>
        )}
      </div>
    </Seccion>
  )
}

export function Ajustes() {
  const { hash } = useLocation()
  const { yo } = useYo()

  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => clearTimeout(t)
  }, [hash])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-6">
        {yo?.rol === 'casa' && <Aviso>Estás en la cuenta Casa. Aprobar siempre pide el PIN de Diego o de Sofía.</Aviso>}
        <Tu />
        <Seccion id="categorias" titulo="Categorías" descripcion="Se usan en gastos y presupuesto. El orden aquí es el orden al registrar.">
          <Categorias />
        </Seccion>
        <Acceso />
      </div>
      <div className="flex flex-col gap-6">
        <Mesadas />
        <Umbral />
        <TipoCambio />
        <Dispositivo />
        <p className="px-2 text-[12px] text-texto-3">Casa Sofía y Diego · bloque 1</p>
      </div>
    </div>
  )
}
