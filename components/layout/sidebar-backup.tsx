'use client'

import { useRouter } from 'next/navigation'
import { Menu, Bell, LogOut, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

interface TopbarProps {
  onMenuClick: () => void
  sidebarOpen: boolean
}

export function Topbar({ onMenuClick, sidebarOpen }: TopbarProps) {
  const router = useRouter()
  const { profile, signOut } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
      // Add a small delay to ensure state is cleared
      await new Promise(resolve => setTimeout(resolve, 100))
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Sign out error:', error)
      // Still redirect even if there's an error
      router.push('/login')
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-card px-4 lg:px-6" suppressHydrationWarning>
      {/* Menu Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="shrink-0"
      >
        <span className="lg:hidden">
          <Menu className="h-5 w-5" />
        </span>
        <span className="hidden lg:block">
          {sidebarOpen ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </span>
        <span className="sr-only">Alternar menu</span>
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2" suppressHydrationWarning>
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                3
              </span>
              <span className="sr-only">Notificaciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                <span className="text-sm font-medium">Cuota vencida</span>
                <span className="text-xs text-muted-foreground">
                  Cliente Juan Perez tiene 1 cuota vencida
                </span>
                <span className="text-xs text-muted-foreground">Hace 2 horas</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                <span className="text-sm font-medium">Solicitud pendiente</span>
                <span className="text-xs text-muted-foreground">
                  Nueva solicitud de credito requiere aprobacion
                </span>
                <span className="text-xs text-muted-foreground">Hace 5 horas</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                <span className="text-sm font-medium">Limite excedido</span>
                <span className="text-xs text-muted-foreground">
                  Cliente Maria Garcia supero el limite de credito
                </span>
                <span className="text-xs text-muted-foreground">Ayer</span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-primary">
              Ver todas las notificaciones
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium uppercase text-primary-foreground">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="hidden flex-col items-start text-left md:flex">
                <span className="text-sm font-medium">
                  {profile?.full_name || 'Usuario'}
                </span>
                <span className="text-xs capitalize text-muted-foreground">
                  {profile?.role || 'Sin rol'}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/perfil')}>
              <User className="mr-2 h-4 w-4" />
              Mi Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
