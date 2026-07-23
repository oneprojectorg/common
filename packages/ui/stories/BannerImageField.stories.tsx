import type { Meta, StoryObj } from '@storybook/react';

import { BannerImageField } from '../src/components/BannerImageField';

const SAMPLE_IMAGE = 'https://picsum.photos/1200/400';

const copy = {
  label: 'Banner image',
  title: 'Legacy/Upload banner image',
  description: 'PNG, JPG, WebP or GIF · recommended 2400×800px · max 25MB',
  helperText:
    'The headline appears centered over a dark overlay. Avoid images with key subjects in the middle.',
  chooseFile: 'Choose file',
  remove: 'Remove image',
};

const meta: Meta<typeof BannerImageField> = {
  title: 'BannerImageField',
  component: BannerImageField,
  tags: ['autodocs'],
  args: {
    copy,
    onSelectFile: (file: File) => console.log('selected', file.name),
    onRemove: () => console.log('remove'),
  },
  argTypes: {
    uploading: { control: 'boolean' },
    value: { control: 'text' },
    aspectClassName: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div className="w-[28rem] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof BannerImageField>;

// No image chosen yet — icon + title + specs + "Choose file".
export const Empty: Story = {};

// A stored image — preview + filename · size + remove button.
export const Filled: Story = {
  args: {
    value: SAMPLE_IMAGE,
    fileName: 'community-hero.jpg',
    fileSizeLabel: '1.8 MB',
  },
};

// Upload in flight: preview dims and a spinner overlays it.
export const Uploading: Story = {
  args: {
    value: SAMPLE_IMAGE,
    fileName: 'community-hero.jpg',
    fileSizeLabel: '1.8 MB',
    uploading: true,
  },
};

export const WithError: Story = {
  args: {
    error:
      'That file type is not supported. Accepted types: PNG, JPEG, WEBP, GIF',
  },
};

// Callers can override the preview box shape (e.g. a wider phase banner).
export const CustomAspect: Story = {
  args: {
    value: SAMPLE_IMAGE,
    fileName: 'phase-banner.jpg',
    fileSizeLabel: '900 KB',
    aspectClassName: 'aspect-[16/9]',
  },
};

// The app injects an optimized element (here a bordered <img> stand-in for
// next/image). Transient blob:/data: URLs still fall back to a plain <img>.
export const WithRenderPreview: Story = {
  args: {
    value: SAMPLE_IMAGE,
    fileName: 'community-hero.jpg',
    fileSizeLabel: '1.8 MB',
    renderPreview: ({ src, className }) => (
      <img
        src={src}
        alt=""
        className={`${className} ring-2 ring-primary-teal`}
      />
    ),
  },
};
