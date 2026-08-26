-- Script to fix existing admin user with missing profile
-- This should be run AFTER executing 003-auto-create-profile-trigger.sql

-- First, let's see if there's an admin user without a profile
-- Uncomment and run to see:
-- SELECT au.id, au.email FROM auth.users au 
-- LEFT JOIN public.profiles p ON p.id = au.id 
-- WHERE p.id IS NULL;

-- Fix admin user
-- Replace 'admin@example.com' with the actual admin email you used
UPDATE public.profiles 
SET role = 'administrador', status = 'active'
WHERE email LIKE '%admin%' AND role != 'administrador';

-- If the profile doesn't exist yet, you can also manually create it with this query
-- First get the user ID from Supabase Auth dashboard, then run:
-- INSERT INTO public.profiles (id, email, full_name, role, status)
-- VALUES ('YOUR_USER_ID_HERE', 'admin@example.com', 'Admin User', 'administrador', 'active')
-- ON CONFLICT (id) DO UPDATE SET role = 'administrador', status = 'active';
