import { describe, expect, it } from 'vitest';
import { formatMelbourneDateTime, isFuture, localDate, slug, sortCfps, sortEvents } from './events';
const e = (title: string, start: string, end?: string) => ({
  data: { title, start: new Date(start), end: end ? new Date(end) : undefined },
});
describe('Melbourne event dates', () => {
  it('keeps finished events on their local day', () =>
    expect(
      isFuture(
        e('x', '2026-07-14T23:00:00Z', '2026-07-15T01:00:00Z'),
        new Date('2026-07-15T12:00:00Z'),
      ),
    ).toBe(true));
  it('handles AEDT dates', () =>
    expect(localDate(new Date('2026-01-01T13:30:00Z'))).toBe('2026-01-02'));
  it('shows deadline times in Melbourne time', () => {
    expect(formatMelbourneDateTime(new Date('2026-09-18T13:59:00Z'))).toContain('11:59 pm');
    expect(formatMelbourneDateTime(new Date('2026-09-18T13:59:00Z'))).toContain('AEST');
  });
  it('sorts and slugs', () => {
    expect(sortEvents([e('b', '2026-01-02'), e('a', '2026-01-01')], true)[0].data.title).toBe('a');
    expect(slug('C# / .NET — Night')).toBe('c-net-night');
  });
  it('sorts CFPs by deadline, treating rolling CFPs as closing two weeks before the event', () => {
    const deadline = new Date('2026-09-18T13:59:00Z');
    const rolling = e('Rolling', '2026-10-01T08:00:00Z');
    const later = e('Later event', '2026-12-03T08:00:00Z');
    const earlier = e('Earlier event', '2026-10-28T08:00:00Z');
    const laterEvent = { ...later, data: { ...later.data, cfpDeadline: deadline } };
    const earlierEvent = { ...earlier, data: { ...earlier.data, cfpDeadline: deadline } };
    expect(
      sortCfps([laterEvent, earlierEvent, rolling], true).map((item) => item.data.title),
    ).toEqual(['Rolling', 'Earlier event', 'Later event']);
  });
});
