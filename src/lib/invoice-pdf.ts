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

// Brand palette: navy + gold on white
const C = {
  navy: [15, 36, 71] as [number, number, number],
  navySoft: [237, 240, 246] as [number, number, number],
  gold: [232, 184, 58] as [number, number, number],
  goldSoft: [253, 248, 234] as [number, number, number],
  ink: [33, 37, 45] as [number, number, number],
  mute: [110, 116, 128] as [number, number, number],
  hair: [223, 226, 232] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildInvoicePDF(inv: InvoicePDFData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const M = 42;                       // page margin
  const contentW = pageW - M * 2;
  const GAP = 16;                     // gutter between columns
  const colW = (contentW - GAP) / 2;
  const FOOTER_SAFE = 66;             // reserved bottom space for footer

  const currency = inv.currency || "INR";
  const subtotal = inv.items.reduce((s, i) => s + Number(i.amount || 0), 0);

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

  // ---------- tiny helpers ----------
  const setText = (size: number, color: [number, number, number], bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const wrap = (t: string, w: number): string[] => doc.splitTextToSize(t, w) as string[];
  const ensure = (needed: number, y: number): number => {
    if (y + needed > pageH - FOOTER_SAFE) { doc.addPage(); return M + 10; }
    return y;
  };
  const sectionTitle = (label: string, x: number, y: number, w: number) => {
    setText(9, C.navy, true);
    doc.text(label.toUpperCase(), x, y);
    doc.setDrawColor(...C.gold);
    doc.setLineWidth(1.4);
    doc.line(x, y + 5, x + Math.min(26, w), y + 5);
    doc.setLineWidth(0.5);
    return y + 18;
  };

  // ============================== HEADER BAND ==============================
  const headerH = 104;
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pageW, headerH, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, headerH, pageW, 4, "F");

  setText(23, C.white, true);
  doc.text(co.brand, M, 46);
  setText(9.5, C.gold, true);
  doc.text(co.legal, M, 63);
  setText(8.5, [205, 212, 225], false);
  doc.text(wrap(co.ids, contentW * 0.56), M, 78, { lineHeightFactor: 1.35 });

  setText(24, C.gold, true);
  doc.text("INVOICE", pageW - M, 46, { align: "right" });
  setText(10, C.white, true);
  doc.text(inv.invoice_number || "DRAFT", pageW - M, 64, { align: "right" });
  setText(8.5, [205, 212, 225], false);
  doc.text(`Date: ${inv.issue_date}`, pageW - M, 78, { align: "right" });

  // ============================== COMPANY STRIP ==============================
  let y = headerH + 4 + 18;
  setText(8.5, C.mute, false);
  const addrLines = wrap(co.address, contentW * 0.62);
  doc.text(addrLines, M, y, { lineHeightFactor: 1.35 });
  doc.text(`${co.email}   ·   ${co.phone}`, pageW - M, y, { align: "right" });
  y += Math.max(addrLines.length * 11, 11) + 14;

  // ============================== BILLED TO / DETAILS ==============================
  const billLines: string[] = [];
  if (inv.client_location) billLines.push(...wrap(inv.client_location, colW - 28));
  if (inv.client_email) billLines.push(`Email: ${inv.client_email}`);
  if (inv.client_phone) billLines.push(`Mobile: ${inv.client_phone}`);

  const detailRows: Array<[string, string]> = [
    ["Invoice No.", inv.invoice_number || "DRAFT"],
    ["Invoice Date", inv.issue_date],
    ["Due Date", inv.due_date || "As per agreement"],
    ["Payment Mode", inv.payment_mode || "Bank Transfer"],
  ];
  if (inv.category) detailRows.push(["Category", inv.category]);

  const PAD = 14;
  const leftH = PAD + 15 + billLines.length * 12 + PAD - 2;
  const rightH = PAD + detailRows.length * 15 + PAD - 3;
  const cardH = Math.max(leftH, rightH, 86);

  y = ensure(cardH + 20, y);

  // left card
  doc.setFillColor(...C.navySoft);
  doc.roundedRect(M, y, colW, cardH, 6, 6, "F");
  doc.setFillColor(...C.gold);
  doc.roundedRect(M, y, 3.5, cardH, 2, 2, "F");
  let ly = y + PAD + 2;
  setText(8, C.mute, true);
  doc.text("BILLED TO", M + PAD, ly);
  ly += 15;
  setText(11.5, C.navy, true);
  doc.text(inv.client, M + PAD, ly, { maxWidth: colW - PAD * 2 });
  ly += 14;
  setText(9, C.ink, false);
  billLines.forEach((l) => { doc.text(l, M + PAD, ly); ly += 12; });

  // right card
  const rx = M + colW + GAP;
  doc.setDrawColor(...C.hair);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(rx, y, colW, cardH, 6, 6, "FD");
  let ry = y + PAD + 2;
  setText(8, C.mute, true);
  doc.text("INVOICE DETAILS", rx + PAD, ry);
  ry += 15;
  detailRows.forEach(([k, v]) => {
    setText(9, C.mute, false);
    doc.text(k, rx + PAD, ry);
    setText(9, C.navy, true);
    doc.text(v, rx + colW - PAD, ry, { align: "right", maxWidth: colW - PAD * 2 - 70 });
    ry += 15;
  });

  y += cardH + 24;

  // ============================== ITEMS TABLE ==============================
  const bodyRows = inv.items.map((it, idx) => [
    String(idx + 1),
    it.name,
    it.description || "—",
    fmt(Number(it.amount || 0)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Service", "Description", `Amount (${currency})`]],
    body: bodyRows,
    theme: "plain",
    styles: { font: "helvetica", lineColor: C.hair, lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 } },
    headStyles: {
      fillColor: C.navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: { top: 9, bottom: 9, left: 10, right: 10 },
      lineWidth: 0,
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: C.ink,
      cellPadding: { top: 10, bottom: 10, left: 10, right: 10 },
      valign: "top",
    },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: {
      0: { cellWidth: 28, halign: "center", textColor: C.mute },
      1: { cellWidth: 132, fontStyle: "bold", textColor: C.navy },
      2: { cellWidth: "auto" },
      3: { cellWidth: 96, halign: "right", fontStyle: "bold" },
    },
    margin: { left: M, right: M, bottom: FOOTER_SAFE },
  });

  // @ts-expect-error jspdf-autotable augments lastAutoTable at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 18;

  // ============================== TOTALS ==============================
  const totalsW = 250;
  const totalsX = pageW - M - totalsW;
  y = ensure(84, y);

  setText(9.5, C.mute, false);
  doc.text("Subtotal", totalsX + 14, y + 2);
  setText(9.5, C.ink, false);
  doc.text(`${currency} ${fmt(subtotal)}`, pageW - M - 14, y + 2, { align: "right" });

  const bandY = y + 14;
  const bandH = 38;
  doc.setFillColor(...C.navy);
  doc.roundedRect(totalsX, bandY, totalsW, bandH, 6, 6, "F");
  setText(10, C.gold, true);
  doc.text("TOTAL PAYABLE", totalsX + 14, bandY + 23);
  setText(13, C.white, true);
  doc.text(`${currency} ${fmt(subtotal)}`, pageW - M - 14, bandY + 23, { align: "right" });

  // Amount in words (left of totals block)
  setText(8, C.mute, true);
  doc.text("AMOUNT IN WORDS", M, y + 2);
  setText(9.5, C.navy, true);
  const wordLines = wrap(numberToWordsIndian(subtotal), contentW - totalsW - GAP);
  doc.text(wordLines, M, y + 16, { lineHeightFactor: 1.35 });

  y = Math.max(bandY + bandH, y + 16 + wordLines.length * 12) + 24;

  // ============================== NOTES ==============================
  if (inv.notes) {
    setText(8.5, C.ink, false);
    const nl = wrap(inv.notes, contentW - 28);
    const boxH = nl.length * 11.5 + 24;
    y = ensure(boxH + 16, y);
    doc.setFillColor(...C.goldSoft);
    doc.roundedRect(M, y, contentW, boxH, 6, 6, "F");
    doc.setFillColor(...C.gold);
    doc.roundedRect(M, y, 3.5, boxH, 2, 2, "F");
    setText(8.5, C.ink, false);
    doc.text(nl, M + 14, y + 16, { lineHeightFactor: 1.4 });
    y += boxH + 22;
  }

  // ============================== BANK DETAILS ==============================
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

  const halfCount = Math.ceil(bankPairs.length / 2);
  const bankLeft = bankPairs.slice(0, halfCount);
  const bankRight = bankPairs.slice(halfCount);

  const brAddrLines = bank.branchAddress ? wrap(`Branch Address: ${bank.branchAddress}`, contentW - 28) : [];
  const bankBoxH = 30 + Math.max(bankLeft.length, bankRight.length) * 16 + (brAddrLines.length ? brAddrLines.length * 11 + 8 : 0) + 12;

  y = ensure(bankBoxH + 30, y);
  y = sectionTitle(bank.tag ? `Bank Details for Payment — ${bank.tag}` : "Bank Details for Payment", M, y, contentW);

  doc.setDrawColor(...C.hair);
  doc.setFillColor(252, 253, 255);
  doc.roundedRect(M, y, contentW, bankBoxH, 6, 6, "FD");

  const renderPairs = (pairs: Array<[string, string]>, x: number, startY: number, w: number) => {
    let py = startY;
    pairs.forEach(([k, v]) => {
      setText(8, C.mute, false);
      doc.text(k, x, py);
      setText(9.5, C.navy, true);
      doc.text(v, x, py + 11, { maxWidth: w });
      py += 16 + 10;
    });
  };
  // two columns, label above value
  let byL = y + 18;
  let byR = y + 18;
  bankLeft.forEach(([k, v]) => {
    setText(8, C.mute, false); doc.text(k, M + 14, byL);
    setText(9.5, C.navy, true); doc.text(v, M + 14, byL + 12, { maxWidth: colW - 28 });
    byL += 28;
  });
  bankRight.forEach(([k, v]) => {
    setText(8, C.mute, false); doc.text(k, M + colW + GAP, byR);
    setText(9.5, C.navy, true); doc.text(v, M + colW + GAP, byR + 12, { maxWidth: colW - 14 });
    byR += 28;
  });
  void renderPairs;

  let bankBottom = Math.max(byL, byR);
  if (brAddrLines.length) {
    setText(8.5, C.mute, false);
    doc.text(brAddrLines, M + 14, bankBottom - 4, { lineHeightFactor: 1.35 });
    bankBottom += brAddrLines.length * 11;
  }
  y = y + bankBoxH + 24;

  // ============================== TERMS + SIGNATORY ==============================
  const termsLinesAll: string[] = [];
  co.terms.forEach((t) => {
    const clean = t.trim().replace(/^•\s*/, "");
    wrap(clean, colW - 14).forEach((l, i) => termsLinesAll.push(i === 0 ? `•  ${l}` : `    ${l}`));
  });
  const blockH = Math.max(termsLinesAll.length * 12 + 22, 92);
  y = ensure(blockH + 12, y);

  const tTop = sectionTitle("Terms & Conditions", M, y, colW);
  setText(8.5, C.ink, false);
  let ty = tTop;
  termsLinesAll.forEach((l) => { doc.text(l, M, ty); ty += 12; });

  // signatory (right column)
  const sx = M + colW + GAP;
  setText(8.5, C.mute, false);
  doc.text(`For ${co.brand}`, sx + colW, y, { align: "right" });
  doc.setDrawColor(...C.hair);
  doc.line(sx + colW - 170, y + 50, sx + colW, y + 50);
  setText(9.5, C.navy, true);
  doc.text(co.signatory, sx + colW, y + 63, { align: "right" });
  setText(8, C.mute, false);
  doc.text(co.legal, sx + colW, y + 75, { align: "right" });

  y = Math.max(ty, y + 86) + 10;

  // Thank-you strip
  y = ensure(34, y);
  doc.setFillColor(...C.navySoft);
  doc.roundedRect(M, y, contentW, 28, 6, 6, "F");
  setText(9.5, C.navy, true);
  doc.text("Thank you for your business!", M + 14, y + 18);
  setText(8.5, C.mute, false);
  doc.text(`Queries: ${co.email}  ·  ${co.phone}`, pageW - M - 14, y + 18, { align: "right" });

  // ============================== PAGE FOOTERS ==============================
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...C.hair);
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 42, pageW - M, pageH - 42);
    setText(7.5, C.mute, false);
    doc.text("This is a system-generated invoice; no signature is required.", M, pageH - 28);
    doc.text(`${co.brand}  ·  Invoice ${inv.invoice_number || "DRAFT"}`, pageW / 2, pageH - 28, { align: "center" });
    doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 28, { align: "right" });
  }

  return doc;
}

export function downloadInvoicePDF(inv: InvoicePDFData) {
  const doc = buildInvoicePDF(inv);
  doc.save(`Invoice_${inv.invoice_number || "draft"}.pdf`);
}
