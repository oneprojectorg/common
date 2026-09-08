import { listAllProposals } from '../listAllProposals';
import { listProposals } from '../listProposals';
import type { ThemeAnalysisScope } from '../schemas/themeAnalysis';
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
 * One call, not a paging loop. Everything past the ceiling never reaches the
 * model, so reading it would buy nothing but latency and memory — which is the
 * opposite of the export's situation, where every row had to end up in the file.
 * What the export's paging really bought was an honest completeness signal, and
 * `total` supplies that here in one query.
 *
 * `scope` picks which reader answers. `phase` reads the instance's current phase
 * — what the proposals list shows. `process` reads every proposal the instance
 * holds, including ones dropped in an earlier phase, which is what the results
 * screen shows. They diverge as soon as an instance advances, so the surface
 * that launches an analysis has to say which one it means.
 *
 * `previewText` is the proposal body as plain text, already assembled
 * server-side from the document fragments and capped at 2000 characters. Asking
 * for `includeDocumentContent` and walking the fragments again would return the
 * same prose at several times the payload.
 *
 * The filters this omits define what an analysis covers, the same way the
 * export's omissions define what a file covers. No search, category, or status
 * narrowing, so two facilitators analysing one instance are looking at the same
 * corpus.
 *
 * The two readers settle access differently, and both are right for what they
 * do. The phase read passes `skipAccessCheck`, taking every phase-scoped
 * non-draft proposal regardless of the visibility and moderation filters a
 * signed-in caller would get — the caller settled authorization before reaching
 * here. `listAllProposals` has no such bypass and asserts instance access
 * itself, which re-checks the requester at run time: an admin who lost the role
 * between pressing the button and the job starting gets a failed run rather than
 * a corpus.
 *
 * Proposals whose body is empty are dropped rather than sent as a bare title. A
 * title alone gives the model nothing to find a theme in, and it would still
 * occupy one of the ceiling's slots.
 *
 * @param processInstanceId - The instance to read.
 * @param userId - Auth-user id of the facilitator who asked. Identity only:
 *   every path this reaches (`getCurrentProfileId`, `assertUserByAuthId`,
 *   `resolveAccessUserIds`) reads it as an auth user id, not a database key.
 * @param scope - Which proposals to read. See {@link ThemeAnalysisScope}.
 * @returns The numbered corpus and the scope's total. The caller reports both,
 *   so a synthesis that covered a quarter of the field cannot read as a claim
 *   about all of it.
 */
export const collectProposalCorpus = async ({
  processInstanceId,
  userId,
  scope,
}: {
  processInstanceId: string;
  userId: string;
  scope: ThemeAnalysisScope;
}): Promise<ProposalCorpus> => {
  const { proposals, total } = await readProposalsInScope({
    processInstanceId,
    userId,
    scope,
    limit: THEME_ANALYSIS_MAX_PROPOSALS,
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

/**
 * The proposals in a scope, in the one shape both readers share.
 *
 * `listProposals` returns `{ proposals, total }` and `listAllProposals` returns
 * `{ items, total }`; the rows themselves already agree — both carry
 * `proposalData` merged with the fragment-resolved system fields, and both carry
 * `previewText`. This normalises the wrapper so the corpus shaping above does
 * not branch.
 *
 * `limit` is a parameter so the request's cheap "is there anything to analyse"
 * count can reuse this rather than keeping its own copy of the scope branch.
 * Note that {@link THEME_ANALYSIS_MAX_PROPOSALS} equals `PAGE_LIMIT.max`, which
 * is what the all-proposals input schema accepts — raising the ceiling means
 * checking that bound too.
 */
export const readProposalsInScope = async ({
  processInstanceId,
  userId,
  scope,
  limit,
}: {
  processInstanceId: string;
  userId: string;
  scope: ThemeAnalysisScope;
  limit: number;
}): Promise<{ proposals: ProposalRow[]; total: number }> => {
  if (scope === 'process') {
    const { items, total } = await listAllProposals({
      input: { processInstanceId, limit },
      user: { id: userId },
    });

    return { proposals: items, total };
  }

  const { proposals, total } = await listProposals({
    input: { processInstanceId, limit, skipAccessCheck: true },
    user: { id: userId },
  });

  return { proposals, total };
};

/** The fields the corpus reads off a row, whichever reader produced it. */
interface ProposalRow {
  id: string;
  proposalData: { title?: string | null };
  previewText?: string;
}
