/**
 * Absent = allowed: defaulting to false would retire comments on every process
 * configured before the toggle existed. Takes `unknown` because the domain
 * type, the API encoder and the raw jsonb column all reach here.
 */
export function areCommentsAllowed(instanceData: unknown): boolean {
  if (
    instanceData === null ||
    typeof instanceData !== 'object' ||
    !('config' in instanceData)
  ) {
    return true;
  }

  const { config } = instanceData;
  if (
    config === null ||
    typeof config !== 'object' ||
    !('allowComments' in config)
  ) {
    return true;
  }

  const { allowComments } = config;

  return typeof allowComments === 'boolean' ? allowComments : true;
}
