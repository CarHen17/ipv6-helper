// Geolocation lookup via ipinfo.io (free tier: 50k req/month, no auth)

export interface GeoInfo {
  ip: string;
  city?: string;
  region?: string;
  country?: string;  // ISO 3166-1 alpha-2 code, e.g. "BR"
  countryName?: string;
  lat?: number;
  lon?: number;
  org?: string;
  timezone?: string;
}

// Map of ISO 3166-1 alpha-2 codes to country names (most common)
const COUNTRY_NAMES: Record<string, string> = {
  BR: 'Brasil', US: 'Estados Unidos', DE: 'Alemanha', FR: 'França',
  GB: 'Reino Unido', JP: 'Japão', CN: 'China', AU: 'Austrália',
  CA: 'Canadá', NL: 'Países Baixos', SE: 'Suécia', SG: 'Singapura',
  IN: 'Índia', RU: 'Rússia', AR: 'Argentina', CL: 'Chile',
  MX: 'México', CO: 'Colômbia', PT: 'Portugal', ES: 'Espanha',
  IT: 'Itália', PL: 'Polônia', CH: 'Suíça', BE: 'Bélgica',
  NO: 'Noruega', DK: 'Dinamarca', FI: 'Finlândia', AT: 'Áustria',
  ZA: 'África do Sul', NG: 'Nigéria', KR: 'Coreia do Sul', TW: 'Taiwan',
  HK: 'Hong Kong', ID: 'Indonésia', TH: 'Tailândia', VN: 'Vietnã',
  UA: 'Ucrânia', TR: 'Turquia', IL: 'Israel', AE: 'Emirados Árabes',
};

/** Returns a flag emoji for a given ISO 3166-1 alpha-2 country code. */
export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  const offset = 127397; // 🇦 = 0x1F1E6 = 127462, A = 65 → 127462 - 65 = 127397
  return String.fromCodePoint(...code.toUpperCase().split('').map(c => c.charCodeAt(0) + offset));
}

/** Looks up geolocation data for a given IP address via ipinfo.io. */
export async function lookupGeo(ip: string): Promise<GeoInfo | null> {
  try {
    const addr = ip.split('/')[0];
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(addr)}/json`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data = await res.json() as {
      ip?: string;
      bogon?: boolean;
      city?: string;
      region?: string;
      country?: string;
      loc?: string;    // "lat,lon"
      org?: string;
      timezone?: string;
    };

    // bogon = private/reserved address — no meaningful geo data
    if (data.bogon) return null;
    if (!data.country) return null;

    let lat: number | undefined;
    let lon: number | undefined;
    if (data.loc) {
      const [la, lo] = data.loc.split(',').map(Number);
      if (!isNaN(la) && !isNaN(lo)) { lat = la; lon = lo; }
    }

    const code = data.country ?? '';
    return {
      ip: data.ip ?? addr,
      city: data.city,
      region: data.region,
      country: code,
      countryName: COUNTRY_NAMES[code] ?? code,
      lat,
      lon,
      org: data.org,
      timezone: data.timezone,
    };
  } catch {
    return null;
  }
}
