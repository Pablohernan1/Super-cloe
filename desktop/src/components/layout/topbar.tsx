import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LogOut, RefreshCw } from 'lucide-react'
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

export function Topbar() {
  const navigate = useNavigate()
  const { profile, user, signOut, refreshProfile } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (user && !profile?.role) {
      refreshProfile()
    }
  }, [user, profile?.role, refreshProfile])

  const handleRefreshProfile = async () => {
    setIsRefreshing(true)
    try {
      await refreshProfile()
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:px-6">
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 pl-2 pr-3 text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium uppercase text-primary-foreground">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="hidden flex-col items-start text-left md:flex">
                <span className="text-sm font-medium">{profile?.full_name || 'Usuario'}</span>
                <span className="text-xs capitalize text-sidebar-foreground/70">{profile?.role || 'Sin rol'}</span>
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
            <DropdownMenuItem onClick={handleRefreshProfile} disabled={isRefreshing}>
              <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} />
              {isRefreshing ? 'Recargando...' : 'Recargar Perfil'}
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
