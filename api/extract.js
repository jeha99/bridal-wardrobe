// Vercel Serverless Function — extracts product data from any URL
// No API keys, no LLM, no token usage. Pure HTML parsing.

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing ?url= parameter' });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Site returned ${response.status}` });
    }

    const html = await response.text();
    const result = parseProduct(html, url);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(502).json({
      error: err.name === 'TimeoutError'
        ? 'Site took too long to respond'
        : `Fetch failed: ${err.message}`
    });
  }
}

function parseProduct(html, pageUrl) {
  let name = null, vendor = null, price = null, currency = null, imageUrl = null;

  // 1. JSON-LD structured data (most reliable)
  const jsonLdRegex = /]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch;
  while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const raw = JSON.parse(ldMatch[1]);
      const items = Array.isArray(raw) ? raw : (raw['@graph'] || [raw]);
      for (const item of items) {
        if (!item || !item['@type']) continue;
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (!types.includes('Product')) continue;

        if (!name && item.name) name = item.name.trim();

        if (!imageUrl && item.image) {
          const img = item.image;
          if (typeof img === 'string') imageUrl = img;
          else if (Array.isArray(img)) imageUrl = typeof img[0] === 'string' ? img[0] : img[0]?.url;
          else if (img.url) imageUrl = img.url;
        }

        if (!vendor && item.brand) {
          vendor = typeof item.brand === 'string' ? item.brand : item.brand.name;
        }

        const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        if (offers) {
          if (price == null && offers.price != null) price = parseFloat(offers.price);
          if (!currency && offers.priceCurrency) currency = offers.priceCurrency;
          // Shopify sometimes nests under offers.offers
          if (price == null && offers.offers) {
            const inner = Array.isArray(offers.offers) ? offers.offers[0] : offers.offers;
            if (inner?.price != null) price = parseFloat(inner.price);
            if (!currency && inner?.priceCurrency) currency = inner.priceCurrency;
          }
        }
      }
    } catch (e) { /* ignore bad JSON-LD */ }
  }

  // 2. Meta tag fallbacks
  const meta = (prop) => {
    const re = new RegExp(`]*(?:property|name)\\s*=\\s*["']${prop}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, 'i');
    const alt = new RegExp(`]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${prop}["']`, 'i');
    const m = html.match(re) || html.match(alt);
    return m ? m[1].trim() : null;
  };

  if (!name) {
    const t = meta('og:title');
    if (t) name = t.split(/\s*[–|—|•]\s*/)[0].trim();
  }
  if (!name) {
    const titleMatch = html.match(/]*>([^<]+)<\/title>/i);
    if (titleMatch) name = titleMatch[1].split(/\s*[–|—|•]\s*/)[0].trim();
  }
  if (!imageUrl) imageUrl = meta('og:image') || meta('og:image:secure_url') || meta('twitter:image');
  if (!vendor) vendor = meta('og:site_name') || meta('product:brand');
  if (!price) {
    const p = meta('product:price:amount') || meta('og:price:amount');
    if (p) price = parseFloat(p.replace(/,/g, ''));
  }
  if (!currency) currency = meta('product:price:currency') || meta('og:price:currency');

  // 3. Regex price fallback
  if (price == null) {
    const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
    const bodyText = bodyMatch ? bodyMatch[0].replace(/]+>/g, ' ').slice(0, 30000) : '';
    const patterns = [
      { re: /₹\s*([\d,]+(?:\.\d+)?)/, curr: 'INR' },
      { re: /Rs\.?\s*([\d,]+(?:\.\d+)?)/i, curr: 'INR' },
      { re: /US\$\s*([\d,]+(?:\.\d+)?)/i, curr: 'USD' },
      { re: /\$\s*([\d,]+(?:\.\d+)?)/, curr: 'USD' },
      { re: /£\s*([\d,]+(?:\.\d+)?)/, curr: 'GBP' },
      { re: /€\s*([\d,]+(?:\.\d+)?)/, curr: 'EUR' }
    ];
    for (const { re, curr } of patterns) {
      const m = bodyText.match(re);
      if (m) {
        const n = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(n) && n > 10) {
          price = n;
          if (!currency) currency = curr;
          break;
        }
      }
    }
  }

  // Normalize image URL
  if (imageUrl) {
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    else if (imageUrl.startsWith('/')) {
      try { imageUrl = new URL(pageUrl).origin + imageUrl; } catch (e) {}
    }
    // Shopify: upgrade thumbnails
    imageUrl = imageUrl.replace(/_(?:100|160|200|240|360|480|540)x/g, '_1024x');
  }

  // Derive vendor from hostname as last resort
  if (!vendor) {
    try {
      const h = new URL(pageUrl).hostname.replace(/^www\./, '').split('.')[0];
      vendor = h.charAt(0).toUpperCase() + h.slice(1);
    } catch (e) {}
  }

  return {
    name: name || null,
    vendor: vendor || null,
    price: price != null && !isNaN(price) ? price : null,
    currency: currency || null,
    imageUrl: imageUrl || null
  };
}
