// Phase dates are business dates, not personal moments, and they must format
// identically on the server and in the browser or hydration fails (React #418):
// "2026-07-06T04:00:00Z" is "Jul 6" in UTC and "Jul 5" in America/Los_Angeles.
// An unset `timeZone` resolves to the runtime's, which differs between the two
// passes, so pin it. Matches the app's next-intl `timeZone`.
const DISPLAY_TIME_ZONE = 'UTC';

export function formatDate(dateString: string, locale: string = 'en-US') {
  return new Date(dateString).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  });
}

export function formatDateRange(
  startDate?: string,
  endDate?: string,
  locale?: string,
) {
  if (startDate && endDate) {
    return `${formatDate(startDate, locale)} - ${formatDate(endDate, locale)}`;
  }
  if (startDate) {
    return formatDate(startDate, locale);
  }
  if (endDate) {
    return formatDate(endDate, locale);
  }
  return '';
}
