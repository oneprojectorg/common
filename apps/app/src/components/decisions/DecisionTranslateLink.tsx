'use client';

import { useDecisionTranslateLink } from './DecisionTranslationContext';
import { TranslateLink } from './TranslateLink';

/** The process's link, centered above the overview and phase heroes. */
export const DecisionTranslateLink = ({
  hasImage = false,
}: {
  hasImage?: boolean;
}) => {
  const link = useDecisionTranslateLink();
  return link ? (
    <TranslateLink translation={link} align="center" inverse={hasImage} />
  ) : null;
};
