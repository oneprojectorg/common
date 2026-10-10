'use client';

import { useDecisionTranslateLink } from './DecisionTranslationContext';
import { TranslateLink } from './TranslateLink';

/**
 * The process's "See translation" link, centered above a banner header (the
 * overview hero, the phase hero). Every placement drives the same state, so
 * the overview, phase copy, phase names and resources translate together.
 */
export const DecisionTranslateLink = ({
  hasImage = false,
}: {
  /** The banner sits over an image, so its text is white. */
  hasImage?: boolean;
}) => {
  const link = useDecisionTranslateLink();
  return link ? (
    <TranslateLink translation={link} align="center" inverse={hasImage} />
  ) : null;
};
