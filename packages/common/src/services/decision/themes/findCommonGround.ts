import type {
  ThemeAnalysisCommonGround,
  ThemeAnalysisOutlier,
  ThemeAnalysisSuggestion,
  ThemeAnalysisTheme,
} from '../schemas/themeAnalysis';
import { commonGroundPassReplySchema } from '../schemas/themeAnalysis';
import { askForJson } from './askForJson';
import type { CorpusProposal } from './corpusGrounding';
import { renderCorpusForPrompt, resolveCorpusIndexes } from './corpusGrounding';

const INSTRUCTIONS = `You help a facilitator find where a set of proposals already agrees, who is standing outside that agreement, and what small move would bring them closer.

Three things, in this order.

Common ground: statements most of these proposals could accept, drawn from what they actually say rather than from what would be agreeable. Say it as a sentence a participant would recognise as their own position, and list the proposals that support it. Do not manufacture agreement. If the field is genuinely split, report the little that is shared and leave it there.

Outliers: proposals sitting outside the common ground. Sort each one:
- "high-impact": it proposes something substantial that nothing else proposes. Losing it loses the idea. This is the outlier a facilitator needs to see.
- "low-impact": it differs in a narrow or minor way — a detail, a small scope, a variation on something already covered.
An outlier is not a bad proposal, and being unusual is not a criticism. Give the reason it sits apart.

Suggestions: concrete next moves, at most six.
- "merge": two or more proposals close enough to become one. Say what the merged proposal would be.
- "modify": one proposal and a small, specific change that would bring it inside the common ground without giving up what makes it worth keeping. Small means small. Do not suggest rewriting a proposal into a different proposal.
Suggest nothing you cannot ground in the text. No suggestions is a valid answer.

Answer with an object holding:
- "commonGround": array of { "statement", "proposalIndexes" }
- "outliers": array of { "proposalIndex", "impact", "reason" }, impact being "high-impact" or "low-impact"
- "suggestions": array of { "kind", "rationale", "proposalIndexes" }, kind being "merge" or "modify"`;

/**
 * Renders the themes pass's output as context for this pass.
 *
 * Only titles and summaries. The proposal lists are omitted because this pass is
 * given the corpus itself and does its own grounding; passing the first pass's
 * index lists too would invite it to copy them through rather than re-read.
 */
const renderThemes = (themes: ThemeAnalysisTheme[]): string =>
  themes.map(({ title, summary }) => `- ${title}: ${summary}`).join('\n');

export interface CommonGroundAnalysis {
  commonGround: ThemeAnalysisCommonGround[];
  outliers: ThemeAnalysisOutlier[];
  suggestions: ThemeAnalysisSuggestion[];
}

/**
 * Where a corpus of proposals agrees, who sits outside that agreement, and what
 * to do about it — the second of the two passes.
 *
 * This is the pass the task calls the Habermas machine, after the DeepMind
 * system that drafts a statement a group could collectively endorse. The shape
 * is the same: read every position, find what they could live with together, and
 * be explicit about who is not inside it rather than averaging them away. The
 * outlier split is what keeps it honest — a synthesis that reports only
 * agreement has quietly discarded the one proposal worth arguing about.
 *
 * Runs after {@link analyzeThemes} and is given its output, so it can reason
 * about the field in the vocabulary the corpus itself supplied.
 *
 * Every index is resolved against the corpus, so nothing here can name a
 * proposal the model invented. An outlier whose index does not resolve is
 * dropped outright, unlike a theme with no surviving proposals: an outlier *is*
 * a claim about one proposal, so with no proposal there is no claim left. A
 * suggestion needs at least one proposal for the same reason — "merge these"
 * with nothing to merge is not advice.
 *
 * @param themes - What the first pass found.
 * @param corpus - The numbered proposals, the same set the first pass read.
 * @returns Common ground, outliers, and suggestions, all grounded in the corpus.
 * @throws ThemeAnalysisFailure when the model's reply is unusable. See
 *   {@link askForJson}.
 */
export const findCommonGround = async ({
  themes,
  corpus,
}: {
  themes: ThemeAnalysisTheme[];
  corpus: CorpusProposal[];
}): Promise<CommonGroundAnalysis> => {
  const themeContext = themes.length
    ? `A first pass over these proposals reported these themes:\n\n${renderThemes(themes)}\n\n`
    : '';

  const reply = await askForJson({
    name: 'proposal-common-ground',
    instructions: INSTRUCTIONS,
    prompt: `${themeContext}Find the common ground across these ${corpus.length} proposals, the outliers, and what to suggest.\n\n${renderCorpusForPrompt(corpus)}`,
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
