'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (roles: string | string[]) => boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      console.log('[v0] Client: Fetching profile via API for user:', userId)
      // Use API endpoint instead of direct Supabase query to bypass RLS issues
      const response = await fetch('/api/auth/get-profile', {
        method: 'POST'
      })
      
      console.log('[v0] Client: API response status:', response.status)
      
      if (!response.ok) {
        console.error('[v0] Client: Profile API error:', response.status)
        return null
      }
      
      const result = await response.json()
      console.log('[v0] Client: API response:', result)
      
      if (result.profile) {
        console.log('[v0] Client: Profile fetched successfully:', { role: result.profile.role, full_name: result.profile.full_name })
        return result.profile as Profile
      }
      
      console.warn('[v0] Client: No profile in response')
      return null
    } catch (error) {
      console.error('[v0] Client: Exception fetching profile:', error)
      return null
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (isMounted && session?.user) {
          console.log('[v0] Session found for user:', session.user.id)
          setUser(session.user)
          
          // First ensure profile exists
          try {
            const res = await fetch('/api/auth/ensure-profile', { method: 'POST' })
            if (!res.ok) {
              console.warn('[v0] Ensure profile returned:', res.status)
            }
          } catch (err) {
            console.error('[v0] Ensure profile error:', err)
          }
          
          // Small delay to ensure profile was created
          await new Promise(resolve => setTimeout(resolve, 300))
          
          const profile = await fetchProfile(session.user.id)
          if (isMounted) {
            setProfile(profile)
            console.log('[v0] Auth init - Profile loaded:', profile?.role)
          }
        } else {
          console.log('[v0] No session found on init')
          setUser(null)
          setProfile(null)
        }
      } catch (error) {
        console.error('[v0] Auth init error:', error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        console.log('[v0] Auth state changed:', event)

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[v0] SIGNED_IN - User:', session.user.id)
          setUser(session.user)
          
          // Ensure profile exists
          try {
            const res = await fetch('/api/auth/ensure-profile', { method: 'POST' })
            console.log('[v0] Ensure profile response:', res.status)
          } catch (err) {
            console.error('[v0] Ensure profile error:', err)
          }
          
          // Wait for profile to be created
          await new Promise(resolve => setTimeout(resolve, 300))
          
          const profile = await fetchProfile(session.user.id)
          if (isMounted) {
            setProfile(profile)
            console.log('[v0] SIGNED_IN - Profile loaded:', profile?.role)
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[v0] SIGNED_OUT')
          setUser(null)
          setProfile(null)
        }
      }
    )

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    setUser(null)
    setProfile(null)
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (!user) {
      console.log('[v0] No user, skipping profile refresh')
      return
    }
    console.log('[v0] Refreshing profile for user:', user.id)
    const profile = await fetchProfile(user.id)
    if (profile) {
      console.log('[v0] Profile refreshed successfully:', { role: profile.role, email: profile.email, id: profile.id })
      setProfile(profile)
    } else {
      console.warn('[v0] Profile refresh returned null')
    }
  }

  const hasRole = (roles: string | string[]) => {
    if (!profile) return false
    const roleArray = Array.isArray(roles) ? roles : [roles]
    return roleArray.includes(profile.role)
  }

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signIn, signOut, hasRole, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
