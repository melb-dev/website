import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { execFileSync } from 'node:child_process';
import { slug } from '../src/lib/events';
type Row = { kind: string; id: string; path: string; data: any };
const root = join(process.cwd(), 'src/content');
export function load(dir = root): Row[] {
  return ['events', 'groups', 'venues', 'topics'].flatMap((kind) =>
    readdirSync(join(dir, kind), { recursive: true, encoding: 'utf8' })
      .filter((x) => x.endsWith('.yaml'))
      .map((file) => ({
        kind,
        id: file.slice(0, -5),
        path: join(dir, kind, file),
        data: parse(readFileSync(join(dir, kind, file), 'utf8')),
      })),
  );
}
export function validate(rows: Row[], base: Row[] = []) {
  const errors: string[] = [];
  const uids = new Map<string, Row>();
  const byKind = new Map(rows.map((r) => [`${r.kind}:${r.id}`, r]));
  for (const r of rows) {
    if (
      !/^0[0-9a-f]{7}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        r.data.uid ?? '',
      )
    )
      errors.push(`${r.path}: invalid UUIDv7`);
    if (uids.has(r.data.uid)) errors.push(`${r.path}: duplicate uid`);
    uids.set(r.data.uid, r);
    for (const t of r.data.topics ?? []) {
      if (!byKind.has(`topics:${t}`)) errors.push(`${r.path}: missing topic ${t}`);
    }
    if (new Set(r.data.topics ?? []).size !== (r.data.topics ?? []).length)
      errors.push(`${r.path}: duplicate topics`);
    if (['events', 'groups'].includes(r.kind) && !(r.data.topics?.length > 0))
      errors.push(`${r.path}: at least one topic required`);
    if (r.kind === 'events') {
      for (const [field, kind] of [
        ['group', 'groups'],
        ['venue', 'venues'],
      ] as const)
        if (r.data[field] && !byKind.has(`${kind}:${r.data[field]}`))
          errors.push(`${r.path}: missing ${field}`);
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Australia/Melbourne',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(new Date(r.data.start))
        .replaceAll('-', '')
        .replaceAll('/', '');
      const expected = `${date}-${r.data.group}-${slug(r.data.title)}`;
      if (r.id !== expected) errors.push(`${r.path}: filename must be ${expected}.yaml`);
      for (const field of ['start', 'end'])
        if (
          r.data[field] &&
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
            r.data[field],
          )
        )
          errors.push(`${r.path}: ${field} must be an ISO datetime with UTC offset`);
      if (!['meetup', 'conference'].includes(r.data.eventType))
        errors.push(`${r.path}: invalid event type`);
      if (typeof r.data.paid !== 'boolean') errors.push(`${r.path}: paid must be a boolean`);
      if (r.data.end && new Date(r.data.end) <= new Date(r.data.start))
        errors.push(`${r.path}: end must follow start`);
      if (r.data.allDay && r.data.end)
        errors.push(`${r.path}: all-day events cannot have an end time`);
      if (r.data.updated && !/^\d{4}-\d{2}-\d{2}$/.test(r.data.updated))
        errors.push(`${r.path}: updated must be an ISO date`);
      if (
        (r.data.format === 'online' && r.data.venue) ||
        (r.data.format !== 'online' && !r.data.venue)
      )
        errors.push(`${r.path}: invalid format/venue`);
    }
    if (r.data.logo && !existsSync(join(process.cwd(), 'public', r.data.logo.replace(/^\//, ''))))
      errors.push(`${r.path}: missing logo`);
  }
  const headByUid = new Map(rows.map((r) => [r.data.uid, r]));
  const headByKey = new Map(rows.map((r) => [`${r.kind}:${r.id}`, r]));
  for (const old of base) {
    const sameId = headByKey.get(`${old.kind}:${old.id}`);
    if (sameId && sameId.data.uid !== old.data.uid)
      errors.push(`${sameId.path}: existing entry UUID cannot change`);
    const now = headByUid.get(old.data.uid);
    if (old.kind === 'events' && !now) {
      errors.push(`${old.path}: event deletion forbidden`);
      continue;
    }
    if (!now) {
      errors.push(
        `${old.path}: content identity missing; ${old.kind} UUID must be preserved across renames and deletion`,
      );
      continue;
    }
    if (now.kind !== old.kind) errors.push(`${now.path}: uid changed type`);
    if (old.kind === 'events') {
      const material = [
        'title',
        'start',
        'end',
        'group',
        'topics',
        'eventType',
        'paid',
        'format',
        'venue',
        'url',
        'rsvpNote',
        'status',
      ].some((k) => JSON.stringify(old.data[k]) !== JSON.stringify(now.data[k]));
      if (
        material &&
        (!(now.data.revision >= (old.data.revision ?? 0) + 1) ||
          !now.data.updated ||
          now.data.updated === old.data.updated)
      )
        errors.push(`${now.path}: material change requires revision increment and updated`);
    }
  }
  return errors;
}
if (process.argv[1]?.endsWith('validate-content.ts')) {
  let base: Row[] = [];
  try {
    const ref = process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : execFileSync('git', ['rev-list', '--parents', '-n', '1', 'HEAD'], { encoding: 'utf8' })
          .trim()
          .split(' ')[1];
    if (ref) {
      const files = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, 'src/content'], {
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .filter((x) => x.endsWith('.yaml'));
      base = files.map((path) => {
        const [, , kind, ...parts] = path.split('/');
        const file = parts.join('/');
        return {
          kind,
          id: file.slice(0, -5),
          path,
          data: parse(execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' })),
        };
      });
    }
  } catch (error) {
    if (process.env.GITHUB_BASE_REF) throw error;
  }
  const errors = validate(load(), base);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`Validated ${load().length} content records.`);
}
