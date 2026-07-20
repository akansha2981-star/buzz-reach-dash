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

export type InvoiceBank = {
  name: string;
  number: string;
  ifsc?: string | null;
  branch?: string | null;
  branchAddress?: string | null;
  upi?: string | null;
  tag?: string | null;
};

export type InvoiceCompanyOverride = {
  brand?: string;
  legal?: string;
  ids?: string;
  address?: string;
  email?: string;
  phone?: string;
  signatory?: string;
  terms?: string[];
};

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
  bank?: InvoiceBank | null;
  company?: InvoiceCompanyOverride | null;
};


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

// Palette matched to reference PDF: navy + gold on white
const C = {
  navy: [15, 36, 71] as [number, number, number],       // #0F2447
  gold: [232, 184, 58] as [number, number, number],     // #E8B83A
  ink: [30, 30, 30] as [number, number, number],
  mute: [90, 90, 95] as [number, number, number],
  hair: [220, 220, 224] as [number, number, number],
  totalBg: [239, 239, 240] as [number, number, number],
};

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildInvoicePDF(inv: InvoicePDFData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const contentW = pageW - M * 2;
  const currency = inv.currency || "INR";
  const subtotal = inv.items.reduce((s, i) => s + Number(i.amount || 0), 0);

  // ============ HEADER (white bg) ============
  const co = {
    brand: inv.company?.brand || COMPANY.brand,
    legal: inv.company?.legal || COMPANY.legal,
    ids: inv.company?.ids || COMPANY.ids,
    address: inv.company?.address || COMPANY.address,
    email: inv.company?.email || COMPANY.email,
    phone: inv.company?.phone || COMPANY.phone,
    signatory: inv.company?.signatory || "Authorized Signatory",
    terms: inv.company?.terms && inv.company.terms.length ? inv.company.terms : [
      "Payment to be made as per the agreed terms mentioned in the engagement agreement.",
      "All payments should be made to the bank account details mentioned above.",
      "Any disputes regarding this invoice should be raised within 7 days of receipt.",
    ],
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...C.navy);
  doc.text(co.brand, M, M + 10);

  doc.setFontSize(22);
  doc.setTextColor(...C.gold);
  doc.text("INVOICE", pageW - M, M + 8, { align: "right" });

  // Legal + IDs + address
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.navy);
  doc.text(co.legal, M, M + 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.ink);
  doc.text(co.ids, M, M + 44);
  const addrLines = doc.splitTextToSize(co.address, contentW);
  doc.text(addrLines, M, M + 58);


  // Gold divider
  let y = M + 80;
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(1);
  doc.line(M, y, pageW - M, y);
  doc.setLineWidth(0.2);

  y += 22;

  // ============ BILLED TO / INVOICE DETAILS ============
  const colW = contentW / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.navy);
  doc.text("BILLED TO", M, y);
  doc.text("INVOICE DETAILS", M + colW, y);

  let ly = y + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  doc.text(inv.client, M, ly);
  ly += 14;
  if (inv.client_location) { doc.text(inv.client_location, M, ly, { maxWidth: colW - 12 }); ly += 14; }
  if (inv.client_email) { doc.text(`Email: ${inv.client_email}`, M, ly); ly += 14; }
  if (inv.client_phone) { doc.text(`Mobile: ${inv.client_phone}`, M, ly); ly += 14; }

  // Right: labeled details, key normal + value bold
  const rows: Array<[string, string, boolean]> = [
    ["Invoice No: ", inv.invoice_number, true],
    ["Invoice Date: ", inv.issue_date, false],
    ["Due Date: ", inv.due_date || "As per agreement", false],
    ["Payment Mode: ", inv.payment_mode || "Bank Transfer", false],
  ];
  if (inv.category) rows.push(["Category: ", inv.category, false]);
  if (inv.client_email) rows.push(["Email: ", inv.client_email, false]);
  if (inv.client_phone) rows.push(["Mobile: ", inv.client_phone, false]);

  let ry = y + 16;
  rows.forEach(([k, v, bold]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.ink);
    doc.text(k, M + colW, ry);
    const kw = doc.getTextWidth(k);
    if (bold) { doc.setFont("helvetica", "bold"); doc.setTextColor(...C.navy); }
    doc.text(v, M + colW + kw, ry);
    ry += 14;
  });

  y = Math.max(ly, ry) + 14;

  // ============ ITEMS TABLE ============
  const bodyRows = inv.items.map((it, idx) => [
    String(idx + 1),
    it.name,
    it.description || "",
    fmt(Number(it.amount || 0)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Service Name", "Description", `Amount (${currency})`]],
    body: bodyRows,
    theme: "plain",
    headStyles: {
      fillColor: C.navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: 10,
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 10,
      textColor: C.ink,
    },
    columnStyles: {
      0: { cellWidth: 32, halign: "left" },
      1: { cellWidth: 130 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 110, halign: "right" },
    },
    margin: { left: M, right: M },
  });

  // @ts-expect-error jspdf-autotable augments lastAutoTable at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 6;

  // ============ TOTAL PAYABLE (gray band, full width) ============
  const totalH = 30;
  doc.setFillColor(...C.totalBg);
  doc.rect(M, y, contentW, totalH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.navy);
  doc.text("Total Payable Amount", M + 10, y + 19);

  // small navy square
  doc.setFillColor(...C.navy);
  doc.rect(pageW - M - 100, y + 10, 9, 9, "F");
  doc.setFontSize(13);
  doc.setTextColor(...C.ink);
  doc.text(fmt(subtotal), pageW - M - 10, y + 19, { align: "right" });

  y += totalH + 16;

  // Amount in words
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  doc.text(`Amount in Words: ${numberToWordsIndian(subtotal)}`, M, y);
  y += 20;

  // ============ NOTES / DECLARATION ============
  if (inv.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.ink);
    const nl = doc.splitTextToSize(inv.notes, contentW);
    doc.text(nl, M, y);
    y += nl.length * 12 + 12;
  }

  // Page break guard
  if (y > pageH - 260) { doc.addPage(); y = M; }

  // ============ BANK DETAILS FOR PAYMENT ============
  const bank: InvoiceBank = {
    name: inv.bank?.name || COMPANY.bank.name,
    number: inv.bank?.number || COMPANY.bank.number,
    ifsc: inv.bank?.ifsc || COMPANY.bank.ifsc,
    branch: inv.bank?.branch || COMPANY.bank.branch,
    branchAddress: inv.bank?.branchAddress || COMPANY.bank.branchAddress,
    upi: inv.bank?.upi || null,
    tag: inv.bank?.tag || null,
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.navy);
  doc.text(bank.tag ? `BANK DETAILS FOR PAYMENT — ${bank.tag.toUpperCase()}` : "BANK DETAILS FOR PAYMENT", M, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);

  const leftCol: string[] = [
    `Account Name: ${bank.name}`,
    `Account Number: ${bank.number}`,
    `IFSC Code: ${bank.ifsc || "—"}`,
  ];
  if (bank.upi) leftCol.push(`UPI ID: ${bank.upi}`);

  const rightCol: string[] = [`Branch: ${bank.branch || "—"}`];
  if (bank.branchAddress) {
    const brLines = doc.splitTextToSize(`Branch Address: ${bank.branchAddress}`, colW - 12);
    rightCol.push(...brLines);
  }

  const startY = y;
  leftCol.forEach((line, i) => doc.text(line, M, startY + i * 14));
  rightCol.forEach((line, i) => doc.text(line, M + colW, startY + i * 14));

  y = startY + Math.max(leftCol.length, rightCol.length) * 14 + 20;

  // ============ SIGNATORY ============
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  doc.text(`For ${co.brand} (${co.legal})`, M, y);
  y += 40;
  doc.text(co.signatory, M, y);

  y += 14;

  // Thin gray divider
  doc.setDrawColor(...C.hair);
  doc.line(M, y, pageW - M, y);
  y += 16;

  // ============ TERMS & CONDITIONS ============
  if (y > pageH - 120) { doc.addPage(); y = M; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.navy);
  doc.text("TERMS & CONDITIONS", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  const terms = co.terms.map((t) => (t.trim().startsWith("•") ? t : `• ${t.trim()}`));
  terms.forEach((t) => {
    const wrapped = doc.splitTextToSize(t, contentW);
    wrapped.forEach((line: string) => { doc.text(line, M, y); y += 13; });
  });


  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  doc.text("Thank you for your business!", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.ink);
  doc.text(`For queries, contact: ${COMPANY.email} | ${COMPANY.phone}`, M, y);
  y += 13;
  doc.text("This is a system-generated invoice; no signature is required.", M, y);

  return doc;
}

export function downloadInvoicePDF(inv: InvoicePDFData) {
  const doc = buildInvoicePDF(inv);
  doc.save(`Invoice_${inv.invoice_number || "draft"}.pdf`);
}
