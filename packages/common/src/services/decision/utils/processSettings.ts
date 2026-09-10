/**
 * Process-level settings resolution: `instanceData.config.*` → defaults. The
 * process-wide counterpart to `phaseSettings`; consumers go through these
 * helpers rather than reading `config` directly.
 *
 * Takes `unknown` because the domain type, the API-encoder `InstanceData`, and
 * the raw jsonb column all reach these helpers — same reason `getInstancePhases`
 * does. The narrowing happens once, here, instead of an assertion per caller.
 */

/**
 * Participants may comment in this process — the Process Builder's "Allow
 * comments" toggle. Gates the comment surfaces AND the write itself (see
 * `assertPostWriteAccess`), so both read the same rule.
 *
 * Absent = allowed. Every process configured before this toggle existed has
 * working comments, and defaulting to `false` would retire all of them at once.
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
