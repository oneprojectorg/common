/**
 * PROTOTYPE ONLY.
 *
 * Stands in for the app's next-intl setup. `t` returns its own key, which is
 * exactly right here: every call site already passes the English string as the
 * key, so the key *is* the copy and there are no dictionaries to keep in sync. A
 * prototype nobody will read in Somali has no business editing seven
 * translation files to change a label.
 *
 * Interpolation is still real, because next-intl's `{name}` placeholders are
 * part of the copy — without it a date renders as the literal `{date}`.
 */
export { Link, usePathname, useRouter } from '../router';

export type TranslationKey = string;

type Values = Record<string, string | number>;

/** The shape the wizard's pure helpers take a translator as. */
export interface TranslateFn {
  (key: TranslationKey, values?: Values): string;
}

export function useTranslations(): TranslateFn {
  return (key: TranslationKey, values?: Values) =>
    values
      ? key.replace(/\{(\w+)\}/g, (whole, name: string) =>
          name in values ? String(values[name]) : whole,
        )
      : key;
}
