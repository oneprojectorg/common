import type { proposals } from '@op/db/schema';

import { ValidationError } from '../../utils';
import {
  type LocationData,
  normalizeLocation,
  parseProposalData,
} from './proposalDataSchema';
import { hasDecisionBoundaries, resolveBoundary } from './resolveBoundary';
import { templateCollectsLocation } from './templateLocation';
import type { ProposalTemplateSchema } from './types';
import { validateProposalAgainstTemplate } from './validateProposalAgainstTemplate';

interface SubmittableProposal {
  /** The assembled document values for a collab-doc proposal; `null` for a legacy proposal. */
  assembledData: Record<string, unknown> | null;
  location: LocationData | null;
  collaborationDocId: string;
}

/**
 * Runs the submit checks on a proposal without changing it: the template
 * rules, the location rule and the collaboration document.
 *
 * @throws {ValidationError} when the proposal cannot be submitted
 */
export async function assertProposalSubmittable({
  proposal,
  proposalTemplate,
  instance,
}: {
  proposal: Pick<typeof proposals.$inferSelect, 'proposalData'> & {
    profile: { name: string };
  };
  proposalTemplate: ProposalTemplateSchema | null;
  instance: { profileId: string };
}): Promise<SubmittableProposal> {
  const parsed = parseProposalData(proposal.proposalData);

  // For collab-doc proposals the assembled fragment values are authoritative —
  // stored proposalData may lag the last autosave.
  let assembledData: Record<string, unknown> | null = null;

  if (proposalTemplate) {
    assembledData = await validateProposalAgainstTemplate(
      proposalTemplate,
      proposal.proposalData,
      proposal.profile.name,
      { profileId: instance.profileId },
    );
  }

  const location =
    normalizeLocation(
      assembledData ? assembledData.location : parsed.location,
    ) ?? null;

  // When the template collects a location, it is mandatory. If boundaries are
  // configured, the pin must fall inside one — the authoritative server-side
  // enforcement of the picker's out-of-area check. When no boundaries exist,
  // any location is valid (the pin can go anywhere).
  if (templateCollectsLocation(proposalTemplate)) {
    if (!location) {
      throw new ValidationError(
        'A project location is required to submit this proposal.',
      );
    }

    const boundary = await resolveBoundary({
      lat: location.lat,
      lng: location.lng,
      profileId: instance.profileId,
    });

    if (
      !boundary &&
      (await hasDecisionBoundaries({ profileId: instance.profileId }))
    ) {
      throw new ValidationError(
        'The selected location is outside the project boundary. Choose a spot within the boundary.',
      );
    }
  }

  if (!parsed.collaborationDocId) {
    throw new ValidationError('Proposal is missing a collaboration document');
  }

  return {
    assembledData,
    location,
    collaborationDocId: parsed.collaborationDocId,
  };
}
