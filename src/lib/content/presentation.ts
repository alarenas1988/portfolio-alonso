/** Small, plain-text excerpts for Home; full Markdown rendering belongs to F4. */
export function excerptText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/^\s{0,3}(?:#{1,6}\s|>\s|[-*+]\s)/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value || [...value].some((character) => character.charCodeAt(0) <= 32 || character === '\\'))
    return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function emailActions(value: string | null | undefined) {
  const email = value?.trim();
  if (!email || !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) return null;
  return { email, href: 'mailto:' + encodeURIComponent(email).replace('%40', '@') };
}

export function whatsappUrl(
  number: string | null | undefined,
  message?: string | null,
): string | null {
  const value = number?.trim();
  if (!value || !/^\+?[\d ()-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (!/^[1-9]\d{6,14}$/.test(digits)) return null;
  const url = new URL(digits, 'https://wa.me/');
  if (message?.trim()) url.searchParams.set('text', message.trim());
  return url.href;
}

export function formatEditorialDate(value: string, timezone: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid editorial date.');
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(date);
}

/** Calendar dates are not instants: do not shift editorial periods across time zones. */
export function formatPeriod(
  start: string | null,
  end: string | null,
  current: boolean,
): string | null {
  const month = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid period date.');
    const date = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
      throw new Error('Invalid period date.');
    return new Intl.DateTimeFormat('es-CL', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  };
  if (!start) return null;
  return month(start) + (current ? ' — Actualidad' : end ? ' — ' + month(end) : '');
}
