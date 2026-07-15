import { readFileSync, existsSync } from 'node:fs';
for (const f of [
  'dist/index.html',
  'dist/events.xml',
  'dist/events.ics',
  'dist/robots.txt',
  'dist/sitemap-index.xml',
  'dist/404.html',
])
  if (!existsSync(f)) throw new Error(`Missing ${f}`);
const ics = readFileSync('dist/events.ics', 'utf8');
if (!ics.includes('BEGIN:VCALENDAR') || !ics.includes('UID:event-') || !ics.includes('VERSION:2.0'))
  throw new Error('Invalid iCalendar output');
const rss = readFileSync('dist/events.xml', 'utf8');
if (!rss.includes('<rss') || !rss.includes('event-')) throw new Error('Invalid RSS output');
for (const file of ['dist/index.html', 'dist/groups/index.html', 'dist/about/index.html']) {
  const html = readFileSync(file, 'utf8');
  for (const marker of [
    'lang="en-AU"',
    '<main',
    '<h1',
    'href="#main"',
    'https://github.com/melb-dev/website/issues',
  ])
    if (!html.includes(marker))
      throw new Error(`${file} is missing accessibility marker ${marker}`);
}
if (!/\r\n/.test(ics) || !ics.includes('SEQUENCE:') || !ics.includes('DTSTAMP:'))
  throw new Error('iCalendar is missing CRLF, sequence, or deterministic stamp fields');
if (!rss.includes('<guid isPermaLink="false">event-'))
  throw new Error('RSS has no stable event GUID');
console.log('Validated generated routes, accessibility smoke checks, and feeds.');
