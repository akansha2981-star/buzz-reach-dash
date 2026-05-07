import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => {
        // Idempotent: only create if no admin exists
        const { data: existing } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("role", "admin")
          .limit(1);
        if (existing && existing.length > 0) {
          return Response.json({ created: false, message: "Admin already exists" });
        }

        const email = "admin@bschoolbuzz.com";
        const password = "Admin@12345";

        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: "Admin" },
        });
        if (error || !created.user) {
          return new Response(JSON.stringify({ error: error?.message ?? "Failed" }), { status: 500 });
        }

        await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
        return Response.json({ created: true, email });
      },
    },
  },
});
