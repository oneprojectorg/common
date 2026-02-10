import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { TranslateBanner } from '../src/components/TranslateBanner';

const meta: Meta<typeof TranslateBanner> = {
  title: 'Components/TranslateBanner',
  component: TranslateBanner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    label: 'Traducir al espanol',
    onTranslate: () => {},
    onDismiss: () => {},
    isTranslating: false,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [isTranslating, setIsTranslating] = useState(false);
    return (
      <div className="w-full">
        <TranslateBanner
          {...args}
          isTranslating={isTranslating}
          onTranslate={() => setIsTranslating((prev) => !prev)}
        />
      </div>
    );
  },
};
