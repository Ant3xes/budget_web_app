/**
 * Content-Security-Policy with a per-request nonce (issue 163, ADR 0005).
 * Pure function so it can be unit-tested; proxy.ts sets the result as a
 * Content-Security-Policy-Report-Only header.
 */
export const buildCsp = ({
  nonce,
  isDev,
  supabaseUrl,
}: {
  nonce: string;
  isDev: boolean;
  supabaseUrl?: string;
}) => {
  const connect = ["'self'"];
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      connect.push(url.origin);
      // Supabase Realtime uses a websocket on the same host.
      connect.push(`${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`);
    } catch {
      // Invalid URL: leave connect-src to 'self' only.
    }
  }
  // Vercel Analytics / Speed Insights beacons (same-origin paths on Vercel).
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Nonce for <style> tags; style="" attributes (Recharts, Radix) need
    // 'unsafe-inline' on the attribute-only directive.
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src ${connect.join(" ")}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];
  return directives.join("; ");
};
