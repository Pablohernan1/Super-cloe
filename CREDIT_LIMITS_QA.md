# Módulo de Límites de Crédito - Guía de Testing QA

## Cambios Realizados en Segunda Iteración

### 1. Página de Detalle Mejorada (/creditos/[id])
✓ Muestra todos los campos del límite (aprobado, comprometido, disponible, estado, observaciones, garantes, elegibilidad)
✓ Botones de acción (Editar, Aprobar, Rechazar) visibles según rol
✓ Sección de préstamos asociados al límite
✓ Historial de cambios registrado en audit_logs

**Testing:**
- [ ] Con rol administrador: Ver botones Editar, Aprobar, Rechazar
- [ ] Con rol supervisor: Ver botones Editar, Aprobar, Rechazar
- [ ] Con rol cajero: No ver botones de acción
- [ ] Hacer clic en "Aprobar" → cambio de estado, registro en audit_logs
- [ ] Hacer clic en "Rechazar" → cambio de estado, registro en audit_logs
- [ ] Verificar préstamos asociados se muestren si existen

### 2. Sección Mejorada en Ficha del Cliente (/clientes/[id])
✓ Card de Límite de Crédito con estado, garantes, elegibilidad
✓ Botón "Ver Detalle Completo" → /creditos/[id]
✓ Si no existe límite: mostrar card vacío con botón "Crear Límite de Crédito"

**Testing:**
- [ ] Cliente sin límite: Ver card con opción de crear
- [ ] Cliente con límite: Ver estado, garantes, botón Ver Detalle
- [ ] Hacer clic en "Ver Detalle Completo" → abrir /creditos/[id]

### 3. Tabla de Listado Limpiada (/creditos)
✓ Muestra todas las columnas: Cliente, CUIT, Aprobado, Comprometido, Disponible, Estado, Garantes, Ampliación, Fecha
✓ Enlace a detalles en cada fila
✓ Sin console.log innecesarios

**Testing:**
- [ ] Verificar que se muestren todos los límites
- [ ] Hacer clic en "Ver" → abrir detalle del límite
- [ ] Estados con colores correctos (amarillo=pendiente, verde=aprobado, rojo=rechazado)

### 4. Auditoría Completa
✓ Función `createAuditLog()` mejorada para recibir old_values y new_values
✓ Registra acciones: create, update, approve, reject
✓ Almacena cambios específicos en tabla audit_logs

**Testing:**
- [ ] Crear límite: verificar audit_logs con action='create'
- [ ] Aprobar límite: verificar audit_logs con action='approve', status cambio a 'approved'
- [ ] Rechazar límite: verificar audit_logs con action='reject', status cambio a 'rejected'
- [ ] Historial de cambios muestre usuario y fecha/hora

### 5. Servicios de Integración de Préstamos
✓ Funciones de validación en `/lib/services/credit-limits.ts`:
  - `validateCreditLimitForLoan()` - valida si cliente puede obtener préstamo
  - `getLoansForCreditLimit()` - obtiene préstamos asociados
  - `calculateUtilizationPercentage()` - calcula porcentaje de uso

✓ Endpoint GET `/api/credit-limits/[id]/validation?loan_amount=XXX`
  - Retorna si hay crédito disponible
  - Valida garantes requeridos
  - Retorna monto disponible

**Testing:**
- [ ] Llamar a `/api/credit-limits/[id]/validation?loan_amount=5000`
- [ ] Verificar respuesta con isEligible, availableForLoan, guarantorsOk
- [ ] Validar error si falta crédito
- [ ] Validar error si faltan garantes

## Permisos por Rol

### Administrador
- Crear límites ✓
- Ver todos los límites ✓
- Editar límites ✓
- Aprobar/Rechazar límites ✓
- Acceso a historial de cambios ✓

### Supervisor
- Crear límites ✓
- Ver todos los límites ✓
- Editar límites ✓
- Aprobar/Rechazar límites ✓
- Acceso a historial de cambios ✓

### Cajero
- Ver límites ✓
- NO puede crear ✗
- NO puede editar ✗
- NO puede aprobar ✗

## Checklist de Validación Final

### Datos
- [ ] Conexión a Supabase funciona (sin mocks)
- [ ] Datos cargados desde BD, no placeholders
- [ ] Dinero en formato ARS con .toLocaleString('es-AR')

### Seguridad
- [ ] Permisos validados en backend (API)
- [ ] Permisos validados en frontend (UI)
- [ ] Solo usuario autenticado puede ver datos
- [ ] Audit logs registran usuario y fecha

### Errores
- [ ] Mensajes en español
- [ ] Validaciones funcionales (crédito disponible, garantes, etc)
- [ ] Confirmación antes de aprobar/rechazar

### Integraciones
- [ ] Préstamos relacionados se muestran
- [ ] Endpoint de validación funciona
- [ ] servicios en `/lib/services/credit-limits.ts` son usables

## Notas Técnicas

1. **Cambio en Audit Logger**
   - Antes: `createAuditLog(action, table, id, changes)`
   - Ahora: `createAuditLog(action, table, id, oldValues, newValues)`

2. **Nuevos Archivos**
   - `/app/(dashboard)/creditos/[id]/credit-limit-actions.tsx` - Componente de botones
   - `/app/api/credit-limits/[id]/route.ts` - Endpoint PATCH dinámico
   - `/app/api/credit-limits/[id]/validation/route.ts` - Validación para préstamos
   - `/lib/services/credit-limits.ts` - Servicios de crédito

3. **Archivos Modificados**
   - `/app/(dashboard)/creditos/[id]/page.tsx` - Agregados botones y préstamos
   - `/app/(dashboard)/clientes/[id]/page.tsx` - Mejorada sección de crédito
   - `/app/api/credit-limits/route.ts` - Limpiado (antes tenía llaves no balanceadas)
   - `/app/(dashboard)/creditos/credit-limits-table.tsx` - Quitados console.log
   - `/lib/audit-logger.ts` - Actualizada función

## Status

✅ **COMPLETADO** - Módulo de Límites de Crédito listo para QA
- Páginas completas y funcionales
- Auditoría registrando cambios
- Permisos validados
- Integración de préstamos preparada
- Sin mocks, datos desde Supabase real
