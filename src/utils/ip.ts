import { Request } from 'express';

export function getClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return normalizeIp(cfIp.trim());
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return normalizeIp(first);
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    return normalizeIp(forwarded[0].trim());
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return normalizeIp(realIp.trim());
  }

  const fallback = req.ip || req.socket?.remoteAddress || 'unknown';
  return normalizeIp(fallback);
}

function normalizeIp(ip: string): string {
  if (!ip) return 'unknown';
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function isPrivateIp(ip: string): boolean {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  return false;
}

// Cache vị trí theo IP trong 24h (giới hạn 5000 IP) để không gọi API ngoài lặp lại
const geoCache = new Map<string, { value: string | null; expiresAt: number }>();
const GEO_TTL_MS = 24 * 60 * 60 * 1000;

export async function lookupIpLocation(ip: string): Promise<string | null> {
  if (isPrivateIp(ip)) return 'Local';

  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let location: string | null = null;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city&lang=vi`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (res.ok) {
      const data: any = await res.json();
      if (data?.status === 'success') {
        const parts = [data.city, data.regionName, data.country]
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean);
        // Loại bỏ phần trùng nhau (ví dụ city === regionName)
        const uniqueParts = Array.from(new Set(parts));
        if (uniqueParts.length > 0) {
          location = uniqueParts.slice(0, 2).join(', ');
        }
      }
    }
  } catch {
    // Fallback ipwho.is nếu ip-api timeout
    try {
      const res2 = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(2500),
      });
      if (res2.ok) {
        const data2: any = await res2.json();
        if (data2?.success) {
          const parts = [data2.city, data2.country].filter(Boolean);
          if (parts.length > 0) location = parts.join(', ');
        }
      }
    } catch {
      // Bỏ qua nếu mạng lỗi
    }
  }

  if (geoCache.size > 5000) {
    const firstKey = geoCache.keys().next().value;
    if (firstKey) geoCache.delete(firstKey);
  }
  geoCache.set(ip, { value: location, expiresAt: Date.now() + GEO_TTL_MS });
  return location;
}

export function parseUserAgent(ua: string | undefined): {
  device: string;
  browser: string;
  os: string;
} {
  if (!ua) {
    return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };
  }

  const lower = ua.toLowerCase();

  // Nhận diện App Mobile DieuNhaAdmin
  if (lower.includes('dieunhaadmin')) {
    const os = lower.includes('ios') ? 'iOS' : lower.includes('android') ? 'Android' : 'Mobile';
    return { device: 'Mobile App', browser: 'DieuNha App', os };
  }

  let device = 'Desktop';
  if (/bot|crawler|spider|slurp|googlebot|bingbot/i.test(ua)) {
    device = 'Bot';
  } else if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    device = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) {
    device = 'Mobile';
  }

  let browser = 'Other';
  if (lower.includes('edg/') || lower.includes('edge/')) browser = 'Edge';
  else if (lower.includes('opr/') || lower.includes('opera')) browser = 'Opera';
  else if (lower.includes('coc_coc_browser')) browser = 'Cốc Cốc';
  else if (lower.includes('zalo')) browser = 'Zalo';
  else if (lower.includes('fban') || lower.includes('fbav')) browser = 'Facebook';
  else if (lower.includes('chrome/') && !lower.includes('chromium')) browser = 'Chrome';
  else if (lower.includes('safari/') && !lower.includes('chrome')) browser = 'Safari';
  else if (lower.includes('firefox/')) browser = 'Firefox';

  let os = 'Other';
  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')) os = 'iOS';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('mac os') || lower.includes('macintosh')) os = 'macOS';
  else if (lower.includes('linux')) os = 'Linux';

  return { device, browser, os };
}
