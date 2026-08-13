import {
  GradientHeader,
  Header1,
  Header2,
  Header3,
  Header4,
} from '@op/sense/Header';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Header1> = {
  title: 'Composites/Header',
  component: Header1,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Header1>;

// Serif headings on the sense semantic scale — sizes are responsive
// (display 24→48, headline 20→30, title 18→20 at the md breakpoint).
export const Scale: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Header1>Display — community decisions</Header1>
      <Header2>Headline — open proposals</Header2>
      <Header3>Title — voting closes Friday</Header3>
      <Header4>Label — 12 members participating</Header4>
    </div>
  ),
};

// dir defaults to auto, so Arabic content right-aligns on its own.
export const AutoDirection: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-4">
      <Header2>Budget 2027</Header2>
      <Header2>ميزانية ٢٠٢٧</Header2>
    </div>
  ),
};

export const Gradient: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <GradientHeader>Common Sense</GradientHeader>
      <GradientHeader gradient="bg-redTeal">Common Sense</GradientHeader>
      <GradientHeader gradient="bg-blueGreen">Common Sense</GradientHeader>
    </div>
  ),
};
