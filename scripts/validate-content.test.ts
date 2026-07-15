import { describe, it, expect } from 'vitest';
import { validate } from './validate-content';
const row = (kind: string, id: string, uid: string, data: any) => ({
  kind,
  id,
  path: id + '.yaml',
  data: { uid, ...data },
});
const u = (n: number) => `019b0b73-1000-7000-8000-${String(n).padStart(12, '0')}`;
describe('content integrity', () => {
  it('rejects duplicate identity and missing references', () => {
    const rows = [
      row('events', '20260101-nope-test', u(1), {
        title: 'Test',
        start: '2026-01-01T10:00:00+11:00',
        group: 'nope',
        topics: ['missing'],
        eventType: 'meetup',
        paid: false,
        format: 'online',
      }),
      row('topics', 'x', u(1), { name: 'x' }),
    ];
    expect(validate(rows).join()).toMatch(/duplicate uid|missing group|missing topic/);
  });
  it('allows a group rename when its UUID is preserved', () => {
    const old = row('groups', 'old-name', u(2), { topics: ['topic'] });
    const renamed = row('groups', 'new-name', u(2), { topics: ['topic'] });
    const topic = row('topics', 'topic', u(3), { name: 'Topic' });
    expect(validate([renamed, topic], [old])).toEqual([]);
  });
  it('rejects a group rename that replaces its UUID', () => {
    const old = row('groups', 'old-name', u(4), { topics: ['topic'] });
    const renamed = row('groups', 'new-name', u(5), { topics: ['topic'] });
    const topic = row('topics', 'topic', u(6), { name: 'Topic' });
    expect(validate([renamed, topic], [old]).join()).toMatch(
      /content identity missing; groups UUID must be preserved across renames and deletion/,
    );
  });
  it('still rejects event deletion', () =>
    expect(validate([], [row('events', 'old', u(7), {})]).join()).toMatch(
      /event deletion forbidden/,
    ));
  it('rejects changed UUIDs at a stable path', () => {
    const old = row('groups', 'group', u(8), { topics: ['topic'] });
    const now = row('groups', 'group', u(9), { topics: ['topic'] });
    const topic = row('topics', 'topic', u(10), { name: 'Topic' });
    expect(validate([now, topic], [old]).join()).toMatch(/UUID cannot change/);
  });
  it('rejects changing an identity to another content type', () => {
    const old = row('groups', 'group', u(11), { topics: ['topic'] });
    const now = row('venues', 'venue', u(11), { name: 'Venue' });
    expect(validate([now], [old]).join()).toMatch(/uid changed type/);
  });
  it('requires offset datetimes and non-empty topics', () => {
    const event = row('events', '20260101-group-test', u(12), {
      title: 'Test',
      start: '2026-01-01T10:00:00',
      group: 'group',
      topics: [],
      eventType: 'meetup',
      paid: false,
      format: 'online',
    });
    expect(validate([event]).join()).toMatch(/UTC offset|at least one topic/);
  });
  it('requires a new revision and updated date for material changes', () => {
    const data = {
      title: 'Test',
      start: '2026-01-01T10:00:00+11:00',
      group: 'group',
      topics: ['topic'],
      eventType: 'meetup',
      paid: false,
      format: 'online',
      revision: 0,
      updated: '2025-12-01',
    };
    const old = row('events', '20260101-group-test', u(13), data);
    const now = row('events', '20260101-group-test-renamed', u(13), {
      ...data,
      title: 'Test Renamed',
    });
    expect(validate([now], [old]).join()).toMatch(/revision increment/);
  });
});
