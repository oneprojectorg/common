import { logger } from '@op/logging';

const STATES = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);

export const parseFeatureFlagOverrides = (
  value: string | undefined,
): Map<string, boolean> =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((overrides, entry) => {
      const [key = '', state = ''] = entry
        .split(':')
        .map((part) => part.trim());
      const parsed = STATES.get(state);
      if (!key || parsed === undefined) {
        logger.warn('Ignoring a malformed FEATURE_FLAG_OVERRIDES entry', {
          entry,
        });
        return overrides;
      }
      return overrides.set(key, parsed);
    }, new Map<string, boolean>());
