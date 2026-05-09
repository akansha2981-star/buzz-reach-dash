import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type HRRole = "super_admin" | "hr_admin" | "manager" | "team_leader" | "employee" | "intern";
export type HREmploymentStatus = "active" | "suspended" | "inactive";
export type HRAttendanceStatus = "present" | "absent" | "half_day" | "late" | "wfh" | "holiday" | "leave";
export type HRLeaveStatus = "pending" | "manager_approved" | "approved" | "rejected" | "cancelled";

export type HREmployee = {
  id: string;
  user_id: string | null;
  employee_code: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  department_id: string | null;
  designation: string | null;
  reporting_manager_id: string | null;
  hr_role: HRRole;
  employment_type: string;
  status: HREmploymentStatus;
  joining_date: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  pan_number: string | null;
  aadhaar_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type HRDepartment = { id: string; name: string; description: string | null; head_user_id: string | null };
export type HRLeaveType = { id: string; code: string; name: string; default_quota: number; color: string; requires_doc: boolean; is_paid: boolean; active: boolean };
export type HRAttendance = {
  id: string; employee_id: string; work_date: string;
  clock_in_at: string | null; clock_out_at: string | null;
  total_break_minutes: number; total_work_minutes: number;
  status: HRAttendanceStatus; notes: string | null;
};

export const HR_DOC_CATEGORIES = ["Aadhaar", "PAN", "Offer Letter", "Salary Slip", "Certificate", "Resume", "Other"] as const;
export type HRDocCategory = (typeof HR_DOC_CATEGORIES)[number];

export const HR_ROLES: { value: HRRole; label: string; tone: string }[] = [
  { value: "super_admin", label: "Super Admin", tone: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40" },
  { value: "hr_admin", label: "HR Admin", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40" },
  { value: "manager", label: "Manager", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40" },
  { value: "team_leader", label: "Team Leader", tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40" },
  { value: "employee", label: "Employee", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
  { value: "intern", label: "Intern", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40" },
];

export const HR_BUCKET = "hr-docs";

export function useMyEmployee() {
  return useQuery({
    queryKey: ["hr-me"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<HREmployee | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("hr_employees").select("*").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data as HREmployee | null;
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["hr-departments"],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("hr_departments").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as HRDepartment[];
    },
  });
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ["hr-leave-types"],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("hr_leave_types").select("*").eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []) as HRLeaveType[];
    },
  });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function isHRAdminRole(role?: HRRole | null) {
  return role === "super_admin" || role === "hr_admin";
}

export function isManagerRole(role?: HRRole | null) {
  return role === "manager" || role === "team_leader" || isHRAdminRole(role);
}
