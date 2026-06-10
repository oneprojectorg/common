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
export {
  organizationUserSchema,
  type OrganizationUserBase,
} from './services/organization/schemas/organizationUser';
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
export {
  templateCollectsLocation,
  getLocationFieldMapView,
} from './services/decision/templateLocation';
export { assembleProposalData } from './services/decision/assembleProposalData';
export { relaxLocationCategoryRequirement } from './services/decision/relaxLocationCategoryRequirement';
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

// Resource constants (no server dependencies)
export {
  ALLOWED_RESOURCE_MIME_TYPES,
  MAX_RESOURCE_FILE_SIZE,
  RESOURCE_DESCRIPTION_MAX_LEN,
  RESOURCE_TITLE_MAX_LEN,
  httpUrlSchema,
  isAllowedResourceMimeType,
  resourcePathPrefix,
  type AllowedResourceMimeType,
} from './services/resources/constants';

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

// Sentinel base used to detect open-redirect bypass attempts. Any path that
// resolves to an origin different from this base is escaping the app origin
// — `//host`, `/\host`, `/\t//host`, etc. — and must be rejected.
const REDIRECT_VALIDATOR_BASE = 'https://op-redirect-validator.invalid';

/**
 * Validate a relative redirect path and return its safe canonical (decoded)
 * form. Accepts both already-decoded paths (the common case after
 * `searchParams.get`) and percent-encoded paths like `%2Fen%2Fprofile%2Fx` —
 * the latter happens when the redirect param arrives without being URL-decoded
 * (e.g. read off `request.url` manually, or set on a downstream Location
 * header). Returns `null` if the path is unsafe.
 *
 * Callers should redirect to the **returned** string, not the original input —
 * `redirect()` / `new URL()` don't decode percent sequences, so passing the
 * encoded form lands the user on a literal-`%2F` path that won't route.
 */
export function getSafeRedirectPath(path: string | null): string | null {
  if (path == null) {
    return null;
  }
  // Decode percent-encoded paths once. We only decode when the input doesn't
  // already look like a path so legitimate paths with embedded `%XX` sequences
  // (e.g. `/foo%20bar`) are left alone.
  let candidate = path;
  if (candidate.startsWith('%')) {
    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      return null;
    }
  }
  if (!candidate.startsWith('/')) {
    return null;
  }
  // Reject backslashes and ASCII control characters anywhere in the path.
  // The WHATWG URL parser normalizes `\` to `/` and strips control chars,
  // which is how `/\evil.com` and `/\t//evil.com` produce a foreign origin
  // when handed to NextResponse.redirect / window.location.href.
  if (/[\\\x00-\x1f\x7f]/.test(candidate)) {
    return null;
  }
  let resolved: URL;
  try {
    resolved = new URL(candidate, REDIRECT_VALIDATOR_BASE);
  } catch {
    return null;
  }
  // Belt-and-braces: if the path resolved to a different origin (e.g. via a
  // future parser quirk the string check above missed), reject it.
  if (resolved.origin !== REDIRECT_VALIDATOR_BASE) {
    return null;
  }
  if (LOGIN_PATH_RE.test(candidate)) {
    return null;
  }
  if (candidate.startsWith('/api/')) {
    return null;
  }
  return candidate;
}

export function isSafeRedirectPath(path: string | null): path is string {
  return getSafeRedirectPath(path) !== null;
}
