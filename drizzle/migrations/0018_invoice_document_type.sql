ALTER TABLE public.accounts_invoices ADD COLUMN invoice_type text;
ALTER TABLE public.accounts_invoices ADD CONSTRAINT accounts_invoices_invoice_type_check CHECK (invoice_type IN ('tax', 'proforma'));
COMMENT ON COLUMN public.accounts_invoices.invoice_type IS 'Tax or proforma invoice. NULL means an older invoice awaits classification; only tax invoices contribute to invoice GST collection.';