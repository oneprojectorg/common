import { logger } from '@op/logging';
import { trace } from '@opentelemetry/api';
import { InngestMiddleware } from 'inngest';

const bootedAt = Date.now();
let invocationsServed = 0;

/**
 * Emits one structured log record and one OTel span per function invocation.
 *
 * Inngest re-invokes the app over HTTP for every step, so a run's latency
 * lives between invocations as much as inside them. Each record carries what
 * PostHog needs to place the time: which step executed, how long the new work
 * took (executionMs) versus the whole request (invocationMs), how far the run
 * is from its triggering event (sinceEventMs), and whether this process had
 * served anything before (coldStart, processAgeMs).
 */
export const invocationTiming = new InngestMiddleware({
  name: 'invocation-timing',
  init: () => ({
    onFunctionRun({ ctx, fn, steps }) {
      const arrivedAt = Date.now();
      const coldStart = invocationsServed === 0;
      invocationsServed += 1;

      const span = trace
        .getTracer('@op/events')
        .startSpan(`inngest.invocation ${fn.name}`, {
          startTime: arrivedAt,
          attributes: {
            'inngest.function': fn.name,
            'inngest.run_id': ctx.runId,
            'inngest.memoized_steps': steps.length,
            'inngest.cold_start': coldStart,
          },
        });

      let executionStartedAt: number | null = null;
      let step: string | null = null;
      let failed = false;

      return {
        beforeExecution() {
          executionStartedAt = Date.now();
        },
        transformOutput(output) {
          step = output.step?.displayName ?? null;
          failed = output.result.error !== undefined;
        },
        beforeResponse() {
          const finishedAt = Date.now();
          const eventTs = ctx.event.ts;
          const record = {
            function: fn.name,
            runId: ctx.runId,
            step,
            memoizedSteps: steps.length,
            executionMs:
              executionStartedAt === null
                ? null
                : finishedAt - executionStartedAt,
            invocationMs: finishedAt - arrivedAt,
            sinceEventMs:
              typeof eventTs === 'number' ? finishedAt - eventTs : null,
            coldStart,
            processAgeMs: arrivedAt - bootedAt,
            failed,
          };
          if (step !== null) {
            span.setAttribute('inngest.step', step);
          }
          span.setAttributes({
            'inngest.execution_ms': record.executionMs ?? -1,
            'inngest.since_event_ms': record.sinceEventMs ?? -1,
            'inngest.failed': failed,
          });
          span.end(finishedAt);
          logger.info('inngest.invocation', record);
        },
      };
    },
  }),
});
