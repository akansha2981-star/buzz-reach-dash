import { splitGst, GST_RATE } from "@/lib/gst";

const f = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

export function GstBox({ applicable, amount, onChange }: { applicable: boolean; amount: number; onChange: (v: boolean) => void }) {
  const s = splitGst(amount, applicable);
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <label className="flex cursor-pointer items-center gap-2 font-medium">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={applicable} onChange={(e) => onChange(e.target.checked)} />
        GST Applicable ({GST_RATE}% included in amount)
      </label>
      {applicable && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div><div className="text-muted-foreground">Base amount</div><div className="font-semibold">{f(s.base)}</div></div>
          <div><div className="text-muted-foreground">GST {GST_RATE}%</div><div className="font-semibold">{f(s.gst)}</div></div>
          <div><div className="text-muted-foreground">Total incl. GST</div><div className="font-semibold">{f(s.total)}</div></div>
        </div>
      )}
    </div>
  );
}