# Testing & QA Checklist - Módulo de Préstamos

## 1. Validaciones de Negocio

### 1.1 Cliente Ineligible
- [ ] Intentar crear préstamo con cliente inactivo → Error "Cliente inactivo"
- [ ] Intentar crear préstamo con cliente sin límite de crédito → Error "Cliente no tiene límite asignado"
- [ ] Intentar crear préstamo con límite de crédito no aprobado → Error "Límite de crédito no aprobado"

### 1.2 Monto y Plazo
- [ ] Monto solicitado 0 → Error "Monto debe ser mayor a 0"
- [ ] Plazo 0 → Error "Plazo debe estar entre 1 y 60 meses"
- [ ] Plazo > 60 meses → Error

### 1.3 Límite de Crédito
- [ ] Monto > disponible → Error "Monto excede crédito disponible"
- [ ] Monto < disponible → Válido
- [ ] Garantes insuficientes → Error "Insuficientes garantes"

### 1.4 Aprobación y Committed
- [ ] Crear préstamo → committed_limit NO aumenta
- [ ] Aprobar préstamo → committed_limit AUMENTA en monto total
- [ ] available_credit se actualiza correctamente

## 2. Cálculo de Tasas

### 2.1 Tasas Predefinidas
- [ ] 1 mes: 2.5%
- [ ] 2 meses: 4.5%
- [ ] 3 meses: 6.5%
- [ ] 12 meses: 12%
- [ ] 36 meses: 15%

### 2.2 Interpolación
- [ ] 5 meses: ~8% (interpolado entre 3 y 6)
- [ ] 18 meses: ~13% (interpolado entre 12 y 24)

### 2.3 Cálculo de Cuotas
- [ ] Cuota = Total / meses
- [ ] Interés total = Principal × Tasa
- [ ] Total = Principal + Interés total

## 3. Generación de Cuotas

### 3.1 Cantidad
- [ ] 12 meses → 12 cuotas creadas
- [ ] 3 meses → 3 cuotas creadas

### 3.2 Vencimientos
- [ ] Cuota 1: Mes+1
- [ ] Cuota 2: Mes+2
- [ ] Cuota N: Mes+N

### 3.3 Importes
- [ ] Principal por cuota: Principal / cuotas
- [ ] Interés por cuota: Interés total / cuotas
- [ ] Total por cuota: (Principal + Interés) / cuotas

## 4. Interfaz de Usuario

### 4.1 Simulador
- [ ] Búsqueda de cliente funciona (autocomplete)
- [ ] Mostrar resumen del cliente (garantes, límite)
- [ ] Inputs: monto y plazo validados
- [ ] Botón "Validar" deshabilitado sin cliente

### 4.2 Validación
- [ ] Errores en rojo
- [ ] Advertencias en amarillo
- [ ] Información de crédito visible
- [ ] Cálculo mostrado correctamente

### 4.3 Creación
- [ ] Botón "Crear" solo si validación OK
- [ ] Redirecciona a detalle tras crear
- [ ] Número de préstamo generado (PRS-timestamp)

### 4.4 Listado
- [ ] Tabla de préstamos ordenada por fecha
- [ ] Estados con colores
- [ ] Links a detalle funcionan
- [ ] Botón "Nuevo Préstamo" visible

### 4.5 Detalle
- [ ] Información del préstamo correcta
- [ ] Tabla de cuotas completa
- [ ] Cálculo de saldo correcto
- [ ] Estados coloreados

## 5. Permisos por Rol

### 5.1 Administrador
- [ ] Acceso a /prestamos ✓
- [ ] Crear préstamos ✓
- [ ] Aprobar préstamos ✓
- [ ] Ver detalles ✓

### 5.2 Supervisor
- [ ] Acceso a /prestamos ✓
- [ ] Crear préstamos ✓
- [ ] Aprobar préstamos ✓
- [ ] Ver detalles ✓

### 5.3 Cajero
- [ ] Acceso a /prestamos ✓
- [ ] Crear préstamos ✗ (mostrar error 403)
- [ ] Ver detalles ✓

## 6. Auditoría

### 6.1 Crear Préstamo
- [ ] audit_logs registra: create, loans, user_id
- [ ] old_values: null
- [ ] new_values: customer_id, principal, etc.

### 6.2 Aprobar Préstamo
- [ ] audit_logs registra: approve, loans, user_id
- [ ] Registra cambio de status
- [ ] Registra who approved

### 6.3 Integración con Límites
- [ ] audit_logs registra actualización de credit_limits
- [ ] old_values: committed_limit anterior
- [ ] new_values: committed_limit nuevo

## 7. Integración con Límites de Crédito

### 7.1 Impacto al Crear
- [ ] committed_limit NO cambia
- [ ] available_credit se ve en simulador

### 7.2 Impacto al Aprobar
- [ ] committed_limit AUMENTA en total_amount
- [ ] available_credit DISMINUYE
- [ ] Verificar en ficha del cliente

### 7.3 Inconsistencias
- [ ] committed_limit nunca > approved_limit
- [ ] available_credit nunca < 0

## 8. API Endpoints

### 8.1 POST /api/prestamos
- [ ] Crear con datos válidos ✓
- [ ] Rechazar sin customer_id ✓
- [ ] Rechazar por validación ✓
- [ ] Rechazar sin permisos ✓

### 8.2 GET /api/prestamos
- [ ] Listar todos
- [ ] Filtrar por customer_id
- [ ] Filtrar por status

### 8.3 GET /api/prestamos/[id]
- [ ] Devolver préstamo completo
- [ ] Incluir cuotas
- [ ] 404 si no existe

### 8.4 PATCH /api/prestamos/[id]
- [ ] Aprobar (action: approve)
- [ ] Rechazar (action: reject + reason)
- [ ] Permisos validados

### 8.5 POST /api/prestamos/[id]/validate
- [ ] Validar eligibilidad
- [ ] Devolver cálculo
- [ ] Devolver errores

## 9. Edge Cases

### 9.1 Montos Decimales
- [ ] Monto 10000.50 → OK
- [ ] Redondeo correcto en cuotas

### 9.2 Tasas
- [ ] Plazo 7 meses (interpolación)
- [ ] Plazo 60 meses (máximo)

### 9.3 Límites
- [ ] Cliente con múltiples préstamos
- [ ] Comprometer más del límite
- [ ] Préstamo justo al límite

## 10. Datos de Prueba Necesarios

```sql
-- Cliente activo con límite
UPDATE customers SET is_active = true WHERE id = 'TEST_CUSTOMER_ID';

-- Límite aprobado
UPDATE credit_limits SET status = 'approved', approved_limit = 50000, available_credit = 50000 WHERE customer_id = 'TEST_CUSTOMER_ID';

-- Garantes activos
INSERT INTO guarantor_relations (titular_customer_id, guarantor_customer_id, status) 
VALUES ('TEST_CUSTOMER_ID', 'TEST_GUARANTOR_ID', 'active');
```

## Notas de QA

- Todos los montos en argentina (ARS)
- Fechas en formato local (es-AR)
- Auditoría completa en cada acción
- Sin console.log en producción
- Manejo de errores con mensajes claros
