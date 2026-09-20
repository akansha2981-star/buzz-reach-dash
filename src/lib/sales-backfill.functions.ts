import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AnyRec = Record<string, any>;

const toMajor = (paise: unknown) => (typeof paise === "number" ? paise / 100 : 0);

function pick(notes: AnyRec | undefined, keys: string[]): string | null {
  if (!notes) return null;
  for (const k of keys) {
    const v = notes[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

export type BackfillResult = {
  paymentsFetched: number;
  paymentsStored: number;
  refundsFetched: number;
  refundsStored: number;
  from: string;
  to: string;
  truncated: boolean;
  message: string;
};

/**
 * Pulls historical payments + refunds straight from the Razorpay API and
 * upserts them into sales_payments / sales_refunds (idempotent on the
 * Razorpay ids, so re-running never duplicates anything).
 */
export const importRazorpayHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string }) => {
    const from = new Date(`${input.from}T00:00:00`);
    const to = new Date(`${input.to}T23:59:59`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new Error("Invalid date range");
    if (from > to) throw new Error("Start date must be before end date");
    return { from: input.from, to: input.to };
  })
  .handler(async ({ data, context }): Promise<BackfillResult> => {
    const { data: allowed, error: roleErr } = await context.supabase.rpc("has_sales_access", {
      _uid: context.userId,
    });
    if (roleErr || !allowed) throw new Error("You do not have access to the sales tracker");

    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !keySecret) throw new Error("Razorpay API keys are not configured yet");

    const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
    const fromTs = Math.floor(new Date(`${data.from}T00:00:00`).getTime() / 1000);
    const toTs = Math.floor(new Date(`${data.to}T23:59:59`).getTime() / 1000);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin.from("sales_settings").select("*").limit(1).maybeSingle();
    const feePct = Number(settings?.gateway_fee_percent ?? 0);
    const feeGst = Number(settings?.gateway_fee_gst_percent ?? 0);

    const log = async (status: string, message: string) => {
      await supabaseAdmin.from("sales_webhook_logs").insert({
        event_type: "api.backfill", razorpay_event_id: null, status, message, payload: null,
      });
    };

    const fetchAll = async (resource: "payments" | "refunds") => {
      const items: AnyRec[] = [];
      let skip = 0;
      let truncated = false;
      for (let page = 0; page < 60; page++) {
        const url = `https://api.razorpay.com/v1/${resource}?from=${fromTs}&to=${toTs}&count=100&skip=${skip}`;
        const res = await fetch(url, { headers: { Authorization: auth } });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Razorpay ${resource} request failed (${res.status}): ${body.slice(0, 200)}`);
        }
        const json = (await res.json()) as AnyRec;
        const batch: AnyRec[] = json.items ?? [];
        items.push(...batch);
        if (batch.length < 100) return { items, truncated };
        skip += 100;
        if (page === 59) truncated = true;
      }
      return { items, truncated };
    };

    // ---------- caches so repeated lookups stay cheap ----------
    const siteCache = new Map<string, string | null>();
    const courseCache = new Map<string, string | null>();

    const resolveSite = async (ref: string | null) => {
      if (!ref) return null;
      const key = ref.toLowerCase();
      if (siteCache.has(key)) return siteCache.get(key)!;
      const { data: site } = await supabaseAdmin.from("sales_websites").select("id")
        .or(`name.ilike.${ref},domain.ilike.%${ref}%`).limit(1).maybeSingle();
      let id = site?.id ?? null;
      if (!id) {
        const { data: created } = await supabaseAdmin.from("sales_websites").insert({ name: ref }).select("id").single();
        id = created?.id ?? null;
      }
      siteCache.set(key, id);
      return id;
    };

    const resolveCourse = async (name: string | null, code: string | null, websiteId: string | null) => {
      const label = name ?? code;
      if (!label) return null;
      const key = label.toLowerCase();
      if (courseCache.has(key)) return courseCache.get(key)!;
      let id: string | null = null;
      if (code) {
        const { data: c } = await supabaseAdmin.from("sales_courses").select("id").ilike("code", code).limit(1).maybeSingle();
        id = c?.id ?? null;
      }
      if (!id && name) {
        const { data: c } = await supabaseAdmin.from("sales_courses").select("id").ilike("name", name).limit(1).maybeSingle();
        id = c?.id ?? null;
      }
      if (!id) {
        const { data: created } = await supabaseAdmin.from("sales_courses")
          .insert({ name: label, code, website_id: websiteId }).select("id").single();
        id = created?.id ?? null;
      }
      courseCache.set(key, id);
      return id;
    };

    try {
      // ---------------- payments ----------------
      const { items: payments, truncated } = await fetchAll("payments");
      const rows: (AnyRec & { razorpay_payment_id: string })[] = [];
      for (const p of payments) {
        const notes: AnyRec = p.notes ?? {};
        const productName = pick(notes, ["course", "course_name", "product", "product_name"]) ?? p.description ?? null;
        const websiteId = await resolveSite(pick(notes, ["website", "website_id", "site", "source_website"]));
        const courseRef = pick(notes, ["course_id", "course_code", "product_id", "product_code"]);
        const courseId = await resolveCourse(productName, courseRef, websiteId);

        const amount = toMajor(p.amount);
        const fee = typeof p.fee === "number" && p.fee > 0
          ? toMajor(p.fee) + toMajor(p.tax ?? 0)
          : ((amount * feePct) / 100) * (1 + feeGst / 100);
        const isFailed = p.status === "failed";

        rows.push({
          razorpay_payment_id: p.id,
          razorpay_order_id: p.order_id ?? null,
          website_id: websiteId,
          course_id: courseId,
          product_name: productName,
          product_ref: courseRef,
          customer_name: pick(notes, ["name", "customer_name", "full_name"]),
          customer_email: p.email ?? pick(notes, ["email"]),
          customer_phone: p.contact ?? pick(notes, ["phone", "contact"]),
          amount,
          discount: Number(pick(notes, ["discount"]) ?? 0) || 0,
          tax: Number(pick(notes, ["tax", "gst"]) ?? 0) || 0,
          final_amount: amount,
          currency: p.currency ?? "INR",
          payment_method: p.method ?? null,
          status: p.status ?? "captured",
          gateway_fee: isFailed ? 0 : fee,
          refund_amount: toMajor(p.amount_refunded ?? 0),
          refund_status: p.refund_status ?? null,
          coupon_code: pick(notes, ["coupon", "coupon_code", "offer", "offer_code"]),
          utm_source: pick(notes, ["utm_source"]),
          utm_medium: pick(notes, ["utm_medium"]),
          utm_campaign: pick(notes, ["utm_campaign", "campaign"]),
          utm_content: pick(notes, ["utm_content"]),
          utm_term: pick(notes, ["utm_term"]),
          paid_at: p.created_at ? new Date(p.created_at * 1000).toISOString() : new Date().toISOString(),
          raw: p as AnyRec,
        });
      }

      let paymentsStored = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await supabaseAdmin.from("sales_payments").upsert(chunk, { onConflict: "razorpay_payment_id" });
        if (error) throw error;
        paymentsStored += chunk.length;
      }

      // ---------------- refunds ----------------
      const { items: refunds } = await fetchAll("refunds");
      let refundsStored = 0;
      for (const r of refunds) {
        const paymentRef: string | null = r.payment_id ?? null;
        const amount = toMajor(r.amount);
        const { data: pay } = paymentRef
          ? await supabaseAdmin.from("sales_payments").select("id, final_amount")
              .eq("razorpay_payment_id", paymentRef).maybeSingle()
          : { data: null as AnyRec | null };

        const { error } = await supabaseAdmin.from("sales_refunds").upsert({
          razorpay_refund_id: r.id,
          payment_id: pay?.id ?? null,
          razorpay_payment_id: paymentRef,
          amount,
          is_partial: !!pay && amount < Number(pay.final_amount ?? 0),
          reason: r.notes?.reason ?? null,
          refunded_at: r.created_at ? new Date(r.created_at * 1000).toISOString() : new Date().toISOString(),
          raw: r as AnyRec,
        }, { onConflict: "razorpay_refund_id" });
        if (error) throw error;
        refundsStored++;

        if (pay) {
          const { data: all } = await supabaseAdmin.from("sales_refunds").select("amount").eq("payment_id", pay.id);
          const total = (all ?? []).reduce((s: number, x: AnyRec) => s + Number(x.amount ?? 0), 0);
          const full = total >= Number(pay.final_amount ?? 0) - 0.01;
          await supabaseAdmin.from("sales_payments").update({
            refund_amount: total,
            refund_status: full ? "full" : "partial",
            status: full ? "refunded" : "partially_refunded",
          }).eq("id", pay.id);
        }
      }

      const message = `Imported ${paymentsStored} payments and ${refundsStored} refunds from ${data.from} to ${data.to}`;
      await log("processed", message);

      return {
        paymentsFetched: payments.length,
        paymentsStored,
        refundsFetched: refunds.length,
        refundsStored,
        from: data.from,
        to: data.to,
        truncated,
        message,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown import error";
      await log("api_error", `Backfill failed: ${msg}`);
      throw new Error(msg);
    }
  });
