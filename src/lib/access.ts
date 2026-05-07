import { supabase } from "@/integrations/supabase/client";

export type Permissions = {
  can_dashboard: boolean;
  can_colleges: boolean;
  can_coaching: boolean;
  can_meetings: boolean;
  can_stages: boolean;
  can_users: boolean;
  can_logs: boolean;
};

export const ADMIN_PERMS: Permissions = {
  can_dashboard: true, can_colleges: true, can_coaching: true,
  can_meetings: true, can_stages: true, can_users: true, can_logs: true,
};

export async function fetchMyPermissions(userId: string): Promise<Permissions> {
  const { data } = await supabase.from("user_permissions").select("*").eq("user_id", userId).maybeSingle();
  if (!data) {
    return { can_dashboard: true, can_colleges: true, can_coaching: true, can_meetings: true, can_stages: false, can_users: false, can_logs: false };
  }
  return data as Permissions;
}

export async function logAction(params: {
  action: string;
  entity_type?: string;
  entity_id?: string | null;
  entity_label?: string | null;
  details?: Record<string, unknown>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id ?? null,
    entity_label: params.entity_label ?? null,
    details: (params.details ?? null) as any,
  });
}

export type Meeting = {
  id: string;
  institute_id: string | null;
  title: string;
  description: string | null;
  meeting_at: string;
  duration_minutes: number;
  platform: string;
  meeting_link: string | null;
  attendees: any;
  reminder_minutes: number;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
