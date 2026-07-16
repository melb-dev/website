import { getVtimezoneComponent } from '@touch4it/ical-timezones';
import ical, { ICalCalendarMethod, ICalEventStatus } from 'ical-generator';
import { getCollection } from 'astro:content';
import { localDate, MELBOURNE_TZ, sortEvents } from '../lib/events';

function formatUtc(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function melbourneWallTime(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: MELBOURNE_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
}

export async function GET() {
  const now = Date.now();
  const [events, groups, venues] = await Promise.all([
    getCollection('events'),
    getCollection('groups'),
    getCollection('venues'),
  ]);
  const cal = ical({
    name: 'melb.dev events',
    method: ICalCalendarMethod.PUBLISH,
    prodId: { company: 'melb.dev', product: 'events' },
    timezone: {
      name: MELBOURNE_TZ,
      generator: (timezone) => {
        const component = getVtimezoneComponent(timezone);
        if (!component) throw new Error(`Unable to generate VTIMEZONE for ${timezone}`);
        return component;
      },
    },
  });
  const sortedEvents = sortEvents(
    events.filter((e) => (e.data.end ?? e.data.start).getTime() >= now - 30 * 864e5),
    true,
  );
  const stamps: Date[] = [];
  for (const e of sortedEvents) {
    const g = groups.find((x) => x.id === e.data.group.id),
      v = venues.find((x) => x.id === e.data.venue?.id);
    stamps.push(e.data.updated ?? e.data.start);
    cal.createEvent({
      id: `event-${e.data.uid}@melb.dev`,
      stamp: e.data.updated ?? e.data.start,
      start: e.data.allDay
        ? new Date(`${localDate(e.data.start)}T00:00:00Z`)
        : melbourneWallTime(e.data.start),
      end: e.data.end ? melbourneWallTime(e.data.end) : undefined,
      allDay: e.data.allDay,
      timezone: e.data.allDay ? undefined : MELBOURNE_TZ,
      summary: e.data.title,
      description: `${e.data.paid ? 'Paid' : 'Free'} ${e.data.eventType === 'meetup' ? 'meetup' : 'conference'} organised by ${g?.data.name}. ${e.data.rsvpNote ?? ''}`,
      location: v ? `${v.data.name}, ${v.data.address}, ${v.data.suburb}` : 'Online',
      url: e.data.url,
      sequence: e.data.revision,
      status: e.data.status === 'cancelled' ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
    });
  }
  let stampIndex = 0;
  const body = cal.toString().replace(/^DTSTAMP:[^\r\n]+/gm, () => {
    const stamp = stamps[stampIndex++];
    if (!stamp) throw new Error('Generated more DTSTAMP properties than events');
    return `DTSTAMP:${formatUtc(stamp)}`;
  });
  if (stampIndex !== stamps.length)
    throw new Error('Generated fewer DTSTAMP properties than events');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="events.ics"',
    },
  });
}
