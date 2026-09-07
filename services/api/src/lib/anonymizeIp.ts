// An IP address is personal data (GDPR Recital 30), so nothing we retain past
// the request itself keeps the host part. IPv4 keeps the /24 network, IPv6 the
// /48 routing prefix — enough to correlate abuse from one network, not enough
// to single out a subscriber.

/**
 * Reduce a client IP to a coarse network prefix for logging.
 *
 * Takes the raw `X-Forwarded-For` value: the first entry is the client, the
 * rest are proxies. The header is caller-controlled, so anything that isn't a
 * parseable address is dropped rather than written to the log stream.
 */
export const anonymizeIp = (
  forwardedFor: string | null | undefined,
): string | undefined => {
  const client = forwardedFor?.split(',')[0]?.trim();

  if (!client) {
    return undefined;
  }

  if (client.includes(':')) {
    // Read the prefix off the text before any `::` run. A compressed address
    // whose prefix is shorter than /48 (`fe80::1`, `::ffff:203.0.113.42`)
    // truncates further than needed, which errs towards less data, not more.
    const [prefix = ''] = client.split('::');
    const hextets = prefix.split(':').filter(Boolean).slice(0, 3);

    return hextets.every(isHextet) ? `${hextets.join(':')}::` : undefined;
  }

  const octets = client.split('.');

  if (octets.length !== 4 || !octets.every(isOctet)) {
    return undefined;
  }

  return `${octets.slice(0, 3).join('.')}.0`;
};

const isOctet = (value: string) =>
  /^\d{1,3}$/.test(value) && Number(value) <= 255;

const isHextet = (value: string) => /^[0-9a-f]{1,4}$/i.test(value);
