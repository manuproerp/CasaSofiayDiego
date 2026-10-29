import { IconContext } from '@phosphor-icons/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ProveedorAvisos } from './componentes/ui/avisos'
import { ProveedorSesion } from './datos/sesion'
import './index.css'
import './lib/dispositivo'

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <IconContext.Provider value={{ weight: 'regular', mirrored: false }}>
        <ProveedorSesion>
          <BrowserRouter>
            <ProveedorAvisos>
              <App />
            </ProveedorAvisos>
          </BrowserRouter>
        </ProveedorSesion>
      </IconContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
