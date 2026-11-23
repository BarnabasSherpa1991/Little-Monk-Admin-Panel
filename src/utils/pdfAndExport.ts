import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Booking, CompanySettings, Payment, Quotation } from '../types/crm';
import { formatCurrencyExact, formatDate } from './formatters';

let cachedFontsPromise: Promise<{ regular: string; bold: string } | null> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function getUnicodeFonts(): Promise<{ regular: string; bold: string } | null> {
  if (!cachedFontsPromise) {
    cachedFontsPromise = (async () => {
      try {
        const [regRes, boldRes] = await Promise.all([
          fetch('/fonts/NotoSans-Regular.ttf'),
          fetch('/fonts/NotoSans-Bold.ttf'),
        ]);
        if (!regRes.ok || !boldRes.ok) return null;
        const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
        return {
          regular: arrayBufferToBase64(regBuf),
          bold: arrayBufferToBase64(boldBuf),
        };
      } catch {
        return null;
      }
    })();
  }
  return cachedFontsPromise;
}

async function registerPdfFont(doc: jsPDF): Promise<'NotoSans' | 'helvetica'> {
  const fonts = await getUnicodeFonts();
  if (!fonts) return 'helvetica';
  doc.addFileToVFS('NotoSans-Regular.ttf', fonts.regular);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFileToVFS('NotoSans-Bold.ttf', fonts.bold);
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  doc.setFont('NotoSans', 'normal');
  return 'NotoSans';
}

function pdfCurrency(amount: number | undefined | null, hasRupeeGlyph = true): string {
  const formatted = formatCurrencyExact(amount);
  return hasRupeeGlyph ? formatted : formatted.replace('₹', 'INR ');
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

async function addCompanyHeader(
  doc: jsPDF,
  fontName: 'NotoSans' | 'helvetica',
  settings: CompanySettings | null,
  documentTitle: string,
  documentCode: string
) {
  const companyName = settings?.companyName || 'Azure Travel';
  const logoUrl = settings?.logoUrl || '/src/assets/images/company_logo_mark_1795419417417.jpg';

  // Navy top bar
  doc.setFillColor(15, 39, 68);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(13, 148, 136);
  doc.rect(0, 34, 210, 2, 'F');

  const logoData = await loadImageAsDataUrl(logoUrl);
  let textX = 14;
  if (logoData) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 5, 24, 24, 2, 2, 'F');
    doc.addImage(logoData, 'JPEG', 15, 6, 22, 22);
    textX = 43;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(16);
  doc.text(companyName, textX, 14);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  if (settings?.address) doc.text(settings.address.slice(0, 70), textX, 20);
  const contactLine = [
    settings?.phone,
    settings?.email,
    settings?.gstNumber ? `GSTIN: ${settings.gstNumber}` : '',
  ]
    .filter(Boolean)
    .join('  |  ');
  if (contactLine) doc.text(contactLine, textX, 26);

  doc.setTextColor(255, 255, 255);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(13);
  doc.text(documentTitle, 196, 15, { align: 'right' });
  doc.setFont(fontName, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(45, 212, 191);
  doc.text(documentCode, 196, 23, { align: 'right' });
}

export async function generateQuotationPDF(q: Quotation, settings: CompanySettings | null) {
  const doc = new jsPDF();
  const fontName = await registerPdfFont(doc);
  const hasRupee = fontName === 'NotoSans';

  await addCompanyHeader(doc, fontName, settings, 'TRAVEL QUOTATION', `${q.quoteCode} (v${q.version})`);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont(fontName, 'bold');
  doc.text('Prepared For:', 14, 46);
  doc.setFont(fontName, 'normal');
  doc.text(q.customerName, 14, 52);
  if (q.customerPhone) doc.text(`Phone: ${q.customerPhone}`, 14, 57);
  if (q.customerEmail) doc.text(`Email: ${q.customerEmail}`, 14, 62);

  doc.setFont(fontName, 'bold');
  doc.text('Trip Summary:', 115, 46);
  doc.setFont(fontName, 'normal');
  doc.text(`Destination: ${q.destination}`, 115, 52);
  doc.text(`Dates: ${formatDate(q.startDate)} to ${formatDate(q.endDate)}`, 115, 57);
  doc.text(`Travellers: ${q.paxSummary || 'As discussed'}`, 115, 62);
  doc.text(`Currency: INR (₹)  |  Status: ${q.status}`, 115, 67);

  let y = 76;

  if (q.hotelItems && q.hotelItems.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Hotel Name', 'Room Type', 'Meal', 'Nights', 'Rooms', 'Rate/Night', 'Total (INR)']],
      body: q.hotelItems.map((h) => [
        h.city || h.region ? `${h.hotelName} (${[h.city, h.region].filter(Boolean).join(', ')})` : h.hotelName,
        h.roomType,
        h.mealPlan,
        String(h.nights),
        String(h.rooms),
        pdfCurrency(h.ratePerNight, hasRupee),
        pdfCurrency(h.total, hasRupee),
      ]),
      styles: { font: fontName },
      headStyles: { fillColor: [15, 39, 68], textColor: 255, fontSize: 8.5, font: fontName, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, font: fontName },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (q.transportItems && q.transportItems.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Vehicle Category', 'Model', 'Days', 'Rate/Day', 'Total (INR)']],
      body: q.transportItems.map((t) => [
        t.vehicleCategory,
        t.vehicleModel,
        String(t.days),
        pdfCurrency(t.ratePerDay, hasRupee),
        pdfCurrency(t.total, hasRupee),
      ]),
      styles: { font: fontName },
      headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8.5, font: fontName, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, font: fontName },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  const summaryRows: string[][] = [
    ['Sightseeing & Entry Charges', pdfCurrency(q.sightseeingCharge || 0, hasRupee)],
    ['Meals & Dining Charges', pdfCurrency(q.mealsCharge || 0, hasRupee)],
    ['Other Operational Expenses', pdfCurrency(q.otherExpenses || 0, hasRupee)],
    ['Base Subtotal', pdfCurrency(q.subtotal, hasRupee)],
    [`Agency Service / Markup (${q.markupPercent || 0}%)`, pdfCurrency(q.markupAmount || 0, hasRupee)],
    ['Discount Applied', `- ${pdfCurrency(q.discountAmount || 0, hasRupee)}`],
    [`GST (${q.gstPercent || 0}%)`, pdfCurrency(q.gstAmount || 0, hasRupee)],
    ['TOTAL PACKAGE COST (INR)', pdfCurrency(q.totalCost, hasRupee)],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Cost Breakdown', 'Amount (INR)']],
    body: summaryRows,
    styles: { font: fontName },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9, font: fontName, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, font: fontName },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (y > 245) {
    doc.addPage();
    y = 20;
  }

  const addTextBlock = (title: string, content?: string) => {
    if (!content) return;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 39, 68);
    doc.text(title, 14, y);
    y += 5;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(content, 182);
    doc.text(lines, 14, y);
    y += lines.length * 4.2 + 5;
  };

  addTextBlock('Inclusions', q.inclusions);
  addTextBlock('Exclusions', q.exclusions);
  addTextBlock('Terms & Conditions', q.termsAndConditions || settings?.quotationTerms);

  doc.save(`${q.quoteCode}_v${q.version}.pdf`);
}

export async function generateBookingVoucherPDF(b: Booking, settings: CompanySettings | null) {
  const doc = new jsPDF();
  const fontName = await registerPdfFont(doc);
  const hasRupee = fontName === 'NotoSans';

  await addCompanyHeader(doc, fontName, settings, 'BOOKING CONFIRMATION VOUCHER', b.bookingCode);

  const hotelSummary =
    b.selectedHotels && b.selectedHotels.length > 0
      ? b.selectedHotels
          .map((h) => (h.city || h.region ? `${h.hotelName} (${[h.city, h.region].filter(Boolean).join(', ')})` : h.hotelName))
          .join(' | ')
      : b.hotelName || 'As per itinerary';

  let y = 46;
  autoTable(doc, {
    startY: y,
    head: [['Guest & Trip Details', 'Confirmation Information']],
    body: [
      ['Primary Guest', b.customerName],
      ['Contact Phone / Email', `${b.customerPhone || '—'}  |  ${b.customerEmail || '—'}`],
      ['Destination', b.destination],
      ['Check-In / Start Date', formatDate(b.startDate)],
      ['Check-Out / End Date', formatDate(b.endDate)],
      ['Passengers', `${b.adults} Adults, ${b.children || 0} Children, ${b.infants || 0} Infants`],
      ['Tour Package', b.packageName || 'Custom Itinerary'],
      ['Hotel Accommodation', hotelSummary],
      ['Assigned Vehicle', b.vehicleDetails || 'As per itinerary'],
      ['Operations Manager', b.operationsManagerName || 'Operations Desk'],
      ['Booking Status', b.bookingStatus],
    ],
    styles: { font: fontName },
    headStyles: { fillColor: [15, 39, 68], textColor: 255, fontSize: 9.5, font: fontName, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, font: fontName },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    head: [['Payment Summary (INR)', 'Amount']],
    body: [
      ['Total Booking Value', pdfCurrency(b.bookingAmount, hasRupee)],
      ['Advance / Paid Amount', pdfCurrency(b.advanceReceived, hasRupee)],
      ['Remaining Balance Due', pdfCurrency(b.remainingAmount, hasRupee)],
      ['Payment Status', b.paymentStatus],
    ],
    styles: { font: fontName },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 9.5, font: fontName, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9.5, font: fontName },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  if (b.specialNotes) {
    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.text('Special Instructions:', 14, y);
    y += 5;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(b.specialNotes, 182), 14, y);
    y += 14;
  }

  if (settings?.invoiceTerms) {
    doc.setFont(fontName, 'bold');
    doc.setFontSize(9);
    doc.text('Voucher Terms:', 14, y);
    y += 5;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(settings.invoiceTerms, 182), 14, y);
  }

  doc.save(`${b.bookingCode}_Voucher.pdf`);
}

export async function generatePaymentReceiptPDF(
  p: Payment,
  booking: Booking | undefined,
  settings: CompanySettings | null
) {
  const doc = new jsPDF();
  const fontName = await registerPdfFont(doc);
  const hasRupee = fontName === 'NotoSans';

  const title = p.type === 'Refund' ? 'PAYMENT REFUND VOUCHER' : 'OFFICIAL PAYMENT RECEIPT';
  await addCompanyHeader(doc, fontName, settings, title, p.receiptCode);

  autoTable(doc, {
    startY: 48,
    head: [['Receipt Field', 'Details']],
    body: [
      ['Receipt Number', p.receiptCode],
      ['Transaction Type', p.type],
      ['Payment Date', formatDate(p.paymentDate)],
      ['Customer Name', p.customerName],
      ['Booking Reference', p.bookingCode || booking?.bookingCode || p.bookingId],
      ['Destination', booking?.destination || '—'],
      ['Payment Mode', p.mode],
      ['Reference / UTR', p.referenceNumber || '—'],
      ['Amount (INR)', pdfCurrency(p.amount, hasRupee)],
      ['Included GST Component (INR)', pdfCurrency(p.gstComponent || 0, hasRupee)],
      ['Notes', p.notes || '—'],
    ],
    styles: { font: fontName },
    headStyles: { fillColor: [15, 39, 68], textColor: 255, fontSize: 9.5, font: fontName, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9.5, font: fontName },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65 } },
    margin: { left: 14, right: 14 },
  });

  const y = (doc as any).lastAutoTable.finalY + 12;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('This is a computer-generated INR receipt issued by ' + (settings?.companyName || 'Azure Travel') + '.', 14, y);
  if (settings?.bankDetails) {
    doc.text(doc.splitTextToSize('Bank Details: ' + settings.bankDetails, 182), 14, y + 7);
  }

  doc.save(`${p.receiptCode}_Receipt.pdf`);
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csvContent = '\uFEFF' + [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportReportPDF(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  settings: CompanySettings | null
) {
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
  const fontName = await registerPdfFont(doc);
  await addCompanyHeader(doc, fontName, settings, title.toUpperCase(), new Date().toISOString().slice(0, 10));
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${subtitle} (Currency: INR)`, 14, 44);

  autoTable(doc, {
    startY: 49,
    head: [headers],
    body: rows.map((r) => r.map((c) => (fontName === 'NotoSans' ? String(c ?? '') : String(c ?? '').replace(/₹/g, 'INR ')))),
    styles: { font: fontName },
    headStyles: { fillColor: [15, 39, 68], textColor: 255, fontSize: 8, font: fontName, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, font: fontName },
    margin: { left: 14, right: 14 },
  });
  doc.save(`${filename}.pdf`);
}
