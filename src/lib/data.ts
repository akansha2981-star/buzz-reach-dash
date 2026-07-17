import { supabase } from "@/integrations/supabase/client";

export type InstituteType = "college" | "coaching";

export type Stage = {
  id: string;
  name: string;
  position: number;
  color: string;
};

export type Institute = {
  id: string;
  type: InstituteType;
  name: string;
  city: string | null;
  state: string | null;
  website: string | null;
  contact_person: string | null;
  contact_designation: string | null;
  current_stage_id: string | null;
  notes: string | null;
  next_meeting_at: string | null;
  priority: number | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export async function fetchStages(): Promise<Stage[]> {
  const { data, error } = await supabase.from("outreach_stages").select("*").order("position");
  if (error) throw error;
  return data as Stage[];
}

export async function fetchInstitutes(type: InstituteType): Promise<Institute[]> {
  const { data, error } = await supabase
    .from("institutes")
    .select("*")
    .eq("type", type)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Institute[];
}

export async function fetchInstitute(id: string) {
  const [{ data: inst, error: e1 }, { data: emails, error: e2 }, { data: phones, error: e3 }, { data: activities, error: e4 }] = await Promise.all([
    supabase.from("institutes").select("*").eq("id", id).maybeSingle(),
    supabase.from("institute_emails").select("*").eq("institute_id", id),
    supabase.from("institute_phones").select("*").eq("institute_id", id),
    supabase.from("outreach_activities").select("*").eq("institute_id", id).order("created_at", { ascending: false }),
  ]);
  if (e1 || e2 || e3 || e4) throw e1 || e2 || e3 || e4;
  return { institute: inst as Institute | null, emails: emails ?? [], phones: phones ?? [], activities: activities ?? [] };
}
