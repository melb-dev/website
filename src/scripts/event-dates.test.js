import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshEventDates, watchEventDates } from './event-dates';

function card(name, start, end, deadline) {
  const label = { textContent: 'View event & RSVP' };
  const nodes = {
    '[data-past-badge]': { hidden: true, textContent: 'Past event' },
    '[data-event-action]': { classList: { toggle: vi.fn() }, querySelector: () => label },
    '[data-cfp-closed]': { hidden: true, textContent: '' },
    '[data-cfp-open]': { hidden: false },
    '[data-cfp-verb]': deadline ? { textContent: 'closes' } : null,
    '[data-cfp-rolling]': deadline ? null : { hidden: false },
  };
  return {
    dataset: { name, start, end, deadline, period: 'future' },
    querySelector: (selector) => nodes[selector],
    label,
  };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('browser event dates', () => {
  it('reclassifies stale cards using Melbourne days, end dates and chronological ordering', () => {
    const old = card('Old', '2026-10-06T17:30:00+11:00');
    const yesterday = card('Yesterday', '2026-10-07T17:30:00+11:00');
    const today = card('Today', '2026-10-08T08:00:00+11:00', '2026-10-08T09:00:00+11:00');
    const ongoing = card('Ongoing', '2026-10-07T09:00:00+11:00', '2026-10-09T17:00:00+11:00');
    const future = card('Future', '2026-10-10T18:00:00+11:00');
    today.dataset.period = 'past';
    const ordered = refreshEventDates(
      [future, old, today, yesterday, ongoing],
      'events',
      new Date('2026-10-08T03:14:00Z'),
    );
    expect(ordered.map((item) => item.dataset.name)).toEqual([
      'Ongoing',
      'Today',
      'Future',
      'Yesterday',
      'Old',
    ]);
    expect([old, yesterday, today, ongoing].map((item) => item.dataset.period)).toEqual([
      'past',
      'past',
      'future',
      'future',
    ]);
    expect(yesterday.querySelector('[data-past-badge]').hidden).toBe(false);
    expect(yesterday.label.textContent).toBe('View past event');
    expect(today.querySelector('[data-past-badge]').hidden).toBe(true);
    expect(today.label.textContent).toBe('View event & RSVP');
  });

  it('moves no-end and all-day events to Past at Melbourne midnight, not UTC midnight', () => {
    for (const start of ['2026-10-08T18:00:00+11:00', '2026-10-08T00:00:00+11:00']) {
      const event = card('Local day', start);
      refreshEventDates([event], 'events', new Date('2026-10-08T12:59:59.999Z'));
      expect(event.dataset.period).toBe('future');
      refreshEventDates([event], 'events', new Date('2026-10-08T13:00:00Z'));
      expect(event.dataset.period).toBe('past');
    }
  });

  it('closes fixed CFPs at the deadline and rolling CFPs after the event local day', () => {
    const fixed = card(
      'Fixed',
      '2026-11-11T18:00:00+11:00',
      undefined,
      '2026-10-08T14:30:00+11:00',
    );
    const rolling = card('Rolling', '2026-10-07T17:30:00+11:00');
    refreshEventDates([fixed, rolling], 'cfps', new Date('2026-10-08T03:30:00Z'));
    expect(fixed.dataset.period).toBe('future');
    expect(fixed.querySelector('[data-cfp-open]').hidden).toBe(false);
    expect(rolling.dataset.period).toBe('past');
    expect(rolling.querySelector('[data-cfp-rolling]').hidden).toBe(true);
    expect(rolling.querySelector('[data-past-badge]').textContent).toBe('Event ended');
    refreshEventDates([fixed], 'cfps', new Date('2026-10-08T03:30:00.001Z'));
    expect(fixed.dataset.period).toBe('past');
    expect(fixed.querySelector('[data-cfp-open]').hidden).toBe(true);
    expect(fixed.querySelector('[data-cfp-closed]').hidden).toBe(false);
    expect(fixed.querySelector('[data-cfp-verb]').textContent).toBe('closed');
  });

  it('advances the group next-event preview and clears it when no future events remain', () => {
    const strong = { textContent: 'Stale preview' };
    const preview = { hidden: false, querySelector: () => strong };
    const group = {
      dataset: {
        events: JSON.stringify([
          { name: 'Later', start: '2026-10-10T18:00:00+11:00' },
          { name: 'Expired', start: '2026-10-06T18:00:00+11:00' },
          { name: 'Ongoing', start: '2026-10-07T09:00:00+11:00', end: '2026-10-09T17:00:00+11:00' },
        ]),
      },
      querySelector: () => preview,
    };
    refreshEventDates([group], 'groups', new Date('2026-10-08T03:14:00Z'));
    expect(strong.textContent).toBe('Ongoing');
    refreshEventDates([group], 'groups', new Date('2026-10-09T13:00:00Z'));
    expect(strong.textContent).toBe('Later');
    refreshEventDates([group], 'groups', new Date('2026-10-10T13:00:00Z'));
    expect(preview.hidden).toBe(true);
    expect(strong.textContent).toBe('');
  });

  it('refreshes on load, every minute, tab visibility and back/forward restoration', () => {
    vi.useFakeTimers();
    const listeners = {};
    const document = {
      hidden: true,
      addEventListener: (name, fn) => {
        listeners[name] = fn;
      },
    };
    vi.stubGlobal('document', document);
    vi.stubGlobal('addEventListener', (name, fn) => {
      listeners[name] = fn;
    });
    const refresh = vi.fn();
    watchEventDates(refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    listeners.visibilitychange();
    expect(refresh).toHaveBeenCalledTimes(2);
    document.hidden = false;
    listeners.visibilitychange();
    listeners.pageshow();
    expect(refresh).toHaveBeenCalledTimes(4);
  });
});
