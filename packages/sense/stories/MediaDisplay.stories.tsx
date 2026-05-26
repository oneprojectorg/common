import type { Meta, StoryObj } from '@storybook/react-vite';

import { MediaDisplay } from '@/components/MediaDisplay';

const meta: Meta<typeof MediaDisplay> = {
  title: 'shadcn/MediaDisplay',
  component: MediaDisplay,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MediaDisplay>;

export const LinkPreview: Story = {
  args: {
    title: 'Cooperative governance handbook',
    site: 'example.org',
    description: 'A short overview of cooperative governance principles.',
    url: 'https://example.org',
  },
};

export const Pdf: Story = {
  args: {
    title: 'minutes-q3.pdf',
    mimeType: 'application/pdf',
    size: 247000,
    url: 'https://example.org/minutes-q3.pdf',
  },
};

export const WithImage: Story = {
  render: () => (
    <MediaDisplay
      title="cover.jpg"
      mimeType="image/jpeg"
      url="https://placehold.co/640x360"
    >
      <img
        src="https://placehold.co/640x360"
        alt="Placeholder"
        className="w-full"
      />
    </MediaDisplay>
  ),
};
