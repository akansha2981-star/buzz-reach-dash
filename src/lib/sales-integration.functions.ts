import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reports whether the Razorpay secrets are present on the server. Never returns key material. */
export const getRazorpayHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"];
    return {
      keyIdConfigured: !!keyId,
      keySecretConfigured: !!keySecret,
      webhookSecretConfigured: !!webhookSecret,
      keyIdMasked: keyId ? `${keyId.slice(0, 8)}••••` : null,
      mode: keyId?.startsWith("rzp_live") ? "live" : keyId ? "test" : "unconfigured",
    };
  });
