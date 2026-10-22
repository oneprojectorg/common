import { TranslateLink } from '@op/sense/TranslateLink';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof TranslateLink> = {
  title: 'Composites/TranslateLink',
  component: TranslateLink,
  tags: ['autodocs'],
  args: {
    onTranslate: () => {},
    onShowOriginal: () => {},
    translatedNotice: 'Translated from Spanish',
  },
};

export default meta;

type Story = StoryObj<typeof TranslateLink>;

// Every state, each above the text it would translate.
export const States: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      {(['idle', 'translating', 'translated', 'failed'] as const).map(
        (status) => (
          <div key={status} className="flex flex-col gap-2">
            <TranslateLink {...args} status={status} />
            <p className="font-serif text-title">
              Huerta comunitaria en el parque central
            </p>
          </div>
        ),
      )}
    </div>
  ),
};

// Click through: translate, then back to the original.
export const Interactive: Story = {
  render: (args) => {
    const [status, setStatus] = useState<'idle' | 'translated'>('idle');
    return (
      <TranslateLink
        {...args}
        status={status}
        onTranslate={() => setStatus('translated')}
        onShowOriginal={() => setStatus('idle')}
      />
    );
  },
};

// Centered over a dark image, as on the decision overview banner.
export const InverseCentered: Story = {
  args: { status: 'idle', align: 'center', inverse: true },
  render: (args) => (
    <div className="flex flex-col gap-2 bg-foreground p-8 text-center">
      <TranslateLink {...args} />
      <p className="font-serif text-headline text-white">
        Presupuesto participativo
      </p>
    </div>
  ),
};
