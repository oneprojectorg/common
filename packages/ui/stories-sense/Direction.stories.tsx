import { DirectionProvider } from '@op/sense/Direction';
import { Progress, ProgressLabel, ProgressValue } from '@op/sense/Progress';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof DirectionProvider> = {
  title: 'Sense/Direction',
  component: DirectionProvider,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof DirectionProvider>;

// DirectionProvider renders nothing itself — it tells Base UI components
// which direction to lay out in, while the `dir` attribute on the wrapper
// flips the CSS.
export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <DirectionProvider direction="ltr">
        <div dir="ltr" className="w-80">
          <Progress value={66}>
            <ProgressLabel>Uploading files</ProgressLabel>
            <ProgressValue />
          </Progress>
        </div>
      </DirectionProvider>
      <DirectionProvider direction="rtl">
        <div dir="rtl" className="w-80">
          <Progress value={66}>
            <ProgressLabel>جارٍ رفع الملفات</ProgressLabel>
            <ProgressValue />
          </Progress>
        </div>
      </DirectionProvider>
    </div>
  ),
};
