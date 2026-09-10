import type { ThemeAnalysisTheme } from '../schemas/themeAnalysis';
import { themesPassReplySchema } from '../schemas/themeAnalysis';
import { askForJson } from './askForJson';
import type { CorpusProposal } from './corpusGrounding';
import {
  assertCorpusHasProposals,
  renderCorpusForPrompt,
  resolveCorpusIndexes,
} from './corpusGrounding';

const INSTRUCTIONS = `You read the proposals submitted to a participatory decision process and report the themes running through them.

A theme is something several proposals are about, named the way a participant would recognise it. "Safer routes to school" is a theme. "Community" is a category, and categories tell a facilitator nothing they did not already know.

Report at most eight themes, fewest first in importance order — a theme two proposals share is worth reporting when the process only has twelve proposals, and is not when it has ninety. Every theme lists the proposals that carry it, by their index. Do not report a theme no proposal carries.

Answer with an object holding one key, "themes", whose value is an array of objects with:
- "title": the theme, at most a short phrase
- "summary": one or two sentences on what the proposals in it are saying
- "proposalIndexes": the indexes of the proposals that carry it`;

/**
 * The themes running through a corpus of proposals — the first of the two
 * passes.
 *
 * This is the pass that answers "what is this process about", and it runs first
 * because the common-ground pass reads better with the vocabulary in hand: it
 * can say a proposal sits outside the common ground *on a named theme* rather
 * than in general.
 *
 * Every index the model returns is resolved against the corpus and dropped if it
 * is not there, so a theme cannot reach a facilitator carrying a proposal nobody
 * wrote. A theme whose proposals all fail that check is kept, with an empty
 * list: the model found something in the text, and silently deleting the finding
 * would hide the fact that its grounding did not survive.
 *
 * @param corpus - The numbered proposals to read.
 * @returns The themes, with corpus indexes resolved to proposals.
 * @throws ThemeAnalysisFailure when the model's reply is unusable. See
 *   {@link askForJson}.
 */
export const analyzeThemes = async (
  corpus: CorpusProposal[],
): Promise<ThemeAnalysisTheme[]> => {
  assertCorpusHasProposals(corpus, 'proposal-themes');

  const reply = await askForJson({
    name: 'proposal-themes',
    instructions: INSTRUCTIONS,
    prompt: `Report the themes running through these ${corpus.length} proposals.\n\n${renderCorpusForPrompt(corpus)}`,
    schema: themesPassReplySchema,
  });

  return reply.themes.map(({ title, summary, proposalIndexes }) => ({
    title,
    summary,
    proposals: resolveCorpusIndexes(proposalIndexes, corpus),
  }));
};
