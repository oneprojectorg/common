import { TranslateBanner } from '@op/sense/TranslateBanner';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof TranslateBanner> = {
  title: 'Composites/TranslateBanner',
  component: TranslateBanner,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof TranslateBanner>;

const Demo = () => {
  const [dismissed, setDismissed] = useState(false);
  const [translating, setTranslating] = useState(false);

  if (dismissed) {
    return (
      <button
        type="button"
        className="text-sm text-muted-foreground underline"
        onClick={() => setDismissed(false)}
      >
        Bring the banner back
      </button>
    );
  }

  return (
    <TranslateBanner
      label="Translate to English"
      tooltip="Translated automatically — may contain errors"
      isTranslating={translating}
      onTranslate={() => {
        setTranslating(true);
        setTimeout(() => setTranslating(false), 1200);
      }}
      onDismiss={() => setDismissed(true)}
    />
  );
};

export const Default: Story = {
  render: () => <Demo />,
};

export const Arabic: Story = {
  render: () => (
    <div dir="rtl">
      <TranslateBanner
        label="ترجمة إلى العربية"
        onTranslate={() => {}}
        onDismiss={() => {}}
      />
    </div>
  ),
};
