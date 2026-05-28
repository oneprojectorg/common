import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Buttons,
  ComparisonGrid,
  Feedback,
  Forms,
  Navigation,
  Overlays,
  Surfaces,
} from '../src/comparison/Comparison';

const meta: Meta = {
  title: 'Sense Comparison/Overview',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const All: Story = { render: () => <ComparisonGrid /> };
export const ButtonsSection: Story = {
  name: 'Buttons & toggles',
  render: () => <Buttons />,
};
export const FormsSection: Story = {
  name: 'Form inputs',
  render: () => <Forms />,
};
export const OverlaysSection: Story = {
  name: 'Overlays',
  render: () => <Overlays />,
};
export const NavigationSection: Story = {
  name: 'Navigation',
  render: () => <Navigation />,
};
export const SurfacesSection: Story = {
  name: 'Surfaces & layout',
  render: () => <Surfaces />,
};
export const FeedbackSection: Story = {
  name: 'Display & feedback',
  render: () => <Feedback />,
};
