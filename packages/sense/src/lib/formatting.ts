// Date-only strings ("2026-06-01") parse as UTC midnight, so they must also
// render in UTC — otherwise viewers west of UTC see the previous day.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(dateString: string, locale: string = 'en-US') {
  return new Date(dateString).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: DATE_ONLY.test(dateString) ? 'UTC' : undefined,
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
