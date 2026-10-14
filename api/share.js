// Vercel serverless function: returns OG tags for card share links
// URL: /api/share?type=prompt&id=xxx
// Crawlers (WhatsApp, Telegram, etc.) read OG tags; browsers get redirected to the card

const SUPABASE_URL = 'https://vfyuebkdkxhdrlduqxng.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmeXVlYmtka3hoZHJsZHVxeG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTI1NDQsImV4cCI6MjEwNjc2ODU0NH0.RY-VU33zwySGKmPH34pHs72HaxRt9yi4lAhHO9xn7_4';
const SITE = 'https://creators-automation.vercel.app';

const TABLES = {
  prompt: { table: 'prompts', title: 'title', image: 'image_url', page: 'index.html' },
  niche: { table: 'niches', title: 'title', image: 'image_url', page: 'niches.html' },
  tool: { table: 'tools', title: 'name', image: 'image_url', page: 'tools.html' },
};

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = async (req, res) => {
  const type = String(req.query.type || 'prompt').toLowerCase();
  const id = String(req.query.id || '');
  const cfg = TABLES[type] || TABLES.prompt;
  const targetUrl = `${SITE}/${cfg.page}#card-${id}`;

  let title = 'Creators Automation';
  let image = `${SITE}/og-default.png`;
  let desc = 'Check out this card on Creators Automation';

  if (id) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/${cfg.table}?id=eq.${encodeURIComponent(id)}&select=${cfg.title},${cfg.image}`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
      );
      const rows = await r.json();
      if (rows && rows.length) {
        title = rows[0][cfg.title] || title;
        if (rows[0][cfg.image]) image = rows[0][cfg.image];
        desc = title;
      }
    } catch (e) {}
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(targetUrl)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(targetUrl)}">
</head><body>
<p>Redirecting to <a href="${esc(targetUrl)}">${esc(title)}</a>...</p>
<script>location.replace(${JSON.stringify(targetUrl)});</script>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(html);
};
