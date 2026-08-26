import { Topbar } from './topbar'
import { cn } from '@/lib/utils'
import { NavLink } from 'react-router-dom'
import { Home, Users, FileText, CreditCard, HandCoins, Bell } from 'lucide-react'

interface AppShellProps {
  children: React.ReactNode
}

// Alineado con la navegación del spec (sección 6).
const navItems = [
  { title: 'Inicio', href: '/dashboard', icon: Home },
  { title: 'Clientes', href: '/clientes', icon: Users },
  { title: 'Créditos', href: '/creditos', icon: CreditCard },
  { title: 'Garantes', href: '/garantes', icon: Users },
  { title: 'Préstamos', href: '/prestamos', icon: FileText },
  { title: 'Cobranza', href: '/cobranza', icon: HandCoins },
  { title: 'Alertas', href: '/alertas', icon: Bell },
]

function FixedSidebar() {
  return (
    <aside className="w-64 bg-sidebar border-r border-border flex flex-col">
      <div className="h-16 flex items-center justify-center border-b border-border">
        <div className="font-bold text-white text-lg">Cloe</div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50'
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{item.title}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="h-16 border-t border-border flex items-center justify-center text-xs text-sidebar-foreground/50">
        Cloe Desktop
      </div>
    </aside>
  )
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <FixedSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
