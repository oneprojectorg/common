import { ModerationError } from '../../utils';
import { moderateTextContent } from './moderateTextContent';
import type { ModerationDecision, ModerationProvider } from './types';

/**
 * Runs the moderation gate and throws `ModerationError` if the content does not
 * pass, following the `assert*` convention: throws on failure, returns the
 * decision on success.
 *
 * @param content - The text to moderate
 * @param provider - Optional provider override (defaults to the configured one)
 * @throws ModerationError when the content is rejected
 */
export async function assertTextContentModerated(
  content: string,
  provider?: ModerationProvider,
): Promise<ModerationDecision> {
  const decision = await moderateTextContent(content, provider);

  if (!decision.passed) {
    throw new ModerationError();
  }

  return decision;
}
