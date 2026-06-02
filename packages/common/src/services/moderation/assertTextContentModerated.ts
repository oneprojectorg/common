import { ModerationError } from '../../utils';
import { moderateTextContent } from './moderateTextContent';
import type { ModerationDecision, ModerationProvider } from './types';

/**
 * Runs the moderation gate and throws if the content does not pass, following
 * the `assert*` convention: throws on failure, returns the decision on success.
 *
 * @param content - The text to moderate
 * @param error - Custom error to throw on rejection (defaults to ModerationError)
 * @param provider - Optional provider override
 * @throws The provided error or ModerationError when the content is rejected
 */
export async function assertTextContentModerated(
  content: string,
  error: Error = new ModerationError(),
  provider?: ModerationProvider,
): Promise<ModerationDecision> {
  const decision = provider
    ? await moderateTextContent(content, provider)
    : await moderateTextContent(content);

  if (!decision.passed) {
    throw error;
  }

  return decision;
}
