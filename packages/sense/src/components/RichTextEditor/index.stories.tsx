import { Header2 } from '@op/sense/Header';
import {
  RichTextEditor,
  RichTextEditorSkeleton,
  RichTextViewer,
} from '@op/sense/RichTextEditor';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof RichTextEditor> = {
  title: 'Composites/RichTextEditor',
  component: RichTextEditor,
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

/** An editor named by a visible heading, for a section edited where it sits. */
export const NamedByHeading: Story = {
  render: () => (
    <section className="flex w-full max-w-xl flex-col gap-3">
      <Header2 id="about-heading" className="text-label">
        About the process
      </Header2>
      <RichTextEditor
        className="min-h-32 rounded-lg border p-4"
        content={sampleContent}
        ariaLabelledBy="about-heading"
      />
    </section>
  ),
};

export const Viewer: Story = {
  render: () => <RichTextViewer className="max-w-xl" content={sampleContent} />,
};

export const Skeleton: Story = {
  render: () => <RichTextEditorSkeleton className="max-w-xl" />,
};
