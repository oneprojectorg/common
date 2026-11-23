const SKIP_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const hasSkipCookie = (name: string): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.cookie
    .split('; ')
    .some((cookie) => cookie.startsWith(`${name}=`));
};

export const setSkipCookie = (name: string) => {
  document.cookie = `${name}=1; path=/; max-age=${SKIP_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
};
