import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth-context'
import { ProtectedRoute } from '@/components/layout/protected-route'
import { Toaster } from '@/components/ui/sonner'

import LoginPage from '@/pages/login'
import DashboardPage from '@/pages/dashboard'

import ClientesListPage from '@/pages/clientes/list'
import ClienteDetailPage from '@/pages/clientes/detail'
import ClienteNewPage from '@/pages/clientes/new'
import ClienteEditPage from '@/pages/clientes/edit'

import GarantesListPage from '@/pages/garantes/list'
import GaranteNewPage from '@/pages/garantes/new'

import CreditosListPage from '@/pages/creditos/list'
import CreditoDetailPage from '@/pages/creditos/detail'
import CreditoNewPage from '@/pages/creditos/new'

import PrestamosListPage from '@/pages/prestamos/list'
import PrestamoDetailPage from '@/pages/prestamos/detail'
import PrestamoSimulacionPage from '@/pages/prestamos/simulacion'

import CobranzaPage from '@/pages/cobranza'
import AlertasPage from '@/pages/alertas'
import TarjetasPage from '@/pages/tarjetas'
import ParametrosPage from '@/pages/parametros'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/clientes" element={<ClientesListPage />} />
            <Route path="/clientes/nuevo" element={<ClienteNewPage />} />
            <Route path="/clientes/:id" element={<ClienteDetailPage />} />
            <Route path="/clientes/:id/editar" element={<ClienteEditPage />} />

            <Route path="/garantes" element={<GarantesListPage />} />
            <Route path="/garantes/nuevo" element={<GaranteNewPage />} />

            <Route path="/creditos" element={<CreditosListPage />} />
            <Route path="/creditos/nuevo" element={<CreditoNewPage />} />
            <Route path="/creditos/:id" element={<CreditoDetailPage />} />

            <Route path="/prestamos" element={<PrestamosListPage />} />
            <Route path="/prestamos/simulacion" element={<PrestamoSimulacionPage />} />
            <Route path="/prestamos/:id" element={<PrestamoDetailPage />} />

            <Route path="/cobranza" element={<CobranzaPage />} />
            <Route path="/alertas" element={<AlertasPage />} />
            <Route path="/tarjetas" element={<TarjetasPage />} />
            <Route path="/parametros" element={<ParametrosPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
      <Toaster />
    </AuthProvider>
  )
}
