import type { UserRole } from './types'

export const PERMISSIONS = {
  // Admin - puede todo
  administrador: {
    create: true,
    read: true,
    update: true,
    delete: true,
    approve: true,
    manage_users: true,
  },
  // Supervisor - puede editar pero no eliminar
  supervisor: {
    create: true,
    read: true,
    update: true,
    delete: false,
    approve: true,
    manage_users: false,
  },
  // Cajero - solo lectura
  cajero: {
    create: false,
    read: true,
    update: false,
    delete: false,
    approve: false,
    manage_users: false,
  },
} as const

export type Permission = keyof typeof PERMISSIONS.administrador

export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return PERMISSIONS[role][permission] ?? false
}

export function canCreate(role: UserRole | null | undefined): boolean {
  return hasPermission(role, 'create')
}

export function canRead(role: UserRole | null | undefined): boolean {
  return hasPermission(role, 'read')
}

export function canUpdate(role: UserRole | null | undefined): boolean {
  return hasPermission(role, 'update')
}

export function canDelete(role: UserRole | null | undefined): boolean {
  return hasPermission(role, 'delete')
}

export function canApprove(role: UserRole | null | undefined): boolean {
  return hasPermission(role, 'approve')
}

export function canManageUsers(role: UserRole | null | undefined): boolean {
  return hasPermission(role, 'manage_users')
}
