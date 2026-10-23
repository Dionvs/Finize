// Both exact HTTPS origins are documented by Enable Banking during its migration.
const origins = new Set(['https://auth.enablebanking.com', 'https://tilisy.enablebanking.com']);
export function bankAuthorizationUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!origins.has(url.origin) || url.username || url.password || url.pathname.replace(/\/$/, '') !== '/ais/start') return null;
    return url.href;
  } catch { return null; }
}
