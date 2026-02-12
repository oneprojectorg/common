// Client-safe exports for @op/common
// This file should only export types and schemas that don't depend on server-only modules

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
