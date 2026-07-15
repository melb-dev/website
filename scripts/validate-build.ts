import { existsSync, readFileSync, readdirSync } from 'node:fs';
import ICAL from 'ical.js';
import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import { localDate } from '../src/lib/events';
import { load } from './validate-content';

type ExpectedEvent = {
  uid: string;
  title: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  group?: string;
  topics: string[];
  eventType: 'meetup' | 'conference';
  paid: boolean;
  format: 'in-person' | 'online' | 'hybrid';
  venue?: string;
  location: string;
  url: string;
  note?: string;
  status: 'scheduled' | 'postponed' | 'cancelled';
  revision: number;
  stamp: Date;
};

export type ExpectedFeeds = { events: ExpectedEvent[] };

const formatNames = { 'in-person': 'In person', online: 'Online', hybrid: 'Hybrid' } as const;
const eventTypeNames = { meetup: 'Meetup', conference: 'Conference' } as const;
const text = (value: unknown) => String(value ?? '');
const list = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

export function expectedFeeds(contentRoot?: string, now = new Date()): ExpectedFeeds {
  const rows = load(contentRoot);
  const records = new Map(rows.map((row) => [`${row.kind}:${row.id}`, row.data]));
  const cutoff = now.getTime() - 30 * 864e5;
  const events = rows
    .filter((row) => row.kind === 'events')
    .map((row) => {
      const data = row.data;
      const start = new Date(data.start);
      const end = data.end ? new Date(data.end) : undefined;
      const group = records.get(`groups:${data.group}`)?.name;
      const venue = data.venue ? records.get(`venues:${data.venue}`) : undefined;
      const topics = (data.topics ?? []).map(
        (topic: string) => records.get(`topics:${topic}`)?.name,
      );
      return {
        uid: `event-${data.uid}@melb.dev`,
        title: data.title,
        start,
        end,
        allDay: data.allDay ?? false,
        group,
        topics,
        eventType: data.eventType,
        paid: data.paid,
        format: data.format,
        venue: venue?.name,
        location: venue ? `${venue.name}, ${venue.address}, ${venue.suburb}` : 'Online',
        url: data.url,
        note: data.rsvpNote,
        status: data.status ?? 'scheduled',
        revision: data.revision ?? 0,
        stamp: data.updated
          ? data.updated instanceof Date
            ? data.updated
            : new Date(`${data.updated}T00:00:00Z`)
          : start,
      } as ExpectedEvent;
    })
    .filter((event) => (event.end ?? event.start).getTime() >= cutoff)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title));
  return { events };
}

function assertUniqueExact(actual: string[], expected: string[], label: string, errors: string[]) {
  if (new Set(actual).size !== actual.length) errors.push(`${label}s must be unique`);
  if (
    actual.length !== expected.length ||
    [...actual].sort().join('\n') !== [...expected].sort().join('\n')
  )
    errors.push(`${label} set/count does not match source content`);
}

export function validateRss(rss: string, expected: ExpectedFeeds): string[] {
  const errors: string[] = [];
  let valid;
  try {
    valid = SyntaxValidator.validate(rss);
  } catch (error) {
    return [`RSS is malformed XML: ${error instanceof Error ? error.message : String(error)}`];
  }
  if (valid !== true) return [`RSS is malformed XML: ${valid.err.msg}`];
  let document: any;
  try {
    document = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(rss);
  } catch (error) {
    return [`RSS cannot be parsed: ${String(error)}`];
  }
  const channel = document?.rss?.channel;
  if (text(document?.rss?.['@_version']) !== '2.0') errors.push('RSS version must be 2.0');
  if (!channel?.title || !channel?.link || !channel?.description)
    errors.push('RSS channel is missing required fields');
  const items = list<any>(channel?.item);
  const guids = items.map((item) => text(item.guid?.['#text'] ?? item.guid));
  assertUniqueExact(
    guids,
    expected.events.map((event) => event.uid),
    'RSS GUID',
    errors,
  );
  const byUid = new Map(expected.events.map((event) => [event.uid, event]));
  for (const item of items) {
    const uid = text(item.guid?.['#text'] ?? item.guid);
    const event = byUid.get(uid);
    if (!item.title || !item.link || !item.description || !item.pubDate || !uid)
      errors.push(`RSS item ${uid || '(unknown)'} is missing required fields`);
    if (item.guid?.['@_isPermaLink'] !== 'false')
      errors.push(`RSS item ${uid} GUID must be stable and non-permalink`);
    if (!event) continue;
    if (text(item.title) !== event.title) errors.push(`RSS ${uid} title does not match source`);
    if (text(item.link) !== event.url) errors.push(`RSS ${uid} link does not match source`);
    if (new Date(text(item.pubDate)).getTime() !== event.start.getTime())
      errors.push(`RSS ${uid} date does not match source start`);
    const description = text(item.description);
    for (const required of [
      event.group,
      eventTypeNames[event.eventType],
      event.paid ? 'Paid' : 'Free',
      formatNames[event.format],
      event.format !== 'online' ? event.venue : undefined,
      ...event.topics,
      event.note,
      event.status,
    ].filter(Boolean) as string[])
      if (!description.includes(required))
        errors.push(`RSS ${uid} description is missing ${required}`);
  }
  const starts = items.map((item) => new Date(text(item.pubDate)).getTime());
  if (starts.some((start, index) => index > 0 && start < starts[index - 1]!))
    errors.push('RSS items are not chronological');
  return errors;
}

const iso = (property: any) => property?.getFirstValue()?.toJSDate().toISOString();

export function validateIcs(ics: string, expected: ExpectedFeeds): string[] {
  const errors: string[] = [];
  if (/(^|[^\r])\n/.test(ics) || /\r(?!\n)/.test(ics)) errors.push('ICS must use CRLF only');
  const lines = ics.split('\r\n');
  lines.forEach((line, index) => {
    if (Buffer.byteLength(line, 'utf8') > 75)
      errors.push(`ICS physical line ${index + 1} exceeds 75 octets`);
    if (/^[ \t]/.test(line) && (index === 0 || lines[index - 1] === ''))
      errors.push(`ICS line ${index + 1} has an invalid continuation`);
  });
  let calendar: any;
  try {
    calendar = new ICAL.Component(ICAL.parse(ics));
  } catch (error) {
    return [...errors, `ICS cannot be parsed: ${String(error)}`];
  }
  if (calendar.name !== 'vcalendar' || !calendar.getFirstPropertyValue('version'))
    errors.push('ICS is missing VCALENDAR/version');
  else if (text(calendar.getFirstPropertyValue('version')) !== '2.0')
    errors.push('ICS version must be 2.0');
  const components = calendar.getAllSubcomponents('vevent');
  const uids = components.map((component: any) => text(component.getFirstPropertyValue('uid')));
  assertUniqueExact(
    uids,
    expected.events.map((event) => event.uid),
    'VEVENT UID',
    errors,
  );
  const byUid = new Map(expected.events.map((event) => [event.uid, event]));
  for (const component of components) {
    const uid = text(component.getFirstPropertyValue('uid'));
    const event = byUid.get(uid);
    const required = [
      'uid',
      'summary',
      'description',
      'dtstart',
      'dtstamp',
      'location',
      'url',
      'sequence',
      'status',
    ];
    for (const name of required)
      if (!component.getFirstProperty(name))
        errors.push(`VEVENT ${uid || '(unknown)'} is missing ${name.toUpperCase()}`);
    if (!event) continue;
    if (event.end && !component.getFirstProperty('dtend'))
      errors.push(`VEVENT ${uid} is missing DTEND`);
    if (!event.end && component.getFirstProperty('dtend'))
      errors.push(`VEVENT ${uid} has an unexpected DTEND`);
    const value = (name: string) => text(component.getFirstPropertyValue(name));
    if (value('summary') !== event.title) errors.push(`VEVENT ${uid} title does not match source`);
    if (value('location') !== event.location)
      errors.push(`VEVENT ${uid} location does not match source`);
    if (value('url') !== event.url) errors.push(`VEVENT ${uid} URL does not match source`);
    if (Number(component.getFirstPropertyValue('sequence')) !== event.revision)
      errors.push(`VEVENT ${uid} sequence does not match source`);
    const status = event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';
    if (value('status').toUpperCase() !== status)
      errors.push(`VEVENT ${uid} status does not match source`);
    for (const [name, date] of [
      ['dtstart', event.start],
      ['dtend', event.end],
      ['dtstamp', event.stamp],
    ] as const) {
      const property = component.getFirstProperty(name);
      if (property && date) {
        if (event.allDay && name === 'dtstart') {
          if (property.type !== 'date' || value(name) !== localDate(date))
            errors.push(`VEVENT ${uid} DTSTART does not match source date`);
        } else {
          if (iso(property) !== date.toISOString())
            errors.push(`VEVENT ${uid} ${name.toUpperCase()} does not match source`);
          if (property.getFirstValue()?.zone !== ICAL.Timezone.utcTimezone)
            errors.push(`VEVENT ${uid} ${name.toUpperCase()} must be UTC`);
        }
      }
    }
  }
  return errors;
}

export function validateBuild(root = 'dist', contentRoot?: string) {
  for (const file of [
    'index.html',
    'events.xml',
    'events.ics',
    'robots.txt',
    'sitemap-index.xml',
    '404.html',
  ])
    if (!existsSync(`${root}/${file}`)) throw new Error(`Missing ${root}/${file}`);
  const expected = expectedFeeds(contentRoot);
  const errors = [
    ...validateRss(readFileSync(`${root}/events.xml`, 'utf8'), expected),
    ...validateIcs(readFileSync(`${root}/events.ics`, 'utf8'), expected),
  ];
  for (const file of ['index.html', 'groups/index.html', 'about/index.html']) {
    const html = readFileSync(`${root}/${file}`, 'utf8');
    for (const marker of [
      'lang="en-AU"',
      '<main',
      '<h1',
      'href="#main"',
      'https://github.com/melb-dev/website/issues',
    ])
      if (!html.includes(marker))
        errors.push(`${root}/${file} is missing accessibility marker ${marker}`);
  }
  for (const file of readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((file) =>
    file.endsWith('.html'),
  )) {
    const html = readFileSync(`${root}/${file}`, 'utf8');
    for (const match of html.matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"[^>]*>/gi)) {
      const [anchor, href] = match;
      if (new URL(href).hostname === 'melb.dev') continue;
      if (!anchor.includes('target="_blank"'))
        errors.push(`${root}/${file} external link ${href} must open in a new tab`);
      if (!anchor.includes('rel="nofollow noopener noreferrer"'))
        errors.push(`${root}/${file} external link ${href} is missing the required rel`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Validated generated routes, accessibility smoke checks, and feeds.');
}

if (process.argv[1]?.endsWith('validate-build.ts')) validateBuild();
