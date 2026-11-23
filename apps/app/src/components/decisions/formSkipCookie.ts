const SKIP_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const getSkipCookieName = (prefix: string, id: string) => `${prefix}${id}`;

const hasSkipCookie = (prefix: string, id: string): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }
  const name = `${getSkipCookieName(prefix, id)}=`;
  return document.cookie.split('; ').some((c) => c.startsWith(name));
};

const setSkipCookie = (prefix: string, id: string) => {
  document.cookie = `${getSkipCookieName(prefix, id)}=1; path=/; max-age=${SKIP_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
};

export const hasFormSkipCookie = (formId: string): boolean =>
  hasSkipCookie('form-skipped-', formId);

export const setFormSkipCookie = (formId: string) => {
  setSkipCookie('form-skipped-', formId);
};
