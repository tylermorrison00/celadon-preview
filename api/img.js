// Vercel serverless function: image CDN proxy for Supabase prompt-media images
// URL: /api/img?f=<filename>&w=<width>
// Problem it solves: Supabase /render/image/ returns `Cache-Control: no-cache`
// + CF-Cache-Status BYPASS, so every page load re-downloads every image from
// the slow origin (1-3s TTFB each). This proxy re-serves the transformed image
// with a long edge-cache header, so Vercel Edge caches it near the visitor and
// repeat loads are instant. Only files from the prompt-media bucket are allowed.

const SUPABASE_URL = 'https://vfyuebkdkxhdrlduqxng.supabase.co';
const BUCKET = 'prompt-media';
const WIDTHS = { '300': 300, '400': 400, '500': 500, '600': 600, '800': 800, '1000': 1000, '1200': 1200 };

module.exports = async (req, res) => {
  try {
    const f = String((req.query && req.query.f) || '');
    // Basename only: no slashes, no "..", safe characters only (blocks SSRF/path tricks)
    if (!f || f.indexOf('/') > -1 || f.indexOf('\\') > -1 || f.indexOf('..') > -1 || !/^[A-Za-z0-9._-]+$/.test(f)) {
      res.status(400).send('bad file');
      return;
    }
    const w = WIDTHS[String(req.query.w || '600')] || 600;
    const file = encodeURIComponent(f);
    // Small transformed version first (quality same look, much smaller size)
    const renderUrl = SUPABASE_URL + '/storage/v1/render/image/public/' + BUCKET + '/' + file + '?width=' + w + '&quality=75&resize=contain';
    let up = await fetch(renderUrl);
    if (!up.ok) {
      // Fallback: original file
      up = await fetch(SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + file);
    }
    if (!up.ok) {
      res.status(up.status).send('image not found');
      return;
    }
    const buf = Buffer.from(await up.arrayBuffer());
    const ct = up.headers.get('content-type') || 'image/webp';
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Length', String(buf.length));
    // Edge cache for a year + browser cache; file content never changes under same name
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).send('image proxy error');
  }
};
