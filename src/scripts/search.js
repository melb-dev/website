const root = document.querySelector('#directory');
if (root) {
  const form = root.querySelector('#filters');
  const resetButton = form.querySelector('[type="reset"]');
  const disclosure = root.querySelector('.filter-disclosure');
  const desktopFilters = matchMedia('(min-width: 1024px)');
  let mobileFiltersOpen = Boolean(location.search);
  disclosure.open = desktopFilters.matches || mobileFiltersOpen;
  disclosure.addEventListener('toggle', () => {
    if (!desktopFilters.matches) mobileFiltersOpen = disclosure.open;
  });
  desktopFilters.addEventListener('change', () => {
    disclosure.open = desktopFilters.matches || mobileFiltersOpen;
  });
  const cards = [...root.querySelectorAll('.directory-card')];
  const kind = root.dataset.kind;
  let searchDbPromise;
  let searchTimer;
  let runVersion = 0;

  const optionValues = (input) => (input.dataset.values ?? input.value).split(',');
  const values = (name) => [
    ...new Set([...form.querySelectorAll(`[name="${name}"]:checked`)].flatMap(optionValues)),
  ];
  const labels = (name) =>
    [...form.querySelectorAll(`[name="${name}"]:checked`)].flatMap((el) =>
      (el.dataset.labels ?? el.dataset.label).split(','),
    );
  const list = (items) =>
    items.length < 2
      ? (items[0] ?? '')
      : `${items.slice(0, -1).join(', ')}${items.length > 2 ? ',' : ''} and ${items.at(-1)}`;
  const readForm = () => ({
    q: form.elements.q.value.trim(),
    period: kind === 'events' ? form.elements.period.value : '',
    eventType: kind === 'events' ? form.elements.eventType.value : 'all',
    cost: kind === 'events' ? form.elements.cost.value : 'all',
    range: kind === 'events' ? form.elements.range.value : '',
    format: kind === 'events' ? form.elements.format.value : '',
    recommended: kind === 'groups' ? form.elements.recommended.value : 'all',
    topic: values('topic'),
    location: values('location'),
  });
  const applyUrl = () => {
    const params = new URLSearchParams(location.search);
    form.reset();
    if (params.has('q')) form.elements.q.value = params.get('q');
    for (const name of ['period', 'cost', 'range', 'format']) {
      if (kind !== 'events' || !params.has(name)) continue;
      const value = params.get(name);
      const option = form.querySelector(`[name="${name}"][value="${CSS.escape(value)}"]`);
      if (option) option.checked = true;
    }
    if (kind === 'events' && params.has('type')) {
      const value = params.get('type');
      const option = form.querySelector(`[name="eventType"][value="${CSS.escape(value)}"]`);
      if (option) option.checked = true;
    }
    if (kind === 'groups' && params.get('recommended') === 'true')
      form.querySelector('[name="recommended"][value="recommended"]').checked = true;
    for (const name of ['topic', 'location']) {
      const selected = params.getAll(name);
      for (const input of form.querySelectorAll(`[name="${name}"]`))
        input.checked = optionValues(input).some((value) => selected.includes(value));
    }
  };
  const writeUrl = (state, replace = false) => {
    const url = new URL(location.href);
    url.search = '';
    if (state.q) url.searchParams.set('q', state.q);
    if (state.period && state.period !== 'future') url.searchParams.set('period', state.period);
    if (state.eventType !== 'all') url.searchParams.set('type', state.eventType);
    if (state.cost !== 'all') url.searchParams.set('cost', state.cost);
    if (state.range) url.searchParams.set('range', state.range);
    for (const value of state.topic) url.searchParams.append('topic', value);
    for (const value of state.location) url.searchParams.append('location', value);
    if (state.format && state.format !== 'in-person') url.searchParams.set('format', state.format);
    if (kind === 'groups' && state.recommended === 'recommended')
      url.searchParams.set('recommended', 'true');
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
  };
  const dateBounds = (range) => {
    if (!range) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type).value;
    const today = `${get('year')}-${get('month')}-${get('day')}`;
    const start = new Date(`${today}T00:00:00Z`);
    const end = new Date(start);
    if (range === 'week') {
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
      end.setTime(start.getTime());
      end.setUTCDate(end.getUTCDate() + 6);
    }
    if (range === 'next-week') {
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      start.setUTCDate(start.getUTCDate() + (7 - ((day + 6) % 7)));
      end.setTime(start.getTime());
      end.setUTCDate(end.getUTCDate() + 6);
    }
    if (range === 'month') {
      start.setUTCDate(1);
      end.setUTCMonth(end.getUTCMonth() + 1, 0);
    }
    const iso = (date) => date.toISOString().slice(0, 10);
    return [iso(start), iso(end)];
  };
  const matches = (card, state, ignoreFacet) => {
    if (
      kind === 'groups' &&
      state.recommended === 'recommended' &&
      card.dataset.recommended !== 'true'
    )
      return false;
    if (kind === 'events' && state.period !== 'all' && card.dataset.period !== state.period)
      return false;
    if (
      kind === 'events' &&
      state.eventType !== 'all' &&
      card.dataset.eventType !== state.eventType
    )
      return false;
    if (
      kind === 'events' &&
      state.cost !== 'all' &&
      card.dataset.paid !== String(state.cost === 'paid')
    )
      return false;
    if (kind === 'events' && state.format !== 'any') {
      const formats = state.format === 'in-person' ? ['in-person', 'hybrid'] : ['online', 'hybrid'];
      if (!formats.includes(card.dataset.format)) return false;
    }
    const bounds = dateBounds(state.range);
    if (bounds && (card.dataset.date < bounds[0] || card.dataset.date > bounds[1])) return false;
    for (const facet of ['topic', 'location']) {
      if (facet === ignoreFacet || !state[facet].length) continue;
      const cardValues = (card.dataset[`${facet}s`] ?? card.dataset[facet] ?? '').split(',');
      if (!state[facet].some((value) => cardValues.includes(value))) return false;
    }
    return true;
  };
  const ensureSearch = () => {
    if (!searchDbPromise)
      searchDbPromise = import('@orama/orama').then(async ({ create, insertMultiple }) => {
        const db = create({ schema: { id: 'string', text: 'string', name: 'string' } });
        await insertMultiple(
          db,
          cards.map((card) => ({
            id: card.dataset.id,
            text: card.dataset.search,
            name: card.dataset.name,
          })),
        );
        return db;
      });
    return searchDbPromise;
  };
  const run = async (write = false, replace = false) => {
    const version = ++runVersion;
    const state = readForm();
    let scores = null;
    if (state.q.length >= 3) {
      const { search } = await import('@orama/orama');
      const db = await ensureSearch();
      const response = await search(db, {
        term: state.q,
        properties: ['name', 'text'],
        boost: { name: 3, text: 1 },
        tolerance: state.q.length >= 6 ? 1 : 0,
        limit: cards.length,
      });
      scores = new Map(response.hits.map((hit, index) => [hit.document.id, index]));
    }
    if (version !== runVersion) return;
    let visible = cards.filter(
      (card) => (!scores || scores.has(card.dataset.id)) && matches(card, state),
    );
    cards.forEach((card) => {
      card.hidden = !visible.includes(card);
      card.style.order = scores?.has(card.dataset.id) ? String(scores.get(card.dataset.id)) : '';
    });
    for (const fieldset of form.querySelectorAll('[data-facet-group]')) {
      const facet = fieldset.dataset.facetGroup;
      for (const input of fieldset.querySelectorAll('input')) {
        const values = optionValues(input);
        const count = cards.filter(
          (card) =>
            (!scores || scores.has(card.dataset.id)) &&
            matches(card, state, facet) &&
            values.some((value) =>
              (card.dataset[`${facet}s`] ?? card.dataset[facet] ?? '').split(',').includes(value),
            ),
        ).length;
        fieldset.querySelector(`[data-count-for="${CSS.escape(input.value)}"]`).textContent =
          `(${count})`;
        input.disabled = count === 0 && !input.checked;
      }
    }
    for (const disclosure of form.querySelectorAll('[data-facet-disclosure]')) {
      const count = disclosure.querySelectorAll('input:checked').length;
      const status = disclosure.querySelector('[data-selected-count]');
      status.textContent = `${count} selected`;
      status.hidden = count === 0;
    }
    if (kind === 'events') {
      const cost = state.cost === 'free' ? 'free ' : state.cost === 'paid' ? 'paid ' : '';
      const format =
        state.format === 'in-person' ? 'in person ' : state.format === 'online' ? 'online ' : '';
      const noun =
        state.eventType === 'meetup'
          ? `meetup${visible.length === 1 ? '' : 's'}`
          : state.eventType === 'conference'
            ? `conference${visible.length === 1 ? '' : 's'}`
            : `event${visible.length === 1 ? '' : 's'}`;
      const range =
        { today: ' today', week: ' this week', 'next-week': ' next week', month: ' this month' }[
          state.range
        ] ?? '';
      const period =
        state.period === 'future' ? ' upcoming' : state.period === 'past' ? ' in the past' : '';
      const locations = labels('location');
      const topics = labels('topic');
      root.querySelector('#count').textContent =
        `${visible.length} ${cost}${format}${noun}${period}${range}${locations.length ? ` in ${list(locations)}` : ''}${topics.length ? ` for ${list(topics)}` : ''}`;
    } else {
      const locations = labels('location');
      const topics = labels('topic');
      root.querySelector('#count').textContent =
        `${visible.length} ${state.recommended === 'recommended' ? 'recommended ' : ''}group${visible.length === 1 ? '' : 's'}${state.q.length >= 3 ? ` matching “${state.q}”` : ''}${locations.length ? ` in ${list(locations)}` : ''}${topics.length ? ` for ${list(topics)}` : ''}`;
    }
    root.querySelector('#empty').classList.toggle('hidden', visible.length > 0);
    resetButton.hidden =
      kind === 'events'
        ? !state.q &&
          state.period === 'future' &&
          state.eventType === 'all' &&
          state.cost === 'all' &&
          !state.range &&
          state.format === 'in-person' &&
          !state.topic.length &&
          !state.location.length
        : !state.q && state.recommended === 'all' && !state.topic.length && !state.location.length;
    if (write) writeUrl(state, replace);
  };
  form.addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    if (event.target.name === 'q') {
      runVersion += 1;
      searchTimer = setTimeout(() => run(true, true), 300);
    } else {
      run(true);
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(searchTimer);
    run(true, true);
  });
  form.addEventListener('reset', () => {
    clearTimeout(searchTimer);
    setTimeout(() => run(true), 0);
  });
  addEventListener('popstate', () => {
    applyUrl();
    run();
  });
  applyUrl();
  run(false);
}
