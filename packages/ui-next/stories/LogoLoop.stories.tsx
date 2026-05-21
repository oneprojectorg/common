import type { Meta, StoryObj } from '@storybook/react-vite';

import { LogoLoop } from '@/components/LogoLoop';

const meta: Meta<typeof LogoLoop> = {
  title: 'shadcn/LogoLoop',
  component: LogoLoop,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="w-full p-6">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LogoLoop>;

const logos = [
  'Acme',
  'Globex',
  'Initech',
  'Hooli',
  'Stark Industries',
  'Wayne Enterprises',
].map((label) => ({
  node: (
    <div className="text-muted-foreground px-6 text-sm font-medium">
      {label}
    </div>
  ),
  ariaLabel: label,
}));

export const Default: Story = {
  args: { logos, logoHeight: 32, gap: 32, pauseOnHover: true },
};
