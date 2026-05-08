import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Sparkles, Users, Calendar, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
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
    <div className="relative flex min-h-screen w-full overflow-hidden bg-background">
      {/* Subtle ambient gradient */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.4), transparent)" }} />
        <div className="absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.35), transparent)" }} />
      </div>

      {/* Left: brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between border-r border-border/60 bg-card/40 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl overflow-hidden bg-white shadow-md">
            <img src={logo} alt="Works by B School Buzz" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-xl font-semibold tracking-tight">Works</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">by B School Buzz</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Outreach Workspace</p>
            <h2 className="font-display text-4xl font-bold leading-[1.1] tracking-tight">
              The operating system for your outreach team.
            </h2>
            <p className="text-sm text-muted-foreground">
              Pipelines, meetings, notes and team activity — built for the way B School Buzz works with colleges and coaching partners.
            </p>
          </div>

          <ul className="space-y-3 text-sm">
            {[
              { Icon: Users, label: "Manage colleges & coaching pipelines" },
              { Icon: Calendar, label: "Plan meetings and follow-ups" },
              { Icon: BarChart3, label: "Track every activity in real time" },
            ].map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
                  <Icon className="h-4 w-4 text-primary" />
                </span>
                <span className="text-foreground/80">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} B School Buzz. All rights reserved.</p>
      </div>

      {/* Right: form */}
      <div className="flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-[54%]">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden bg-white shadow-md">
              <img src={logo} alt="Works by B School Buzz" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-xl font-semibold tracking-tight">Works</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">by B School Buzz</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mb-7 space-y-1.5">
              <h1 className="font-display text-2xl font-bold tracking-tight">Sign in to your workspace</h1>
              <p className="text-sm text-muted-foreground">Enter the credentials provided by your administrator.</p>
            </div>

            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" required autoComplete="email" placeholder="you@bschoolbuzz.com"
                    className="h-11 rounded-lg pl-10"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type={showPwd ? "text" : "password"} required autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 rounded-lg pl-10 pr-10"
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPwd((s) => !s)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={busy}
                className="group h-11 w-full rounded-lg text-sm font-semibold shadow-md"
                style={{ background: "var(--gradient-primary)" }}>
                {busy ? "Signing in…" : (<>Sign in <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>)}
              </Button>
            </form>

            <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                Accounts are issued by your administrator. Contact your admin if you need access.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
            © {new Date().getFullYear()} B School Buzz
          </p>
        </div>
      </div>
    </div>
  );
}
