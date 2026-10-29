import { ArrowLeft, Envelope, Eye, EyeSlash } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { Aviso, Boton, Campo, Entrada } from '@/componentes/ui/base'
import { useSesion } from '@/datos/sesion'
import { mensajeError, supabase } from '@/lib/supabase'

type Modo = 'entrar' | 'crear' | 'olvide'

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-hero p-10 text-sobre-hero md:flex lg:p-14">
        <span className="flex size-12 items-center justify-center rounded-[16px] bg-sobre-hero/10 text-base font-semibold ring-1 ring-sobre-hero/15">
          S<span className="text-sobre-hero-2">&</span>D
        </span>
        <div className="relative z-10 flex max-w-[22ch] flex-col gap-4">
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tighter lg:text-5xl">La casa, en un solo lugar.</h1>
          <p className="text-[15px] leading-relaxed text-sobre-hero-2">
            Gastos, presupuesto y lo que viene: tareas, súper y menú. Para Sofía y Diego.
          </p>
        </div>
        {/* Anillos tonales decorativos */}
        <svg className="pointer-events-none absolute -right-24 -bottom-24 h-[420px] w-[420px] opacity-[0.14]" viewBox="0 0 200 200" aria-hidden>
          {[90, 70, 50, 30].map((r) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="1" />
          ))}
        </svg>
      </div>
      <div className="flex items-center px-5 py-10 md:px-12 lg:px-20">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  )
}

export function Acceso() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [ver, setVer] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState<string | null>(null)

  const cambiar = (m: Modo) => {
    setModo(m)
    setError(null)
    setEnviado(null)
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const correo = email.trim().toLowerCase()
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })
        if (error) throw error
      } else if (modo === 'crear') {
        const { data, error } = await supabase.auth.signUp({
          email: correo,
          password: clave,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) setEnviado(`Te enviamos un correo a ${correo}. Ábrelo para confirmar tu cuenta.`)
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo: window.location.origin })
        if (error) throw error
        setEnviado(`Si ${correo} tiene cuenta, te llegará un enlace para crear una contraseña nueva.`)
      }
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  const titulos: Record<Modo, [string, string]> = {
    entrar: ['Entrar', 'Con tu correo y contraseña.'],
    crear: ['Crear cuenta', 'Solo para los correos de la casa.'],
    olvide: ['Recuperar acceso', 'Te mandamos un enlace a tu correo.'],
  }

  return (
    <Panel>
      <div className="mb-8 flex flex-col gap-2">
        {modo !== 'entrar' && (
          <button onClick={() => cambiar('entrar')} className="-ml-1 mb-2 flex h-10 items-center gap-1.5 self-start text-sm font-medium text-texto-2 hover:text-texto">
            <ArrowLeft size={18} /> Volver
          </button>
        )}
        <span className="mb-3 flex size-11 items-center justify-center rounded-[14px] bg-hero text-sm font-semibold text-sobre-hero md:hidden">
          S&D
        </span>
        <h2 className="text-3xl font-semibold tracking-tighter">{titulos[modo][0]}</h2>
        <p className="text-texto-2">{titulos[modo][1]}</p>
      </div>

      {enviado ? (
        <div className="flex flex-col gap-5">
          <Aviso tono="ok">{enviado}</Aviso>
          <Boton variante="secundario" icono={Envelope} onClick={() => cambiar('entrar')}>
            Ya lo confirmé, entrar
          </Boton>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <Campo etiqueta="Correo">
            {(id) => (
              <Entrada
                id={id}
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
            )}
          </Campo>
          {modo !== 'olvide' && (
            <Campo etiqueta="Contraseña" ayuda={modo === 'crear' ? 'Mínimo 6 caracteres.' : undefined}>
              {(id) => (
                <div className="relative">
                  <Entrada
                    id={id}
                    type={ver ? 'text' : 'password'}
                    autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
                    required
                    minLength={6}
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setVer((v) => !v)}
                    aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute top-0 right-0 flex h-12 w-12 items-center justify-center text-texto-3 hover:text-texto"
                  >
                    {ver ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              )}
            </Campo>
          )}
          {error && (
            <p role="alert" className="text-sm text-rojo">
              {error}
            </p>
          )}
          <Boton type="submit" tamano="lg" ancho cargando={cargando} disabled={!email || (modo !== 'olvide' && clave.length < 6)}>
            {modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Enviar enlace'}
          </Boton>
          {modo === 'entrar' && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button type="button" onClick={() => cambiar('crear')} className="h-10 font-medium text-primario hover:underline">
                Primera vez: crear cuenta
              </button>
              <button type="button" onClick={() => cambiar('olvide')} className="h-10 text-texto-2 hover:text-texto">
                Olvidé mi contraseña
              </button>
            </div>
          )}
        </form>
      )}
    </Panel>
  )
}

export function NuevaContrasena() {
  const { terminarRecuperacion } = useSesion()
  const [clave, setClave] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setCargando(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: clave })
    setCargando(false)
    if (error) setError(mensajeError(error))
    else terminarRecuperacion()
  }

  return (
    <Panel>
      <div className="mb-8 flex flex-col gap-2">
        <h2 className="text-3xl font-semibold tracking-tighter">Contraseña nueva</h2>
        <p className="text-texto-2">Escríbela una vez y listo.</p>
      </div>
      <form onSubmit={enviar} className="flex flex-col gap-5">
        <Campo etiqueta="Contraseña" ayuda="Mínimo 6 caracteres." error={error}>
          {(id) => <Entrada id={id} type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />}
        </Campo>
        <Boton type="submit" tamano="lg" ancho cargando={cargando} disabled={clave.length < 6}>
          Guardar
        </Boton>
      </form>
    </Panel>
  )
}
