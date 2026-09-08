/**
 * PROTOTYPE ONLY.
 *
 * `next-intl`, as far as this build ever needs it. The locale is fixed: it feeds
 * `Intl` date and relative-time formatting, not a dictionary lookup.
 */
export const useLocale = () => 'en';

/**
 * Reimplemented on `Intl` directly, which is all next-intl wraps here. Reached
 * through `@op/hooks`, whose index pulls in a relative-time hook the prototype
 * does use.
 */
export const useFormatter = () => ({
  dateTime: (date: Date, options?: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en', options).format(date),
  relativeTime: (
    date: Date,
    options?: { now?: Date; style?: Intl.RelativeTimeFormatStyle },
  ) => {
    const now = options?.now ?? new Date();
    const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
    const format = new Intl.RelativeTimeFormat('en', {
      numeric: 'auto',
      style: options?.style,
    });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31_536_000],
      ['month', 2_592_000],
      ['day', 86_400],
      ['hour', 3_600],
      ['minute', 60],
    ];

    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) {
        return format.format(Math.round(seconds / size), unit);
      }
    }

    return format.format(seconds, 'second');
  },
  number: (value: number, options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat('en', options).format(value),
});
