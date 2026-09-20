-- Permission flag
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS can_sales_tracker boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.has_sales_access(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin')
      OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _uid AND can_sales_tracker = true);
$$;

-- Websites
CREATE TABLE public.sales_websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_websites TO authenticated;
GRANT ALL ON public.sales_websites TO service_role;
ALTER TABLE public.sales_websites ENABLE ROW LEVEL SECURITY;
CREATE POLICY sw_all ON public.sales_websites FOR ALL TO authenticated USING (public.has_sales_access(auth.uid())) WITH CHECK (public.has_sales_access(auth.uid()));

-- Courses / products
CREATE TABLE public.sales_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  website_id uuid REFERENCES public.sales_websites(id) ON DELETE SET NULL,
  list_price numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sales_courses_code_uniq ON public.sales_courses (lower(code)) WHERE code IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_courses TO authenticated;
GRANT ALL ON public.sales_courses TO service_role;
ALTER TABLE public.sales_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY sc_all ON public.sales_courses FOR ALL TO authenticated USING (public.has_sales_access(auth.uid())) WITH CHECK (public.has_sales_access(auth.uid()));

-- Payments (Razorpay transactions)
CREATE TABLE public.sales_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_payment_id text NOT NULL UNIQUE,
  razorpay_order_id text,
  website_id uuid REFERENCES public.sales_websites(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.sales_courses(id) ON DELETE SET NULL,
  product_name text,
  product_ref text,
  customer_name text,
  customer_email text,
  customer_phone text,
  amount numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  final_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  payment_method text,
  status text NOT NULL DEFAULT 'captured',
  gateway_fee numeric NOT NULL DEFAULT 0,
  refund_status text,
  refund_amount numeric NOT NULL DEFAULT 0,
  coupon_code text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_payments_paid_at_idx ON public.sales_payments (paid_at DESC);
CREATE INDEX sales_payments_status_idx ON public.sales_payments (status);
CREATE INDEX sales_payments_course_idx ON public.sales_payments (course_id);
CREATE INDEX sales_payments_website_idx ON public.sales_payments (website_id);
CREATE INDEX sales_payments_campaign_idx ON public.sales_payments (utm_campaign);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_payments TO authenticated;
GRANT ALL ON public.sales_payments TO service_role;
ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp_all ON public.sales_payments FOR ALL TO authenticated USING (public.has_sales_access(auth.uid())) WITH CHECK (public.has_sales_access(auth.uid()));

-- Refund events
CREATE TABLE public.sales_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_refund_id text NOT NULL UNIQUE,
  payment_id uuid REFERENCES public.sales_payments(id) ON DELETE CASCADE,
  razorpay_payment_id text,
  amount numeric NOT NULL DEFAULT 0,
  is_partial boolean NOT NULL DEFAULT false,
  reason text,
  refunded_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_refunds_at_idx ON public.sales_refunds (refunded_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_refunds TO authenticated;
GRANT ALL ON public.sales_refunds TO service_role;
ALTER TABLE public.sales_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY sr_all ON public.sales_refunds FOR ALL TO authenticated USING (public.has_sales_access(auth.uid())) WITH CHECK (public.has_sales_access(auth.uid()));

-- Ad campaigns
CREATE TABLE public.sales_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campaign_ref text,
  platform text NOT NULL DEFAULT 'Meta Ads',
  objective text,
  website_id uuid REFERENCES public.sales_websites(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.sales_courses(id) ON DELETE SET NULL,
  budget_mode text NOT NULL DEFAULT 'total',
  total_budget numeric NOT NULL DEFAULT 0,
  daily_budget numeric NOT NULL DEFAULT 0,
  duration_days integer NOT NULL DEFAULT 1,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_ad_campaigns TO authenticated;
GRANT ALL ON public.sales_ad_campaigns TO service_role;
ALTER TABLE public.sales_ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY sac_all ON public.sales_ad_campaigns FOR ALL TO authenticated USING (public.has_sales_access(auth.uid())) WITH CHECK (public.has_sales_access(auth.uid()));

-- Ad spend entries
CREATE TABLE public.sales_ad_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.sales_ad_campaigns(id) ON DELETE SET NULL,
  campaign_name text,
  platform text NOT NULL DEFAULT 'Meta Ads',
  ad_set text,
  ad_name text,
  website_id uuid REFERENCES public.sales_websites(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.sales_courses(id) ON DELETE SET NULL,
  objective text,
  spend_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  budget_mode text NOT NULL DEFAULT 'total',
  budget numeric NOT NULL DEFAULT 0,
  duration_days integer NOT NULL DEFAULT 1,
  start_date date,
  end_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_ad_spend_date_idx ON public.sales_ad_spend (spend_date DESC);
CREATE INDEX sales_ad_spend_campaign_idx ON public.sales_ad_spend (campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_ad_spend TO authenticated;
GRANT ALL ON public.sales_ad_spend TO service_role;
ALTER TABLE public.sales_ad_spend ENABLE ROW LEVEL SECURITY;
CREATE POLICY sas_all ON public.sales_ad_spend FOR ALL TO authenticated USING (public.has_sales_access(auth.uid())) WITH CHECK (public.has_sales_access(auth.uid()));

-- Other business expenses
CREATE TABLE public.sales_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  amount numeric NOT NULL DEFAULT 0,
  spent_on date NOT NULL DEFAULT CURRENT_DATE,
  website_id uuid REFERENCES public.sales_websites(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.sales_courses(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_expenses_date_idx ON public.sales_expenses (spent_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_expenses TO authenticated;
GRANT ALL ON public.sales_expenses TO service_role;
ALTER TABLE public.sales_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY sex_all ON public.sales_expenses FOR ALL TO authenticated USING (public.has_sales_access(auth.uid())) WITH CHECK (public.has_sales_access(auth.uid()));

-- Settings / targets (single row)
CREATE TABLE public.sales_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  gateway_fee_percent numeric NOT NULL DEFAULT 2,
  gateway_fee_gst_percent numeric NOT NULL DEFAULT 18,
  default_tax_percent numeric NOT NULL DEFAULT 0,
  default_unit_cost numeric NOT NULL DEFAULT 0,
  daily_revenue_target numeric NOT NULL DEFAULT 0,
  daily_profit_target numeric NOT NULL DEFAULT 0,
  daily_ad_spend_limit numeric NOT NULL DEFAULT 0,
  daily_sales_target integer NOT NULL DEFAULT 0,
  monthly_revenue_target numeric NOT NULL DEFAULT 0,
  monthly_profit_target numeric NOT NULL DEFAULT 0,
  expense_categories text[] NOT NULL DEFAULT ARRAY['Software','Salaries','Freelancers','Hosting','Content','Design','Marketing','Operations','Miscellaneous','Other'],
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sales_settings TO authenticated;
GRANT ALL ON public.sales_settings TO service_role;
ALTER TABLE public.sales_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY sset_all ON public.sales_settings FOR ALL TO authenticated USING (public.has_sales_access(auth.uid())) WITH CHECK (public.has_sales_access(auth.uid()));
INSERT INTO public.sales_settings (singleton) VALUES (true);

-- Webhook logs
CREATE TABLE public.sales_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text,
  razorpay_event_id text,
  status text NOT NULL DEFAULT 'received',
  message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_webhook_logs_created_idx ON public.sales_webhook_logs (created_at DESC);
CREATE UNIQUE INDEX sales_webhook_logs_event_uniq ON public.sales_webhook_logs (razorpay_event_id) WHERE razorpay_event_id IS NOT NULL;
GRANT SELECT ON public.sales_webhook_logs TO authenticated;
GRANT ALL ON public.sales_webhook_logs TO service_role;
ALTER TABLE public.sales_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY swl_read ON public.sales_webhook_logs FOR SELECT TO authenticated USING (public.has_sales_access(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_sw_upd BEFORE UPDATE ON public.sales_websites FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sc_upd BEFORE UPDATE ON public.sales_courses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sp_upd BEFORE UPDATE ON public.sales_payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sac_upd BEFORE UPDATE ON public.sales_ad_campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sas_upd BEFORE UPDATE ON public.sales_ad_spend FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sex_upd BEFORE UPDATE ON public.sales_expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sset_upd BEFORE UPDATE ON public.sales_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
