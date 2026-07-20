import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CompanySettings = {
  id?: string;
  brand: string;
  legal_name: string;
  cin: string | null;
  pan: string | null;
  tan: string | null;
  gstin: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  signatory: string | null;
  terms: string | null;
};

export const DEFAULT_COMPANY: CompanySettings = {
  brand: "B School Buzz",
  legal_name: "Akaniya Ventures pvt ltd",
  cin: "U85500UP2025PTC228798",
  pan: "ABDCA3843N",
  tan: "MRTA27234E",
  gstin: null,
  address: "444, Sadar Navada Colony Bareilly Mod, Shahjahanpur — 242001 Uttar Pradesh, India",
  email: "admin@bschoolbuzz.in",
  phone: "7668129226",
  signatory: "Authorized Signatory",
  terms: [
    "Payment to be made as per the agreed terms mentioned in the engagement agreement.",
    "All payments should be made to the bank account details mentioned above.",
    "Any disputes regarding this invoice should be raised within 7 days of receipt.",
  ].join("\n"),
};

export function buildIdString(c: CompanySettings): string {
  const parts: string[] = [];
  if (c.cin) parts.push(`CIN: ${c.cin}`);
  if (c.pan) parts.push(`PAN: ${c.pan}`);
  if (c.tan) parts.push(`TAN: ${c.tan}`);
  if (c.gstin) parts.push(`GSTIN: ${c.gstin}`);
  return parts.join(" | ");
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ["accounts_company_settings"],
    staleTime: 60_000,
    queryFn: async (): Promise<CompanySettings> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return DEFAULT_COMPANY;
      const { data } = await supabase
        .from("accounts_company_settings")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (!data) return DEFAULT_COMPANY;
      return {
        id: data.id,
        brand: data.brand || DEFAULT_COMPANY.brand,
        legal_name: data.legal_name || DEFAULT_COMPANY.legal_name,
        cin: data.cin,
        pan: data.pan,
        tan: data.tan,
        gstin: data.gstin,
        address: data.address,
        email: data.email,
        phone: data.phone,
        signatory: data.signatory || "Authorized Signatory",
        terms: data.terms,
      };
    },
  });
}
