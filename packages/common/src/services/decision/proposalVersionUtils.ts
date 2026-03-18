import {
  type TipTapClient,
  type TipTapDocument,
  type TipTapFragmentResponse,
  type TipTapVersion,
  createTipTapClient,
} from '@op/collab';
import { db } from '@op/db/client';
import type { ProcessInstance, Profile, Proposal } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertInstanceProfileAccess, getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { assembleProposalData } from './assembleProposalData';
import { getProposalFragmentNames } from './getProposalFragmentNames';
import {
  type ProposalData,
  normalizeBudget,
  parseProposalData,
} from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema } from './types';

type ProposalWithVersionAccess = Proposal & {
  processInstance: ProcessInstance;
  profile: Profile;
};

export interface ProposalVersionContext {
  proposal: ProposalWithVersionAccess;
  collaborationDocId: string;
  fragmentNames: string[];
  proposalTemplate: ProposalTemplateSchema | null;
  currentProfileId: string;
  client: TipTapClient;
}

function isTipTapDocument(value: unknown): value is TipTapDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.type === 'string' &&
    (candidate.content === undefined || Array.isArray(candidate.content))
  );
}

function isTipTapFragmentResponse(
  value: unknown,
): value is TipTapFragmentResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => isTipTapDocument(entry));
}

function extractTextFromNode(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  const candidate = node as Record<string, unknown>;
  const ownText = typeof candidate.text === 'string' ? candidate.text : '';
  const childText = Array.isArray(candidate.content)
    ? candidate.content
        .map((child: unknown) => extractTextFromNode(child))
        .join('')
    : '';

  return `${ownText}${childText}`;
}

export function extractTextFromDocument(document: TipTapDocument): string {
  return Array.isArray(document.content)
    ? document.content
        .map((node: unknown) => extractTextFromNode(node))
        .join('')
    : '';
}

export function extractTextFragments(
  fragments: TipTapFragmentResponse,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fragments).map(([fragmentName, document]) => [
      fragmentName,
      extractTextFromDocument(document),
    ]),
  );
}

function parseBudgetFragment(text: string | undefined) {
  if (text === undefined || text === '') {
    return undefined;
  }

  try {
    return normalizeBudget(JSON.parse(text)) ?? undefined;
  } catch {
    return normalizeBudget(text) ?? undefined;
  }
}

function applySystemFieldOverrides(
  baseData: Record<string, unknown>,
  fragmentTexts: Record<string, string>,
): Record<string, unknown> {
  const nextData = { ...baseData };

  if ('title' in fragmentTexts) {
    nextData.title = fragmentTexts.title;
  }

  if ('category' in fragmentTexts) {
    nextData.category = fragmentTexts.category || undefined;
  }

  if ('budget' in fragmentTexts) {
    nextData.budget = parseBudgetFragment(fragmentTexts.budget);
  }

  return nextData;
}

export function buildVersionProposalData({
  collaborationDocId,
  fragmentTexts,
  proposalTemplate,
}: {
  collaborationDocId: string;
  fragmentTexts: Record<string, string>;
  proposalTemplate: ProposalTemplateSchema | null;
}): ProposalData {
  const assembledData = proposalTemplate
    ? assembleProposalData(proposalTemplate, fragmentTexts)
    : {};

  return parseProposalData({
    ...applySystemFieldOverrides(assembledData, fragmentTexts),
    collaborationDocId,
  });
}

export function mergeRestoredProposalData({
  collaborationDocId,
  existingProposalData,
  fragmentTexts,
  proposalTemplate,
}: {
  collaborationDocId: string;
  existingProposalData: unknown;
  fragmentTexts: Record<string, string>;
  proposalTemplate: ProposalTemplateSchema | null;
}): ProposalData {
  const existingData = parseProposalData(existingProposalData);
  const assembledData = proposalTemplate
    ? assembleProposalData(proposalTemplate, fragmentTexts)
    : {};
  const mergedData = {
    ...existingData,
    ...assembledData,
  };

  return parseProposalData({
    ...applySystemFieldOverrides(mergedData, fragmentTexts),
    collaborationDocId,
  });
}

export function normalizeVersionSnapshot(
  snapshot: unknown,
): TipTapFragmentResponse | null {
  if (isTipTapDocument(snapshot)) {
    return { default: snapshot };
  }

  if (isTipTapFragmentResponse(snapshot)) {
    return snapshot;
  }

  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const candidate = snapshot as Record<string, unknown>;
  const nestedCandidates = [
    candidate.fragments,
    candidate.document,
    candidate.content,
    candidate.data,
    candidate.snapshot,
  ];

  for (const nestedCandidate of nestedCandidates) {
    if (isTipTapDocument(nestedCandidate)) {
      return { default: nestedCandidate };
    }

    if (isTipTapFragmentResponse(nestedCandidate)) {
      return nestedCandidate;
    }
  }

  return null;
}

export function sortVersionsDesc(versions: TipTapVersion[]): TipTapVersion[] {
  return [...versions].sort((left, right) => {
    if (left.version !== right.version) {
      return right.version - left.version;
    }

    return right.date - left.date;
  });
}

function createConfiguredTipTapClient(): TipTapClient {
  const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
  const secret = process.env.TIPTAP_SECRET;

  if (!appId || !secret) {
    throw new CommonError('TipTap credentials not configured');
  }

  return createTipTapClient({ appId, secret });
}

/**
 * Loads a proposal, confirms the caller can edit it, and resolves the
 * collaboration document metadata needed for version history operations.
 */
export async function getProposalVersionContext({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<ProposalVersionContext> {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.currentProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
    with: {
      processInstance: true,
      profile: true,
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal');
  }

  const proposalProfileUser = await getProfileAccessUser({
    user: { id: user.id },
    profileId: proposal.profileId,
  });

  const hasProposalUpdate = checkPermission(
    { profile: permission.UPDATE },
    proposalProfileUser?.roles ?? [],
  );

  if (!hasProposalUpdate) {
    await assertInstanceProfileAccess({
      user: { id: user.id },
      instance: proposal.processInstance,
      profilePermissions: { decisions: permission.UPDATE },
      orgFallbackPermissions: [{ decisions: permission.ADMIN }],
    });
  }

  const parsedProposalData = parseProposalData(proposal.proposalData);

  if (!parsedProposalData.collaborationDocId) {
    throw new ValidationError(
      'Proposal does not have collaborative content to version',
    );
  }

  const proposalTemplate = await resolveProposalTemplate(
    proposal.processInstance.instanceData as DecisionInstanceData | null,
    proposal.processInstance.processId,
  );

  return {
    proposal,
    collaborationDocId: parsedProposalData.collaborationDocId,
    fragmentNames: proposalTemplate
      ? getProposalFragmentNames(proposalTemplate)
      : ['default'],
    proposalTemplate,
    currentProfileId: dbUser.currentProfileId,
    client: createConfiguredTipTapClient(),
  };
}
