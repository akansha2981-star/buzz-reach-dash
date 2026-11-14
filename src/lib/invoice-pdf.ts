import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { INVOICE_LOGO_DATA_URL } from "./invoice-logo";


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
  base?: number;
  gst?: number;
  total?: number;
  gst_label?: string;
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

// Brand palette: teal + gold on white (matches brand template)
const C = {
  teal: [23, 182, 190] as [number, number, number],
  tealDark: [12, 137, 145] as [number, number, number],
  gold: [240, 174, 40] as [number, number, number],
  ink: [26, 30, 36] as [number, number, number],
  body: [70, 76, 86] as [number, number, number],
  mute: [130, 136, 146] as [number, number, number],
  panel: [246, 247, 248] as [number, number, number],
  hair: [226, 229, 233] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]!.toUpperCase()).join("");
}

export function buildInvoicePDF(inv: InvoicePDFData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const M = 46;
  const contentW = pageW - M * 2;
  const GAP = 22;
  const colW = (contentW - GAP) / 2;
  const FOOTER_SAFE = 84;

  const currency = inv.currency || "INR";
  const cur = currency === "INR" ? "Rs." : currency;
  const itemsSum = inv.items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const subtotal = inv.base ?? itemsSum;
  const gstAmt = inv.gst ?? 0;
  const grand = inv.total ?? itemsSum;

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

  // ---------- helpers ----------
  const setText = (size: number, color: [number, number, number], bold = false, italic = false) => {
    doc.setFont("helvetica", bold ? "bold" : italic ? "italic" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const wrap = (t: string, w: number): string[] => doc.splitTextToSize(t, w) as string[];
  const ensure = (needed: number, y: number): number => {
    if (y + needed > pageH - FOOTER_SAFE) { doc.addPage(); return M + 6; }
    return y;
  };
  const rule = (y: number, x1 = M, x2 = pageW - M, color = C.teal, w = 1.6) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(w);
    doc.line(x1, y, x2, y);
    doc.setLineWidth(0.5);
  };
  const heading = (label: string, x: number, y: number) => {
    setText(10.5, C.ink, true);
    doc.text(label, x, y);
    return y + 15;
  };

  // ============================== TITLE ==============================
  let y = M + 30;
  setText(30, C.teal, true);
  doc.text("INVOICE", M, y);

  // brand logo (top-right)
  const logoSize = 62;
  try {
    doc.addImage(INVOICE_LOGO_DATA_URL, "PNG", pageW - M - logoSize, y - 42, logoSize, logoSize);
  } catch {
    const lr = 28;
    doc.setFillColor(...C.gold);
    doc.circle(pageW - M - lr, y - 12, lr, "F");
    setText(15, C.white, true);
    doc.text(initials(co.brand), pageW - M - lr, y - 7, { align: "center" });
  }


  y += 26;
  rule(y);
  y += 26;

  // ============================== COMPANY + DETAILS ==============================
  const detailRows: Array<[string, string]> = [
    ["Invoice Number:", inv.invoice_number || "DRAFT"],
    ["Invoice Date:", inv.issue_date],
    ["Due Date:", inv.due_date || "As per agreement"],
    ["Payment Mode:", inv.payment_mode || "Bank Transfer"],
  ];
  if (inv.category) detailRows.push(["Category:", inv.category]);

  // left: company block
  let ly = heading(co.brand, M, y);
  setText(9, C.body, false, true);
  const compLines = [
    ...wrap(co.legal, colW),
    ...wrap(co.address, colW),
    `Phone: ${co.phone}`,
    `Email: ${co.email}`,
  ];
  compLines.forEach((l) => { doc.text(l, M, ly); ly += 12.5; });

  // right: gray details panel
  const rx = M + colW + GAP;
  const panelH = detailRows.length * 17 + 20;
  doc.setFillColor(...C.panel);
  doc.rect(rx, y - 14, colW, panelH, "F");
  let ry = y + 4;
  detailRows.forEach(([k, v]) => {
    setText(9, C.body, false);
    doc.text(k, rx + 14, ry);
    setText(9, C.ink, true);
    doc.text(v, rx + 118, ry, { maxWidth: colW - 132 });
    ry += 17;
  });

  y = Math.max(ly, y - 14 + panelH + 6) + 6;

  // ============================== BILLED TO + IDS/TERMS ==============================
  y = ensure(120, y);
  let by = heading("Billed To", M, y);
  setText(10, C.ink, true);
  const nameLines = wrap(inv.client, colW);
  nameLines.forEach((l) => { doc.text(l, M, by); by += 13; });
  setText(9, C.body, false, true);
  const billLines: string[] = [];
  if (inv.client_location) billLines.push(...wrap(inv.client_location, colW));
  if (inv.client_email) billLines.push(`Email: ${inv.client_email}`);
  if (inv.client_phone) billLines.push(`Phone: ${inv.client_phone}`);
  billLines.forEach((l) => { doc.text(l, M, by); by += 12.5; });

  let cy = heading("Company Identifiers", rx, y);
  setText(8.8, C.body, false);
  wrap(co.ids.replace(/\s*\|\s*/g, "   ·   "), colW).forEach((l) => { doc.text(l, rx, cy); cy += 12 });



  y = Math.max(by, cy) + 6;

  // ============================== ITEMS TABLE ==============================
  y = ensure(120, y);
  rule(y, M, pageW - M, C.teal, 1.6);
  y += 6;

  const bodyRows = inv.items.map((it, idx) => [
    String(idx + 1),
    it.name,
    it.description || "—",
    `${cur} ${fmt(Number(it.amount || 0))}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Items", "Description", "Total"]],
    body: bodyRows,
    theme: "plain",
    rowPageBreak: "avoid",
    styles: { font: "helvetica", cellPadding: { top: 6.5, bottom: 6.5, left: 0, right: 10 } },
    headStyles: {
      textColor: C.ink,
      fontStyle: "bold",
      fontSize: 9.5,
      lineColor: C.hair,
      lineWidth: { top: 0, right: 0, bottom: 0.8, left: 0 },
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: C.body,
      lineColor: C.hair,
      lineWidth: { top: 0, right: 0, bottom: 0.6, left: 0 },
      valign: "top",
    },
    columnStyles: {
      0: { cellWidth: 26, textColor: C.mute },
      1: { cellWidth: 150, fontStyle: "bold", textColor: C.ink },
      2: { cellWidth: "auto" },
      3: { cellWidth: 104, halign: "right", fontStyle: "bold", textColor: C.ink },
    },
    margin: { left: M, right: M, bottom: FOOTER_SAFE },
  });

  // @ts-expect-error jspdf-autotable augments lastAutoTable at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 14;

  // ============================== TOTALS ==============================
  y = ensure(92, y);
  const labelX = pageW - M - 190;
  const valX = pageW - M;

  setText(9.5, C.ink, true);
  doc.text("Subtotal", labelX, y);
  setText(9.5, C.body, false);
  doc.text(`${cur} ${fmt(subtotal)}`, valX, y, { align: "right" });

  y += 20;
  setText(9.5, C.ink, true);
  doc.text(gstAmt > 0 ? (inv.gst_label || "GST @ 18%") : "Tax", labelX, y);
  setText(9.5, C.body, false);
  doc.text(`${cur} ${fmt(gstAmt)}`, valX, y, { align: "right" });

  y += 12;
  rule(y, labelX - 10, valX, C.hair, 0.8);
  y += 20;
  setText(11.5, C.teal, true);
  doc.text("Total Payable", labelX, y);
  doc.text(`${cur} ${fmt(grand)}`, valX, y, { align: "right" });

  // amount in words on the left of totals
  setText(8.5, C.mute, true);
  doc.text("AMOUNT IN WORDS", M, y - 40);
  setText(9.5, C.ink, true);
  const wordLines = wrap(numberToWordsIndian(grand), contentW - 190);
  doc.text(wordLines, M, y - 26, { lineHeightFactor: 1.35 });

  y = Math.max(y, y - 26 + wordLines.length * 12) + 18;

  // ============================== BANK DETAILS + TERMS ==============================
  const bank: InvoiceBank = {
    name: inv.bank?.name || COMPANY.bank.name,
    number: inv.bank?.number || COMPANY.bank.number,
    ifsc: inv.bank?.ifsc || COMPANY.bank.ifsc,
    branch: inv.bank?.branch || COMPANY.bank.branch,
    branchAddress: inv.bank?.branchAddress || COMPANY.bank.branchAddress,
    upi: inv.bank?.upi || null,
    tag: inv.bank?.tag || null,
  };

  const bankPairs: Array<[string, string]> = [
    ["Account Name", bank.name],
    ["Account Number", bank.number],
    ["IFSC Code", bank.ifsc || "—"],
    ["Bank / Branch", bank.branch || "—"],
  ];
  if (bank.upi) bankPairs.push(["UPI ID", bank.upi]);


  const c1 = contentW * 0.42, c2 = contentW * 0.34, c3 = contentW * 0.2;
  const x1 = M, x2 = M + c1 + 10, x3 = pageW - M - c3;

  const termsLines: string[] = [];
  co.terms.forEach((t) => {
    const clean = t.trim().replace(/^\u2022\s*/, "");
    wrap(clean, c2 - 8).forEach((l, i) => termsLines.push(i === 0 ? `\u2022  ${l}` : `    ${l}`));
  });

  // pre-measure wrapped bank values so rows never overlap
  const labelW = 86;
  const valW = c1 - labelW - 8;
  setText(8.8, C.ink, true);
  const bankRows = bankPairs.map(([k, v]) => ({ k, lines: wrap(v, valW) }));
  const bankH = bankRows.reduce((s, r) => s + Math.max(14, r.lines.length * 11.5 + 3), 0);

  const blockH = Math.max(bankH, termsLines.length * 11.5, 74) + 34;
  y = ensure(blockH, y);
  rule(y, M, pageW - M, C.hair, 0.8);
  y += 18;

  let ky = heading(bank.tag ? `Payment Details \u2014 ${bank.tag}` : "Payment Details", x1, y);
  bankRows.forEach(({ k, lines }) => {
    setText(8.5, C.mute, false);
    doc.text(k, x1, ky);
    setText(8.8, C.ink, true);
    lines.forEach((l, i) => doc.text(l, x1 + labelW, ky + i * 11));
    ky += Math.max(14, lines.length * 11 + 3);
  });

  let ty = heading("Terms & Conditions", x2, y);
  setText(8.3, C.body, false);
  termsLines.forEach((l) => { doc.text(l, x2, ty); ty += 11.5; });

  // signature column
  setText(8.5, C.mute, false);
  doc.text(`For ${co.brand}`, pageW - M, y - 1, { align: "right" });
  doc.setDrawColor(...C.hair);
  doc.setLineWidth(0.8);
  doc.line(x3, y + 42, pageW - M, y + 42);
  setText(9, C.ink, true);
  doc.text(co.signatory, pageW - M, y + 54, { align: "right" });
  setText(8, C.mute, false);
  wrap(co.legal, c3).forEach((l, i) => doc.text(l, pageW - M, y + 65 + i * 10, { align: "right" }));

  y = Math.max(ky, ty, y + 66) + 8;

  // ============================== NOTES (own section, just above footer) ==============================
  if (inv.notes) {
    setText(8.2, C.body, false);
    const noteLines = wrap(inv.notes, contentW - 28);
    const noteH = noteLines.length * 10.5 + 30;
    if (y + noteH > pageH - 74) { doc.addPage(); y = M + 6; }
    doc.setFillColor(...C.panel);
    doc.rect(M, y, contentW, noteH - 8, "F");
    doc.setFillColor(...C.teal);
    doc.rect(M, y, 3, noteH - 8, "F");
    setText(9, C.ink, true);
    doc.text("Notes", M + 14, y + 16);
    setText(8.2, C.body, false);
    noteLines.forEach((l, i) => doc.text(l, M + 14, y + 29 + i * 10.5));
    y += noteH + 6;
  }


  // ============================== FOOTERS ==============================
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (p > 1) {
      try { doc.addImage(INVOICE_LOGO_DATA_URL, "PNG", pageW - M - 32, 8, 32, 32); } catch { /* ignore */ }
    }
    // teal baseline band
    doc.setFillColor(...C.teal);
    doc.rect(0, pageH - 14, pageW, 14, "F");

    rule(pageH - 62, M, pageW - M, C.hair, 0.8);
    const fy = pageH - 46;
    setText(8.2, C.ink, true);
    doc.text("Registered Address", M, fy);
    doc.text("Contact", M + contentW / 3, fy);
    doc.text("Invoice", M + (contentW / 3) * 2, fy);
    setText(7.6, C.mute, false);
    doc.text(wrap(co.address, contentW / 3 - 16), M, fy + 11, { lineHeightFactor: 1.3 });
    doc.text([`Phone: ${co.phone}`, `Email: ${co.email}`], M + contentW / 3, fy + 11, { lineHeightFactor: 1.3 });
    doc.text([`${inv.invoice_number || "DRAFT"}`, `Page ${p} of ${pages}`], M + (contentW / 3) * 2, fy + 11, { lineHeightFactor: 1.3 });
  }

  return doc;
}

export function downloadInvoicePDF(inv: InvoicePDFData) {
  const doc = buildInvoicePDF(inv);
  doc.save(`Invoice_${inv.invoice_number || "draft"}.pdf`);
}
