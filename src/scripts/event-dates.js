import { isFuture, isUpcomingCfp, sortCfps, sortEvents } from '../lib/events';

const eventData = ({ name, start, end, deadline }) => ({
  title: name,
  start: new Date(start),
  end: end ? new Date(end) : undefined,
  cfpDeadline: deadline ? new Date(deadline) : undefined,
});

export function refreshEventDates(cards, kind = 'events', now = new Date()) {
  if (kind === 'groups') {
    for (const card of cards) {
      const events = JSON.parse(card.dataset.events).map((event) => ({ data: eventData(event) }));
      const next = sortEvents(events, true).find((event) => isFuture(event, now));
      const preview = card.querySelector('[data-next-event]');
      preview.hidden = !next;
      preview.querySelector('strong').textContent = next?.data.title ?? '';
    }
    return cards;
  }

  const events = cards.map((card) => ({ card, data: eventData(card.dataset) }));
  for (const { card, data } of events) {
    const past = !(kind === 'cfps' ? isUpcomingCfp({ data }, now) : isFuture({ data }, now));
    card.dataset.period = past ? 'past' : 'future';
    card.querySelector('[data-past-badge]').hidden = !past;
    if (kind === 'cfps') {
      const label = data.cfpDeadline ? 'CFP closed' : 'Event ended';
      card.querySelector('[data-past-badge]').textContent = label;
      card.querySelector('[data-cfp-closed]').textContent = data.cfpDeadline
        ? 'Submissions closed'
        : 'Event ended';
      card.querySelector('[data-cfp-closed]').hidden = !past;
      card.querySelector('[data-cfp-open]').hidden = past;
      const verb = card.querySelector('[data-cfp-verb]');
      if (verb) verb.textContent = past ? 'closed' : 'closes';
      const rolling = card.querySelector('[data-cfp-rolling]');
      if (rolling) rolling.hidden = past;
    } else {
      const action = card.querySelector('[data-event-action]');
      action.classList.toggle('btn-past', past);
      action.classList.toggle('btn-primary', !past);
      action.querySelector('[data-event-action-label]').textContent = past
        ? 'View past event'
        : 'View event & RSVP';
    }
  }
  const sort = kind === 'cfps' ? sortCfps : sortEvents;
  return [
    ...sort(
      events.filter(({ card }) => card.dataset.period === 'future'),
      true,
    ),
    ...sort(
      events.filter(({ card }) => card.dataset.period === 'past'),
      false,
    ),
  ].map(({ card }) => card);
}

export function watchEventDates(refresh) {
  refresh();
  setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  addEventListener('pageshow', refresh);
}
