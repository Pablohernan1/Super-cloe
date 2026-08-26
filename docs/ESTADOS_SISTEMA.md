# Guía de Estados del Sistema

## 1. Estados de Límites de Crédito

```typescript
type CreditLimitStatus = 'pending_approval' | 'approved' | 'rejected' | 'suspended' | 'expired'
```

### Estados Disponibles:

- **pending_approval**: Límite recién creado, awaiting approval. Estado inicial cuando se crea un nuevo límite.
- **approved**: Límite aprobado y activo. El cliente puede solicitar préstamos hasta este límite.
- **rejected**: Límite fue rechazado en el proceso de aprobación.
- **suspended**: Límite fue suspendido (ej: por mora o violación de políticas).
- **expired**: Límite expiró. Necesita renovación.

### Flujo de Estados:
```
pending_approval → approved → [active] → suspended (opcional)
pending_approval → rejected (fin)
approved → suspended (por mora/incidente)
approved → expired (por tiempo)
```

---

## 2. Estados de Préstamos

```typescript
type LoanStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'defaulted' | 'cancelled'
```

### Estados Disponibles:

- **pending**: Solicitud de préstamo creada, awaiting approval.
- **approved**: Préstamo aprobado, listo para desembolso.
- **rejected**: Solicitud rechazada.
- **active**: Préstamo desembolsado, en proceso de pago.
- **completed**: Todos los pagos completados.
- **defaulted**: Préstamo en mora/incumplimiento.
- **cancelled**: Préstamo cancelado antes de desembolso.

### Flujo de Estados:
```
pending → approved → active → completed
pending → rejected (fin)
pending → cancelled (fin)
active → defaulted (por mora)
active → completed (pagos terminados)
```

---

## 3. Estados de Cuotas

```typescript
type InstallmentStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled'
```

### Estados Disponibles:

- **pending**: Cuota no vencida aún.
- **paid**: Cuota pagada en su totalidad.
- **partial**: Cuota pagada pero no en su totalidad (requiere pago adicional).
- **overdue**: Cuota vencida y no pagada.
- **cancelled**: Cuota cancelada (anulada).

### Flujo de Estados:
```
pending → paid (pago completo)
pending → partial (pago parcial)
pending → overdue (vencimiento sin pago)
partial → paid (pago del saldo)
partial → overdue (vencimiento sin pago del saldo)
```

---

## 4. Estados de Perfiles de Usuario

```typescript
type AccountStatus = 'active' | 'blocked' | 'pending_password_change'
```

### Estados Disponibles:

- **active**: Usuario activo y operativo.
- **blocked**: Usuario bloqueado (por incumplimiento de políticas o solicitud).
- **pending_password_change**: Usuario debe cambiar contraseña en próximo login.

---

## 5. Estados de Clientes

### Estados Disponibles (en tabla customers):

- **active**: Cliente activo.
- **inactive**: Cliente inactivo (no ha solicitado productos).
- **blocked**: Cliente bloqueado (por mora, documentos vencidos, etc).
- **defaulted**: Cliente en mora/incumplimiento.

---

## 6. Tipos de Alertas

```typescript
type AlertType = 'overdue' | 'limit_exceeded' | 'document_expired' | 'system'
type AlertPriority = 'low' | 'medium' | 'high' | 'critical'
```

### Alertas por Tipo:

- **overdue**: Cuota o préstamo vencido sin pago.
- **limit_exceeded**: Cliente intentó usar más crédito del aprobado.
- **document_expired**: Documentos de cliente vencieron.
- **system**: Alertas del sistema (errores, tareas pendientes).

### Prioridades:

- **low**: Informativos generales.
- **medium**: Require atención en próximos días.
- **high**: Require atención inmediata.
- **critical**: Emergencia, requiere acción inmediata.

---

## 7. Acciones de Auditoría

```typescript
type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'approve' | 'reject'
```

### Acciones Registradas:

- **create**: Nuevo registro creado.
- **update**: Registro modificado.
- **delete**: Registro eliminado.
- **login**: Usuario ingresó al sistema.
- **logout**: Usuario salió del sistema.
- **approve**: Registro fue aprobado.
- **reject**: Registro fue rechazado.

---

## 8. Roles de Usuario

```typescript
type UserRole = 'cajero' | 'supervisor' | 'administrador'
```

### Permisos por Rol:

| Acción | Cajero | Supervisor | Administrador |
|--------|--------|-----------|---------------|
| Ver clientes | ✓ | ✓ | ✓ |
| Crear clientes | ✗ | ✓ | ✓ |
| Crear límites de crédito | ✗ | ✓ | ✓ |
| Aprobar límites | ✗ | ✓ | ✓ |
| Crear préstamos | ✓ | ✓ | ✓ |
| Aprobar préstamos | ✗ | ✓ | ✓ |
| Registrar pagos | ✓ | ✓ | ✓ |
| Aprobar pagos | ✗ | ✓ | ✓ |
| Gestionar usuarios | ✗ | ✗ | ✓ |
| Acceso a reportes | ✗ | ✓ | ✓ |

---

## 9. Ciclo Completo: Desde Cliente a Préstamo

```
1. CLIENTE REGISTRADO (status: active)
   ↓
2. LÍMITE DE CRÉDITO CREADO (status: pending_approval)
   ↓
3. LÍMITE APROBADO (status: approved)
   ↓
4. SOLICITUD DE PRÉSTAMO (status: pending)
   ↓
5. PRÉSTAMO APROBADO (status: approved)
   ↓
6. PRÉSTAMO DESEMBOLSADO (status: active)
   ↓
7. CUOTAS EN CICLO DE PAGO (status: pending/paid/overdue)
   ↓
8. PRÉSTAMO COMPLETADO (status: completed)
```

---

## 10. Reglas de Negocio

### Límites de Crédito:
- Un cliente solo puede tener UN límite de crédito activo.
- El límite debe estar APROBADO para poder solicitar préstamos.
- El `committed_limit` es la suma de todos los préstamos activos del cliente.
- El `available_credit` = `approved_limit` - `committed_limit`.
- Un préstamo no puede exceder el `available_credit`.

### Garantores:
- Un cliente puede tener múltiples garantores.
- El sistema registra cuántos garantores activos tiene cada cliente.
- Se puede habilitar ampliación de límite si hay 2+ garantores.

### Préstamos:
- Solo se puede crear si el cliente tiene límite APROBADO.
- El monto no puede exceder el crédito disponible.
- Las cuotas se generan automáticamente según el plazo.

### Mora:
- Si una cuota no se paga en la fecha de vencimiento, cambia a OVERDUE.
- Si un préstamo tiene 1+ cuota vencida, cambia a DEFAULTED.
- El cliente puede cambiar a estado BLOCKED si hay mora prolongada.

