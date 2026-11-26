// TEMPORARY admin-only data export. Remove when the user asks.
import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";

type TableName = keyof Database["public"]["Tables"];

const TABLES = [
  "accounts_bank_accounts","accounts_clients","accounts_company_settings","accounts_expenses","accounts_investments",
  "accounts_invoice_payments","accounts_invoices","accounts_manual_income","accounts_personal_expenses",
  "accounts_recurring_expense_payments","accounts_recurring_expenses","accounts_tds","audit_logs","ceo_desk_notes",
  "ceo_desk_requests","hr_announcement_reads","hr_announcements","hr_attendance","hr_breaks","hr_departments",
  "hr_documents","hr_employees","hr_holidays","hr_leave_balances","hr_leave_requests","hr_leave_types","hr_tasks",
  "hr_work_logs","institute_documents","institute_emails","institute_links","institute_phones","institutes",
  "lms_lead_tags","lms_leads","lms_tag_categories","lms_tags","me_badges","me_categories","me_confidential_apis",
  "me_confidential_documents","me_confidential_passwords","me_focus_sessions","me_goals","me_habit_fields",
  "me_habit_logs","me_habits","me_notifications","me_subtasks","me_task_notes","me_tasks","meetings",
  "outreach_activities","outreach_stages","profiles","sales_ad_campaigns","sales_ad_spend","sales_courses",
  "sales_expenses","sales_payments","sales_refunds","sales_settings","sales_webhook_logs","sales_websites",
  "tasks","user_permissions","user_roles",
] as const satisfies readonly TableName[];

const BUCKETS = ["institute-docs", "hr-docs"];
const PAGE = 1000;

export const Route = createFileRoute("/api/admin/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return Response.json({ error: "Forbidden" }, { status: 403 });
        const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
        if (uErr || !u.user) return Response.json({ error: "Forbidden" }, { status: 403 });
        const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
        if (!isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

        const part = new URL(request.url).searchParams.get("part") ?? "";
        const db = supabaseAdmin as any;
        let body: unknown;
        try {
          if (part === "tables") {
            const out: Record<string, unknown[]> = {};
            for (const t of TABLES) {
              const rows: unknown[] = [];
              for (let from = 0; ; from += PAGE) {
                const { data, error } = await db.from(t).select("*").order("id", { ascending: true }).range(from, from + PAGE - 1);
                if (error) throw new Error(`${t}: ${error.message}`);
                rows.push(...(data ?? []));
                if (!data || data.length < PAGE) break;
              }
              out[t] = rows;
            }
            body = out;
          } else if (part === "users") {
            const users: unknown[] = [];
            for (let page = 1; ; page++) {
              const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
              if (error) throw new Error(error.message);
              for (const x of data.users) users.push({
                id: x.id, email: x.email, phone: x.phone, created_at: x.created_at,
                last_sign_in_at: x.last_sign_in_at, email_confirmed_at: x.email_confirmed_at,
                user_metadata: x.user_metadata, app_metadata: x.app_metadata,
              });
              if (data.users.length < 1000) break;
            }
            body = users;
          } else if (part === "files") {
            const out: Record<string, unknown[]> = {};
            for (const bucket of BUCKETS) {
              const files: any[] = [];
              const walk = async (prefix: string) => {
                for (let offset = 0; ; offset += PAGE) {
                  const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
                  if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
                  for (const item of data ?? []) {
                    const path = prefix ? `${prefix}/${item.name}` : item.name;
                    if (item.id === null) await walk(path);
                    else files.push({ path, size: item.metadata?.size ?? null, content_type: item.metadata?.mimetype ?? null, created_at: item.created_at });
                  }
                  if (!data || data.length < PAGE) break;
                }
              };
              await walk("");
              for (let i = 0; i < files.length; i += 100) {
                const chunk = files.slice(i, i + 100);
                const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrls(chunk.map((f) => f.path), 7200);
                chunk.forEach((f, j) => { f.signed_url = data?.[j]?.signedUrl ?? null; });
              }
              out[bucket] = files;
            }
            body = out;
          } else if (part === "schema") {
            const out: Record<string, number | null> = {};
            for (const t of TABLES) {
              const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
              out[t] = error ? null : count;
            }
            body = out;
          } else {
            return Response.json({ error: "part must be tables, users, files or schema" }, { status: 400 });
          }
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Export failed" }, { status: 500 });
        }
        const date = new Date().toISOString().slice(0, 10);
        return new Response(JSON.stringify(body), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="export-${part}-${date}.json"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
