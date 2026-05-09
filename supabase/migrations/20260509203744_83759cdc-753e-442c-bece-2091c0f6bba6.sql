INSERT INTO public.hr_employees (user_id, full_name, email, hr_role, status, employee_code, joining_date)
VALUES ('dccdc8c4-100c-4e3e-a32b-57b098eb3576', 'Admin', 'admin@bschoolbuzz.com', 'super_admin', 'active', 'EMP001', CURRENT_DATE)
ON CONFLICT DO NOTHING;