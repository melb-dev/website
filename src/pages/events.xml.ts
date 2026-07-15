import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { sortEvents } from '../lib/events';

const formatNames = {
  'in-person': 'In person',
  online: 'Online',
  hybrid: 'Hybrid',
} as const;
const eventTypeNames = { meetup: 'Meetup', conference: 'Conference' } as const;

export async function GET(context: any) {
  const now = Date.now();
  const [events, groups, venues, topics] = await Promise.all([
    getCollection('events'),
    getCollection('groups'),
    getCollection('venues'),
    getCollection('topics'),
  ]);
  const cutoff = now - 30 * 864e5;
  const included = sortEvents(
    events.filter((e) => (e.data.end ?? e.data.start).getTime() >= cutoff),
    true,
  );
  return rss({
    title: 'melb.dev events',
    description: 'Tech community events in Melbourne',
    site: context.site,
    items: included.map((e) => {
      const group = groups.find((item) => item.id === e.data.group.id);
      const venue = venues.find((item) => item.id === e.data.venue?.id);
      return {
        title: e.data.title,
        link: e.data.url,
        customData: `<guid isPermaLink="false">event-${e.data.uid}@melb.dev</guid>`,
        pubDate: e.data.start,
        description: [
          group?.data.name,
          eventTypeNames[e.data.eventType],
          e.data.paid ? 'Paid' : 'Free',
          formatNames[e.data.format],
          venue?.data.name,
          e.data.topics
            .map((reference) => topics.find((topic) => topic.id === reference.id)?.data.name)
            .join(', '),
          e.data.rsvpNote,
          e.data.status,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    }),
  });
}
