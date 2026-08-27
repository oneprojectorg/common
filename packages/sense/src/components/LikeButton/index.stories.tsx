import { CommentButton } from '@op/sense/CommentButton';
import { LikeButton } from '@op/sense/LikeButton';
import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

const meta: Meta<typeof LikeButton> = {
  title: 'Composites/LikeButton',
  component: LikeButton,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof LikeButton>;

// The app composes this with `Intl.ListFormat` and a translated overflow
// string; the component only ever receives the finished node.
const likers = 'Ada Lovelace, Grace Hopper and 2 others';

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <LikeButton count={0} label="0 likes" />
      <LikeButton count={4} label="4 likes" tooltip={likers} />
      <LikeButton count={4} label="4 likes" tooltip={likers} isLiked />
      <LikeButton count={12} label="١٢ إعجابًا" />
    </div>
  ),
};

/** How the pair sits in a post footer — like at the start, comments at the end. */
export const InPostFooter: Story = {
  render: () => (
    <div className="flex w-96 items-center justify-between gap-2">
      <LikeButton count={4} label="4 likes" tooltip={likers} />
      <CommentButton count={2} label="2 comments" />
    </div>
  ),
};

/** Read-only viewers still see the count, but get no toggle. */
export const ReadOnly: Story = {
  render: () => (
    <LikeButton count={7} label="7 likes" tooltip={likers} canLike={false} />
  ),
};

export const Interactive: Story = {
  render: function InteractiveLikeButton() {
    const [liked, setLiked] = React.useState(false);
    const count = liked ? 4 : 3;

    return (
      <LikeButton
        count={count}
        label={`${count} likes`}
        isLiked={liked}
        tooltip={likers}
        onClick={() => setLiked((current) => !current)}
      />
    );
  },
};
