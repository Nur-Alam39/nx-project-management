/**
 * Browser: same-origin proxy path (see Next.js `rewrites`).
 * Server (RSC/actions): talk directly to the API port.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '/api/backend';
  }
  return process.env['INTERNAL_API_URL'] ?? 'http://127.0.0.1:3333';
}
