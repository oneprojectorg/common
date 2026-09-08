import {
  type CommonGroundAnalysis,
  type CorpusProposal,
  type PassFailure,
  type ThemeAnalysisTheme,
  runCommonGroundPass,
  runThemesPass,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { db, eq } from '@op/db/client';
import { proposalThemeAnalyses } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { realtime } from '@op/realtime/server';

/**
 * Record what the run has reached.
 *
 * An `UPDATE` on the row `requestThemeAnalysis` inserted, so the analysis
 * outlives a process restart and exists in a deployment with no Redis. The
 * previous version wrote to `@op/cache`, whose `set` is a silent no-op when
 * `REDIS_URL` is unset — the job ran, the passes cost what they cost, and the
 * caller waited on a record nothing had written.
 *
 * Scoped by `id` alone: the id came from the event, which came from the insert,
 * so there is exactly one row and no second writer to race.
 */
const recordAnalysis = async (
  analysisId: string,
  fields: Partial<typeof proposalThemeAnalyses.$inferInsert>,
) =>
  db
    .update(proposalThemeAnalyses)
    .set(fields)
    .where(eq(proposalThemeAnalyses.id, analysisId));

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

const { proposalThemeAnalysisRequested } = Events;

/**
 * Reads a phase's proposals and reports the themes running through them, the
 * common ground between them, the proposals sitting outside it, and what to
 * suggest.
 *
 * Two model passes, in two steps. The themes pass runs first and the
 * common-ground pass reads its output, so splitting them buys real retry
 * granularity: a common-ground pass that fails does not pay for the themes pass
 * again.
 *
 * The corpus is read once, in the first step, and carried to the second through
 * function state. Re-reading it there looked cheaper than serializing it, and is
 * not: the corpus keeps three fields per proposal, but assembling it runs
 * `listProposals`, which resolves the phase scope, joins authors and profiles,
 * aggregates reactions and selections, fetches up to a hundred collaboration
 * documents, and renders each to plain text. Carrying it instead costs one
 * serialization of roughly 130 KB — which is also, near enough, what each pass
 * already sends to the model.
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
    const { analysisId, processInstanceId, userId } =
      proposalThemeAnalysisRequested.schema.parse(event.data);

    await step.run('update-status-processing', () =>
      recordAnalysis(analysisId, { status: 'processing' }),
    );

    // Closes over `step` rather than taking it: Inngest's `step` type is
    // generated from the whole event schema, and naming it here would be a large
    // structural type to keep in step with it for no gain.
    const reportFailure = async (failure: PassFailure) => {
      await step.run('update-status-failed', () =>
        recordAnalysis(analysisId, {
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

    // Assigned inside the try, written outside it. See the comment on the
    // completed write below for why the two are separated.
    let completed: {
      themes: ThemeAnalysisTheme[];
      habermas: CommonGroundAnalysis;
      proposals: CorpusProposal[];
      total: number;
    };

    try {
      await step.run('notify-analysis-processing', () =>
        notifyAnalysisChanged(analysisId),
      );

      const analysed = await step.run('analyze-themes', () =>
        runThemesPass({ processInstanceId, userId }),
      );

      // A reported failure, not a thrown one: this is the corpus telling us
      // there is nothing here to compare, and no number of retries changes that.
      if (!analysed.ok) {
        return await reportFailure(analysed);
      }

      const { themes, proposals, total } = analysed;

      const habermas = await step.run('find-common-ground', () =>
        runCommonGroundPass({ themes, proposals }),
      );

      if (!habermas.ok) {
        return await reportFailure(habermas);
      }

      completed = { themes, habermas: habermas.analysis, proposals, total };
    } catch (error) {
      // Only genuine faults reach here — the two passes report their own
      // failures above. `error` has crossed a step boundary, so it is a
      // `StepError` rebuilt from `name`/`message`/`stack`: the class is gone and
      // nothing but the message survives. That is why the passes classify
      // themselves rather than throwing something this could inspect.
      await step.run('update-status-failed', async () => {
        await recordAnalysis(analysisId, {
          status: 'failed',
          errorCode: 'unknown',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
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
      recordAnalysis(analysisId, {
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
