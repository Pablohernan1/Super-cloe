// Audit logging utility
import { createClient } from '@/lib/supabase/server'

export interface AuditLog {
  id: string
  user_id: string
  action: string
  table_name: string
  record_id: string
  changes: Record<string, { before: any; after: any }>
  created_at: string
}

/**
 * Create an audit log entry with detailed change tracking
 * Supports: create, update, delete, approve, reject
 */
export async function createAuditLog(
  action: string,
  tableName: string,
  recordId: string,
  oldValues: Record<string, any> | null = null,
  newValues: Record<string, any>
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    // Build changes object
    const changes: Record<string, any> = {}
    
    if (action === 'create') {
      // For create, all new values are the changes
      Object.entries(newValues).forEach(([key, value]) => {
        changes[key] = { before: null, after: value }
      })
    } else {
      // For update/approve/reject, compare old and new values
      Object.entries(newValues).forEach(([key, newValue]) => {
        const oldValue = oldValues?.[key]
        if (oldValue !== newValue) {
          changes[key] = { before: oldValue, after: newValue }
        }
      })
    }

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action,
        table_name: tableName,
        record_id: recordId,
        old_values: oldValues,
        new_values: newValues,
        changes: changes,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('[v0] Error creating audit log:', error)
    }
  } catch (err) {
    console.error('[v0] Exception in createAuditLog:', err)
  }
}

/**
 * Get audit history for a record
 */
export async function getAuditHistory(tableName: string, recordId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      user:user_id (
        id,
        email,
        user_metadata
      )
    `)
    .eq('table_name', tableName)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching audit history:', error)
    return []
  }

  return data as AuditLog[]
}

/**
 * Get audit history for a specific user
 */
export async function getUserAuditHistory(userId: string, limit: number = 50) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching user audit history:', error)
    return []
  }

  return data as AuditLog[]
}

