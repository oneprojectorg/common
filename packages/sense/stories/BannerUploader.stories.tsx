import type { Meta, StoryObj } from '@storybook/react-vite';

import { BannerUploader } from '@/components/BannerUploader';

const meta: Meta<typeof BannerUploader> = {
  title: 'shadcn/BannerUploader',
  component: BannerUploader,
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
type Story = StoryObj<typeof BannerUploader>;

export const Empty: Story = { args: { label: 'Banner image' } };
export const WithImage: Story = {
  args: { label: 'Banner image', value: 'https://placehold.co/1024x440' },
};
export const Uploading: Story = {
  args: { label: 'Uploading…', uploading: true },
};
export const Error: Story = {
  args: { label: 'Banner', error: 'File too large' },
};
