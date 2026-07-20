import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const COMPANY = {
  brand: "B School Buzz",
  legal: "Akaniya Ventures pvt ltd",
  ids: "CIN: U85500UP2025PTC228798 | PAN: ABDCA3843N | TAN: MRTA27234E",
  address: "444, Sadar Navada Colony Bareilly Mod, Shahjahanpur — 242001 Uttar Pradesh, India",
  email: "admin@bschoolbuzz.in",
  phone: "7668129226",
  bank: {
    name: "HARSH SAXENA",
    number: "31780110038147",
    ifsc: "UCBA0003178",
    branch: "UCO Bank",
    branchAddress: "444, Sadar Navada Colony Bareilly Mod, Shahjahanpur — 242001 Uttar Pradesh, India",
  },
};

export type InvoiceItem = { name: string; description?: string; amount: number };

export type InvoicePDFData = {
  invoice_number: string;
  issue_date: string;
  due_date?: string | null;
  payment_mode?: string | null;
  category?: string | null;
  client: string;
  client_location?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  items: InvoiceItem[];
  currency?: string;
  notes?: string | null;
};

// Convert number to words (Indian numbering)
function numberToWordsIndian(num: number): string {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
  };
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let result = "Rupees " + (rupees === 0 ? "Zero" : inWords(rupees));
  if (paise > 0) result += " and " + inWords(paise) + " Paise";
  return result + " Only";
}

export function buildInvoicePDF(inv: InvoicePDFData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(COMPANY.brand, M, y);
  doc.setFontSize(22);
  doc.setTextColor(80, 80, 80);
  doc.text("INVOICE", pageW - M, y, { align: "right" });
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(COMPANY.legal, M, y); y += 12;
  doc.text(COMPANY.ids, M, y); y += 12;
  doc.text(COMPANY.address, M, y, { maxWidth: pageW - M * 2 }); y += 18;

  // Divider
  doc.setDrawColor(220);
  doc.line(M, y, pageW - M, y); y += 20;

  // Billed to / Invoice details
  const colW = (pageW - M * 2) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("BILLED TO", M, y);
  doc.text("INVOICE DETAILS", M + colW, y);
  y += 14;
  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.text(inv.client, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const detailLines = [
    ["Invoice No", inv.invoice_number],
    ["Invoice Date", inv.issue_date],
    ["Due Date", inv.due_date || "As per agreement"],
    ["Payment Mode", inv.payment_mode || "Bank Transfer"],
    ...(inv.category ? [["Category", inv.category] as [string, string]] : []),
    ["Email", COMPANY.email],
    ["Mobile", COMPANY.phone],
  ];
  detailLines.forEach((row, i) => {
    doc.text(`${row[0]}: ${row[1]}`, M + colW, y + i * 12);
  });
  y += 12;
  if (inv.client_location) { doc.text(inv.client_location, M, y); y += 12; }
  if (inv.client_email) { doc.text(inv.client_email, M, y); y += 12; }
  if (inv.client_phone) { doc.text(inv.client_phone, M, y); y += 12; }

  y = Math.max(y, M + 60 + detailLines.length * 12) + 12;

  // Items table
  const currency = inv.currency || "INR";
  const rows = inv.items.map((it, idx) => [
    String(idx + 1),
    it.name,
    it.description || "",
    it.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ]);
  const subtotal = inv.items.reduce((s, i) => s + Number(i.amount || 0), 0);

  autoTable(doc, {
    startY: y,
    head: [["#", "Service Name", "Description", `Amount (${currency})`]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [30, 30, 40], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 8 },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: 140 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 90, halign: "right" },
    },
    margin: { left: M, right: M },
  });

  // @ts-expect-error jspdf-autotable augments lastAutoTable at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 12;

  // Total row
  doc.setFillColor(245, 245, 250);
  doc.rect(M, y, pageW - M * 2, 30, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("Total Payable Amount", M + 10, y + 20);
  doc.text(
    `${currency} ${subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pageW - M - 10, y + 20, { align: "right" }
  );
  y += 44;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Amount in Words: ${numberToWordsIndian(subtotal)}`, M, y, { maxWidth: pageW - M * 2 });
  y += 22;

  // GST declaration
  if (inv.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    const split = doc.splitTextToSize(inv.notes, pageW - M * 2);
    doc.text(split, M, y);
    y += split.length * 11 + 10;
  }

  // Bank details
  if (y > 660) { doc.addPage(); y = M; }
  doc.setDrawColor(220);
  doc.line(M, y, pageW - M, y); y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("BANK DETAILS FOR PAYMENT", M, y); y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Account Name: ${COMPANY.bank.name}`, M, y);
  doc.text(`Branch: ${COMPANY.bank.branch}`, M + colW, y); y += 12;
  doc.text(`Account Number: ${COMPANY.bank.number}`, M, y);
  doc.text(`Branch Address: ${COMPANY.bank.branchAddress}`, M + colW, y, { maxWidth: colW - 10 }); y += 24;
  doc.text(`IFSC Code: ${COMPANY.bank.ifsc}`, M, y); y += 20;

  doc.setFont("helvetica", "bold");
  doc.text(`For ${COMPANY.brand} (${COMPANY.legal})`, M, y); y += 30;
  doc.setFont("helvetica", "normal");
  doc.text("Authorized Signatory", M, y); y += 20;

  // Terms
  if (y > 720) { doc.addPage(); y = M; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TERMS & CONDITIONS", M, y); y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const terms = [
    "• Payment to be made as per the agreed terms mentioned in the engagement agreement.",
    "• All payments should be made to the bank account details mentioned above.",
    "• Any disputes regarding this invoice should be raised within 7 days of receipt.",
  ];
  terms.forEach((t) => { doc.text(t, M, y); y += 12; });
  y += 8;
  doc.setFont("helvetica", "italic");
  doc.setTextColor(80);
  doc.text("Thank you for your business!", M, y); y += 12;
  doc.text(`For queries, contact: ${COMPANY.email} | ${COMPANY.phone}`, M, y); y += 12;
  doc.setTextColor(140);
  doc.text("This is a system-generated invoice; no signature is required.", M, y);

  return doc;
}

export function downloadInvoicePDF(inv: InvoicePDFData) {
  const doc = buildInvoicePDF(inv);
  doc.save(`Invoice_${inv.invoice_number || "draft"}.pdf`);
}
