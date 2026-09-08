import { set } from '@op/cache';
import {
  THEME_ANALYSIS_CACHE_TTL_SECONDS,
  type CommonGroundAnalysis,
  type CorpusProposal,
  type PassFailure,
  type ThemeAnalysisData,
  type ThemeAnalysisScope,
  type ThemeAnalysisTheme,
  readCorpusForAnalysis,
  runCommonGroundPass,
  runThemesPass,
  themeAnalysisCacheKey,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { Events, inngest } from '@op/events';
import { realtime } from '@op/realtime/server';

/**
 * Write the analysis record.
 *
 * A whole record every time, not a patch, and nothing is read first. `identity`
 * carries everything the request's seed carried, so `identity` plus the status
 * fields below is already every field the schema names — there is nothing a read
 * could add.
 *
 * Reading anyway was worse than useless. The cache holds the only copy, so a
 * read has to tell "held nothing" apart from "did not answer", which means a
 * read that did not answer has to fail the step — and that put a cache blip
 * between a finished two-model analysis and the record that reports it. It also
 * put one inside the failure handler, where a throw would replace the real cause
 * and skip the broadcast that ends the facilitator's wait.
 *
 * Writing blind is safe here because this workflow and the request are the only
 * writers, and their writes are ordered: the seed, then `processing`, then one
 * terminal write.
 */
const recordAnalysis = async (
  identity: AnalysisIdentity,
  fields: Partial<ThemeAnalysisData>,
) =>
  set(
    themeAnalysisCacheKey(identity),
    { ...identity, ...fields },
    THEME_ANALYSIS_CACHE_TTL_SECONDS,
  );

/**
 * Tell the facilitator waiting on this analysis that its record has moved.
 *
 * Broadcast-only: the record written just before this is the source of truth,
 * and the message carries no payload — subscribers re-read
 * `getThemeAnalysisStatus` on receipt.
 *
 * Sent for the intermediate `processing` write as well as the terminal one.
 * Nothing polls behind this, so a lost broadcast costs correctness rather than
 * latency: lose the terminal one and the client never sees a terminal state, so
 * the wait reports a timeout for an analysis that worked.
 *
 * An analysis that settles before the client's socket join lands is covered the
 * same way every other channel covers it — the client re-reads its query once
 * the join is confirmed, and whatever settled before then is in that read.
 *
 * `realtime.publish` logs and swallows its own failures, so this cannot fail the
 * run or trigger a retry that would rewrite a settled record.
 */
const notifyAnalysisChanged = (analysisId: string) =>
  realtime.publish(Channels.proposalThemeAnalysis(analysisId), {
    // A fresh id per publish. The client drops a broadcast carrying an id it has
    // already handled, so an id shared across this run's two reports would let
    // `processing` suppress the terminal one.
    mutationId: crypto.randomUUID(),
  });

/**
 * The fields that identify a record and never change once it is seeded — and,
 * between them, the cache key it lives under.
 */
type AnalysisIdentity = Pick<
  ThemeAnalysisData,
  'analysisId' | 'processInstanceId' | 'userId'
> & { scope: ThemeAnalysisScope };

/**
 * The diagnostic to record for a fault nobody classified.
 *
 * A caught value carries no guarantee of being an `Error`, and by the time one
 * reaches the handler it has crossed a step boundary and been rebuilt anyway.
 * The message is all that survives, so it is all this takes.
 */
const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

const { proposalThemeAnalysisRequested } = Events;

/**
 * Reads a phase's proposals and reports the themes running through them, the
 * common ground between them, the proposals sitting outside it, and what to
 * suggest.
 *
 * Three steps: read the corpus, then the themes pass, then the common-ground
 * pass. Inngest invokes the handler once per step, so each gets its own budget
 * and its own line in the run — which is what makes "the analysis was slow"
 * answerable as "the read was slow" or "the model was slow" without reading a
 * log. It also buys retry granularity: a common-ground pass that fails does not
 * pay for the themes pass again.
 *
 * The corpus is read once and carried through function state to both passes.
 * Re-reading it per step would be cheaper to serialize and wrong to do: the
 * indexes the themes pass grounds against are positions in that list, so a
 * re-read returning a different set would silently renumber them.
 */
export const analyzeProposalThemes = inngest.createFunction(
  {
    id: 'analyzeProposalThemes',
    // One retry, against Inngest's default of four. Most of the ways this fails
    // are deterministic — a corpus with nothing in it to compare, a reply that
    // does not match its schema — and repeating those buys nothing while each
    // attempt pays for a corpus read and up to two model calls. It also has to
    // finish losing inside the client's wait, or the facilitator is told the
    // analysis timed out instead of being told why it failed. One retry still
    // absorbs a momentary provider blip.
    retries: 1,
  },
  { event: proposalThemeAnalysisRequested.name },
  async ({ event, step }) => {
    const { analysisId, processInstanceId, userId, scope } =
      proposalThemeAnalysisRequested.schema.parse(event.data);

    // Everything the seed carried, taken from the event rather than re-read, so
    // every write below is a complete record on its own — and it is also the
    // cache key, which the id alone does not name.
    const identity = { analysisId, processInstanceId, userId, scope };

    await step.run('update-status-processing', () =>
      recordAnalysis(identity, {
        status: 'processing',
        createdAt: new Date().toISOString(),
      }),
    );

    // Closes over `step` rather than taking it: Inngest's `step` type is
    // generated from the whole event schema, and naming it here would be a large
    // structural type to keep in step with it for no gain.
    const reportFailure = async (failure: PassFailure) => {
      await step.run('update-status-failed', () =>
        recordAnalysis(identity, {
          status: 'failed',
          // The code is what the facilitator sees, mapped to copy in their own
          // locale. The message is English and diagnostic, for the log and for
          // whoever reads the record.
          errorCode: failure.code,
          errorMessage: failure.message,
          completedAt: new Date().toISOString(),
        }),
      );

      await step.run('notify-analysis-failed', () =>
        notifyAnalysisChanged(analysisId),
      );

      return { analysisId, status: 'failed' as const };
    };

    /**
     * The three steps, in order, stopping at the first that reports a failure.
     *
     * Its own closure so each guard reads as one line of a sequence rather than
     * another branch in the handler, and so the handler below is left saying the
     * only thing it decides: record what came back, or report why nothing did.
     */
    const runAnalysisSteps = async () => {
      await step.run('notify-analysis-processing', () =>
        notifyAnalysisChanged(analysisId),
      );

      // Three steps, not two. The corpus read is not the model call, and giving
      // it its own step means Inngest names whichever one is slow — and neither
      // has to finish inside the other's share of one invocation's budget.
      const corpus = await step.run('read-corpus', () =>
        readCorpusForAnalysis({ processInstanceId, userId, scope }),
      );

      // A reported failure, not a thrown one: this is the corpus telling us
      // there is nothing here to compare, and no number of retries changes that.
      if (!corpus.ok) {
        return corpus;
      }

      const { proposals, total } = corpus;

      const analysed = await step.run('analyze-themes', () =>
        runThemesPass({ proposals }),
      );

      if (!analysed.ok) {
        return analysed;
      }

      const { themes } = analysed;

      const habermas = await step.run('find-common-ground', () =>
        runCommonGroundPass({ themes, proposals }),
      );

      if (!habermas.ok) {
        return habermas;
      }

      return {
        ok: true as const,
        themes,
        habermas: habermas.analysis,
        proposals,
        total,
      };
    };

    // Assigned inside the try, written outside it. See the comment on the
    // completed write below for why the two are separated.
    let completed: {
      themes: ThemeAnalysisTheme[];
      habermas: CommonGroundAnalysis;
      proposals: CorpusProposal[];
      total: number;
    };

    try {
      const outcome = await runAnalysisSteps();

      if (!outcome.ok) {
        return await reportFailure(outcome);
      }

      completed = outcome;
    } catch (error) {
      // Only genuine faults reach here — the two passes report their own
      // failures above. `error` has crossed a step boundary, so it is a
      // `StepError` rebuilt from `name`/`message`/`stack`: the class is gone and
      // nothing but the message survives. That is why the passes classify
      // themselves rather than throwing something this could inspect.
      await step.run('update-status-failed', async () => {
        await recordAnalysis(identity, {
          status: 'failed',
          errorCode: 'unknown',
          errorMessage: messageOf(error),
          completedAt: new Date().toISOString(),
        });
      });

      await step.run('notify-analysis-failed', () =>
        notifyAnalysisChanged(analysisId),
      );

      throw error;
    }

    // Outside the try, both of them. A step that fails after the analysis is
    // finished must not reach the failure handler, because that handler writes a
    // whole record with no `result` — it would overwrite a completed two-model
    // analysis with "failed" over a broadcast that did not send.
    await step.run('update-status-completed', () =>
      recordAnalysis(identity, {
        status: 'completed',
        result: { themes: completed.themes, ...completed.habermas },
        // Written in the same update as the result, so a reader that sees a
        // completed analysis can always say how much of the phase it covers.
        analyzedCount: completed.proposals.length,
        total: completed.total,
        completedAt: new Date().toISOString(),
      }),
    );

    await step.run('notify-analysis-finished', () =>
      notifyAnalysisChanged(analysisId),
    );

    return { analysisId, status: 'completed' as const };
  },
);
