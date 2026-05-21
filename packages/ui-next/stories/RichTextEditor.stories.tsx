import type { Meta, StoryObj } from '@storybook/react-vite';

import { RichTextEditor, RichTextViewer } from '@/components/RichTextEditor';
import {
  defaultEditorExtensions,
  defaultViewerExtensions,
} from '@/components/RichTextEditor/editorConfig';

const meta: Meta<typeof RichTextEditor> = {
  title: 'shadcn/RichTextEditor',
  component: RichTextEditor,
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
type Story = StoryObj<typeof RichTextEditor>;

export const Editor: Story = {
  render: () => (
    <RichTextEditor
      content="<p>Edit me</p>"
      extensions={defaultEditorExtensions}
      editorClassName="prose min-h-32"
    />
  ),
};

export const Viewer: Story = {
  render: () => (
    <RichTextViewer
      content="<p>Read-only <strong>rich text</strong>.</p>"
      extensions={defaultViewerExtensions}
      editorClassName="prose max-w-none"
    />
  ),
};
