// Client-safe exports for @op/common
// This file should only export types and schemas that don't depend on server-only modules

export * from './money';
export * from './services/decision/proposalDataSchema';
export * from './services/decision/types';
export {
  SYSTEM_FIELD_KEYS,
  getProposalTemplateFieldOrder,
  type ProposalTemplateFieldOrder,
} from './services/decision/getProposalTemplateFieldOrder';
// Translation constants (no server dependencies)
export {
  SUPPORTED_LOCALES,
  LOCALE_TO_DEEPL,
} from './services/translation/locales';
export type { SupportedLocale } from './services/translation/locales';

const LOGIN_PATH_RE = /^\/(?:[a-z]{2}\/)?login(\/|$|\?)/;

export function isSafeRedirectPath(path: string | null): path is string {
  if (!path?.startsWith('/')) {
    return false;
  }
  if (path.startsWith('//')) {
    return false;
  }
  if (LOGIN_PATH_RE.test(path)) {
    return false;
  }
  if (path.startsWith('/api/')) {
    return false;
  }
  return true;
}
