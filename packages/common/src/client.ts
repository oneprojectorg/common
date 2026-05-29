// Client-safe exports for @op/common
// This file should only export types and schemas that don't depend on server-only modules

export * from './money';
export * from './services/decision/proposalDataSchema';
export * from './services/decision/schemas/reviews';
export {
  attachmentSchema,
  documentContentSchema,
  proposalAccessSchema,
  proposalAttachmentSchema,
  proposalSchema,
  proposalListSchema,
  proposalProfileSchema,
  storageItemSchema,
  allProposalsFilterSchema,
  allProposalsListItemSchema,
  allProposalsListSchema,
  type Proposal,
  type ProposalList,
  type ProposalProfile,
  type AllProposalsFilter,
  type AllProposalsListItem,
  type AllProposalsList,
} from './services/decision/schemas/proposal';
export {
  adminDecisionInstanceSchema,
  type AdminDecisionInstance,
} from './services/decision/schemas/adminDecisionInstance';
export {
  proposalSelectionSchema,
  type ProposalSelection,
} from './services/decision/schemas/selection';
export {
  profileUserSchema,
  profileUserWithProfileSchema,
  profileUserWithRolesSchema,
  type ProfileUser,
  type ProfileUserBase,
} from './services/profile/schemas/profileUser';
export {
  profileMinimalSchema,
  storageItemMinimalSchema,
  type ProfileMinimal,
  type StorageItemMinimal,
} from './services/profile/schemas/profileMinimal';
export {
  accessRoleMinimalSchema,
  type AccessRoleMinimal,
} from './services/access/schemas/accessRole';
export * from './services/decision/types';
export {
  attachmentSummarySchema,
  resourceWithSignedUrlSchema,
  resourceInCollectionSchema,
  resourceListSchema,
  collectionSchema,
  collectionListSchema,
  type AttachmentSummary,
  type ResourceDTO,
  type ResourceInCollectionDTO,
  type ResourceListResult,
  type CollectionDTO,
  type CollectionListResult,
} from './services/resources/schemas';
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
export {
  getRubricScoringInfo,
  OVERALL_RECOMMENDATION_KEY,
  RECOMMENDATION_OPTION,
  type RecommendationValue,
  isOverallRecommendationField,
} from './services/decision/getRubricScoringInfo';
export { REVIEWS_POLICIES } from './services/decision/schemas/types';
export { isLastPhase } from './services/decision/schemas/instanceData';
export {
  VOTING_INELIGIBLE_STATUSES,
  isVotingEligible,
} from './services/decision/votingEligibility';

// Translation constants (no server dependencies)
export {
  SUPPORTED_LOCALES,
  LOCALE_TO_DEEPL,
} from './services/translation/locales';
export type { SupportedLocale } from './services/translation/locales';
export { parseTranslatedMeta } from './services/translation/parseTranslatedMeta';
export type { ProposalTranslation } from './services/translation/translateProposal';
export type {
  TranslatedFieldValue,
  TranslatedFields,
} from './services/translation/translatedFields';

// Re-exported from utils so client components can import it without pulling in
// the server-only utils barrel (which depends on drizzle).
export { hasEmail } from './utils/email';

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
