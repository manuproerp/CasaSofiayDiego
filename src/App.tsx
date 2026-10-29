import { Compass } from '@phosphor-icons/react'
import { Link, Route, Routes } from 'react-router-dom'
import { ProveedorRegistroGasto } from '@/componentes/gastos/RegistroGasto'
import { Shell } from '@/componentes/shell/Shell'
import { Boton, ErrorEnLinea, Vacio } from '@/componentes/ui/base'
import { useYo } from '@/datos/consultas'
import { ProveedorMes } from '@/datos/mes'
import { useSesion } from '@/datos/sesion'
import { useTiempoReal } from '@/datos/tiempoReal'
import { supabase } from '@/lib/supabase'
import { Acceso, NuevaContrasena } from '@/paginas/Acceso'
import { Ajustes } from '@/paginas/Ajustes'
import { Ausencias } from '@/paginas/Ausencias'
import { Gastos } from '@/paginas/Gastos'
import { Inicio } from '@/paginas/Inicio'
import { Menu } from '@/paginas/Menu'
import { Metas } from '@/paginas/Metas'
import { PorAprobar } from '@/paginas/PorAprobar'
import { Presupuesto } from '@/paginas/Presupuesto'
import { Recetas } from '@/paginas/Recetas'
import { Super } from '@/paginas/Super'
import { Tareas } from '@/paginas/Tareas'
import { Wishlist } from '@/paginas/Wishlist'

function Pantalla({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[100dvh] items-center px-6 md:px-16">{children}</div>
}

function Cargando() {
  return (
    <Pantalla>
      <div className="flex items-center gap-3 text-texto-2">
        <span className="flex size-11 items-center justify-center rounded-[14px] bg-hero text-sm font-semibold text-sobre-hero">S&D</span>
        <span className="size-4 animate-spin rounded-full border-2 border-primario border-r-transparent" />
      </div>
    </Pantalla>
  )
}

function AppConSesion() {
  const { yo, isLoading, error, refetch } = useYo()
  useTiempoReal(!!yo)

  if (isLoading) return <Cargando />
  if (error) {
    return (
      <Pantalla>
        <div className="w-full max-w-md">
          <ErrorEnLinea error={error} reintentar={() => refetch()} />
        </div>
      </Pantalla>
    )
  }
  if (!yo) {
    return (
      <Pantalla>
        <Vacio
          icono={Compass}
          titulo="Tu cuenta no está vinculada a la casa"
          texto="Inicia sesión con el correo que tiene acceso."
          accion={
            <Boton variante="secundario" onClick={() => supabase.auth.signOut()}>
              Cerrar sesión
            </Boton>
          }
        />
      </Pantalla>
    )
  }

  return (
    <ProveedorMes>
      <ProveedorRegistroGasto>
        <Shell>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/presupuesto" element={<Presupuesto />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/metas" element={<Metas />} />
            <Route path="/aprobaciones" element={<PorAprobar />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/recetas" element={<Recetas />} />
            <Route path="/super" element={<Super />} />
            <Route path="/tareas" element={<Tareas />} />
            <Route path="/ausencias" element={<Ausencias />} />
            <Route path="/ajustes" element={<Ajustes />} />
            <Route
              path="*"
              element={
                <Vacio
                  icono={Compass}
                  titulo="Esta página no existe"
                  accion={
                    <Link to="/" className="font-medium text-primario hover:underline">
                      Ir a Inicio
                    </Link>
                  }
                />
              }
            />
          </Routes>
        </Shell>
      </ProveedorRegistroGasto>
    </ProveedorMes>
  )
}

export default function App() {
  const { sesion, cargando, recuperando } = useSesion()
  if (cargando) return <Cargando />
  if (recuperando) return <NuevaContrasena />
  if (!sesion) return <Acceso />
  return <AppConSesion />
}
