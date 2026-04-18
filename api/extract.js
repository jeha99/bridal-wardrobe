export default async function handler(req, res) {
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
      return res.status(502).json({ error: 'Site returned ' + response.status });
    }

    const html = await response.text();
    const result = parseProduct(html, url);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(502).json({
      error: err.name === 'TimeoutError'
        ? 'Site took too long to respond'
        : 'Fetch failed: ' + err.message
    });
  }
}

function parseProduct(html, pageUrl) {
  var name = null, vendor = null, price = null, currency = null, imageUrl = null;

  var jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  var ldMatch;
  while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      var raw = JSON.parse(ldMatch[1]);
      var items = Array.isArray(raw) ? raw : (raw['@graph'] || [raw]);
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item || !item['@type']) continue;
        var types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (types.indexOf('Product') === -1) continue;

        if (!name && item.name) name = item.name.trim();

        if (!imageUrl && item.image) {
          var img = item.image;
          if (typeof img === 'string') imageUrl = img;
          else if (Array.isArray(img)) imageUrl = typeof img[0] === 'string' ? img[0] : (img[0] && img[0].url);
          else if (img.url) imageUrl = img.url;
        }

        if (!vendor && item.brand) {
          vendor = typeof item.brand === 'string' ? item.brand : item.brand.name;
        }

        var offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        if (offers) {
          if (price == null && offers.price != null) price = parseFloat(offers.price);
          if (!currency && offers.priceCurrency) currency = offers.priceCurrency;
          if (price == null && offers.offers) {
            var inner = Array.isArray(offers.offers) ? offers.offers[0] : offers.offers;
            if (inner && inner.price != null) price = parseFloat(inner.price);
            if (!currency && inner && inner.priceCurrency) currency = inner.priceCurrency;
          }
        }
      }
    } catch (e) {}
  }

  var metaGet = function(prop) {
    var re = new RegExp('<meta[^>]*(?:property|name)\\s*=\\s*["\']' + prop + '["\'][^>]*content\\s*=\\s*["\']([^"\']*)["\']', 'i');
    var alt = new RegExp('<meta[^>]*content\\s*=\\s*["\']([^"\']*)["\'][^>]*(?:property|name)\\s*=\\s*["\']' + prop + '["\']', 'i');
    var m = html.match(re) || html.match(alt);
    return m ? m[1].trim() : null;
  };

  if (!name) {
    var t = metaGet('og:title');
    if (t) name = t.split(/\s*[–|—|•]\s*/)[0].trim();
  }
  if (!name) {
    var titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) name = titleMatch[1].split(/\s*[–|—|•]\s*/)[0].trim();
  }
  if (!imageUrl) imageUrl = metaGet('og:image') || metaGet('og:image:secure_url') || metaGet('twitter:image');
  if (!vendor) vendor = metaGet('og:site_name') || metaGet('product:brand');
  if (!price) {
    var p = metaGet('product:price:amount') || metaGet('og:price:amount');
    if (p) price = parseFloat(p.replace(/,/g, ''));
  }
  if (!currency) currency = metaGet('product:price:currency') || metaGet('og:price:currency');

  if (price == null) {
    var bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
    var bodyText = bodyMatch ? bodyMatch[0].replace(/<[^>]+>/g, ' ').slice(0, 30000) : '';
    var patterns = [
      { re: /₹\s*([\d,]+(?:\.\d+)?)/, curr: 'INR' },
      { re: /Rs\.?\s*([\d,]+(?:\.\d+)?)/i, curr: 'INR' },
      { re: /US\$\s*([\d,]+(?:\.\d+)?)/i, curr: 'USD' },
      { re: /\$\s*([\d,]+(?:\.\d+)?)/, curr: 'USD' },
      { re: /£\s*([\d,]+(?:\.\d+)?)/, curr: 'GBP' },
      { re: /€\s*([\d,]+(?:\.\d+)?)/, curr: 'EUR' }
    ];
    for (var j = 0; j < patterns.length; j++) {
      var m = bodyText.match(patterns[j].re);
      if (m) {
        var n = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(n) && n > 10) {
          price = n;
          if (!currency) currency = patterns[j].curr;
          break;
        }
      }
    }
  }

  if (imageUrl) {
    if (imageUrl.indexOf('//') === 0) imageUrl = 'https:' + imageUrl;
    else if (imageUrl.indexOf('/') === 0) {
      try { imageUrl = new URL(pageUrl).origin + imageUrl; } catch (e) {}
    }
    imageUrl = imageUrl.replace(/_(?:100|160|200|240|360|480|540)x/g, '_1024x');
  }

  if (!vendor) {
    try {
      var h = new URL(pageUrl).hostname.replace(/^www\./, '').split('.')[0];
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
