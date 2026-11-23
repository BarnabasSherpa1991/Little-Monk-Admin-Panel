export function formatCurrency(amount: number | undefined | null): string {
  const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatCurrencyExact(amount: number | undefined | null): string {
  const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTimestamp(ts: any): string {
  if (!ts) return '—';
  try {
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isOverdueDate(dateStr?: string): boolean {
  if (!dateStr) return false;
  return dateStr < todayISO();
}

export function isTodayDate(dateStr?: string): boolean {
  if (!dateStr) return false;
  return dateStr === todayISO();
}

export function isWithinNextDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  const today = todayISO();
  const target = new Date();
  target.setDate(target.getDate() + days);
  const maxISO = target.toISOString().slice(0, 10);
  return dateStr >= today && dateStr <= maxISO;
}

export function generateCode(prefix: string, count: number): string {
  const yr = new Date().getFullYear();
  const seq = String(count + 1).padStart(3, '0');
  return `${prefix}-${yr}-${seq}`;
}

export function buildWhatsAppLink(phone: string | undefined, message: string): string {
  const digits = (phone || '').replace(/[^\d]/g, '');
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function interpolateTemplate(
  body: string,
  vars: Record<string, string | number | undefined>
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

export function clampStr(val: string | undefined | null, maxLen: number): string {
  const s = (val ?? '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}
