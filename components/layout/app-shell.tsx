'use client'

import { Topbar } from './topbar'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, FileText, CreditCard, HandCoins, Bell, QrCode, Settings } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface AppShellProps {
  children: React.ReactNode
}

// Alineado con la navegación del spec (sección 6): Inicio, Clientes,
// Garantes, Préstamos, Cobranza, Alertas. Créditos queda como pantalla
// adicional para gestionar límites (spec 8.3) -- solo supervisor+, es
// tarea de aprobación de riesgo, no algo que el cajero necesite navegar
// (spec sección 4: "Supervisor... aprobar límites").
const navItems = [
  { title: 'Inicio', href: '/dashboard', icon: Home },
  { title: 'Clientes', href: '/clientes', icon: Users },
  { title: 'Créditos', href: '/creditos', icon: CreditCard, roles: ['supervisor', 'administrador'] },
  { title: 'Garantes', href: '/garantes', icon: Users },
  { title: 'Préstamos', href: '/prestamos', icon: FileText },
  { title: 'Cobranza', href: '/cobranza', icon: HandCoins },
  { title: 'Alertas', href: '/alertas', icon: Bell },
  { title: 'Tarjetas', href: '/tarjetas', icon: QrCode, roles: ['supervisor', 'administrador'] },
  { title: 'Parámetros', href: '/parametros', icon: Settings, roles: ['administrador'] },
]

function FixedSidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(profile?.role || ''))

  return (
    <aside className="w-64 bg-sidebar border-r border-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-border">
        <div className="font-bold text-white text-lg">Cloe</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </nav>
      
      {/* Footer */}
      <div className="h-16 border-t border-border flex items-center justify-center text-xs text-sidebar-foreground/50">
        Cloe v1.0.0
      </div>
    </aside>
  )
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Fixed Sidebar */}
      <FixedSidebar />
      
      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <Topbar />
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
