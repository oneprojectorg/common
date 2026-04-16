import { parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs';

export const proposalEditorAsideValues = ['versions'] as const;

export const proposalEditorReviewRevisionParser = parseAsString;

export type ProposalEditorAside = (typeof proposalEditorAsideValues)[number];

export interface ProposalVersionsAsideParams {
  aside: 'versions';
  versionId: number | null;
}

export type ProposalEditorAsideState =
  | { aside: null }
  | ProposalVersionsAsideParams;

export const proposalEditorAsideParser = parseAsStringLiteral(
  proposalEditorAsideValues,
);

export const proposalEditorVersionIdParser = parseAsInteger;

type ProposalEditorAsideQueryState =
  | { aside: null }
  | ProposalVersionsAsideParams;

/**
 * Normalizes query params into a discriminated union so each aside owns its
 * own state shape.
 */
export function getProposalEditorAsideState(
  queryState: ProposalEditorAsideQueryState,
): ProposalEditorAsideState {
  if (queryState.aside === 'versions') {
    return {
      aside: queryState.aside,
      versionId: queryState.versionId,
    };
  }

  return { aside: null };
}

export function normalizeProposalEditorAsideQueryState({
  aside,
  versionId,
}: {
  aside: ProposalEditorAside | null;
  versionId: number | null;
}): ProposalEditorAsideQueryState {
  if (aside === 'versions') {
    return {
      aside,
      versionId,
    };
  }

  return { aside: null };
}

export function getProposalEditorAsideQuery(state: ProposalEditorAsideState): {
  aside: ProposalEditorAside | null;
  versionId: number | null;
} {
  if (state.aside === 'versions') {
    return {
      aside: state.aside,
      versionId: state.versionId,
    };
  }

  return {
    aside: null,
    versionId: null,
  };
}

export function getProposalEditorAsideDefaultState(
  aside: ProposalEditorAside,
): ProposalEditorAsideState {
  switch (aside) {
    case 'versions': {
      return {
        aside,
        versionId: null,
      };
    }
  }
}
