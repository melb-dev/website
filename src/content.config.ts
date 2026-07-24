import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
const uid = z
  .string()
  .regex(
    /^0[0-9a-f]{7}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'UUIDv7 required',
  );
const https = z.string().url().startsWith('https://');
const datetime = z.preprocess(
  (value) => (value instanceof Date ? value : new Date(value as string)),
  z.date(),
);
const date = z.preprocess(
  (value) => (value instanceof Date ? value : new Date(`${value}T00:00:00Z`)),
  z.date(),
);
const unique = (schema: any) =>
  z
    .array(schema)
    .min(1)
    .refine((v) => new Set(v).size === v.length, 'Must be unique');
const topics = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/topics' }),
  schema: z
    .object({
      uid,
      name: z.string().min(1),
      category: z.enum(['general', 'programming-language']),
      description: z.string().optional(),
    })
    .strict(),
});
const venues = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/venues' }),
  schema: z
    .object({
      uid,
      name: z.string(),
      address: z.string(),
      suburb: z.string(),
      state: z.string().default('VIC'),
      postcode: z.string().regex(/^\d{4}$/),
      url: https.optional(),
      mapUrl: https.optional(),
      accessibility: z.string().optional(),
    })
    .strict(),
});
const groups = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/groups' }),
  schema: z
    .object({
      uid,
      name: z.string(),
      summary: z.string().max(180),
      description: z.string(),
      topics: unique(reference('topics')),
      eventTypes: unique(z.enum(['meetup', 'conference'])),
      websiteUrl: https,
      eventsUrl: https,
      eventsFetchedAt: datetime,
      location: z.string().default('Melbourne'),
      logo: z.string().optional(),
      contact: z.union([z.email(), https]).optional(),
      communityFirst: z.boolean().default(false),
      status: z.enum(['active', 'inactive']).default('active'),
    })
    .strict(),
});
const events = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/events' }),
  schema: z
    .object({
      uid,
      title: z.string(),
      start: datetime,
      end: datetime.optional(),
      allDay: z.boolean().default(false),
      group: reference('groups'),
      topics: unique(reference('topics')),
      eventType: z.enum(['meetup', 'conference']),
      paid: z.boolean(),
      format: z.enum(['in-person', 'online', 'hybrid']),
      venue: reference('venues').optional(),
      url: https,
      rsvpNote: z.string().max(160).optional(),
      status: z.enum(['scheduled', 'postponed', 'cancelled']).default('scheduled'),
      revision: z.number().int().nonnegative().default(0),
      updated: date.optional(),
    })
    .strict()
    .superRefine((e, ctx) => {
      if (e.end && e.end <= e.start)
        ctx.addIssue({ code: 'custom', message: 'end must follow start' });
      if (e.allDay && e.end)
        ctx.addIssue({ code: 'custom', message: 'all-day events cannot have an end time' });
      if (e.format === 'online' && e.venue)
        ctx.addIssue({ code: 'custom', message: 'online events cannot have a venue' });
      if (e.format !== 'online' && !e.venue)
        ctx.addIssue({ code: 'custom', message: 'venue required' });
      if (e.revision > 0 && !e.updated)
        ctx.addIssue({ code: 'custom', message: 'updated required after revision' });
    }),
});
export const collections = { events, groups, venues, topics };
