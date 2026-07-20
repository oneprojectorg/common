import {
  RichTextEditor,
  RichTextEditorSkeleton,
  RichTextViewer,
} from '@op/sense/RichTextEditor';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof RichTextEditor> = {
  title: 'Sense/Composites/RichTextEditor',
  component: RichTextEditor,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof RichTextEditor>;

const sampleContent = `
  <h2>Community garden fund</h2>
  <p>Shared beds, a <strong>seed library</strong>, and weekend workshops
  for the whole neighborhood. See the <a href="#">full budget</a>.</p>
  <ul>
    <li>Raised beds for 40 households</li>
    <li>Tool shed and compost site</li>
  </ul>
`;

export const Editor: Story = {
  render: () => (
    <RichTextEditor
      className="min-h-48 w-full max-w-xl rounded-lg border p-4"
      content={sampleContent}
      placeholder="Write your proposal…"
    />
  ),
};

export const EmptyWithPlaceholder: Story = {
  render: () => (
    <RichTextEditor
      className="min-h-32 w-full max-w-xl rounded-lg border p-4"
      placeholder="Write your proposal…"
    />
  ),
};

export const Viewer: Story = {
  render: () => <RichTextViewer className="max-w-xl" content={sampleContent} />,
};

export const Skeleton: Story = {
  render: () => <RichTextEditorSkeleton className="max-w-xl" />,
};
