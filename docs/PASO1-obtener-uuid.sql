-- PASO 1: Ejecuta esta query PRIMERO para obtener tu UUID
-- Copia el UUID que obtengas y úsalo en el PASO 2
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;
