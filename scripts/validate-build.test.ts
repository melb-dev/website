import { describe, expect, it } from 'vitest';
import { validateIcs, validateRss, type ExpectedFeeds } from './validate-build';

const expected: ExpectedFeeds = {
  events: [
    {
      uid: 'event-1@melb.dev',
      title: 'Test',
      start: new Date('2026-07-15T08:00:00Z'),
      end: new Date('2026-07-15T09:00:00Z'),
      allDay: false,
      group: 'Group',
      topics: ['Web'],
      eventType: 'meetup',
      paid: false,
      format: 'in-person',
      venue: 'Hall',
      location: 'Hall, 1 Road, Melbourne',
      url: 'https://example.org/event',
      status: 'scheduled',
      revision: 0,
      stamp: new Date('2026-07-01T00:00:00Z'),
    },
  ],
};

describe('generated feed validation', () => {
  it('rejects malformed RSS and a missing human-readable format', () => {
    expect(validateRss('<rss>', expected).join()).toMatch(/malformed/);
    const rss = `<?xml version="1.0"?><rss><channel><title>x</title><link>x</link><description>x</description><item><title>Test</title><link>https://example.org/event</link><guid isPermaLink="false">event-1@melb.dev</guid><description>Group · Meetup · Free · Hall · Web · scheduled</description><pubDate>Wed, 15 Jul 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
    expect(validateRss(rss, expected).join()).toMatch(/missing In person/);
  });

  it('rejects malformed ICS and missing required VEVENT fields', () => {
    expect(validateIcs('not a calendar\n', expected).join()).toMatch(/CRLF|parsed/);
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:event-1@melb.dev',
      'SUMMARY:Test',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    expect(validateIcs(ics, expected).join()).toMatch(/missing DTSTART/);
  });

  it('allows omitted DTEND only when the source event has no end', () => {
    const withoutEnd: ExpectedFeeds = {
      events: [{ ...expected.events[0], end: undefined }],
    };
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:event-1@melb.dev',
      'DTSTAMP:20260701T000000Z',
      'DTSTART:20260715T080000Z',
      'SUMMARY:Test',
      'DESCRIPTION:Organised by Group.',
      'LOCATION:Hall\\, 1 Road\\, Melbourne',
      'URL:https://example.org/event',
      'SEQUENCE:0',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');
    expect(validateIcs(ics, withoutEnd)).toEqual([]);
    expect(validateIcs(ics, expected).join()).toMatch(/missing DTEND/);
  });

  it('requires cancelled events to remain marked as cancelled in both feeds', () => {
    const cancelled: ExpectedFeeds = {
      events: [{ ...expected.events[0], status: 'cancelled' }],
    };
    const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title><link>https://example.org/</link><description>x</description><item><title>Test</title><link>https://example.org/event</link><guid isPermaLink="false">event-1@melb.dev</guid><description>Group · Meetup · Free · In person · Hall · Web · cancelled</description><pubDate>Wed, 15 Jul 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
    expect(validateRss(rss, cancelled)).toEqual([]);
    expect(validateRss(rss.replace('cancelled', 'scheduled'), cancelled).join()).toMatch(
      /missing cancelled/,
    );

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:event-1@melb.dev',
      'DTSTAMP:20260701T000000Z',
      'DTSTART:20260715T080000Z',
      'DTEND:20260715T090000Z',
      'SUMMARY:Test',
      'DESCRIPTION:Organised by Group.',
      'LOCATION:Hall\\, 1 Road\\, Melbourne',
      'URL:https://example.org/event',
      'SEQUENCE:0',
      'STATUS:CANCELLED',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');
    expect(validateIcs(ics, cancelled)).toEqual([]);
    expect(validateIcs(ics.replace('CANCELLED', 'CONFIRMED'), cancelled).join()).toMatch(
      /status does not match/,
    );
  });
});
