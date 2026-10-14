/**
 * Decides whether the export has nothing to hand over, so its button can be
 * disabled.
 *
 * The list leaves rejected proposals out, but the export includes them. A list
 * that counts nothing is therefore only empty once the phase's rejected count
 * has also come back as zero.
 *
 * This lives apart from the component so a test can drive it directly, as
 * `exportRetry` does: `apps/app` supports no component test.
 *
 * @param isListEmpty - The list counts nothing.
 * @param rejectedCount - The phase's rejected proposals. Undefined until the
 *   count has answered.
 * @param errored - The rejected count could not be read.
 */
export const isExportEmpty = ({
  isListEmpty,
  rejectedCount,
  errored,
}: {
  isListEmpty: boolean;
  rejectedCount: number | undefined;
  errored: boolean;
}): boolean => {
  if (!isListEmpty) {
    return false;
  }
  // Pending reads as empty, so the button never enables ahead of the answer.
  if (rejectedCount === undefined) {
    // A read that failed with no answer to fall back on would leave the button
    // disabled with no reason given, when the export can still run.
    return !errored;
  }
  return rejectedCount === 0;
};
