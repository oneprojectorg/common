import { OPURLConfig } from '@op/core';

export const buildDecisionUpdateUrl = (processProfileSlug: string) =>
  `${OPURLConfig('APP').ENV_URL}/decisions/${processProfileSlug}?panel=updates`;
