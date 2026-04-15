import type { OnPhaseAdvancedInput } from './onPhaseAdvanced';
import { processResults } from './processResults';

/** Run results processing for an instance that reached its final phase. Failures are logged, not thrown. */
export async function runResultsProcessing(
  input: OnPhaseAdvancedInput,
): Promise<void> {
  try {
    const processingResult = await processResults({
      processInstanceId: input.instanceId,
    });

    if (!processingResult.success) {
      console.error(
        `Results processing failed for process instance ${input.instanceId}:`,
        processingResult.error,
      );
    }
  } catch (error) {
    console.error(
      `Error processing results for process instance ${input.instanceId}:`,
      error,
    );
  }
}
