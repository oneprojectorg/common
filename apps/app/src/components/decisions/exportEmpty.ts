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
  if (rejectedCount === undefined) {
    return !errored;
  }
  return rejectedCount === 0;
};
