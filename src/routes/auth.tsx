import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold">Works</h1>
          <p className="text-sm text-muted-foreground">by B School Buzz · Outreach Dashboard</p>
        </div>
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use the credentials provided by your admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={signIn} className="space-y-4">
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</Button>
            </form>
            <p className="mt-6 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Accounts are created by an admin. Contact your administrator if you don't have access.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
