import ical, { ICalCalendarMethod, ICalEventStatus } from 'ical-generator';
import { getCollection } from 'astro:content';
import { localDate, sortEvents } from '../lib/events';
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
  });
  for (const e of sortEvents(
    events.filter((e) => (e.data.end ?? e.data.start).getTime() >= now - 30 * 864e5),
    true,
  )) {
    const g = groups.find((x) => x.id === e.data.group.id),
      v = venues.find((x) => x.id === e.data.venue?.id);
    cal.createEvent({
      id: `event-${e.data.uid}@melb.dev`,
      stamp: e.data.updated ?? e.data.start,
      start: e.data.allDay ? new Date(`${localDate(e.data.start)}T00:00:00Z`) : e.data.start,
      end: e.data.end,
      allDay: e.data.allDay,
      summary: e.data.title,
      description: `${e.data.paid ? 'Paid' : 'Free'} ${e.data.eventType === 'meetup' ? 'meetup' : 'conference'} organised by ${g?.data.name}. ${e.data.rsvpNote ?? ''}`,
      location: v ? `${v.data.name}, ${v.data.address}, ${v.data.suburb}` : 'Online',
      url: e.data.url,
      sequence: e.data.revision,
      status: e.data.status === 'cancelled' ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
    });
  }
  return new Response(cal.toString(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="events.ics"',
    },
  });
}
