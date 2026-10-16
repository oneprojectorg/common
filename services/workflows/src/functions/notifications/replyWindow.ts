const MIN_WAIT_MS = 1_000;

export const remainingReplyWindow = (
  deadline: number,
  now: number = Date.now(),
): number => Math.max(MIN_WAIT_MS, deadline - now);
