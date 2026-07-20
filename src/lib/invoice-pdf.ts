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

// Brand palette — deep indigo + gold accents (matches app primary)
const BRAND = {
  primary: [55, 48, 163] as [number, number, number],       // #3730A3 deep indigo
  primaryDark: [30, 27, 90] as [number, number, number],    // #1E1B5A
  gold: [201, 168, 76] as [number, number, number],         // #C9A84C
  soft: [244, 243, 255] as [number, number, number],        // #F4F3FF
  ink: [24, 24, 32] as [number, number, number],
  mute: [110, 110, 125] as [number, number, number],
  hair: [225, 225, 235] as [number, number, number],
};

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildInvoicePDF(inv: InvoicePDFData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;
  const contentW = pageW - M * 2;
  const currency = inv.currency || "INR";
  const subtotal = inv.items.reduce((s, i) => s + Number(i.amount || 0), 0);

  // ============ HEADER BAND ============
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageW, 92, "F");
  // Gold accent stripe
  doc.setFillColor(...BRAND.gold);
  doc.rect(0, 92, pageW, 4, "F");

  // Brand name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(COMPANY.brand, M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 245);
  doc.text(COMPANY.legal, M, 58);
  doc.setFontSize(8);
  doc.text(COMPANY.ids, M, 72);

  // INVOICE badge (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", pageW - M, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.gold);
  doc.text(`# ${inv.invoice_number}`, pageW - M, 62, { align: "right" });
  doc.setTextColor(220, 220, 245);
  doc.setFontSize(9);
  doc.text(`Issued: ${inv.issue_date}`, pageW - M, 76, { align: "right" });

  let y = 118;

  // ============ BILLED TO / INVOICE INFO CARDS ============
  const cardH = 96;
  const cardW = (contentW - 12) / 2;

  // Left card - Billed To
  doc.setFillColor(...BRAND.soft);
  doc.roundedRect(M, y, cardW, cardH, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.primary);
  doc.text("BILLED TO", M + 12, y + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.ink);
  doc.text(inv.client, M + 12, y + 34, { maxWidth: cardW - 24 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.mute);
  let ly = y + 50;
  if (inv.client_location) { doc.text(inv.client_location, M + 12, ly, { maxWidth: cardW - 24 }); ly += 12; }
  if (inv.client_email) { doc.text(inv.client_email, M + 12, ly); ly += 12; }
  if (inv.client_phone) { doc.text(inv.client_phone, M + 12, ly); ly += 12; }
  if (inv.category) { doc.text(`Category: ${inv.category}`, M + 12, ly); }

  // Right card - Invoice details
  const rx = M + cardW + 12;
  doc.setFillColor(...BRAND.soft);
  doc.roundedRect(rx, y, cardW, cardH, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.primary);
  doc.text("INVOICE DETAILS", rx + 12, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const info: Array<[string, string]> = [
    ["Invoice #", inv.invoice_number],
    ["Invoice Date", inv.issue_date],
    ["Due Date", inv.due_date || "As per agreement"],
    ["Payment Mode", inv.payment_mode || "Bank Transfer"],
  ];
  info.forEach(([k, v], i) => {
    const ry = y + 32 + i * 14;
    doc.setTextColor(...BRAND.mute);
    doc.text(k, rx + 12, ry);
    doc.setTextColor(...BRAND.ink);
    doc.setFont("helvetica", "bold");
    doc.text(v, rx + cardW - 12, ry, { align: "right" });
    doc.setFont("helvetica", "normal");
  });

  y += cardH + 20;

  // ============ ITEMS TABLE ============
  const rows = inv.items.map((it, idx) => [
    String(idx + 1),
    it.name,
    it.description || "",
    fmt(Number(it.amount || 0)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Service", "Description", `Amount (${currency})`]],
    body: rows,
    theme: "grid",
    headStyles: {
      fillColor: BRAND.primary,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: 10,
      lineColor: BRAND.primary,
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 10,
      textColor: BRAND.ink,
      lineColor: BRAND.hair,
    },
    alternateRowStyles: { fillColor: [250, 250, 253] },
    columnStyles: {
      0: { cellWidth: 30, halign: "center", textColor: BRAND.mute },
      1: { cellWidth: 150, fontStyle: "bold" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 100, halign: "right", fontStyle: "bold" },
    },
    margin: { left: M, right: M },
  });

  // @ts-expect-error jspdf-autotable augments lastAutoTable at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 14;

  // ============ TOTALS BLOCK (right-aligned) ============
  const totalBoxW = 240;
  const totalBoxX = pageW - M - totalBoxW;
  doc.setDrawColor(...BRAND.hair);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.mute);
  doc.text("Subtotal", totalBoxX + 12, y + 4);
  doc.setTextColor(...BRAND.ink);
  doc.text(`${currency} ${fmt(subtotal)}`, totalBoxX + totalBoxW - 12, y + 4, { align: "right" });
  y += 12;
  doc.setDrawColor(...BRAND.hair);
  doc.line(totalBoxX + 12, y + 2, totalBoxX + totalBoxW - 12, y + 2);
  y += 10;

  // Grand total (indigo band)
  doc.setFillColor(...BRAND.primary);
  doc.roundedRect(totalBoxX, y, totalBoxW, 40, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.gold);
  doc.text("TOTAL PAYABLE", totalBoxX + 14, y + 25);
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(`${currency} ${fmt(subtotal)}`, totalBoxX + totalBoxW - 14, y + 25, { align: "right" });

  // Amount in words on the left, same band vertical space
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.mute);
  const words = `Amount in words: ${numberToWordsIndian(subtotal)}`;
  const wLines = doc.splitTextToSize(words, totalBoxX - M - 12);
  doc.text(wLines, M, y + 16);

  y += 56;

  // ============ NOTES / GST DECLARATION ============
  if (inv.notes) {
    doc.setFillColor(255, 251, 235); // soft gold tint
    doc.setDrawColor(...BRAND.gold);
    const noteLines = doc.splitTextToSize(inv.notes, contentW - 24);
    const noteH = noteLines.length * 11 + 30;
    doc.roundedRect(M, y, contentW, noteH, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.primaryDark);
    doc.text("NOTE", M + 12, y + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(noteLines, M + 12, y + 30);
    y += noteH + 16;
  }

  // If we're close to the bottom, add a page
  if (y > pageH - 260) { doc.addPage(); y = M + 10; }

  // ============ BANK DETAILS + SIGNATURE (side by side) ============
  const bankW = contentW * 0.62;
  const sigW = contentW - bankW - 12;
  const bankH = 130;

  // Bank card
  doc.setFillColor(250, 250, 253);
  doc.setDrawColor(...BRAND.hair);
  doc.roundedRect(M, y, bankW, bankH, 6, 6, "FD");
  // Gold left border
  doc.setFillColor(...BRAND.gold);
  doc.rect(M, y, 3, bankH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.primaryDark);
  doc.text("BANK DETAILS FOR PAYMENT", M + 14, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.ink);
  const bankRows: Array<[string, string]> = [
    ["Account Name", COMPANY.bank.name],
    ["Account Number", COMPANY.bank.number],
    ["IFSC Code", COMPANY.bank.ifsc],
    ["Branch", COMPANY.bank.branch],
  ];
  bankRows.forEach(([k, v], i) => {
    const by = y + 36 + i * 15;
    doc.setTextColor(...BRAND.mute);
    doc.text(k, M + 14, by);
    doc.setTextColor(...BRAND.ink);
    doc.setFont("helvetica", "bold");
    doc.text(v, M + 130, by);
    doc.setFont("helvetica", "normal");
  });
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.mute);
  const brAddr = doc.splitTextToSize(`Branch Address: ${COMPANY.bank.branchAddress}`, bankW - 28);
  doc.text(brAddr, M + 14, y + bankH - 14);

  // Signature card
  const sx = M + bankW + 12;
  doc.setFillColor(...BRAND.soft);
  doc.roundedRect(sx, y, sigW, bankH, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.primary);
  doc.text("FOR", sx + 12, y + 18);
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  const forLines = doc.splitTextToSize(`${COMPANY.brand}`, sigW - 24);
  doc.text(forLines, sx + 12, y + 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.mute);
  doc.text(`(${COMPANY.legal})`, sx + 12, y + 48);

  // Signature line
  doc.setDrawColor(...BRAND.mute);
  doc.line(sx + 12, y + bankH - 32, sx + sigW - 12, y + bankH - 32);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.ink);
  doc.text("Authorized Signatory", sx + 12, y + bankH - 20);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.mute);
  doc.text("System-generated · no signature required", sx + 12, y + bankH - 10);

  y += bankH + 14;

  // ============ TERMS ============
  if (y > pageH - 130) { doc.addPage(); y = M + 10; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.primaryDark);
  doc.text("TERMS & CONDITIONS", M, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 90);
  const terms = [
    "• Payment to be made as per the agreed terms mentioned in the engagement agreement.",
    "• All payments should be made to the bank account details mentioned above.",
    "• Any disputes regarding this invoice should be raised within 7 days of receipt.",
    "• This invoice is valid without a physical signature and is generated electronically.",
  ];
  terms.forEach((t) => { doc.text(t, M, y); y += 11; });

  // ============ FOOTER BAND on every page ============
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Thin gold rule
    doc.setDrawColor(...BRAND.gold);
    doc.setLineWidth(1);
    doc.line(M, pageH - 46, pageW - M, pageH - 46);
    doc.setLineWidth(0.2);

    // Footer content
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.primary);
    doc.text("Thank you for your business!", M, pageH - 30);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.mute);
    doc.text(`${COMPANY.email}  ·  ${COMPANY.phone}`, M, pageH - 18);
    const addrLines = doc.splitTextToSize(COMPANY.address, contentW - 180);
    doc.text(addrLines, pageW - M, pageH - 18, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.ink);
    doc.text(`Page ${p} of ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
  }

  return doc;
}


export function downloadInvoicePDF(inv: InvoicePDFData) {
  const doc = buildInvoicePDF(inv);
  doc.save(`Invoice_${inv.invoice_number || "draft"}.pdf`);
}
