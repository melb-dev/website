export type EventLike = { id?: string; data: { title: string; start: Date; end?: Date } };
export const MELBOURNE_TZ = 'Australia/Melbourne';
export function localDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MELBOURNE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function todayMelbourne(now = new Date()) {
  return localDate(now);
}
export function isFuture(event: EventLike, now = new Date()) {
  return localDate(event.data.end ?? event.data.start) >= todayMelbourne(now);
}
export function sortEvents<T extends EventLike>(items: T[], future: boolean) {
  return [...items].sort(
    (a, b) =>
      (future ? 1 : -1) * (a.data.start.getTime() - b.data.start.getTime()) ||
      a.data.title.localeCompare(b.data.title),
  );
}
export type CfpLike = EventLike & { data: EventLike['data'] & { cfpDeadline?: Date } };
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
export function sortCfps<T extends CfpLike>(items: T[], future: boolean) {
  return [...items].sort((a, b) => {
    const direction = future ? 1 : -1;
    const deadline = (item: T) =>
      item.data.cfpDeadline?.getTime() ?? item.data.start.getTime() - TWO_WEEKS_MS;
    return (
      direction * (deadline(a) - deadline(b)) ||
      direction * (a.data.start.getTime() - b.data.start.getTime()) ||
      a.data.title.localeCompare(b.data.title)
    );
  });
}
export function slug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
export function formatEventDate(start: Date, end?: Date, allDay = false) {
  const d = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(start);
  if (allDay) return d;
  const t = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TZ,
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${d}, ${t.format(start)}${end ? `–${t.format(end)}` : ''}`;
}

export function formatMelbourneDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}
