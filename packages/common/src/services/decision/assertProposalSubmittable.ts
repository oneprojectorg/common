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
  assembledData: Record<string, unknown> | null;
  location: LocationData | null;
  collaborationDocId: string;
}

/** @throws {ValidationError} when the proposal cannot be submitted */
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

  // The assembled fragment values are authoritative; stored proposalData may lag the autosave.
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

  // A template that collects a location requires one, inside a boundary when
  // the decision has boundaries.
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
