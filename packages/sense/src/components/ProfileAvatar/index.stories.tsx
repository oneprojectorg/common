import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ProfileAvatar> = {
  title: 'Composites/ProfileAvatar',
  component: ProfileAvatar,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'default', 'lg'] },
  },
  args: {
    name: 'Ada Lovelace',
    alt: 'Ada Lovelace',
    size: 'default',
  },
};

export default meta;

type Story = StoryObj<typeof ProfileAvatar>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <ProfileAvatar name="Ada Lovelace" alt="Ada Lovelace" size="sm" />
      <ProfileAvatar name="Ada Lovelace" alt="Ada Lovelace" size="default" />
      <ProfileAvatar name="Ada Lovelace" alt="Ada Lovelace" size="lg" />
    </div>
  ),
};

// With no `src` the fallback derives an initial and a stable gradient from
// `name`, so the same person keeps the same colour everywhere in the app.
// Visually these are single letters, but each still announces its full `alt` —
// otherwise Katherine and Karen would both read as "K".
export const FallbackGradients: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {[
        'Ada Lovelace',
        'Grace Hopper',
        'Katherine Johnson',
        'Radia Perlman',
        'Karen Spärck Jones',
      ].map((name) => (
        <ProfileAvatar key={name} name={name} alt={name} />
      ))}
    </div>
  ),
};

export const WithImage: Story = {
  args: {
    src: 'https://i.pravatar.cc/128?img=47',
  },
};

// `alt` is required, and it names the avatar in both paths — it sits on the
// root as `aria-label`, so a missing or broken image still announces the
// person. Pass the person's name, never "avatar" or "profile picture", which
// tell a screen reader nothing the surrounding markup didn't already say.
export const AccessibleName: Story = {
  args: {
    src: 'https://i.pravatar.cc/128?img=12',
    name: 'Grace Hopper',
    alt: 'Grace Hopper',
  },
};
