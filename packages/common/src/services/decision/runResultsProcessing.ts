import { processResults } from './processResults';

/** Run results processing for an instance that reached its final phase. Failures are logged, not thrown. */
export async function runResultsProcessing({
  instanceId,
}: {
  instanceId: string;
}): Promise<void> {
  try {
    await processResults({ processInstanceId: instanceId });
  } catch (error) {
    console.error(
      `Error processing results for process instance ${instanceId}:`,
      error,
    );
  }
}
