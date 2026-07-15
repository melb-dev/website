import { describe, expect, it } from 'vitest';
import { isFuture, localDate, slug, sortEvents } from './events';
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
  it('sorts and slugs', () => {
    expect(sortEvents([e('b', '2026-01-02'), e('a', '2026-01-01')], true)[0].data.title).toBe('a');
    expect(slug('C# / .NET — Night')).toBe('c-net-night');
  });
});
