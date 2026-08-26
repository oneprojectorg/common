import { ProposalStatus, Visibility } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { describe, expect, it } from 'vitest';

import { getMergeCandidates } from './merge';

/** Lifts `title` and `profileName` out of their real nesting so cases stay flat. */
const proposal = ({
  id,
  title,
  profileName = 'Profile name',
  status = ProposalStatus.SUBMITTED,
  visibility = Visibility.VISIBLE,
  isFlagged = false,
}: {
  id: string;
  title?: string;
  profileName?: string;
  status?: string;
  visibility?: string;
  isFlagged?: boolean;
}): Proposal =>
  ({
    id,
    processInstanceId: '00000000-0000-0000-0000-0000000000ff',
    profileId: `profile-${id}`,
    proposalData: { title, category: [] },
    status,
    visibility,
    isFlagged,
    profile: { name: profileName },
  }) as unknown as Proposal;

const untitledLabel = 'Untitled Proposal';

describe('getMergeCandidates', () => {
  it('excludes the proposal being merged', () => {
    const candidates = getMergeCandidates({
      proposals: [proposal({ id: 'a' }), proposal({ id: 'b' })],
      sourceProposalId: 'a',
      untitledLabel,
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual(['b']);
  });

  it('excludes drafts, which admins and owners do receive from listProposals', () => {
    const candidates = getMergeCandidates({
      proposals: [
        proposal({ id: 'draft', status: ProposalStatus.DRAFT }),
        proposal({ id: 'submitted' }),
      ],
      sourceProposalId: 'source',
      untitledLabel,
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual(['submitted']);
  });

  it('excludes a hidden proposal, which would survive invisible to members', () => {
    const candidates = getMergeCandidates({
      proposals: [
        proposal({ id: 'hidden', visibility: Visibility.HIDDEN }),
        proposal({ id: 'visible' }),
      ],
      sourceProposalId: 'source',
      untitledLabel,
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual(['visible']);
  });

  it('excludes a flagged proposal, which members also cannot see', () => {
    const candidates = getMergeCandidates({
      proposals: [
        proposal({ id: 'flagged', isFlagged: true }),
        proposal({ id: 'clean' }),
      ],
      sourceProposalId: 'source',
      untitledLabel,
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual(['clean']);
  });

  it('keeps the order the list query returned', () => {
    const candidates = getMergeCandidates({
      proposals: [
        proposal({ id: 'newest' }),
        proposal({ id: 'middle' }),
        proposal({ id: 'oldest' }),
      ],
      sourceProposalId: 'source',
      untitledLabel,
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual([
      'newest',
      'middle',
      'oldest',
    ]);
  });

  it('prefers the title field, falling back to the profile name', () => {
    const [titled, untitledField] = getMergeCandidates({
      proposals: [
        proposal({
          id: 'a',
          title: 'Community Garden',
          profileName: 'Ignored',
        }),
        proposal({ id: 'b', title: '', profileName: 'Youth Tech Hub' }),
      ],
      sourceProposalId: 'source',
      untitledLabel,
    });

    expect(titled?.title).toBe('Community Garden');
    expect(untitledField?.title).toBe('Youth Tech Hub');
  });

  it('falls back to the untitled label when nothing names the proposal', () => {
    const [candidate] = getMergeCandidates({
      proposals: [proposal({ id: 'a', title: '', profileName: '' })],
      sourceProposalId: 'source',
      untitledLabel,
    });

    expect(candidate?.title).toBe(untitledLabel);
  });

  it('carries the proposal through so the card can render it', () => {
    const [candidate] = getMergeCandidates({
      proposals: [proposal({ id: 'a', title: 'Community Garden Expansion' })],
      sourceProposalId: 'source',
      untitledLabel,
    });

    expect(candidate?.proposal.id).toBe('a');
  });
});
