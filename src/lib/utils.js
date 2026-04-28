export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatCurrency(n) {
  if (n == null) return '$0.00';
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function fiscalYear() {
  const now = new Date();
  return now.getFullYear();
}

export function nextQuoteNumber(existing) {
  const year = new Date().getFullYear();
  const nums = existing
    .map(q => parseInt((q.quote_number || '').split('-')[2] || '0'))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `FSS-${year}-${String(next).padStart(3, '0')}`;
}

export function nextJobNumber(existing) {
  const year = new Date().getFullYear();
  const nums = existing
    .map(j => parseInt((j.job_number || '').split('-')[2] || '0'))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `JOB-${year}-${String(next).padStart(3, '0')}`;
}

export function nextInvoiceNumber(existing) {
  const year = new Date().getFullYear();
  const nums = existing
    .map(i => parseInt((i.invoice_number || '').split('-')[2] || '0'))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `INV-${year}-${String(next).padStart(3, '0')}`;
}

export function clientName(c) {
  if (!c) return '—';
  return c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
}

export function divisionLabel(d) {
  return d === 'carpentry' ? 'Carpentry' : d === 'softwash' ? 'Soft Wash' : d || '—';
}

export function gst(subtotal) {
  return Math.round(subtotal * 0.05 * 100) / 100;
}
