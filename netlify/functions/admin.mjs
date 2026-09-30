// Admin PIN check for the settings page on shared lab tablets.
//   GET  /api/admin            -> { pinRequired }
//   POST /api/admin { pin }    -> 200 { ok: true } | 401 { ok: false }
// The PIN lives only in the ADMIN_PIN env var, so clearing a tablet's storage can't bypass it.

import { timingSafeEqual, createHash } from 'node:crypto';

const digest = (s) => createHash('sha256').update(String(s)).digest();

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export default async (req) => {
  const pin = process.env.ADMIN_PIN;
  if (req.method === 'GET') return json({ pinRequired: Boolean(pin) });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!pin) return json({ ok: true });

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false }, 400);
  }
  if (timingSafeEqual(digest(body.pin ?? ''), digest(pin))) return json({ ok: true });
  // Slow down guessing; a school-wide shared IP makes per-IP lockouts unusable.
  await new Promise(r => setTimeout(r, 1000));
  return json({ ok: false }, 401);
};

export const config = { path: '/api/admin' };
