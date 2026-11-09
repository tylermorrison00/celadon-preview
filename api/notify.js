// Vercel serverless function: POST /api/notify — admin-only push fan-out.
// When the admin publishes a new public prompt, prompt-form.html calls this;
// it sends a Web Push notification to every subscriber in push_subscriptions.
// Auth: caller passes its Supabase access token; we verify it and check is_admin.
// Env needed (Vercel dashboard): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (mailto:...), SUPABASE_SERVICE_ROLE_KEY.

const webpush = require('web-push');

const SUPABASE_URL = 'https://vfyuebkdkxhdrlduqxng.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:talhamohsin216@gmail.com';

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).send('method not allowed'); return; }
    if (!SERVICE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) { res.status(500).send('push not configured'); return; }
    const token = String((req.headers.authorization || '').replace(/^Bearer /i, ''));
    if (!token) { res.status(401).send('unauthorized'); return; }
    // Verify the caller is the admin
    const uRes = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) { res.status(401).send('unauthorized'); return; }
    const user = await uRes.json();
    const pRes = await fetch(SUPABASE_URL + '/rest/v1/profiles?select=is_admin&id=eq.' + encodeURIComponent(user.id), { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } });
    const prof = await pRes.json();
    if (!prof || !prof[0] || !prof[0].is_admin) { res.status(403).send('forbidden'); return; }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const title = String(body.title || 'New prompt is live');
    // Read all subscriptions (service role bypasses RLS; table has no public read)
    const sRes = await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?select=endpoint,p256dh,auth', { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } });
    if (!sRes.ok) { res.status(502).send('cannot read subscriptions'); return; }
    const subs = await sRes.json();
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const payload = JSON.stringify({ title: 'Creators Automation', body: title, url: '/' });
    let sent = 0, failed = 0;
    await Promise.all((subs || []).map(async function(s) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e) {
        failed++;
        // 410 Gone = unsubscribed; prune it
        if (e && e.statusCode === 410) {
          try { await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } }); } catch (e2) {}
        }
      }
    }));
    res.status(200).json({ sent: sent, failed: failed, total: (subs || []).length });
  } catch (e) { res.status(500).send('notify error'); }
};
