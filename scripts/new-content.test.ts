import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contentPath,
  melbourneIso,
  nextWeekdayDates,
  slug,
  template,
  uuidv7,
  writeContent,
} from './new-content';

describe('new content helpers', () => {
  it('creates slugged paths', () => {
    expect(slug('Café & Code!')).toBe('cafe-code');
    expect(contentPath('group', 'Melbourne TypeScript')).toBe(
      'src/content/groups/melbourne-typescript.yaml',
    );
  });
  it('creates dated event paths containing group and title', () => {
    expect(contentPath('event', 'Web Night!', '2026-07-16', 'Melb Web')).toBe(
      'src/content/events/20260716-melb-web-web-night.yaml',
    );
  });
  it('creates separate website and event-listing URLs for groups', () => {
    const group = template('group', 'Example Group', {
      websiteUrl: 'https://example.org/',
      eventsUrl: 'https://events.example.org/',
      topic: 'software-engineering',
    });
    expect(group).toMatchObject({
      websiteUrl: 'https://example.org/',
      eventsUrl: 'https://events.example.org/',
    });
  });
  it('labels new events as meetups by default', () => {
    expect(template('event', 'Example event')).toMatchObject({ eventType: 'meetup', paid: false });
  });
  it('generates UUIDv7 values', () =>
    expect(uuidv7()).toMatch(
      /^0[0-9a-f]{7}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ));
  it('rejects collisions', () => {
    const base = mkdtempSync(join(tmpdir(), 'new-content-'));
    mkdirSync(join(base, 'src/content/groups'), { recursive: true });
    writeFileSync(join(base, 'src/content/groups/test.yaml'), 'existing');
    expect(() => writeContent('src/content/groups/test.yaml', {}, base)).toThrow(
      /Refusing to overwrite/,
    );
  });
  it('uses the correct Melbourne daylight-saving offset', () => {
    expect(melbourneIso('2026-01-15', '18:00')).toMatch(/\+11:00$/);
    expect(melbourneIso('2026-07-15', '18:00')).toMatch(/\+10:00$/);
  });
  it('offers eight future Melbourne dates for the selected weekday', () => {
    const dates = nextWeekdayDates(4, new Date('2026-07-15T12:00:00+10:00'));
    expect(dates).toHaveLength(8);
    expect(dates[0]).toBe('2026-07-16');
    expect(dates.every((date) => new Date(`${date}T12:00:00Z`).getUTCDay() === 4)).toBe(true);
  });
});
