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
  // Cajero: busca/da de alta clientes y garantes, simula préstamos, registra
  // pagos (spec sección 4). No aprueba límites ni confirma préstamos -- esas
  // acciones se restringen aparte, con checks explícitos de rol, no con este
  // flag genérico.
  cajero: {
    create: true,
    read: true,
    update: true,
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

// Límites de crédito: definir/aprobar es tarea de supervisor+ (spec 4 y
// paso 4 del flujo end-to-end). El cajero ve el disponible de un cliente
// puntual (Inicio, ficha de cliente) pero no gestiona la sección completa.
export function canManageCreditLimits(role: UserRole | null | undefined): boolean {
  return role === 'supervisor' || role === 'administrador'
}

// Parámetros del sistema (tasas, mora, límites estructurales -- spec sección
// 12): solo administrador, reforzado en RLS (parameters_update_admin).
export function canManageParameters(role: UserRole | null | undefined): boolean {
  return role === 'administrador'
}
