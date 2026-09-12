import {
  type CorpusProposal,
  type PassFailure,
  type ThemeAnalysisResult,
  type ThemeAnalysisScope,
  readCachedThemeAnalysisResult,
  readCorpusForAnalysis,
  readLatestThemeAnalysis,
  runCommonGroundPass,
  runThemesPass,
  storeCachedThemeAnalysisResult,
  storeLatestThemeAnalysis,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { realtime } from '@op/realtime/server';
import { z } from 'zod';

const { proposalCorpusChanged, phaseTransitioned } = Events;

/**
 * Both triggers carry the instance id and nothing else this needs. Parsed to
 * the one field rather than to either event's full schema, so a change to the
 * phase-transition payload cannot break a function that never reads it.
 */
const triggerSchema = z.object({ processInstanceId: z.string().uuid() });

/**
 * Both scopes, in a fixed order. The phase scope first because it is what the
 * proposals list shows and so the one most likely to be opened; the process
 * scope reads a superset and, early in an instance's life, the same set — in
 * which case the result cache answers it without a model call.
 */
const SCOPES: readonly ThemeAnalysisScope[] = ['phase', 'process'];

/**
 * Keeps the stored theme analysis of an instance current with its proposals.
 *
 * Runs after the proposals of an instance change — a submission, an edit to a
 * submitted proposal, a merge or unmerge, a rejection or its reversal, a
 * deletion, a phase transition — and re-analyses each scope whose corpus is
 * no longer the one its snapshot describes. The snapshot is what the "View
 * themes" button opens, so by the time an admin looks the model has already
 * been asked.
 *
 * Debounced per instance. A busy submission window produces one event per
 * proposal, and analysing after each would be one model run per proposal for
 * results nobody would open in between. Inngest holds the run until thirty
 * minutes pass with no further event for the instance, then runs once over
 * whatever the corpus is by then; the `timeout` is the longest a stream of
 * changes can postpone it, so an instance that never goes quiet still gets a
 * refresh every two hours. The concurrency key serialises runs per instance on
 * top of that, so a refresh that started before the next batch arrived does not
 * race the one that follows it.
 *
 * Cheap when nothing has moved. Each scope first compares the corpus digest to
 * the stored snapshot's, and a match means the event was about a proposal the
 * model never reads — a draft edit, a change in a phase the scope does not
 * cover — and the scope is skipped without a model call. A changed corpus then
 * checks the result cache, which is shared with the manual run and keyed by
 * the digest alone, so a corpus already analysed under the other scope or by a
 * facilitator's button press is also free.
 *
 * Reads as the system rather than as a user: there is no requester behind a
 * timer. See `CorpusReader` for what that bypasses and why it is safe.
 *
 * Failures are logged and skipped per scope, never thrown. There is no
 * facilitator waiting, no record to move to `failed`, and the next change to
 * the instance schedules another attempt; a throw would only retry the model
 * call at once against a provider that just declined it.
 */
export const refreshProposalThemesOnCorpusChange = inngest.createFunction(
  {
    id: 'refreshProposalThemesOnCorpusChange',
    debounce: {
      key: 'event.data.processInstanceId',
      period: '30m',
      timeout: '2h',
    },
    concurrency: { key: 'event.data.processInstanceId', limit: 1 },
    // See `analyzeProposalThemes` for why one rather than four. Here even one
    // is generous: nobody is waiting, and every failure below is reported
    // rather than thrown, so a retry only ever covers an infrastructure fault.
    retries: 1,
  },
  [{ event: proposalCorpusChanged.name }, { event: phaseTransitioned.name }],
  async ({ event, step }) => {
    const { processInstanceId } = triggerSchema.parse(event.data);

    const refreshed: ThemeAnalysisScope[] = [];

    /**
     * Both model passes at once, as two parallel steps — the same shape as the
     * manual run's, with one difference in the failure path: a pass that
     * reports a failure is logged and yields null, because there is no record
     * to write it to and nobody to show it to. Closes over `step` for the
     * reason `analyzeProposalThemes` gives.
     */
    const runPasses = async ({
      scope,
      proposals,
    }: {
      scope: ThemeAnalysisScope;
      proposals: CorpusProposal[];
    }): Promise<ThemeAnalysisResult | null> => {
      const [analysed, habermas] = await Promise.all([
        step.run(`analyze-themes-${scope}`, () => runThemesPass({ proposals })),
        step.run(`find-common-ground-${scope}`, () =>
          runCommonGroundPass({ proposals }),
        ),
      ]);

      // The first failure, when both report one. There is no record to carry
      // a code, so this is logged and the scope is left on its last snapshot.
      const reportFailure = (failure: PassFailure) => {
        logger.error('Theme analysis refresh failed', {
          processInstanceId,
          scope,
          errorCode: failure.code,
          errorMessage: failure.message,
        });

        return null;
      };

      if (!analysed.ok) {
        return reportFailure(analysed);
      }

      if (!habermas.ok) {
        return reportFailure(habermas);
      }

      return { themes: analysed.themes, ...habermas.analysis };
    };

    // Sequential, not parallel. The two scopes usually share a corpus, and the
    // second one's result-cache read only finds the first one's answer if the
    // first has finished writing it.
    for (const scope of SCOPES) {
      const corpus = await step.run(`read-corpus-${scope}`, () =>
        readCorpusForAnalysis({
          processInstanceId,
          reader: { system: true },
          scope,
        }),
      );

      if (!corpus.ok) {
        // Too little text to compare. Not an error — a phase with one proposal
        // is the ordinary state of a young instance — and a stale snapshot is
        // left in place rather than cleared: it still describes a corpus that
        // existed, and the dialog says how many proposals it covered.
        logger.info('Theme analysis refresh skipped: nothing to compare', {
          processInstanceId,
          scope,
          message: corpus.message,
        });
        continue;
      }

      const { proposals, total, fingerprint } = corpus;

      const existing = await step.run(`find-existing-result-${scope}`, () =>
        findExistingResult({ processInstanceId, scope, fingerprint }),
      );

      if (existing.upToDate) {
        continue;
      }

      const result = existing.cached
        ? existing.cached
        : await runPasses({ scope, proposals });

      if (!result) {
        continue;
      }

      await step.run(`store-snapshot-${scope}`, async () => {
        const completedAt = new Date().toISOString();

        if (!existing.cached) {
          await storeCachedThemeAnalysisResult(
            { processInstanceId, fingerprint },
            result,
          );
        }

        await storeLatestThemeAnalysis({
          status: 'ready',
          processInstanceId,
          scope,
          result,
          analyzedCount: proposals.length,
          total,
          fingerprint,
          completedAt,
        });

        // Broadcast-only, like the run record's channel: the client re-reads
        // `getLatestThemeAnalysis` on receipt.
        await realtime.publish(
          Channels.proposalThemeAnalysisLatest(processInstanceId, scope),
          { mutationId: crypto.randomUUID() },
        );
      });

      refreshed.push(scope);

      logger.info('Theme analysis refreshed', {
        processInstanceId,
        scope,
        reused: existing.cached !== null,
        analyzedCount: proposals.length,
        total,
      });
    }

    return { processInstanceId, refreshed };
  },
);

/**
 * Whether a scope's snapshot already describes this corpus, and if not,
 * whether the result cache already holds the answer.
 *
 * One step for both reads: they are two Redis commands, and a step is a round
 * trip through Inngest.
 */
const findExistingResult = async ({
  processInstanceId,
  scope,
  fingerprint,
}: {
  processInstanceId: string;
  scope: ThemeAnalysisScope;
  fingerprint: string;
}): Promise<
  { upToDate: true } | { upToDate: false; cached: ThemeAnalysisResult | null }
> => {
  const latest = await readLatestThemeAnalysis({ processInstanceId, scope });

  if (latest.status === 'hit' && latest.snapshot.fingerprint === fingerprint) {
    return { upToDate: true };
  }

  return {
    upToDate: false,
    cached: await readCachedThemeAnalysisResult({
      processInstanceId,
      fingerprint,
    }),
  };
};
