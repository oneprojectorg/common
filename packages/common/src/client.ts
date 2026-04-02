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
export { getProposalFragmentNames } from './services/decision/getProposalFragmentNames';
export { assembleProposalData } from './services/decision/assembleProposalData';
export {
  SchemaValidator,
  schemaValidator,
  type SchemaValidationResult,
} from './services/decision/schemaValidator';
export { serverExtensions } from './services/decision/tiptapExtensions';
export { isRationaleField } from './services/decision/getRubricScoringInfo';
export {
  REVIEWS_POLICIES,
  type ReviewsPolicy,
  type ProposalCategory,
  type ProcessConfig,
} from './services/decision/schemas/types';
export type {
  DecisionInstanceData,
  PhaseInstanceData,
} from './services/decision/schemas/instanceData';
export type { DecisionRolePermissions } from './services/decision/permissions';
export type { SortDir } from './utils/db';
export type { TermWithChildren } from './services/terms';
export {
  CommonError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ConflictError,
} from './utils/error';
export { isUserEmailPlatformAdmin } from './services/access/platformAdmin';

// Translation constants (no server dependencies)
export {
  SUPPORTED_LOCALES,
  LOCALE_TO_DEEPL,
} from './services/translation/locales';
export type { SupportedLocale } from './services/translation/locales';
export { parseTranslatedMeta } from './services/translation/parseTranslatedMeta';

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
