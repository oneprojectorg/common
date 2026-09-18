/**
 * Server-side counterpart to `useTranslations`. next-intl types both from the
 * dictionary, so this module only re-exports; the import path stays because
 * every server component in the app already names it.
 */
export { getTranslations } from 'next-intl/server';
