import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { buildInvoicePDF, type InvoicePDFData } from "@/lib/invoice-pdf";

export function InvoicePreviewDialog({
  open, onOpenChange, invoice,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: InvoicePDFData | null;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invoice) { setUrl(null); return; }
    const doc = buildInvoicePDF(invoice);
    const blob = doc.output("blob");
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [open, invoice]);

  const filename = `Invoice_${invoice?.invoice_number || "draft"}.pdf`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-sm">
            Preview — {invoice?.invoice_number ? `#${invoice.invoice_number}` : "Invoice"}
            {invoice?.client && <span className="text-muted-foreground font-normal"> · {invoice.client}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 bg-muted">
          {url ? (
            <iframe src={url} title="Invoice preview" className="w-full h-full border-0" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Generating preview…</div>
          )}
        </div>
        <DialogFooter className="px-4 py-3 border-t gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={() => url && window.open(url, "_blank", "noopener")} disabled={!url}>
            <ExternalLink className="h-4 w-4 mr-1" />Open in new tab
          </Button>
          <Button
            onClick={() => {
              if (!invoice) return;
              const doc = buildInvoicePDF(invoice);
              doc.save(filename);
            }}
            disabled={!invoice}
          >
            <Download className="h-4 w-4 mr-1" />Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
