import { RichTextEditor, RichTextViewer } from '@op/sense/RichTextEditor';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import {
  RichTextEditor as OldRichTextEditor,
  RichTextViewer as OldRichTextViewer,
} from '../../src/components/RichTextEditor';

// Straight copy port — same tiptap extension set and public API; only the
// package (and eventually the token context) changes.

const meta: Meta = {
  title: 'Sense Comparison/Composites/RichTextEditor',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const content = `
  <h3>Weekend workshops</h3>
  <p>Composting, <strong>seed saving</strong>, and tool care with the
  <a href="#">Greenway circle</a>.</p>
`;

export const RichTextEditorComparison: Story = {
  name: 'RichTextEditor',
  render: () => (
    <div className="p-8">
      <Section title="RichTextEditor">
        <Pair
          label="Editor"
          old={
            <OldRichTextEditor
              className="min-h-32 w-full rounded-lg border p-3"
              content={content}
            />
          }
          raw={
            <RichTextEditor
              className="min-h-32 w-full rounded-lg border p-3"
              content={content}
            />
          }
        />
        <Pair
          label="Viewer"
          old={<OldRichTextViewer content={content} />}
          raw={<RichTextViewer content={content} />}
        />
      </Section>
    </div>
  ),
};
