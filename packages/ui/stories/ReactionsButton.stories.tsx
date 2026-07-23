import { useState } from 'react';

import { ReactionsButton } from '../src/components/ReactionsButton';

export default {
  title: 'Legacy/ReactionsButton',
  component: ReactionsButton,
  parameters: {
    layout: 'centered',
  },
};

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🙏', '🎉', '🔥'] as const;

const Interactive = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const addReaction = (emoji: string) => {
    setCounts((current) => ({
      ...current,
      [emoji]: (current[emoji] ?? 0) + 1,
    }));
  };

  const reactions = REACTION_EMOJIS.filter((emoji) => counts[emoji]).map(
    (emoji) => ({ emoji, count: counts[emoji]! }),
  );

  return (
    <ReactionsButton
      reactions={reactions}
      onAddReaction={addReaction}
      onReactionClick={addReaction}
    />
  );
};

export const Empty = () => <Interactive />;

export const WithReactions = () => (
  <ReactionsButton
    reactions={[
      { emoji: '👍', count: 3 },
      { emoji: '🔥', count: 1 },
    ]}
    onAddReaction={() => {}}
    onReactionClick={() => {}}
  />
);
