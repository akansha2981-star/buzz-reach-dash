import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_PERMS, fetchMyPermissions, type Permissions } from "@/lib/access";

const DEFAULT_PERMS: Permissions = {
  can_dashboard: true, can_colleges: false, can_coaching: false,
  can_meetings: false, can_stages: false, can_users: false, can_logs: false,
};

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  perms: Permissions;
};
const AuthCtx = createContext<Ctx>({
  user: null, session: null, loading: true, isAdmin: false, perms: DEFAULT_PERMS,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState<Permissions>(DEFAULT_PERMS);

  async function loadFor(uid: string) {
    const { data: r } = await supabase
      .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    const admin = !!r;
    setIsAdmin(admin);
    if (admin) setPerms(ADMIN_PERMS);
    else setPerms(await fetchMyPermissions(uid));
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) setTimeout(() => loadFor(s.user.id), 0);
      else { setIsAdmin(false); setPerms(DEFAULT_PERMS); }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) loadFor(data.session.user.id).catch((e) => console.error("loadFor failed", e));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthCtx.Provider value={{ user: session?.user ?? null, session, loading, isAdmin, perms }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
