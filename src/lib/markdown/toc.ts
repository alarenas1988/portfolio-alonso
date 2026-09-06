export interface TocEntry {
  id: string;
  text: string;
  depth: number;
}
export function headingIds(prefix = 'article') {
  const counts = new Map<string, number>();
  if (!/^[a-z][a-z0-9-]*$/.test(prefix)) throw new Error('Invalid heading namespace.');
  return (text: string) => {
    const slug =
      text
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'seccion';
    const base = `${prefix}-${slug}`,
      count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    // Repeated names and literal suffixes cannot collide.
    return `${base}-${count}`;
  };
}
