import type { Meta, StoryObj } from '@storybook/react-vite';

import { TranslateBanner } from '@/components/TranslateBanner';

const meta: Meta<typeof TranslateBanner> = {
  title: 'shadcn/TranslateBanner',
  component: TranslateBanner,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TranslateBanner>;

export const Default: Story = {
  args: {
    label: 'Translate to English',
    onTranslate: () => console.log('translate'),
    onDismiss: () => console.log('dismiss'),
  },
};

export const Translating: Story = {
  args: {
    label: 'Translating…',
    isTranslating: true,
    onTranslate: () => {},
    onDismiss: () => {},
  },
};
