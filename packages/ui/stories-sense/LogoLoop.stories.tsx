import { LogoLoop } from '@op/sense/LogoLoop';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof LogoLoop> = {
  title: 'Sense/Composites/LogoLoop',
  component: LogoLoop,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof LogoLoop>;

const demoLogo = (label: string) => ({
  node: (
    <span className="flex h-8 items-center rounded border bg-muted px-4 text-sm text-muted-foreground">
      {label}
    </span>
  ),
  title: label,
});

export const Marquee: Story = {
  render: () => (
    <div className="w-full max-w-xl">
      <LogoLoop
        logos={['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map(demoLogo)}
        speed={60}
        gap={24}
        fadeOut
        ariaLabel="Partner logos"
      />
    </div>
  ),
};
