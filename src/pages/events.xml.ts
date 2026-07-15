import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { sortEvents } from '../lib/events';
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
      const g = groups.find((x) => x.id === e.data.group.id),
        v = venues.find((x) => x.id === e.data.venue?.id);
      return {
        title: e.data.title,
        link: e.data.url,
        customData: `<guid isPermaLink="false">event-${e.data.uid}@melb.dev</guid>`,
        pubDate: e.data.start,
        description: [
          g?.data.name,
          v?.data.name ?? e.data.format,
          e.data.topics.map((r) => topics.find((t) => t.id === r.id)?.data.name).join(', '),
          e.data.rsvpNote,
          e.data.status,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    }),
  });
}
