import { logger } from '@op/logging';

import type { ThemeAnalysisClaim } from '../schemas/themeAnalysis';
import { claimsPassReplySchema } from '../schemas/themeAnalysis';
import { askForJson } from './askForJson';
import type { CorpusProposal } from './corpusGrounding';
import {
  assertCorpusHasProposals,
  renderCorpusForPrompt,
  resolveCorpusIndexes,
} from './corpusGrounding';

const INSTRUCTIONS = `You read the proposals submitted to a participatory decision process and break each one into the separate claims it makes.

A claim is one thing a proposal asserts, written as a sentence that stands on its own. "The bus routes on the east side should run later in the evening" is a claim. "Transit" is a topic, and "this proposal is about transit" is a description rather than a claim.

Split a proposal wherever it argues more than one thing. A proposal asking for later buses and a new footbridge makes two claims, and they belong in different places — that is the whole reason for reading claims rather than proposals. Do not split a single argument into fragments to inflate the count: one point supported by three reasons is one claim.

Write each claim in the proposal's own terms, not more strongly than it put them. A proposal that says a crossing "feels unsafe at night" has not claimed anyone was hurt there.

Every claim must quote the proposal. Copy the sentence or clause the claim comes from exactly as it appears — same words, same spelling, no tidying and no ellipses. The quote is how a facilitator checks the claim against the text, so a quote that is not in the proposal is worse than no claim at all.

Aim for one to five claims per proposal. A proposal with nothing assertable in it contributes none, and that is a valid answer for it.

Answer with an object holding one key, "claims", whose value is an array of objects with:
- "proposalIndex": the index of the proposal the claim comes from
- "claim": the claim as a standalone sentence
- "quote": the exact words from that proposal the claim rests on`;

/**
 * The claims each proposal makes — the first of the three passes.
 *
 * Runs before the themes pass and changes what the themes pass is grouping. A
 * proposal is a document, and grouping documents forces every proposal into the
 * one theme it is mostly about; a proposal that argues two things is then filed
 * under one of them and the other disappears. Grouping claims gives each
 * argument its own place, lets a proposal appear under several themes for the
 * several things it says, and makes "this proposal is really two proposals"
 * something the analysis can see rather than something a reader has to notice.
 *
 * Every claim is checked twice. Its `proposalIndex` is resolved against the
 * corpus, so a claim cannot be attributed to a proposal nobody wrote; and its
 * quote is looked for in that proposal's text, so the evidence cannot be the
 * model's own words. See {@link verifyQuote} for what happens when it is.
 *
 * @param corpus - The numbered proposals to read.
 * @returns The claims, each resolved to the proposal it came from, numbered by
 *   their position in the returned array — which is the numbering the later
 *   passes are shown.
 * @throws ThemeAnalysisFailure when the model's reply is unusable, or the corpus
 *   is empty. See {@link askForJson}.
 */
export const extractClaims = async (
  corpus: CorpusProposal[],
): Promise<ThemeAnalysisClaim[]> => {
  assertCorpusHasProposals(corpus, 'proposal-claims');

  const reply = await askForJson({
    name: 'proposal-claims',
    instructions: INSTRUCTIONS,
    prompt: `Break each of these ${corpus.length} proposals into the claims it makes.\n\n${renderCorpusForPrompt(corpus)}`,
    schema: claimsPassReplySchema,
  });

  const claims = reply.claims.flatMap(({ proposalIndex, claim, quote }) => {
    const [proposal] = resolveCorpusIndexes([proposalIndex], corpus);

    // A claim is a claim about one proposal. With no proposal there is nothing
    // left for it to be a claim about, so it goes — the same reading that drops
    // an outlier naming a proposal the corpus does not hold.
    if (!proposal) {
      return [];
    }

    return [
      {
        claim,
        quote: verifyQuote({ quote, proposalIndex, corpus }),
        proposal,
      },
    ];
  });

  logger.info('Theme analysis claims extracted', {
    proposals: corpus.length,
    claims: claims.length,
    // The number worth watching. Quotes that do not check out mean the pass is
    // paraphrasing where it was asked to copy, and every grouping built on those
    // claims inherits it.
    unverifiedQuotes: claims.filter(({ quote }) => quote === '').length,
  });

  return claims;
};

/**
 * Returns the quote if the proposal really contains it, and `''` if it does not.
 *
 * The quote is the only part of a claim a facilitator can check without
 * re-reading the proposal, which is exactly why it cannot be taken on trust. A
 * model asked to copy will sometimes tidy — fix a typo, close a bracket,
 * normalise a dash — and will occasionally produce a sentence the proposal never
 * contained at all. The first is harmless and the second is a fabricated source,
 * and from the outside they look the same.
 *
 * So the comparison is loose about the things tidying changes and strict about
 * the words: case and whitespace are normalised, and everything else has to
 * match. That accepts a re-spaced quote and rejects a reworded one.
 *
 * Emptied rather than dropped. The claim survives without its quote, because the
 * model did read the proposal and the claim may well be sound — but it is shown
 * as a claim with no evidence, which is what it is.
 *
 * @param quote - What the model said it copied.
 * @param proposalIndex - The proposal it attributed the quote to.
 * @param corpus - The proposals, to look the text up in.
 * @returns The quote, or `''` when it is not in that proposal.
 */
const verifyQuote = ({
  quote,
  proposalIndex,
  corpus,
}: {
  quote: string;
  proposalIndex: number;
  corpus: CorpusProposal[];
}): string => {
  const source = corpus[proposalIndex - 1];

  if (!source) {
    return '';
  }

  return normalizeForQuoteMatch(source.text).includes(
    normalizeForQuoteMatch(quote),
  )
    ? quote
    : '';
};

/**
 * Flattens the differences a faithful copy is allowed to have from its source.
 *
 * Case and run-length of whitespace only. Not punctuation: "we should fund it"
 * and "we should fund it?" are different claims about what a proposal said, and
 * a check that ignored the difference would be no check at all.
 */
const normalizeForQuoteMatch = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();
