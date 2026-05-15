import {
  Buttons,
  ComparisonGrid,
  Feedback,
  Fields,
  Media,
  Navigation,
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
export const FieldsOnly: Story = { render: () => <Fields /> };
export const FeedbackOnly: Story = { render: () => <Feedback /> };
export const MediaOnly: Story = { render: () => <Media /> };
export const NavigationOnly: Story = { render: () => <Navigation /> };
