import { firstHeaderValue } from '../lib/firstHeaderValue';

export const resolveWebhookUrl = ({
  url,
  headers,
}: {
  url: string;
  headers: Headers;
}): string => {
  const proto = firstHeaderValue(headers.get('x-forwarded-proto'));
  const host =
    firstHeaderValue(headers.get('x-forwarded-host')) ??
    firstHeaderValue(headers.get('host'));

  if (!proto || !host) {
    return url;
  }

  const { pathname, search } = new URL(url);
  return `${proto}://${host}${pathname}${search}`;
};
