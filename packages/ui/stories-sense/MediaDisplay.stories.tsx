import { MediaDisplay } from '@op/sense/MediaDisplay';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof MediaDisplay> = {
  title: 'Sense/Composites/MediaDisplay',
  component: MediaDisplay,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof MediaDisplay>;

export const Pdf: Story = {
  render: () => (
    <div className="w-96">
      <MediaDisplay
        title="Community garden proposal"
        mimeType="application/pdf"
        size={1_240_000}
        url="#"
      >
        <div className="flex h-32 items-center justify-center bg-muted text-sm text-muted-foreground">
          PDF preview
        </div>
      </MediaDisplay>
    </div>
  ),
};

export const LinkPreview: Story = {
  render: () => (
    <div className="w-96">
      <MediaDisplay
        title="Community Tool Library"
        site="example.org"
        description="A shared collection of tools members can borrow instead of buying — drills, saws, ladders, and more."
        url="https://example.org/tool-library"
      />
    </div>
  ),
};
