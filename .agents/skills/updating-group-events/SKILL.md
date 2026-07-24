---
name: updating-group-events
description: Fetches newly listed Melbourne events for every group, creates or updates content records, and advances per-group fetch watermarks. Use when asked to fetch, refresh, sync, or update the latest group events.
---

# Updating Group Events

Synchronize event listings into this repository without missing events or creating duplicates.

## Repository contracts

- Groups are YAML files in `src/content/groups`; the filename without `.yaml` is the group slug.
- Events are YAML files in `src/content/events` and reference a group by slug.
- Venues and topics are in their corresponding `src/content` directories.
- `src/content.config.ts` is the authoritative schema.
- Each group's `eventsUrl` is the source listing and `eventsFetchedAt` is its last successful scan
  watermark.
- UUIDv7 values are permanent identities. Never replace an existing `uid` or delete an event.
- Event filenames are `YYYYMMDD-{group-slug}-{normalised-title}.yaml`, using the event's
  Melbourne-local start date and the repository's `slug` behavior.

## Cursor semantics

`eventsFetchedAt` records when the source was last successfully checked. It does **not** mean the
event's scheduled start time.

For each group independently:

1. Read its current `eventsFetchedAt` as `cursor`.
2. Capture `scanStartedAt` in UTC immediately before opening its `eventsUrl`.
3. Find events whose source publication/listing timestamp is strictly later than `cursor`.
4. If the source does not expose publication timestamps, inspect all current and upcoming listings
   and use repository deduplication to identify new ones. Do not guess a publication time.
5. After a complete successful scan, set `eventsFetchedAt` to `scanStartedAt`, including when no new
   events were found. Using the start time prevents an event published during the scan from being
   skipped on the next run.
6. If the URL is blocked, unavailable, ambiguous, partially loaded, or cannot be fully paginated, do
   not advance that group's watermark. Report the failure and continue with other groups.

## Workflow

### 1. Load local state

- Read every group record and index existing events by group.
- Also index events by canonical URL and by `(group, start, normalized title)`.
- Read existing venues and topics before creating records.
- Process all groups unless the user explicitly limits the scope.

### 2. Browse each source completely

- Open `eventsUrl`. Prefer direct page reading for static HTML; use browser interaction for
  JavaScript-rendered listings, pagination, “load more” controls, or event detail pages.
- Follow pagination or load-more controls until all listings newer than `cursor` have been examined.
- Open each candidate's canonical detail page when necessary to verify title, schedule, timezone,
  format, venue, price, status, and canonical URL.
- Do not bypass authentication, anti-bot challenges, or access controls.
- Ignore unrelated events promoted by the platform or other organizers.
- Treat “Melbourne events” as events anywhere in Victoria, including metropolitan and regional
  locations. For in-person and hybrid events, require a physical venue in Victoria and exclude every
  other Australian state or territory (for example, Sydney/NSW), even when the organizer is a listed
  group. The suburb does not need to be Melbourne itself.
- Include online events only when the listing is explicitly for the group's Melbourne or Victorian
  community. Exclude online events explicitly associated with another state or interstate chapter.
- Ignore historical archive entries unless they were genuinely published after `cursor` and have not
  yet ended.

### 3. Deduplicate before writing

A candidate is already represented if either condition holds:

1. Its normalized canonical URL matches an existing event URL. Normalize harmless URL differences
   such as a trailing slash and tracking query parameters; do not merge distinct event IDs.
2. Its group, actual start instant, and normalized title match an existing event.

Never create a second record merely because a platform changed a display URL. If an existing event's
material source data changed, update that record instead, increment `revision`, and set `updated` to
today's Melbourne date. Preserve its `uid`. Keep cancelled events and mark `status: 'cancelled'`.

### 4. Create complete event records

Use only facts supported by the source. Do not invent times, addresses, prices, or topics.

- Generate a fresh UUIDv7 using the repository's `uuidv7` helper in `scripts/new-content.ts`.
- Preserve the source title, using plain text and normal repository quoting.
- Write `start` and optional `end` as ISO datetimes with the correct Australia/Melbourne UTC offset
  for that date. Convert source timezones rather than assuming the current offset.
- Set `allDay: true` only for an explicitly all-day event; all-day events must not have `end`.
- Set `eventType` to an allowed type from the group and source: `meetup` or `conference`.
- Set `paid` from the listing. “Registration required” does not imply paid.
- Set `format` to `in-person`, `online`, or `hybrid`.
- For in-person and hybrid events, reuse an existing venue when its identity and address match. If no
  venue exists, create a schema-valid venue record from verified public address details. Online
  events must not have a venue.
- Select existing topic slugs directly supported by the event description. Include at least one,
  keep them unique, and prefer the group's established topics over speculative additions.
- Use the event's canonical HTTPS detail URL, not a search result or tracking redirect.
- Add `rsvpNote` only for useful registration constraints and keep it within 160 characters.
- Omit defaultable `status` and `revision` for a newly scheduled event unless clarity requires them.

Do not use the non-interactive `new-content event` defaults as final content: they use tomorrow's date
and placeholder values. Either use the guided creator and verify every field, or construct the YAML
carefully from verified source data.

### 5. Advance successful watermarks

- Update each successfully scanned group's `eventsFetchedAt` only after its event and venue writes
  are complete.
- Use the captured UTC `scanStartedAt` in canonical ISO form, for example
  `2026-07-24T01:23:22.029Z`.
- A failure for one group must not prevent successful groups from being saved or advancing.

### 6. Validate

Run the narrow content checks first, then the repository checks:

```sh
bun scripts/validate-content.ts
bun run format:check
bun run lint
bun run test
```

Fix failures caused by the synchronization. Do not alter unrelated content to manufacture a green
result.

## Completion report

Report:

- groups successfully scanned;
- new events created, with group and start date;
- existing events updated;
- groups with no changes;
- groups not scanned successfully and why their watermarks were left unchanged;
- validation results.
