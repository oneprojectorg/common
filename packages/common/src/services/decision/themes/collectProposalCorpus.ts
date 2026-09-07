import { listProposals } from '../listProposals';
import {
  THEME_ANALYSIS_MAX_PROPOSALS,
  THEME_ANALYSIS_PROPOSAL_CHARS,
} from './constants';
import type { CorpusProposal } from './corpusGrounding';

export interface ProposalCorpus {
  proposals: CorpusProposal[];
  /**
   * Proposals the phase held when the read started, independent of how many
   * were taken. `listProposals` runs its count query separately from the data
   * query, so this is the full count rather than a remaining-rows figure.
   */
  total: number;
}

/**
 * Reads the proposals of an instance's current phase and shapes them for the
 * model.
 *
 * One `listProposals` call, not a paging loop. Everything past the ceiling never
 * reaches the model, so reading it would buy nothing but latency and memory —
 * which is the opposite of the export's situation, where every row had to end up
 * in the file. What the export's paging really bought was an honest completeness
 * signal, and `total` supplies that here in one query.
 *
 * `previewText` is the proposal body as plain text, already assembled
 * server-side from the document fragments and capped at 2000 characters. Asking
 * for `includeDocumentContent` and walking the fragments again would return the
 * same prose at several times the payload.
 *
 * The filters this omits define what an analysis covers, the same way the
 * export's omissions define what a file covers. No `phaseId`, so it reads the
 * instance's current phase and an analysis is not the instance's whole history.
 * No search, category, or status narrowing, so two facilitators analysing one
 * instance are looking at the same corpus. `skipAccessCheck` takes every
 * phase-scoped non-draft proposal, ignoring the visibility and moderation
 * filters a signed-in caller would get; the caller settles authorization before
 * reaching here.
 *
 * Proposals whose body is empty are dropped rather than sent as a bare title. A
 * title alone gives the model nothing to find a theme in, and it would still
 * occupy one of the ceiling's slots.
 *
 * @param processInstanceId - The instance whose current phase is read.
 * @param userId - Auth-user id of the facilitator who asked. Identity only:
 *   every path this reaches (`getCurrentProfileId`, `assertUserByAuthId`,
 *   `resolveAccessUserIds`) reads it as an auth user id, not a database key.
 * @returns The numbered corpus and the phase's total. The caller reports both,
 *   so a synthesis that covered a quarter of the field cannot read as a claim
 *   about the whole process.
 */
export const collectProposalCorpus = async ({
  processInstanceId,
  userId,
}: {
  processInstanceId: string;
  userId: string;
}): Promise<ProposalCorpus> => {
  const { proposals, total } = await listProposals({
    input: {
      processInstanceId,
      limit: THEME_ANALYSIS_MAX_PROPOSALS,
      skipAccessCheck: true,
    },
    user: { id: userId },
  });

  const withText = proposals.flatMap((proposal) => {
    const text = proposal.previewText?.trim();

    if (!text) {
      return [];
    }

    return [
      {
        id: proposal.id,
        // `proposalData.title` carries the fragment-resolved title that
        // `listProposals` merged over the snapshot, which is the title the
        // proposals list shows. Untitled proposals exist, and this keeps the
        // empty string rather than substituting copy: the title is stored on the
        // record and rendered to a facilitator who may not read English, so the
        // placeholder belongs at the point of display, in `t()`. The prompt gets
        // its own English stand-in from `renderCorpusForPrompt`.
        title: proposal.proposalData.title?.trim() ?? '',
        text: text.slice(0, THEME_ANALYSIS_PROPOSAL_CHARS),
      },
    ];
  });

  return {
    // Numbered after the empty-body drop, so the indexes are contiguous. A gap
    // in the list invites the model to fill it.
    proposals: withText.map((proposal, position) => ({
      index: position + 1,
      ...proposal,
    })),
    total,
  };
};
