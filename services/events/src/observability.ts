import { logger } from '@op/logging';
import { trace } from '@opentelemetry/api';
import { InngestMiddleware } from 'inngest';

const bootedAtMark = performance.now();
let invocationsServed = 0;

export const invocationTiming = new InngestMiddleware({
  name: 'invocation-timing',
  init: () => ({
    onFunctionRun({ ctx, fn, steps }) {
      const arrivedAt = Date.now();
      const arrivedAtMark = performance.now();
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

      let executionStartedAtMark: number | null = null;
      let step: string | null = null;
      let failed = false;

      return {
        beforeExecution() {
          executionStartedAtMark = performance.now();
        },
        transformOutput(output) {
          step = output.step?.displayName ?? null;
          failed = output.result.error !== undefined;
        },
        beforeResponse() {
          const finishedAt = Date.now();
          const finishedAtMark = performance.now();
          const eventTs = ctx.event.ts;
          const record = {
            function: fn.name,
            runId: ctx.runId,
            step,
            memoizedSteps: steps.length,
            executionMs:
              executionStartedAtMark === null
                ? null
                : finishedAtMark - executionStartedAtMark,
            invocationMs: finishedAtMark - arrivedAtMark,
            sinceEventMs:
              typeof eventTs === 'number' ? finishedAt - eventTs : null,
            coldStart,
            processAgeMs: arrivedAtMark - bootedAtMark,
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
