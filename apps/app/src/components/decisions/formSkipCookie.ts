const FORM_SKIP_COOKIE_PREFIX = 'form-skipped-';
const FORM_SKIP_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const getFormSkipCookieName = (formId: string) =>
  `${FORM_SKIP_COOKIE_PREFIX}${formId}`;

export const hasFormSkipCookie = (formId: string): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }
  const name = `${getFormSkipCookieName(formId)}=`;
  return document.cookie.split('; ').some((c) => c.startsWith(name));
};

export const setFormSkipCookie = (formId: string) => {
  document.cookie = `${getFormSkipCookieName(formId)}=1; path=/; max-age=${FORM_SKIP_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
};
