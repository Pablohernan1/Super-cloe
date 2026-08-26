-- Diagnóstico de la tabla profiles
-- Ejecuta esto para ver la estructura exacta

-- 1. Ver todas las columnas y sus restricciones
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- 2. Ver todas las restricciones NOT NULL
SELECT constraint_name, column_name 
FROM information_schema.constraint_column_usage 
WHERE table_name = 'profiles';

-- 3. Ver el DDL de la tabla
SELECT pg_get_ddl('profiles'::regclass);
