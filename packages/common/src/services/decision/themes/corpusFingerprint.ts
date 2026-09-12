import { createHash } from 'crypto';

import type { CorpusProposal } from './corpusGrounding';

/**
 * A stable digest of what a corpus says, for reusing a finished analysis.
 *
 * Two model passes over a hundred proposals are the whole cost of this feature,
 * and a facilitator presses the button far more often than the corpus changes:
 * to reopen a dialog they closed, to show a colleague, after a refresh. Every one
 * of those presses was a full re-run over identical text, producing a result
 * that differed from the last one only in the model's phrasing.
 *
 * Hashed over exactly what the model is shown — each proposal's id, title and
 * the slice of body text the prompt embeds — so an edit that reaches the prompt
 * changes the digest and an edit that does not (a like, a comment, a change past
 * the per-proposal character budget) leaves it alone. Order-independent, because
 * the readers do not promise an order and a reshuffled corpus is the same
 * corpus: the stored result carries resolved ids rather than positions, so it
 * reads correctly whichever order the proposals came back in.
 *
 * SHA-256 rather than something cheaper because the digest is a cache key: a
 * collision would hand one instance's analysis to another corpus in the same
 * scope, and the hash cost is nothing beside the read that produced the corpus.
 *
 * @param corpus - The numbered proposals a pass would be handed.
 * @returns A hex digest. Equal for two corpora the model would see identically.
 */
export const fingerprintCorpus = (corpus: CorpusProposal[]): string => {
  const entries = corpus
    .map(({ id, title, text }) => [id, title, text] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
};
