import { jsPDF } from 'jspdf';
import { formatCurrency, formatDate } from './utils.js';

export function generateQuotePdf(quote, client, lineItems) {
  const doc = new jsPDF();
  const W = 210, M = 18;
  let y = 20;

  // Header
  doc.setFillColor(26, 31, 46);
  doc.rect(0, 0, W, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont(undefined, 'bold');
  doc.text('FSS Solutions', M, 18);
  doc.setFontSize(9); doc.setFont(undefined, 'normal');
  doc.text('Carpentry · Soft Wash · Exterior Cleaning', M, 26);
  doc.setFontSize(11);
  doc.text(`QUOTE ${quote.quote_number}`, W - M, 18, { align: 'right' });
  doc.setFontSize(9);
  doc.text(quote.division === 'carpentry' ? 'Carpentry Division' : 'Soft Wash Division', W - M, 26, { align: 'right' });

  y = 52;
  doc.setTextColor(30, 41, 59);

  // Bill To + Quote Info
  doc.setFontSize(8); doc.setFont(undefined, 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('BILL TO', M, y);
  doc.text('QUOTE DETAILS', 130, y);
  y += 5;
  doc.setFont(undefined, 'normal');
  doc.setTextColor(30, 41, 59);

  const clientLabel = client?.company_name || `${client?.first_name || ''} ${client?.last_name || ''}`.trim();
  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text(clientLabel || '—', M, y);
  doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  if (client?.email) doc.text(client.email, M, y + 6);
  if (client?.phone) doc.text(client.phone, M, y + 12);
  const addr = quote.property_address || client?.billing_address || '';
  if (addr) doc.text(addr, M, y + 18);

  const details = [
    ['Quote #:', quote.quote_number],
    ['Issued:', formatDate(quote.issued_date)],
    ['Expires:', formatDate(quote.expiry_date)],
    ['Version:', `v${quote.version}`],
  ];
  details.forEach(([k, v], i) => {
    doc.setFont(undefined, 'bold'); doc.text(k, 130, y + i * 6);
    doc.setFont(undefined, 'normal'); doc.text(String(v || '—'), 160, y + i * 6);
  });

  y += 32;
  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text(quote.title, M, y);
  y += 10;

  // Line items table header
  doc.setFillColor(247, 248, 250);
  doc.rect(M, y - 4, W - M * 2, 8, 'F');
  doc.setFontSize(8); doc.setFont(undefined, 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DESCRIPTION', M + 1, y + 1);
  doc.text('QTY', 130, y + 1);
  doc.text('UNIT', 148, y + 1);
  doc.text('PRICE', 165, y + 1);
  doc.text('TOTAL', W - M - 1, y + 1, { align: 'right' });
  y += 10;

  doc.setTextColor(30, 41, 59);
  lineItems.forEach(item => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    const desc = doc.splitTextToSize(item.description || '', 100);
    doc.text(desc, M + 1, y);
    doc.text(String(item.quantity || '1'), 130, y);
    doc.text(item.unit || '', 148, y);
    doc.text(formatCurrency(item.unit_price), 165, y);
    doc.text(formatCurrency(item.line_total), W - M - 1, y, { align: 'right' });
    y += desc.length * 5 + 2;
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y - 1, W - M, y - 1);
  });

  y += 6;
  // Totals
  const totals = [
    ['Subtotal', formatCurrency(quote.subtotal)],
    ['GST (5%)', formatCurrency(quote.gst_amount)],
  ];
  totals.forEach(([k, v]) => {
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text(k, 145, y); doc.text(v, W - M - 1, y, { align: 'right' });
    y += 6;
  });
  doc.setDrawColor(30, 41, 59); doc.line(140, y - 1, W - M, y - 1);
  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text('TOTAL', 145, y + 5);
  doc.text(formatCurrency(quote.total), W - M - 1, y + 5, { align: 'right' });

  // Notes
  if (quote.notes) {
    y += 16;
    doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(100, 116, 139);
    doc.text('NOTES', M, y);
    y += 5;
    doc.setFont(undefined, 'normal'); doc.setTextColor(30, 41, 59); doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(quote.notes, W - M * 2);
    doc.text(noteLines, M, y);
  }

  // Footer
  doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(148, 163, 184);
  doc.text('This quote is valid for 30 days. Thank you for your business — FSS Solutions', W / 2, 285, { align: 'center' });

  doc.save(`${quote.quote_number}.pdf`);
}
