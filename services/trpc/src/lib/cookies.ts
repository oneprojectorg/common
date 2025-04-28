import { parse, serialize } from 'cookie';
import type { SerializeOptions } from 'cookie';

export function getCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');

  if (!cookieHeader) return {};

  return parse(cookieHeader);
}

export function getCookie(req: Request, name: string) {
  const cookieHeader = req.headers.get('cookie');

  if (!cookieHeader) return undefined;
  const cookies = parse(cookieHeader);

  return cookies[name];
}

export function setCookie({
  resHeaders,
  name,
  value,
  options,
}: {
  resHeaders: Headers;
  name: string;
  value: string;
  options?: SerializeOptions;
}) {
  resHeaders.append('Set-Cookie', serialize(name, value, options));
}
