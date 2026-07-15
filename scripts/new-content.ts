import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const kind = process.argv[2];
if (!['event', 'group', 'venue', 'topic'].includes(kind)) {
  console.error('Usage: bun scripts/new-content.ts <event|group|venue|topic>');
  process.exit(1);
}
const now = BigInt(Date.now()),
  b = randomBytes(16);
for (let i = 5; i >= 0; i--) {
  b[i] = Number((now >> BigInt((5 - i) * 8)) & 255n);
}
b[6] = (b[6] & 15) | 0x70;
b[8] = (b[8] & 63) | 0x80;
const h = b.toString('hex'),
  uid = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
const templates: any = {
  topic: `uid: ${uid}\nname: New Topic\n`,
  venue: `uid: ${uid}\nname: New Venue\naddress: Address\nsuburb: Melbourne CBD\npostcode: "3000"\n`,
  group: `uid: ${uid}\nname: New Group\nsummary: A one-sentence summary.\ndescription: A plain text description.\ntopics: [software-engineering]\nurl: https://example.org/\n`,
  event: `uid: ${uid}\ntitle: New Event\nstart: 2026-01-01T18:00:00+11:00\ngroup: group-slug\ntopics: [software-engineering]\nformat: online\nurl: https://example.org/event\n`,
};
const dir = `src/content/${kind}s`;
mkdirSync(dir, { recursive: true });
const path = `${dir}/new-${kind}-${uid.slice(0, 8)}.yaml`;
writeFileSync(path, templates[kind]);
console.log(path);
