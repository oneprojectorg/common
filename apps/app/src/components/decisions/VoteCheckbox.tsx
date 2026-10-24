'use client';

import { Checkbox } from '@op/sense/Checkbox';
import { RankCheckbox } from '@op/sense/RankCheckbox';
import type { ComponentProps } from 'react';

/** The ballot toggle on a card: a round checkbox, numbered on a ranked vote. */
export const VoteCheckbox = ({
  ranked,
  rank,
  ...props
}: ComponentProps<typeof RankCheckbox> & { ranked: boolean }) => {
  // One component for the whole ranked vote, so picking doesn't remount it.
  if (ranked) {
    return <RankCheckbox rank={rank} {...props} />;
  }

  // TODO(sense-migration): sense Checkbox has no shape="circle"/borderColor;
  // approximated with rounded-full — revisit against Figma vote design.
  return <Checkbox {...props} className="rounded-full" />;
};
