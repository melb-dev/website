import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify, parse } from 'yaml';

export type ContentKind = 'event' | 'group' | 'venue' | 'topic';
const kinds: ContentKind[] = ['event', 'group', 'venue', 'topic'];
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function uuidv7(now = Date.now()): string {
  const bytes = randomBytes(16);
  const time = BigInt(now);
  for (let i = 5; i >= 0; i--) bytes[i] = Number((time >> BigInt((5 - i) * 8)) & 255n);
  bytes[6] = (bytes[6] & 15) | 0x70;
  bytes[8] = (bytes[8] & 63) | 0x80;
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function melbourneDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function tomorrowMelbourne(now = new Date()): string {
  const noon = new Date(`${melbourneDate(now)}T12:00:00Z`);
  noon.setUTCDate(noon.getUTCDate() + 1);
  return noon.toISOString().slice(0, 10);
}

export function nextWeekdayDates(weekday: number, now = new Date()): string[] {
  const cursor = new Date(`${tomorrowMelbourne(now)}T12:00:00Z`);
  const dates: string[] = [];
  while (dates.length < 8) {
    if (cursor.getUTCDay() === weekday) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function melbourneIso(date: string, time: string): string {
  const intendedUtc = Date.parse(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(intendedUtc));
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offsetMinutes = (represented - intendedUtc) / 60_000;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  return `${date}T${time}:00${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

export function contentPath(
  kind: ContentKind,
  label: string,
  date?: string,
  group?: string,
): string {
  const file =
    kind === 'event'
      ? `${(date ?? tomorrowMelbourne()).replaceAll('-', '')}-${slug(group ?? 'group')}-${slug(label)}.yaml`
      : `${slug(label)}.yaml`;
  return `src/content/${kind}s/${file}`;
}

export function writeContent(path: string, data: object, base = root): string {
  const absolute = resolve(base, path);
  if (existsSync(absolute)) throw new Error(`Refusing to overwrite existing content: ${path}`);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, stringify(data, { lineWidth: 0 }));
  return path;
}

function entries(kind: Exclude<ContentKind, 'event'>) {
  const dir = resolve(root, `src/content/${kind}s`);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') && !name.startsWith('new-'))
    .map((file) => ({
      slug: file.slice(0, -5),
      ...parse(readFileSync(resolve(dir, file), 'utf8')),
    }));
}

export function template(kind: ContentKind, label: string, details: Record<string, string> = {}) {
  const uid = uuidv7();
  if (kind === 'topic')
    return { uid, name: label, ...(details.description && { description: details.description }) };
  if (kind === 'venue')
    return {
      uid,
      name: label,
      address: details.address ?? 'Address',
      suburb: details.suburb ?? 'Melbourne',
      postcode: details.postcode ?? '3000',
      ...(details.state && { state: details.state }),
      ...(details.url && { url: details.url }),
      ...(details.mapUrl && { mapUrl: details.mapUrl }),
      ...(details.accessibility && { accessibility: details.accessibility }),
    };
  if (kind === 'group')
    return {
      uid,
      name: label,
      summary: details.summary ?? 'A one-sentence summary.',
      description: details.description ?? 'A plain text description.',
      topics: [details.topic ?? entries('topic')[0]?.slug ?? 'software-engineering'],
      websiteUrl: details.websiteUrl ?? 'https://example.org/',
      eventsUrl: details.eventsUrl ?? details.websiteUrl ?? 'https://example.org/events/',
      ...(details.location && { location: details.location }),
    };
  return {
    uid,
    title: label,
    start: melbourneIso(details.date ?? tomorrowMelbourne(), details.time ?? '18:00'),
    ...(details.endTime && {
      end: melbourneIso(details.date ?? tomorrowMelbourne(), details.endTime),
    }),
    group: details.group ?? entries('group')[0]?.slug ?? 'group',
    topics: [details.topic ?? entries('topic')[0]?.slug ?? 'software-engineering'],
    eventType: details.eventType ?? 'meetup',
    paid: details.paid === 'true',
    format: details.format ?? 'online',
    ...(details.venue && { venue: details.venue }),
    url: details.url ?? 'https://example.org/event',
    ...(details.rsvpNote && { rsvpNote: details.rsvpNote }),
    ...(details.status && details.status !== 'scheduled' && { status: details.status }),
  };
}

async function interactive(initialKind?: ContentKind) {
  const {
    createCliRenderer,
    InputRenderable,
    InputRenderableEvents,
    SelectRenderable,
    SelectRenderableEvents,
    TextRenderable,
  } = await import('@opentui/core');
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  let id = 0;
  renderer.start();
  const choose = <T>(question: string, options: { name: string; value: T }[], selectedIndex = 0) =>
    new Promise<T>((done) => {
      if (!options.length) throw new Error(`${question} has no available options.`);
      const heading = new TextRenderable(renderer, { id: `heading-${id++}`, content: question });
      const select = new SelectRenderable(renderer, {
        id: `select-${id++}`,
        options: options.map((o) => ({ ...o, description: '' })),
        height: Math.min(options.length, 10),
        selectedIndex,
      });
      renderer.root.add(heading);
      renderer.root.add(select);
      select.focus();
      select.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: { value: T }) => {
        renderer.root.remove(heading);
        renderer.root.remove(select);
        done(option.value);
      });
    });
  const ask = (
    question: string,
    validate: (s: string) => boolean = (s) => !!s.trim(),
    value = '',
  ) =>
    new Promise<string>((done) => {
      const heading = new TextRenderable(renderer, { id: `heading-${id++}`, content: question });
      const input = new InputRenderable(renderer, {
        id: `input-${id++}`,
        placeholder: 'Type here, then press Enter',
        value,
      });
      renderer.root.add(heading);
      renderer.root.add(input);
      input.focus();
      input.on(InputRenderableEvents.ENTER, () => {
        const value = input.value.trim();
        if (!validate(value)) return;
        renderer.root.remove(heading);
        renderer.root.remove(input);
        done(value);
      });
    });
  const askOptional = (question: string, validate = (_value: string) => true) =>
    ask(`${question} (leave blank to omit)`, (value) => !value || validate(value));
  try {
    const kind =
      initialKind ??
      (await choose(
        'What would you like to create?',
        kinds.map((value) => ({ name: value, value })),
      ));
    const label = await ask(kind === 'event' ? 'Event title' : `${kind} name`);
    const details: Record<string, string> = {};
    const topics = entries('topic');
    if (kind === 'group') {
      details.summary = await ask(
        'Summary (maximum 180 characters)',
        (v) => !!v && v.length <= 180,
      );
      details.description = await ask('Description');
      details.topic = await choose(
        'Primary topic',
        topics.map((x) => ({ name: x.name, value: x.slug })),
      );
      details.websiteUrl = await ask('Community website HTTPS URL', (v) => /^https:\/\/.+/.test(v));
      details.eventsUrl = await ask(
        'Events listing HTTPS URL',
        (v) => /^https:\/\/.+/.test(v),
        details.websiteUrl,
      );
      details.location = await askOptional('Primary location');
    } else if (kind === 'venue') {
      details.address = await ask('Street address');
      details.suburb = await ask('Suburb');
      details.postcode = await ask('Postcode', (v) => /^\d{4}$/.test(v));
      details.url = await askOptional('Public HTTPS URL', (v) => /^https:\/\/.+/.test(v));
    } else if (kind === 'topic') details.description = await askOptional('Description');
    else {
      const groups = entries('group');
      details.group = await choose(
        'Group',
        groups.map((x) => ({ name: x.name, value: x.slug })),
      );
      details.topic = await choose(
        'Primary topic',
        topics.map((x) => ({ name: x.name, value: x.slug })),
      );
      details.eventType = await choose('Event Type', [
        { name: 'Meetup', value: 'meetup' },
        { name: 'Conference', value: 'conference' },
      ]);
      details.paid = await choose(
        'Cost',
        [
          { name: 'Free', value: 'false' },
          { name: 'Paid', value: 'true' },
        ],
        details.eventType === 'conference' ? 1 : 0,
      );
      details.format = await choose(
        'Format',
        ['in-person', 'online', 'hybrid'].map((value) => ({ name: value, value })),
      );
      const weekdays = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const tomorrowWeekday = new Date(`${tomorrowMelbourne()}T12:00:00Z`).getUTCDay();
      const weekday = await choose(
        'Weekday',
        weekdays.map((name, value) => ({ name, value })),
        tomorrowWeekday,
      );
      const dates = nextWeekdayDates(weekday);
      details.date = await choose(
        'Date',
        dates.map((value) => ({ name: value, value })),
      );
      details.time = await ask(
        'Start time (HH:MM)',
        (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        '18:00',
      );
      details.endTime = await askOptional(
        'End time (HH:MM)',
        (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) && value.localeCompare(details.time) > 0,
      );
      if (details.format !== 'online') {
        const venues = entries('venue');
        details.venue = await choose(
          'Venue',
          venues.map((x) => ({ name: x.name, value: x.slug })),
        );
      }
      details.url = await ask('Canonical HTTPS URL', (v) => /^https:\/\/.+/.test(v));
      details.rsvpNote = await askOptional(
        'One-sentence RSVP note (maximum 160 characters)',
        (value) => value.length <= 160,
      );
      details.status = await choose(
        'Status',
        ['scheduled', 'postponed', 'cancelled'].map((value) => ({ name: value, value })),
      );
    }
    const path = contentPath(kind, label, details.date, details.group);
    writeContent(path, template(kind, label, details));
    return path;
  } finally {
    renderer.destroy();
  }
}

async function main() {
  const kind = process.argv[2] as ContentKind | undefined;
  const label = process.argv[3];
  if (kind && !kinds.includes(kind)) throw new Error('Kind must be event, group, venue, or topic.');
  if (kind && label) {
    const group = kind === 'event' ? (process.argv[4] ?? entries('group')[0]?.slug) : undefined;
    const path = contentPath(kind, label, undefined, group);
    writeContent(path, template(kind, label, { ...(group && { group }) }));
    console.log(path);
    return;
  }
  if (!process.stdin.isTTY)
    throw new Error(
      'Usage: bun run new-content <event|group|venue|topic> "Name or title" [group-slug]',
    );
  const path = await interactive(kind);
  console.log(path);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
