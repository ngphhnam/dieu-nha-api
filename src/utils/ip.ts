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

export function parseUserAgent(ua: string | undefined): {
  device: string;
  browser: string;
  os: string;
} {
  if (!ua) {
    return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };
  }

  const lower = ua.toLowerCase();

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
