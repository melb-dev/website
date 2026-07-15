# melb.dev Website Specification

**Status:** Draft for implementation  
**Product:** [melb.dev](https://melb.dev)  
**Principles:** [`PRINCIPLES.md`](./PRINCIPLES.md)

## 1. Purpose and scope

melb.dev is a fast, accessible directory of community-first technology events and groups in Melbourne. The homepage answers:

1. What events are coming up?
2. Which groups run them?
3. How can I RSVP or subscribe?

The site is statically generated with Astro. Events, groups, venues, and topics are one YAML file per record, validated at build time with Astro Content Collections. Approved organiser collaborators maintain the content; anyone can report errors through [GitHub Issues](https://github.com/melb-dev/website/issues).

The site provides discovery, not ticketing. Each event links to the organiser's canonical external page for full details and RSVP.

### Goals

- Make community-first Melbourne tech events and groups easy to discover.
- Support full-text search and faceted, bookmarkable filtering.
- Provide RSS and subscribable iCalendar feeds.
- Keep content structured, reviewable, and simple to maintain in Git.
- Deliver strong accessibility, privacy, SEO, and mobile performance with little client-side JavaScript.

### Out of scope for v1

- Accounts, favourites, profiles, ratings, comments, or personalisation.
- Ticketing, payments, RSVP processing, waitlists, or attendance tracking.
- Scraping event platforms or running a CMS, database, admin dashboard, or server application.
- Jobs, general business listings, venue reviews, or public profiles for individual organisers.

### Editorial scope

Listings are curated. Groups must be relevant to people working in technology, primarily serve Melbourne or nearby areas, align with the current melb.dev principles, and publish a stable URL where details can be verified. Do not introduce automated principle scores or rankings.

Use Australian English and Melbourne local time (`Australia/Melbourne`), including correct AEST/AEDT handling.

## 2. Information architecture

### Navigation and routes

The logo links home. The visible navigation is:

| Label | Route | Content |
| --- | --- | --- |
| Events | `/` | Event search and listing |
| Community Groups | `/groups/` | Group search and listing |
| Organisers | `/organisers/` | Organiser collaboration information |
| Principles | `/principles/` | Current principles and feedback request |
| About | `/about/` | Mission, contact, and maintenance model |

Additional generated routes:

- `/groups/[id]/` — one static detail page per group.
- `/events.xml` — RSS feed.
- `/events.ics` — subscribable iCalendar feed.
- Sitemap, `robots.txt`, and an accessible 404 page.

There are no internal event-detail pages in v1. Event actions link directly to the canonical external event page.

### Events page

Use a compact introduction such as “Community-first tech events in Melbourne”; do not push listings below a large marketing hero.

Controls:

- full-text search;
- event period: Future (default) or Past;
- date range: Any date (default), Today, This week, or This month;
- multi-select Topic;
- Location derived from venue suburbs, plus Online;
- Format: All, In person, Online, Hybrid; and
- Reset, result count, facet counts, and an empty state.

Future events sort by `start` ascending, then title; past events sort newest first. Classification uses Melbourne calendar dates, not the current time: an event is future if its local `end` date (or `start` date when no end exists) is today or later. It becomes past only when that date is before today. This keeps all events occurring today in the default results even if they have already finished. Apply this rule consistently on the homepage, in search, and on group pages. The date-range filter is applied within the selected Future/Past period. Cancelled and postponed events remain visible with a clear status.

Each event card contains only:

- title;
- Melbourne-local date and start/end time;
- group, linked to its melb.dev group page;
- format and venue/suburb or Online;
- topics and status;
- optional one-sentence RSVP note; and
- **View event & RSVP**, linking externally.

Do not copy long descriptions, speaker biographies, promotional banners, attendee counts, ratings, or ticket inventory. Promotional images are not required.

### Community Groups

The directory lists active groups alphabetically and supports full-text search plus Topic and Location facets. Each card shows name, optional logo, one-sentence summary, topics, primary location, and next event when known.

`/groups/[id]/` shows the group's description, topics, external URL, optional public contact, upcoming events oldest first, and past events newest first. Events are joined from their `group` reference; group YAML must not duplicate event IDs. Inactive groups are hidden from the directory but retain labelled detail pages for event history.

### Organisers

This is an informational page, not a people directory. It must:

- explain how melb.dev supports community and event organisers;
- link to the canonical [principles Google Doc](https://docs.google.com/document/d/1Vw_UYw2C8dLHNqLA5N_6w99DnqvaUpVl5MbPuuO3JLo/edit?usp=sharing) and seek community feedback and alignment;
- describe the private Slack for genuine community/event organisers to coordinate, share knowledge, and evolve the principles; and
- direct organisers to `gday@melb.dev` for a Slack invitation or to report missing information.

Do not publish the Slack invite URL or member details.

### Principles

Mention the current PRINCIPLES.md Community-First definition, then link to the canonical [principles Google Doc](https://docs.google.com/document/d/1Vw_UYw2C8dLHNqLA5N_6w99DnqvaUpVl5MbPuuO3JLo/edit?usp=sharing) and mention that we are seeking community feedback and alignment;

### About

Explain:

- what melb.dev is;
- its mission to strengthen Melbourne's tech community and technical excellence;
- its vision to make Melbourne the best city in the world to build technology through technical excellence and a thriving community;
- that it supports rather than replaces existing groups;
- that approved organiser collaborators maintain the repository; and
- that the project owner reviews and approves changes.

Contact: `gday@melb.dev`.  
Security: “We take security seriously. Please email `security@melb.dev`.” Do not direct security reports to public issues.

### Shared footer

Include primary navigation, `gday@melb.dev`, RSS/calendar links, the repository and Issues page, the one-sentence mission, and an all-rights-reserved notice while the repository is unlicensed.

Every page includes **Found an issue? Report it on GitHub**, linking directly to `https://github.com/melb-dev/website/issues`.

## 3. Content model

Use Astro build-time Content Collections with `glob()`, strict Zod schemas, and `reference()` fields in `src/content.config.ts`:

```text
src/content/
├── events/   # YYYYMMDD-group-slug-event-title-slug.yaml
├── groups/   # stable-slug.yaml
├── venues/   # stable-slug.yaml
└── topics/   # stable-slug.yaml
```

Filenames are human-readable handles and Astro entry IDs. References and group routes use these slugs.

Every entry has a globally unique, immutable UUIDv7 `uid`. The UUID remains unchanged when a filename, display field, relationship, or external URL changes. A small development helper, `new-content <event|group|venue|topic>`, generates a UUIDv7 and starter YAML. Store plain UUIDs; add entity prefixes only in external protocol identifiers.

### Event

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `uid` | UUIDv7 | Yes | Immutable and globally unique |
| `title` | string | Yes | Concise display title |
| `start` | ISO 8601 datetime | Yes | Include UTC offset |
| `end` | ISO 8601 datetime | No | Must be after `start` |
| `group` | group reference | Yes | One owning group |
| `topics` | topic references[] | Yes | At least one; no duplicates |
| `format` | enum | Yes | `in-person`, `online`, `hybrid` |
| `venue` | venue reference | Conditional | Required for in-person/hybrid; forbidden for online |
| `url` | HTTPS URL | Yes | Canonical event/RSVP page |
| `rsvpNote` | string | No | One sentence, max 160 characters |
| `status` | enum | No | `scheduled` (default), `postponed`, `cancelled` |
| `revision` | integer | No | Default `0`; increment for material published changes |
| `updated` | ISO date | No | Required with a revision change |

```yaml
uid: 0190b1d7-7d6c-7b2e-9bb7-4df103f47c52
title: Melbourne Web Developers — July Meetup
start: 2026-07-15T18:00:00+10:00
end: 2026-07-15T20:30:00+10:00
group: melbourne-web-developers
topics: [web-development, javascript-and-typescript]
format: in-person
venue: example-hub
url: https://example.org/events/july-2026
rsvpNote: RSVP on the event page; bring photo ID for building access.
status: scheduled
revision: 0
updated: 2026-07-01
```

The event filename must match the Melbourne-local date, referenced group slug, and normalised title slug. If any changes, rename the file but preserve `uid`.

### Group

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `uid` | UUIDv7 | Yes | Immutable and globally unique |
| `name` | string | Yes | Public name |
| `summary` | string | Yes | One sentence, max 180 characters |
| `description` | string | Yes | Plain text; no arbitrary HTML |
| `topics` | topic references[] | Yes | At least one; no duplicates |
| `url` | HTTPS URL | Yes | Canonical community page |
| `location` | string | No | Defaults to Melbourne |
| `logo` | local image path | No | Repository asset preferred |
| `contact` | email or HTTPS URL | No | Only intentionally public details |
| `status` | enum | No | `active` (default), `inactive` |

### Venue

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `uid` | UUIDv7 | Yes | Immutable and globally unique |
| `name` | string | Yes | Public venue/building name |
| `address` | string | Yes | Display address |
| `suburb` | string | Yes | Used as the Location facet |
| `state` | string | No | Default `VIC` |
| `postcode` | four-digit string | Yes | Store as a string |
| `url` | HTTPS URL | No | Venue's public page |
| `mapUrl` | HTTPS URL | No | Link only; no embedded map |
| `accessibility` | string | No | Concise, verified information only |

Do not store private access codes, personal phone numbers, or unverified accessibility claims.

### Topic

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `uid` | UUIDv7 | Yes | Immutable and globally unique |
| `name` | string | Yes | Display label |
| `description` | string | No | One sentence |
| `order` | integer | No | Fallback alphabetical |

Topics are curated, not free-form. Create only topics used by launch content. Proposed taxonomy:

- AI; Machine Learning; Data; Software Engineering; Web Development; Native Mobile; Games; Security; Open Source.
- Cloud; Infrastructure; Platform Engineering; DevOps; SRE; Design & Product.
- Go; Rust; Ruby; PHP; C# / .NET; Swift / iOS; Kotlin / Andoird; JavaScript & TypeScript.

Locations such as Melbourne CBD, Cremorne, and Fitzroy are not topics. Derive event locations from venue suburbs and group locations from `group.location`; no locations collection is needed.

### Derived rules

Do not duplicate data that can be derived. Shared utilities calculate upcoming/past events, each group's next/upcoming/past events, facet values/counts, venue labels, and feed entries. Explicitly sort collection results because Astro collection order is not guaranteed. Use one comparison timestamp per build operation.

## 4. Search and filtering

Use open-source `@orama/orama` locally in the browser; no hosted search, analytics, or external data transfer.

At build time generate compact static documents for events and groups containing their UUID, type, searchable fields, URL, topic IDs/names, location, and relevant event fields. Load and initialise Orama on first search/filter interaction or when the URL already contains search parameters.

Behaviour:

- Events and groups share one adapter but search only their own record type.
- Boost titles/group names above descriptions, topics, venues, and RSVP notes.
- Use exact IDs for facets; conservative typo tolerance may apply to sufficiently long text queries.
- Within one facet, selections use OR; between facets, use AND.
- Show current facet counts. Disable unselected zero-result options; selected options remain removable.
- Without text, events remain chronological and groups alphabetical. With text, rank by relevance, then date/name.
- The server-rendered default listing remains available without JavaScript.

URL state uses `q`, `period`, `range`, repeated `topic`, repeated `location`, and `format`, for example:

```text
/?q=performance&period=past&range=month&topic=web-development&topic=javascript-and-typescript&location=cremorne&format=in-person
```

`period` accepts `future` or `past`; `range` accepts `today`, `week`, or `month`. Omit the default `period=future`, default date range, and other empty values. Ignore invalid values. Update the URL without a page reload, restore state on browser navigation, and ensure bookmarked URLs load the same results.

## 5. Feeds

### RSS: `/events.xml`

Use Astro's RSS integration. Include events from the previous 30 days and all known future events, including cancellations, ordered soonest first. Each item contains title, canonical external link, `event-<uid>@melb.dev` as the GUID, start time, group, venue/format, topics, RSVP note, and status. Add RSS autodiscovery metadata and visible footer access.

### iCalendar: `/events.ics`

Generate standards-compliant UTF-8 iCalendar using a maintained library, including CRLF line endings, line folding, and escaping. Include events from the previous 30 days and all known future events.

Each `VEVENT` includes:

- `UID:event-<uid>@melb.dev`;
- deterministic `DTSTAMP`;
- UTC `DTSTART` and optional `DTEND`;
- `SUMMARY`, `DESCRIPTION`, `LOCATION`, and canonical `URL`;
- `SEQUENCE` from `revision`; and
- `STATUS:CANCELLED` when cancelled.

The `event-` prefix is optional for uniqueness but retained as a readable namespace. A date/title/filename change preserves `uid`, so calendar clients update rather than duplicate the event.

Never delete an event because it is cancelled. Set `status: cancelled`, increment `revision`, update `updated`, and retain it in source control. Old events may eventually fall outside the feed window.

Expose an HTTPS calendar URL with copy and provider-neutral subscription instructions. A `webcal://` link may be a secondary convenience. Validate subscriptions in Apple Calendar and Google Calendar.

## 6. Repository governance and CI

- Anyone may report missing or incorrect information at `https://github.com/melb-dev/website/issues`.
- Pull requests are restricted to approved collaborators, primarily organisers.
- The project owner reviews and approves every pull request and is responsible for content freshness.
- The public site does not invite visitors to edit files or open pull requests.
- General contact is `gday@melb.dev`; private security reports go to `security@melb.dev`.
- The repository remains unlicensed/all rights reserved until organisers agree otherwise.

CI uses the same Make targets as local development. It runs `make precommit` followed by `make build`, including formatting checks, linting, Astro type checking, tests, content validation, feed validation, and an accessibility smoke test where applicable.

### Content and identity validation

Use one small repository script through `make test`, so it runs during pre-commit and CI. It validates the proposed tree and, when a merge base is available, compares it with the pull request base:

1. Every entry has a valid, globally unique UUIDv7.
2. An existing entry's UUID cannot change, including across renames.
3. Every cross-collection reference resolves to an entry of the expected collection: event groups, event/group topics, and event venues. Referenced local assets such as group logos must also exist. Topic arrays are non-empty and unique.
4. Event filenames equal `YYYYMMDD-group-slug-normalised-title.yaml` using one shared slug function.
5. Date, group, or title changes rename the event file while preserving its UUID.
6. Event deletion is rejected; cancellation uses `status: cancelled`.
7. Dates and format/venue combinations are valid; material event changes (`title`, dates, group, topics, format, venue, URL, RSVP note, or status) increment `revision` and update `updated`.

Parse base and head collections into UUID-indexed maps so Git rename detection is not relied upon. Tests cover missing/wrong-type references, missing assets, a valid or forgotten rename, changed/duplicate UUID, deletion, cancellation, and missing revision increment.

## 7. Design and quality requirements

### Visual direction

Use the latest compatible stable Astro, Tailwind CSS 4.x via `@tailwindcss/vite`, and daisyUI 5.x with a small custom semantic theme. Prefer system/self-hosted fonts, subtle borders, restrained elevation, and light mode first. Build mobile-first from 320 px with no horizontal page scrolling or hover-only interactions.

### Accessibility

Target WCAG 2.2 AA: semantic landmarks/headings, skip link, keyboard operation, visible focus, AA contrast, semantic `<time>`, accessible controls, result-count announcements, meaningful alt text, and reduced-motion support. Check keyboard and screen-reader use manually in addition to automated tests.

### Privacy

No accounts, advertising, behavioural tracking, embedded social widgets, or embedded third-party maps. Do not collect RSVP data or expose personal contact details without consent. Launch without analytics; add only privacy-preserving, cookieless measurement if later needed.

### SEO and performance

Provide unique titles/descriptions, canonical URLs, Open Graph metadata, sitemap, robots, favicon, RSS autodiscovery, `Event` JSON-LD, and organisation/community structured data. Make clear that organisers—not melb.dev—own and run events.

Use static HTML by default and client JavaScript only for search/filtering, mobile navigation, and small enhancements. Optimise local images and reserve dimensions. Aim for “good” Core Web Vitals and high Lighthouse scores without treating a specific score as a substitute for user testing.

## 8. Technical stack

- Astro, static output, strict TypeScript.
- Astro Content Collections with `glob()`, Zod, and collection references.
- Tailwind CSS 4.x and daisyUI 5.x.
- `@orama/orama` for local full-text/faceted search.
- Astro sitemap/RSS integrations and a maintained iCalendar library.
- Bun for dependency management, scripts, development server, and tests.
- Oxfmt for formatting and Oxlint for linting.

Pin exact dependency versions in the lockfile at implementation time; use stable, mutually compatible releases rather than prereleases or floating ranges.

### Makefile workflow

The repository root must contain a `Makefile` as the stable developer and CI interface. `help` is the default target and generates usage from `##` descriptions on each public target; running `make` and `make help` therefore print the same current command list without separately maintained help text.

Required targets:

| Target | Behaviour |
| --- | --- |
| `help` | Print target names and their `##` descriptions; default target |
| `setup` | Run `bun install` and idempotently install `.git/hooks/pre-commit`, which executes `make precommit` |
| `precommit` | Run `format-check`, `lint`, and `test`; keep this fast enough for every commit |
| `format` | Rewrite supported files with Oxfmt |
| `format-check` | Check Oxfmt output without modifying files; used by `precommit` and CI |
| `lint` | Run Oxlint and Astro/TypeScript checks |
| `test` | Run the same automated tests and content validation used by CI, including cross-collection reference integrity |
| `dev` | Start the Astro development server through Bun |
| `build` | Produce the static Astro build and validate generated RSS/iCalendar output |

Targets should wrap package scripts rather than duplicate long command lines. All non-file targets are `.PHONY`, commands fail on the first error, and the pre-commit hook is a minimal POSIX shell script containing `exec make precommit`. If the test suite later becomes too slow for commit-time use, split slow integration checks explicitly; do not silently let local and CI test definitions diverge.

## 9. Implementation plan

### Phase 1 — Foundation and content

1. Scaffold Astro, TypeScript, Tailwind, and daisyUI.
2. Define the four collections, references, fixtures, date/query utilities, and schemas.
3. Add `new-content` UUID/template generation and the identity/content validation script.
4. Add Bun scripts, Oxfmt, Oxlint, and the Makefile targets and pre-commit hook workflow.

### Phase 2 — Pages and design system

1. Build the responsive shell, navigation, footer, metadata, shared cards, and controls.
2. Implement About, Organisers, and Principles.
3. Add issue/contact links, favicon, social image, sitemap, robots, and 404 page.

### Phase 3 — Discovery

1. Build event and group listings and group detail pages.
2. Generate search documents and integrate Orama with facets and URL state.
3. Add structured data and test sorting, AEST/AEDT boundaries, empty states, and no-JavaScript access.

### Phase 4 — Feeds and readiness

1. Implement and validate RSS and iCalendar, including updates and cancellations.
2. Configure CI and add concise collaborator documentation with YAML examples.
3. Load reviewed launch content and run accessibility, responsive, link, metadata, feed-client, and performance checks.

## 10. Definition of done

- Upcoming events and groups render from validated YAML with correct references and Melbourne-local times.
- Event and group full-text search, facets, counts, and bookmarked query parameters work accessibly; events default to Future and retain all of today's events regardless of end time.
- Group pages correctly separate upcoming and past events.
- Event RSVP links go to canonical organiser pages.
- Every collection entry has an immutable, globally unique UUIDv7; pre-commit and CI enforce reference integrity, identity, event filenames, revisions, cancellations, and no deletion.
- RSS validates; iCalendar imports and updates correctly in Apple and Google Calendar.
- Required About, Organisers, and Principles content, contacts, Google Doc, Slack explanation, and issue links are present.
- Core content and navigation work without JavaScript; the site meets WCAG 2.2 AA through automated and manual checks.
- `make` prints generated help; `setup`, `precommit`, `format`, `lint`, `test`, `dev`, and `build` work as specified, and CI uses the same targets.
- No accounts, tracking, embedded maps, or unnecessary runtime services are shipped.
