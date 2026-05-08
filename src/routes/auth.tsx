import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, ArrowRight, ShieldCheck, Sparkles, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import heroImg from "@/assets/auth-hero.jpg";

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
      {/* Ambient background gradients */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.35), transparent)" }} />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, oklch(0.78 0.14 320 / 0.35), transparent)" }} />
      </div>

      {/* Left: visual panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 lg:flex">
        <div
          className="absolute inset-4 rounded-3xl bg-cover bg-center shadow-2xl ring-1 ring-border/50"
          style={{ backgroundImage: `url(${heroImg})` }}
        />
        <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-background/0 via-background/10 to-background/40" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg backdrop-blur"
            style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold tracking-tight text-foreground">Works</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">by B School Buzz</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Outreach OS</p>
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground">
            Run every college <br /> conversation in one place.
          </h2>
          <p className="text-sm text-muted-foreground">
            Pipelines, meetings, notes and team activity — designed for the B School Buzz outreach team.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-md"
              style={{ background: "var(--gradient-primary)" }}>
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-xl font-semibold tracking-tight">Works</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">by B School Buzz</p>
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-7 space-y-1.5">
              <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to continue to your outreach workspace.</p>
            </div>

            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" required autoComplete="email" placeholder="you@bschoolbuzz.com"
                    className="h-11 rounded-xl pl-10"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type={showPwd ? "text" : "password"} required autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 rounded-xl pl-10 pr-10"
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPwd((s) => !s)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={busy}
                className="group h-11 w-full rounded-xl text-sm font-semibold shadow-lg"
                style={{ background: "var(--gradient-primary)" }}>
                {busy ? "Signing in…" : (<>Sign in <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>)}
              </Button>
            </form>

            <div className="mt-6 flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                Accounts are issued by your administrator. Contact your admin if you need access.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Works · B School Buzz
          </p>
        </div>
      </div>
    </div>
  );
}
