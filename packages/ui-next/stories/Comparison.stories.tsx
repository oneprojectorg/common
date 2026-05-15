import {
  Buttons,
  ComparisonGrid,
  Feedback,
  Forms,
  Inline,
  Media,
  Navigation,
  Overlays,
  Structure,
} from '@/comparison/Comparison';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Comparison/Old vs New vs Raw',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const Overview: Story = { render: () => <ComparisonGrid /> };
export const ButtonsOnly: Story = { render: () => <Buttons /> };
export const InlineOnly: Story = { render: () => <Inline /> };
export const FormsOnly: Story = { render: () => <Forms /> };
export const FeedbackOnly: Story = { render: () => <Feedback /> };
export const MediaOnly: Story = { render: () => <Media /> };
export const StructureOnly: Story = { render: () => <Structure /> };
export const NavigationOnly: Story = { render: () => <Navigation /> };
export const OverlaysOnly: Story = { render: () => <Overlays /> };
