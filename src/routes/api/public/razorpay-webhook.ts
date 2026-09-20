import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

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

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        const body = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const eventId = request.headers.get("x-razorpay-event-id") ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const log = async (status: string, message: string, eventType?: string, payload?: unknown) => {
          await supabaseAdmin.from("sales_webhook_logs").insert({
            event_type: eventType ?? null,
            razorpay_event_id: status === "received" ? eventId : null,
            status,
            message,
            payload: (payload ?? null) as AnyRec,
          });
        };

        if (!secret) {
          await log("integration_error", "RAZORPAY_WEBHOOK_SECRET is not configured");
          return new Response("Not configured", { status: 500 });
        }

        // ---- Verify signature over the RAW body ----
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          await log("api_error", "Invalid webhook signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let evt: AnyRec;
        try {
          evt = JSON.parse(body);
        } catch {
          await log("api_error", "Malformed JSON payload");
          return new Response("Bad request", { status: 400 });
        }

        const eventType: string = evt.event ?? "unknown";

        // ---- Idempotency on the Razorpay event id ----
        if (eventId) {
          const { error: dupErr } = await supabaseAdmin
            .from("sales_webhook_logs")
            .insert({ event_type: eventType, razorpay_event_id: eventId, status: "received", message: "Webhook received", payload: evt as AnyRec });
          if (dupErr) {
            // Unique violation => already processed
            return Response.json({ ok: true, duplicate: true });
          }
        } else {
          await log("received", "Webhook received (no event id)", eventType, evt);
        }

        try {
          const { data: settings } = await supabaseAdmin
            .from("sales_settings").select("*").limit(1).maybeSingle();
          const feePct = Number(settings?.gateway_fee_percent ?? 0);
          const feeGst = Number(settings?.gateway_fee_gst_percent ?? 0);

          const resolveRefs = async (notes: AnyRec | undefined, productName: string | null) => {
            let websiteId: string | null = null;
            let courseId: string | null = null;

            const siteRef = pick(notes, ["website", "website_id", "site", "source_website"]);
            if (siteRef) {
              const { data: site } = await supabaseAdmin
                .from("sales_websites").select("id").or(`name.ilike.${siteRef},domain.ilike.%${siteRef}%`).limit(1).maybeSingle();
              if (site) websiteId = site.id;
              else {
                const { data: created } = await supabaseAdmin
                  .from("sales_websites").insert({ name: siteRef }).select("id").single();
                websiteId = created?.id ?? null;
              }
            }

            const courseRef = pick(notes, ["course_id", "course_code", "product_id", "product_code"]);
            const courseName = pick(notes, ["course", "course_name", "product", "product_name"]) ?? productName;
            if (courseRef) {
              const { data: c } = await supabaseAdmin
                .from("sales_courses").select("id").or(`code.ilike.${courseRef},id.eq.${courseRef}`).limit(1).maybeSingle();
              if (c) courseId = c.id;
            }
            if (!courseId && courseName) {
              const { data: c } = await supabaseAdmin
                .from("sales_courses").select("id").ilike("name", courseName).limit(1).maybeSingle();
              if (c) courseId = c.id;
              else {
                const { data: created } = await supabaseAdmin
                  .from("sales_courses")
                  .insert({ name: courseName, code: courseRef, website_id: websiteId })
                  .select("id").single();
                courseId = created?.id ?? null;
              }
            }
            return { websiteId, courseId, courseName };
          };

          if (eventType === "payment.captured" || eventType === "payment.authorized" || eventType === "payment.failed") {
            const p: AnyRec = evt.payload?.payment?.entity ?? {};
            const notes: AnyRec = p.notes ?? {};
            const productName = pick(notes, ["course", "course_name", "product", "product_name"]) ?? p.description ?? null;
            const { websiteId, courseId } = await resolveRefs(notes, productName);

            const amount = toMajor(p.amount);
            const tax = Number(pick(notes, ["tax", "gst"]) ?? 0) || 0;
            const discount = Number(pick(notes, ["discount"]) ?? 0) || 0;
            const fee = typeof p.fee === "number" && p.fee > 0
              ? toMajor(p.fee) + toMajor(p.tax ?? 0)
              : (amount * feePct) / 100 * (1 + feeGst / 100);

            const row = {
              razorpay_payment_id: p.id,
              razorpay_order_id: p.order_id ?? null,
              website_id: websiteId,
              course_id: courseId,
              product_name: productName,
              product_ref: pick(notes, ["course_id", "product_id", "course_code"]),
              customer_name: pick(notes, ["name", "customer_name", "full_name"]),
              customer_email: p.email ?? pick(notes, ["email"]),
              customer_phone: p.contact ?? pick(notes, ["phone", "contact"]),
              amount,
              discount,
              tax,
              final_amount: amount,
              currency: p.currency ?? "INR",
              payment_method: p.method ?? null,
              status: eventType === "payment.failed" ? "failed" : (p.status ?? "captured"),
              gateway_fee: eventType === "payment.failed" ? 0 : fee,
              coupon_code: pick(notes, ["coupon", "coupon_code", "offer", "offer_code"]),
              utm_source: pick(notes, ["utm_source"]),
              utm_medium: pick(notes, ["utm_medium"]),
              utm_campaign: pick(notes, ["utm_campaign", "campaign"]),
              utm_content: pick(notes, ["utm_content"]),
              utm_term: pick(notes, ["utm_term"]),
              paid_at: p.created_at ? new Date(p.created_at * 1000).toISOString() : new Date().toISOString(),
              raw: p as AnyRec,
            };

            const { error } = await supabaseAdmin
              .from("sales_payments")
              .upsert(row, { onConflict: "razorpay_payment_id" });
            if (error) throw error;

            await log("payment_created", `${eventType} stored for ${p.id}`, eventType);
            return Response.json({ ok: true });
          }

          if (eventType.startsWith("refund.")) {
            const r: AnyRec = evt.payload?.refund?.entity ?? {};
            const paymentRef: string | null = r.payment_id ?? null;
            const amount = toMajor(r.amount);

            const { data: pay } = paymentRef
              ? await supabaseAdmin.from("sales_payments").select("id, final_amount, refund_amount")
                  .eq("razorpay_payment_id", paymentRef).maybeSingle()
              : { data: null as AnyRec | null };

            const { error: refErr } = await supabaseAdmin.from("sales_refunds").upsert({
              razorpay_refund_id: r.id,
              payment_id: pay?.id ?? null,
              razorpay_payment_id: paymentRef,
              amount,
              is_partial: !!pay && amount < Number(pay.final_amount ?? 0),
              reason: r.notes?.reason ?? r.speed_processed ?? null,
              refunded_at: r.created_at ? new Date(r.created_at * 1000).toISOString() : new Date().toISOString(),
              raw: r as AnyRec,
            }, { onConflict: "razorpay_refund_id" });
            if (refErr) throw refErr;

            if (pay) {
              const { data: allRefunds } = await supabaseAdmin
                .from("sales_refunds").select("amount").eq("payment_id", pay.id);
              const total = (allRefunds ?? []).reduce((s: number, x: AnyRec) => s + Number(x.amount ?? 0), 0);
              const full = total >= Number(pay.final_amount ?? 0) - 0.01;
              await supabaseAdmin.from("sales_payments").update({
                refund_amount: total,
                refund_status: full ? "full" : "partial",
                status: full ? "refunded" : "partially_refunded",
              }).eq("id", pay.id);
            }

            await log("refund_received", `${eventType} stored for ${r.id}`, eventType);
            return Response.json({ ok: true });
          }

          await log("processed", `Ignored event ${eventType}`, eventType);
          return Response.json({ ok: true, ignored: eventType });
        } catch (e) {
          await log("integration_error", e instanceof Error ? e.message : "Unknown processing error", eventType);
          return new Response("Processing error", { status: 500 });
        }
      },
    },
  },
});
