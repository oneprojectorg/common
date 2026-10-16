const firstValue = (header: string | null): string | null => {
  const value = header?.split(',')[0]?.trim();
  return value ? value : null;
};

export const resolveWebhookUrl = ({
  url,
  headers,
}: {
  url: string;
  headers: Headers;
}): string => {
  const proto = firstValue(headers.get('x-forwarded-proto'));
  const host =
    firstValue(headers.get('x-forwarded-host')) ??
    firstValue(headers.get('host'));

  if (!proto || !host) {
    return url;
  }

  const { pathname, search } = new URL(url);
  return `${proto}://${host}${pathname}${search}`;
};
