import { getTipTapClient } from '@op/collab';
import { db } from '@op/db/client';
import { ProposalStatus } from '@op/db/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../utils/error';
import { assertProfileAccess } from '../assert';
import { hasDecisionBoundaries, resolveBoundary } from './resolveBoundary';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { setProposalCategories } from './setProposalCategories';
import { submitProposal } from './submitProposal';
import { syncProposalProfileLocation } from './syncProposalProfileLocation';
import type { ProposalTemplateSchema } from './types';
import { validateProposalAgainstTemplate } from './validateProposalAgainstTemplate';

// Mock every imported module the function touches so we can drive execution to
// the location/boundary enforcement branch (submitProposal.ts ~lines 114-139).
//
// `templateCollectsLocation`, `normalizeLocation`, `parseProposalData`, and
// `checkProposalsAllowed` are intentionally left UNMOCKED — they are pure
// helpers whose real behavior is exactly what the enforcement branch depends on
// (e.g. a template with an `x-format: 'location'` property must read as
// "collects location"). Mocking them would make the test assert nothing real.

vi.mock('@op/db/client', () => ({
  db: {
    query: {
      proposals: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(),
  },
  eq: vi.fn(),
}));

vi.mock('@op/db/schema', () => ({
  ProposalStatus: { DRAFT: 'draft', SUBMITTED: 'submitted' },
  proposals: {},
}));

vi.mock('@op/collab', () => ({
  getTipTapClient: vi.fn(),
}));

vi.mock('../assert', () => ({
  assertProfileAccess: vi.fn(),
}));

vi.mock('./resolveBoundary', () => ({
  resolveBoundary: vi.fn(),
  hasDecisionBoundaries: vi.fn(),
}));

vi.mock('./resolveProposalTemplate', () => ({
  resolveProposalTemplate: vi.fn(),
}));

vi.mock('./validateProposalAgainstTemplate', () => ({
  validateProposalAgainstTemplate: vi.fn(),
}));

vi.mock('./setProposalCategories', () => ({
  setProposalCategories: vi.fn(),
}));

vi.mock('./reconcileReviewAssignments', () => ({
  reconcileReviewAssignments: vi.fn(),
}));

vi.mock('./syncProposalProfileLocation', () => ({
  syncProposalProfileLocation: vi.fn(),
}));

const mockFindFirst = vi.mocked(db.query.proposals.findFirst);
const mockTransaction = vi.mocked(db.transaction);
const mockAssertProfileAccess = vi.mocked(assertProfileAccess);
const mockResolveBoundary = vi.mocked(resolveBoundary);
const mockHasDecisionBoundaries = vi.mocked(hasDecisionBoundaries);
const mockResolveProposalTemplate = vi.mocked(resolveProposalTemplate);
const mockValidateProposalAgainstTemplate = vi.mocked(
  validateProposalAgainstTemplate,
);
const mockGetTipTapClient = vi.mocked(getTipTapClient);
const mockSetProposalCategories = vi.mocked(setProposalCategories);
const mockSyncProposalProfileLocation = vi.mocked(syncProposalProfileLocation);

const PROPOSAL_ID = 'proposal-1';
const PROFILE_ID = 'profile-1';
const AUTH_USER_ID = 'user-1';
const LOCATION = { lat: 39.96, lng: -82.99 };
const BOUNDARY = { id: 'b1', name: 'District 7', taxonomyTermId: 't7' };

/** A template whose `location` field carries the location x-format. */
function locationTemplate(): ProposalTemplateSchema {
  return {
    type: 'object',
    properties: {
      location: { type: 'object', 'x-format': 'location' },
    },
  };
}

/**
 * Build the draft proposal + its process instance, returned from
 * `db.query.proposals.findFirst`. `proposalData` drives `parseProposalData` /
 * `normalizeLocation`, so its `location` controls the "no location" case.
 */
function draftProposal(proposalData: Record<string, unknown>) {
  return {
    id: PROPOSAL_ID,
    status: ProposalStatus.DRAFT,
    proposalData,
    profileId: PROFILE_ID,
    profile: { name: 'Test Project' },
    processInstance: {
      profileId: PROFILE_ID,
      processId: 'process-1',
      currentStateId: 'phase-1',
      // Phase allows proposal submission (rules.proposals.submit !== false).
      instanceData: {
        phases: [{ phaseId: 'phase-1', name: 'Submission', rules: {} }],
      },
    },
  };
}

describe('submitProposal — location/boundary enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Pass the authorization gate so execution reaches the location check.
    mockAssertProfileAccess.mockResolvedValue(undefined as never);
    // Template collects a location for all three cases below.
    mockResolveProposalTemplate.mockResolvedValue(locationTemplate());
  });

  it('throws ValidationError when the template collects a location but the proposal has none', async () => {
    mockFindFirst.mockResolvedValue(
      draftProposal({ collaborationDocId: 'doc-1' }) as never,
    );
    // Assembled data carries no location either.
    mockValidateProposalAgainstTemplate.mockResolvedValue({});

    await expect(
      submitProposal({
        data: { proposalId: PROPOSAL_ID },
        authUserId: AUTH_USER_ID,
      }),
    ).rejects.toThrow(ValidationError);
    await expect(
      submitProposal({
        data: { proposalId: PROPOSAL_ID },
        authUserId: AUTH_USER_ID,
      }),
    ).rejects.toThrow(/A project location is required/);

    // It never got as far as the boundary lookup.
    expect(mockResolveBoundary).not.toHaveBeenCalled();
  });

  it('throws ValidationError when the location falls outside any boundary (resolveBoundary → null)', async () => {
    mockFindFirst.mockResolvedValue(
      draftProposal({
        collaborationDocId: 'doc-1',
        location: LOCATION,
      }) as never,
    );
    mockValidateProposalAgainstTemplate.mockResolvedValue({
      location: LOCATION,
    });
    mockResolveBoundary.mockResolvedValue(null);
    // Boundaries ARE configured, so an unmatched pin is out-of-area.
    mockHasDecisionBoundaries.mockResolvedValue(true);

    await expect(
      submitProposal({
        data: { proposalId: PROPOSAL_ID },
        authUserId: AUTH_USER_ID,
      }),
    ).rejects.toThrow(ValidationError);
    await expect(
      submitProposal({
        data: { proposalId: PROPOSAL_ID },
        authUserId: AUTH_USER_ID,
      }),
    ).rejects.toThrow(/outside the project boundary/);

    expect(mockResolveBoundary).toHaveBeenCalledWith({
      lat: LOCATION.lat,
      lng: LOCATION.lng,
      profileId: PROFILE_ID,
    });
    expect(mockHasDecisionBoundaries).toHaveBeenCalledWith({
      profileId: PROFILE_ID,
    });
  });

  it('passes the location check when a location resolves to a boundary, then completes the submit', async () => {
    mockFindFirst.mockResolvedValue(
      draftProposal({
        collaborationDocId: 'doc-1',
        location: LOCATION,
      }) as never,
    );
    mockValidateProposalAgainstTemplate.mockResolvedValue({
      location: LOCATION,
    });
    mockResolveBoundary.mockResolvedValue(BOUNDARY);

    // Past the location check the function stamps a TipTap version and runs a
    // db transaction. Mock both so the happy path can complete without throwing
    // — proving the location/boundary branch was satisfied.
    mockGetTipTapClient.mockReturnValue({
      createVersion: vi.fn().mockResolvedValue({ version: 7 }),
    } as never);
    const submitted = {
      id: PROPOSAL_ID,
      status: ProposalStatus.SUBMITTED,
      profile: { name: 'Test Project' },
    };
    mockTransaction.mockImplementation((async (
      cb: (tx: unknown) => Promise<unknown>,
    ) => {
      const tx = {
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [submitted],
            }),
          }),
        }),
        query: {
          proposals: {
            findFirst: async () => submitted,
          },
        },
      };
      return cb(tx);
    }) as never);
    mockSyncProposalProfileLocation.mockResolvedValue(undefined as never);
    mockSetProposalCategories.mockResolvedValue(undefined as never);

    const result = await submitProposal({
      data: { proposalId: PROPOSAL_ID },
      authUserId: AUTH_USER_ID,
    });

    // The boundary lookup happened and the submit resolved (no throw at all).
    expect(mockResolveBoundary).toHaveBeenCalledWith({
      lat: LOCATION.lat,
      lng: LOCATION.lng,
      profileId: PROFILE_ID,
    });
    expect(result).toEqual(submitted);
  });

  it('allows any location when no boundaries are configured (pin can go anywhere)', async () => {
    mockFindFirst.mockResolvedValue(
      draftProposal({
        collaborationDocId: 'doc-1',
        location: LOCATION,
      }) as never,
    );
    mockValidateProposalAgainstTemplate.mockResolvedValue({
      location: LOCATION,
    });
    // The pin matches no boundary, but none are configured, so it's allowed.
    mockResolveBoundary.mockResolvedValue(null);
    mockHasDecisionBoundaries.mockResolvedValue(false);

    mockGetTipTapClient.mockReturnValue({
      createVersion: vi.fn().mockResolvedValue({ version: 7 }),
    } as never);
    const submitted = {
      id: PROPOSAL_ID,
      status: ProposalStatus.SUBMITTED,
      profile: { name: 'Test Project' },
    };
    mockTransaction.mockImplementation((async (
      cb: (tx: unknown) => Promise<unknown>,
    ) => {
      const tx = {
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [submitted],
            }),
          }),
        }),
        query: { proposals: { findFirst: async () => submitted } },
      };
      return cb(tx);
    }) as never);
    mockSyncProposalProfileLocation.mockResolvedValue(undefined as never);
    mockSetProposalCategories.mockResolvedValue(undefined as never);

    const result = await submitProposal({
      data: { proposalId: PROPOSAL_ID },
      authUserId: AUTH_USER_ID,
    });

    // Boundary existence was checked, the out-of-area throw was skipped, and the
    // submit completed.
    expect(mockHasDecisionBoundaries).toHaveBeenCalled();
    expect(result).toEqual(submitted);
  });
});
