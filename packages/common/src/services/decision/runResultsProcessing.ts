import { processResults } from './processResults';

/** Run results processing for an instance that reached its final phase. Failures are logged, not thrown. */
export async function runResultsProcessing(
  processInstanceId: string,
): Promise<void> {
  try {
    const processingResult = await processResults({ processInstanceId });

    if (!processingResult.success) {
      console.error(
        `Results processing failed for process instance ${processInstanceId}:`,
        processingResult.error,
      );
    }
  } catch (error) {
    console.error(
      `Error processing results for process instance ${processInstanceId}:`,
      error,
    );
  }
}
