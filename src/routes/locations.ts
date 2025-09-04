import express from 'express';

const router = express.Router();

// Helper to call Nominatim with proper headers
async function nominatimFetch(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'deuce-app/1.0 (contact: support@deuce.app)'
    }
  });
  return response;
}

// GET /api/locations/search?q=...&limit=5
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q as string)?.trim();
    const limitParam = parseInt((req.query.limit as string) || '5', 10);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 10)) : 5;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    // Restrict search to Malaysia only using ISO country code 'my'
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=my&q=${encodeURIComponent(q)}&limit=${limit}`;
    const response = await nominatimFetch(url);

    if (!response.ok) {
      return res.status(502).json({ error: 'Upstream geocoding error' });
    }

    const results = (await response.json()) as any[];

    const mapped = results.map((item) => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      const name = item.display_name?.split(',')[0]?.trim() || item.name || q;

      const addr = item.address || {};
      const country = addr.country || '';
      const state = addr.state || addr.region || '';
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || '';

      return {
        id: String(item.place_id),
        name,
        formatted_address: item.display_name,
        geometry: { location: { lat, lng } },
        place_id: String(item.place_id),
        types: item.type ? [item.type] : [],
        address: addr,
        components: { country, state, city }
      };
    });

    return res.json({ success: true, results: mapped, query: q, count: mapped.length });
  } catch (error: any) {
    console.error('Location search failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/locations/reverse-geocode?lat=...&lng=...
router.get('/reverse-geocode', async (req, res) => {
  try {
    const lat = parseFloat(String(req.query.lat || ''));
    const lng = parseFloat(String(req.query.lng || ''));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const response = await nominatimFetch(url);

    if (!response.ok) {
      return res.status(502).json({ error: 'Upstream reverse geocoding error' });
    }

    const data = await response.json() as any;
    const address = data.display_name as string;

    // Ensure reverse geocode result is in Malaysia
    const countryCode = data?.address?.country_code;
    if (!countryCode || String(countryCode).toLowerCase() !== 'my') {
      return res.status(400).json({ error: 'Coordinates are outside Malaysia' });
    }

    const addr = data.address || {};
    const components = {
      country: addr.country || '',
      state: addr.state || addr.region || '',
      city: addr.city || addr.town || addr.village || addr.suburb || addr.municipality || ''
    };

    return res.json({
      success: true,
      address,
      coordinates: { latitude: lat, longitude: lng },
      address_details: addr,
      components
    });
  } catch (error: any) {
    console.error('Reverse geocode failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


