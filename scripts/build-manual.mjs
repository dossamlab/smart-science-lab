// Builds src/data/manualChunks.json (searchable sections of the public 경기도교육청 과학실 안전관리 계획)
// from src/data/safetyManualData.json (made by extract_safety_text.py from the PDF).
// Only the public 도교육청 plan is published; the school's own plan (school_manual) stays out of the bundle.
//   node scripts/build-manual.mjs
import fs from 'node:fs';

const src = JSON.parse(fs.readFileSync('src/data/safetyManualData.json', 'utf8')).gyeonggi_manual;
const MAJOR = /^(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|Ⅶ|Ⅷ)\s|^부록\s?\d+|^서식\d/;
const MINOR = /^□\s?\S/;
const MAX_BODY = 2500;

const clean = (s) => s
  .replace(/-\s?\d{1,2}\s?-/g, ' ')          // page markers "- 12 -"
  .replace(/\s+([,)])/g, '$1')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

// The first page repeats the table of contents (dot leaders); start at the plan's own first heading.
const lines = src.split('\n');
const start = lines.findIndex(l => /^Ⅰ\s*근거/.test(l.trim()));
const chunks = [];
let major = '';
let current = null;

for (const raw of lines.slice(start)) {
  const line = raw.trim();
  if (!line || /·\s·\s·/.test(line)) continue;
  if (MAJOR.test(line) || MINOR.test(line)) {
    if (MAJOR.test(line)) major = clean(line).slice(0, 60);
    current = { title: clean(line).slice(0, 80), section: MAJOR.test(line) ? '' : major, body: [] };
    chunks.push(current);
  } else if (current) {
    current.body.push(line);
  }
}

const out = [];
for (const c of chunks) {
  const body = clean(c.body.join('\n').replace(/[ \t]+\n/g, '\n'));
  if (body.length < 40) continue; // appendix title lists and empty form headers
  for (let i = 0; i < body.length; i += MAX_BODY) {
    out.push({
      title: c.title + (i ? ' (계속)' : ''),
      section: c.section,
      text: body.slice(i, i + MAX_BODY),
    });
  }
}

fs.writeFileSync('src/data/manualChunks.json', JSON.stringify(out));
console.log(`${out.length} chunks, ${JSON.stringify(out).length} bytes`);
