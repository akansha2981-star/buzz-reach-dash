ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_expenses;
ALTER TABLE public.sales_expenses REPLICA IDENTITY FULL;
ALTER TABLE public.sales_ad_spend REPLICA IDENTITY FULL;