ALTER TABLE public.sales_payments ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS sales_payments_is_test_idx ON public.sales_payments (is_test);

ALTER TABLE public.sales_settings ADD COLUMN IF NOT EXISTS total_sales_target integer NOT NULL DEFAULT 0;
ALTER TABLE public.sales_settings ADD COLUMN IF NOT EXISTS total_revenue_target numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales_settings ADD COLUMN IF NOT EXISTS total_profit_target numeric NOT NULL DEFAULT 0;