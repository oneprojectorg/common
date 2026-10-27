import { Button } from '@op/sense/Button';
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
const likers = 'Ada Lovelace, Grace Hopper, and 2 others';

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <LikeButton count={0} label="0 likes" />
      <LikeButton count={4} label="4 likes" tooltip={likers} />
      <LikeButton count={4} label="4 likes" tooltip={likers} isLiked />
    </div>
  ),
};

/**
 * How the pair sits under a post. The footer row is pulled back by the buttons'
 * own padding so the heart lines up with the text, and the buttons sit flush —
 * their padding is what separates them from the text and from each other.
 */
export const InPostFooter: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-2 leading-6">
      <p>It’s really hard to see people walking at night</p>
      <div className="-ms-2 flex items-center">
        <LikeButton count={1} label="1 like" tooltip={likers} isLiked />
        <CommentButton count={0} label="0 comments" />
      </div>
    </div>
  ),
};

/** Read-only viewers still see the count, but get no toggle. */
export const ReadOnly: Story = {
  render: () => (
    <LikeButton count={7} label="7 likes" tooltip={likers} canLike={false} />
  ),
};

/**
 * Pressing the heart changes the count, which slides to the new number (see
 * `AnimatedCount`) and is announced politely.
 */
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

/** The first like: the count goes 0 → 1 and a tooltip appears with it. */
export const FirstLike: Story = {
  render: function FirstLikeLikeButton() {
    const [liked, setLiked] = React.useState(false);
    const count = liked ? 1 : 0;

    return (
      <LikeButton
        count={count}
        label={count === 1 ? '1 like' : '0 likes'}
        isLiked={liked}
        tooltip={liked ? 'You' : undefined}
        onClick={() => setLiked((current) => !current)}
      />
    );
  },
};

/**
 * The count also moves when someone else likes the post: the viewer has not
 * pressed anything, so the slide and the live announcement are the only cues.
 */
export const LiveCount: Story = {
  render: function LiveCountLikeButton() {
    const [count, setCount] = React.useState(12);

    return (
      <div className="flex items-center gap-4">
        <LikeButton count={count} label={`${count} likes`} tooltip={likers} />
        <Button
          variant="link"
          size="sm"
          onClick={() => setCount((current) => current + 1)}
        >
          Someone else likes this
        </Button>
        <Button
          variant="link"
          size="sm"
          onClick={() => setCount((current) => Math.max(0, current - 1))}
        >
          Someone unlikes this
        </Button>
      </div>
    );
  },
};
