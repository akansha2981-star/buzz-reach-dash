import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PERM_KEYS = ["can_dashboard","can_colleges","can_coaching","can_meetings","can_stages","can_users","can_logs"] as const;
type PermKey = typeof PERM_KEYS[number];
type Perms = Record<PermKey, boolean>;

const permsSchema = z.object({
  can_dashboard: z.boolean(),
  can_colleges: z.boolean(),
  can_coaching: z.boolean(),
  can_meetings: z.boolean(),
  can_stages: z.boolean(),
  can_users: z.boolean(),
  can_logs: z.boolean(),
});

const adminAllPerms: Perms = {
  can_dashboard: true, can_colleges: true, can_coaching: true,
  can_meetings: true, can_stages: true, can_users: true, can_logs: true,
};

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin access required");
}

async function logServer(actorId: string, actorEmail: string | null, action: string, entity_type?: string, entity_id?: string | null, entity_label?: string | null, details?: Record<string, unknown>) {
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId, actor_email: actorEmail, action,
    entity_type: entity_type ?? null, entity_id: entity_id ?? null,
    entity_label: entity_label ?? null, details: (details ?? null) as any,
  });
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: permsList } = await supabaseAdmin.from("user_permissions").select("*");
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    const permMap = new Map<string, Perms>();
    (permsList ?? []).forEach((p: any) => permMap.set(p.user_id, p));
    return list.users.map((u) => {
      const isAdmin = (roleMap.get(u.id) ?? []).includes("admin");
      return {
        id: u.id,
        email: u.email,
        full_name: (u.user_metadata as any)?.full_name ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: roleMap.get(u.id) ?? [],
        permissions: isAdmin ? adminAllPerms : (permMap.get(u.id) ?? {
          can_dashboard: true, can_colleges: false, can_coaching: false,
          can_meetings: false, can_stages: false, can_users: false, can_logs: false,
        }),
      };
    });
  });

const createSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  full_name: z.string().min(1).max(100),
  role: z.enum(["admin", "user"]),
  permissions: permsSchema,
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Create failed");
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    await supabaseAdmin.from("user_permissions").insert({
      user_id: created.user.id, ...(data.role === "admin" ? adminAllPerms : data.permissions),
    });
    await logServer(context.userId, context.claims?.email ?? null, "user.created", "user", created.user.id, data.email, { role: data.role });
    return { id: created.user.id };
  });

const updateSchema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(6).max(72).optional(),
  full_name: z.string().min(1).max(100).optional(),
  role: z.enum(["admin", "user"]).optional(),
  permissions: permsSchema.optional(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const updates: any = {};
    if (data.password) updates.password = data.password;
    if (data.full_name) updates.user_metadata = { full_name: data.full_name };
    if (Object.keys(updates).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, updates);
      if (error) throw new Error(error.message);
    }
    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    }
    if (data.permissions || data.role) {
      const finalPerms = data.role === "admin" ? adminAllPerms : (data.permissions ?? null);
      if (finalPerms) {
        await supabaseAdmin.from("user_permissions").upsert({ user_id: data.user_id, ...finalPerms });
      }
    }
    await logServer(context.userId, context.claims?.email ?? null, "user.updated", "user", data.user_id, null, {
      changed_password: !!data.password, role: data.role, permissions_updated: !!data.permissions,
    });
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Cannot delete yourself");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    await logServer(context.userId, context.claims?.email ?? null, "user.deleted", "user", data.user_id);
    return { ok: true };
  });
