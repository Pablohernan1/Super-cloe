# Cómo Arreglar el Rol del Usuario Admin

## Problema
Cuando un usuario se registra o ingresa manualmente sin usar el script de seed, su perfil no se crea automáticamente en la tabla `profiles`, por lo que no tiene rol asignado.

## Solución

### Opción 1: Ejecutar el Script de Trigger (RECOMENDADO)

Este script crea un trigger automático que asignará rol a todos los nuevos usuarios:

1. Ve a Supabase Dashboard
2. Abre el SQL Editor
3. Crea una nueva query
4. Copia el contenido de `scripts/003-auto-create-profile-trigger.sql`
5. Ejecuta la query

Después de esto, todos los nuevos usuarios tendrán automáticamente rol `cajero` asignado.

### Opción 2: Arreglar tu Usuario Admin Específico

Si ya tienes un usuario admin sin perfil:

1. Ve a Supabase Dashboard
2. Abre el Authentication > Users
3. Copia el UUID de tu usuario admin
4. Abre el SQL Editor
5. Ejecuta esta query (reemplaza `YOUR_USER_ID_HERE` con tu UUID):

```sql
INSERT INTO public.profiles (id, email, full_name, role, status)
VALUES (
  'YOUR_USER_ID_HERE',
  'admin@cloe.com',
  'Admin User',
  'administrador',
  'active'
)
ON CONFLICT (id) DO UPDATE SET role = 'administrador', status = 'active';
```

6. Luego cierra sesión y vuelve a ingresar

### Opción 3: Usar el Seed Script

Si quieres crear varios usuarios de prueba con roles predefinidos:

```bash
npm run seed
# o
npx tsx scripts/seed-users.ts
```

Esto creará:
- 2 Administradores
- 2 Supervisores  
- 3 Cajeros

Con credenciales de prueba.

## Verificar que Funciona

1. Inicia sesión
2. Abre la consola del navegador (F12)
3. Deberías ver el log: `[v0] User role: administrador`

## Permisos Asignados por Rol

### Administrador
- Crear, editar, eliminar clientes
- Crear, editar, eliminar límites de crédito
- Crear, editar, eliminar préstamos
- Crear, editar garantes
- Ver reportes
- Gestionar usuarios
- Cambiar estados

### Supervisor
- Ver clientes
- Ver límites de crédito
- Ver préstamos
- Crear garantes
- Ver reportes básicos

### Cajero
- Ver clientes
- Ver límites de crédito
- Ver préstamos
- Registrar pagos de cuotas

## Problemas Comunes

### No aparece el rol después de ejecutar el script
- Verifica que el trigger se creó correctamente: En SQL Editor, ejecuta:
  ```sql
  SELECT trigger_name FROM information_schema.triggers 
  WHERE event_object_table = 'users';
  ```
  Deberías ver `on_auth_user_created`

### El usuario sigue sin perfil después de new login
- Asegúrate de que ejecutaste el trigger script ANTES de que el usuario se registrara
- Si ya estaba registrado, ejecuta manualmente la query de Opción 2

### Error "profiles already exists"
- Es normal si ya existe el perfil
- Solo asegúrate de que el rol sea el correcto
