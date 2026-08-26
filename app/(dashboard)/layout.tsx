import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthWrapper } from '@/components/layout/auth-wrapper'
import { AppShell } from '@/components/layout'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <AuthWrapper>
      <AppShell>{children}</AppShell>
    </AuthWrapper>
  )
}
