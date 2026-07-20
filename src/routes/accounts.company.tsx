import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, IdCard, MapPin, ScrollText, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompanySettings, DEFAULT_COMPANY, type CompanySettings } from "@/lib/company-settings";

export const Route = createFileRoute("/accounts/company")({ component: CompanyPage });

function CompanyPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useCompanySettings();
  const [form, setForm] = useState<CompanySettings>(DEFAULT_COMPANY);

  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async (v: CompanySettings) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not signed in");
      const payload = {
        user_id: uid,
        brand: v.brand || "",
        legal_name: v.legal_name || "",
        cin: v.cin || null,
        pan: v.pan || null,
        tan: v.tan || null,
        gstin: v.gstin || null,
        address: v.address || null,
        email: v.email || null,
        phone: v.phone || null,
        signatory: v.signatory || null,
        terms: v.terms || null,
      };
      const { error } = await supabase
        .from("accounts_company_settings")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Company details saved");
      qc.invalidateQueries({ queryKey: ["accounts_company_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = (k: keyof CompanySettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Company Details
          </h1>
          <p className="text-sm text-muted-foreground">
            Used on every invoice PDF you generate.
          </p>
        </div>
        <Button onClick={() => save.mutate(form)} disabled={save.isPending || isLoading}>
          {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save changes
        </Button>
      </div>

      {/* Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Company Identity</CardTitle>
          <CardDescription>Brand and legal entity shown at the top of the invoice.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Brand name</Label>
            <Input value={form.brand} onChange={patch("brand")} placeholder="B School Buzz" />
          </div>
          <div className="space-y-1.5">
            <Label>Legal name</Label>
            <Input value={form.legal_name} onChange={patch("legal_name")} placeholder="Akaniya Ventures pvt ltd" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Authorized signatory label</Label>
            <Input value={form.signatory ?? ""} onChange={patch("signatory")} placeholder="Authorized Signatory" />
          </div>
        </CardContent>
      </Card>

      {/* Tax / Regulatory IDs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><IdCard className="h-4 w-4 text-primary" /> Regulatory IDs</CardTitle>
          <CardDescription>Printed as a single line under the legal name.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>CIN</Label>
            <Input value={form.cin ?? ""} onChange={patch("cin")} placeholder="U85500UP2025PTC228798" />
          </div>
          <div className="space-y-1.5">
            <Label>PAN</Label>
            <Input value={form.pan ?? ""} onChange={patch("pan")} placeholder="ABDCA3843N" />
          </div>
          <div className="space-y-1.5">
            <Label>TAN</Label>
            <Input value={form.tan ?? ""} onChange={patch("tan")} placeholder="MRTA27234E" />
          </div>
          <div className="space-y-1.5">
            <Label>GSTIN (optional)</Label>
            <Input value={form.gstin ?? ""} onChange={patch("gstin")} placeholder="—" />
          </div>
        </CardContent>
      </Card>

      {/* Address & Contact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Registered Address & Contact</CardTitle>
          <CardDescription>Shown in header and in the "For queries" footer.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Textarea
              rows={3}
              value={form.address ?? ""}
              onChange={patch("address")}
              placeholder="444, Sadar Navada Colony Bareilly Mod, Shahjahanpur — 242001 Uttar Pradesh, India"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={patch("email")} placeholder="admin@bschoolbuzz.in" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone ?? ""} onChange={patch("phone")} placeholder="7668129226" />
          </div>
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ScrollText className="h-4 w-4 text-primary" /> Terms & Conditions</CardTitle>
          <CardDescription>One point per line — each renders as a bullet on the invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={8}
            value={form.terms ?? ""}
            onChange={patch("terms")}
            placeholder={"Payment to be made as per the agreed terms mentioned in the engagement agreement.\nAll payments should be made to the bank account details mentioned above.\nAny disputes regarding this invoice should be raised within 7 days of receipt."}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending || isLoading} size="lg">
          {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
