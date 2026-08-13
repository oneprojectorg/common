import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@op/sense/Avatar';
import { getGradientForString } from '@op/styles/constants';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Avatar> = {
  title: 'Primitives/Avatar',
  component: Avatar,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
};

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
};

// The app renders letter fallbacks on a deterministic gradient hashed from
// the display name (see getGradientForString). The gradient utilities
// live in @op/styles, so the sense primitive stays unopinionated and the app
// composes them onto AvatarFallback — mirrored here.
export const GradientFallbacks: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {['Frida Kahlo', 'Mark Rothko', 'Sonia Delaunay', 'Lee Krasner'].map(
        (name) => (
          <Avatar key={name}>
            <AvatarFallback
              className={`${getGradientForString(name)} text-white`}
            >
              {name
                .split(' ')
                .map((part) => part[0])
                .join('')}
            </AvatarFallback>
          </Avatar>
        ),
      )}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar size="sm">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithBadge: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>CN</AvatarFallback>
      <AvatarBadge aria-label="Online" />
    </Avatar>
  ),
};

export const Group: Story = {
  render: () => (
    <AvatarGroup>
      {['MW', 'SD', 'CN'].map((initials) => (
        <Avatar key={initials}>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  ),
};
