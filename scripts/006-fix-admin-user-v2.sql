-- Fix admin user - Insert profile if it doesn't exist
-- Replace 'YOUR_USER_ID_HERE' with the actual UUID from auth.users

INSERT INTO public.profiles (id, email, full_name, role, status)
VALUES (
  '582bf9eb-72ad-4b49-a896-e4d61f0ed7dc',  -- Your UUID from auth.users
  'admin@cloe.com',
  'Admin User',
  'administrador'::user_role,
  'active'::account_status
)
ON CONFLICT (id) DO UPDATE SET 
  role = 'administrador'::user_role, 
  status = 'active'::account_status;

-- Verify the update
SELECT id, email, full_name, role, status FROM public.profiles WHERE id = '582bf9eb-72ad-4b49-a896-e4d61f0ed7dc';
