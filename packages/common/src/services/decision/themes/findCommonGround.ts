import type {
  ThemeAnalysisCommonGround,
  ThemeAnalysisOutlier,
  ThemeAnalysisSuggestion,
} from '../schemas/themeAnalysis';
import { commonGroundPassReplySchema } from '../schemas/themeAnalysis';
import { askForJson } from './askForJson';
import type { CorpusProposal } from './corpusGrounding';
import {
  assertCorpusHasProposals,
  renderCorpusForPrompt,
  resolveCorpusIndexes,
} from './corpusGrounding';

const INSTRUCTIONS = `You help a facilitator find where a set of proposals already agrees, who is standing outside that agreement, and what small move would bring them closer.

Three things, in this order. Be brief in each: a facilitator reads this, and every list below is capped because a long answer is a slower one, not a better one.

Common ground: at most six statements most of these proposals could accept, drawn from what they actually say rather than from what would be agreeable. One sentence each, phrased so a participant would recognise it as their own position, and list the proposals that support it. Do not manufacture agreement. If the field is genuinely split, report the little that is shared and leave it there.

Outliers: at most six proposals sitting outside the common ground — the ones that most repay a facilitator's attention, not every proposal that differs. Sort each one:
- "high-impact": it proposes something substantial that nothing else proposes. Losing it loses the idea. This is the outlier a facilitator needs to see.
- "low-impact": it differs in a narrow or minor way — a detail, a small scope, a variation on something already covered.
An outlier is not a bad proposal, and being unusual is not a criticism. Give the reason it sits apart, in one sentence.

Suggestions: concrete next moves, at most six.
- "merge": two or more proposals close enough to become one. Say what the merged proposal would be.
- "modify": one proposal and a small, specific change that would bring it inside the common ground without giving up what makes it worth keeping. Small means small. Do not suggest rewriting a proposal into a different proposal.
One or two sentences of rationale each. Suggest nothing you cannot ground in the text. No suggestions is a valid answer.

Answer with an object holding:
- "commonGround": array of { "statement", "proposalIndexes" }
- "outliers": array of { "proposalIndex", "impact", "reason" }, impact being "high-impact" or "low-impact"
- "suggestions": array of { "kind", "rationale", "proposalIndexes" }, kind being "merge" or "modify"`;

export interface CommonGroundAnalysis {
  commonGround: ThemeAnalysisCommonGround[];
  outliers: ThemeAnalysisOutlier[];
  suggestions: ThemeAnalysisSuggestion[];
}

/**
 * Where a corpus of proposals agrees, who sits outside that agreement, and what
 * to do about it — one of the two passes, run beside the other.
 *
 * This is the pass the task calls the Habermas machine, after the DeepMind
 * system that drafts a statement a group could collectively endorse. The shape
 * is the same: read every position, find what they could live with together, and
 * be explicit about who is not inside it rather than averaging them away. The
 * outlier split is what keeps it honest — a synthesis that reports only
 * agreement has quietly discarded the one proposal worth arguing about.
 *
 * Runs beside {@link analyzeThemes} rather than after it, over the same corpus
 * and nothing else. It used to be handed the first pass's themes as context,
 * which made the two passes sequential and put a whole model call between the
 * facilitator and the answer for the sake of a preamble the pass does not need:
 * it is given the corpus itself and does its own reading, and what it is asked
 * for — agreement, outliers, moves — is not phrased in themes. Independent, the
 * two run concurrently and the wait is the longer of them rather than the sum.
 *
 * Every index is resolved against the corpus, so nothing here can name a
 * proposal the model invented. An outlier whose index does not resolve is
 * dropped outright, unlike a theme with no surviving proposals: an outlier *is*
 * a claim about one proposal, so with no proposal there is no claim left. A
 * suggestion needs at least one proposal for the same reason — "merge these"
 * with nothing to merge is not advice.
 *
 * @param corpus - The numbered proposals, the same set the themes pass reads.
 * @returns Common ground, outliers, and suggestions, all grounded in the corpus.
 * @throws ThemeAnalysisFailure when the model's reply is unusable. See
 *   {@link askForJson}.
 */
export const findCommonGround = async ({
  corpus,
}: {
  corpus: CorpusProposal[];
}): Promise<CommonGroundAnalysis> => {
  assertCorpusHasProposals(corpus, 'proposal-common-ground');

  const reply = await askForJson({
    name: 'proposal-common-ground',
    instructions: INSTRUCTIONS,
    prompt: `Find the common ground across these ${corpus.length} proposals, the outliers, and what to suggest.\n\n${renderCorpusForPrompt(corpus)}`,
    schema: commonGroundPassReplySchema,
  });

  return {
    commonGround: reply.commonGround.map(({ statement, proposalIndexes }) => ({
      statement,
      proposals: resolveCorpusIndexes(proposalIndexes, corpus),
    })),
    outliers: reply.outliers.flatMap(({ proposalIndex, impact, reason }) => {
      const [proposal] = resolveCorpusIndexes([proposalIndex], corpus);

      if (!proposal) {
        return [];
      }

      return [{ proposal, impact, reason }];
    }),
    suggestions: reply.suggestions.flatMap(
      ({ kind, rationale, proposalIndexes }) => {
        const proposals = resolveCorpusIndexes(proposalIndexes, corpus);

        if (proposals.length === 0) {
          return [];
        }

        return [{ kind, rationale, proposals }];
      },
    ),
  };
};
