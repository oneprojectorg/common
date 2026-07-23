import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@op/sense/Resizable';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof ResizablePanelGroup> = {
  title: 'Sense/Primitives/Resizable',
  component: ResizablePanelGroup,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ResizablePanelGroup>;

export const Horizontal: Story = {
  render: () => (
    <div className="h-60 w-full max-w-lg">
      <ResizablePanelGroup className="rounded-lg border">
        <ResizablePanel defaultSize={50}>
          <PanelBody>One</PanelBody>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50}>
          <PanelBody>Two</PanelBody>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="h-80 w-full max-w-lg">
      <ResizablePanelGroup orientation="vertical" className="rounded-lg border">
        <ResizablePanel defaultSize={30}>
          <PanelBody>Header</PanelBody>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={70}>
          <PanelBody>Content</PanelBody>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};

export const WithHandle: Story = {
  render: () => (
    <div className="h-60 w-full max-w-lg">
      <ResizablePanelGroup className="rounded-lg border">
        <ResizablePanel defaultSize={25}>
          <PanelBody>Sidebar</PanelBody>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75}>
          <PanelBody>Content</PanelBody>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};

export const ThreePanels: Story = {
  render: () => (
    <div className="h-60 w-full max-w-lg">
      <ResizablePanelGroup className="rounded-lg border">
        <ResizablePanel defaultSize={25}>
          <PanelBody>One</PanelBody>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50}>
          <PanelBody>Two</PanelBody>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={25}>
          <PanelBody>Three</PanelBody>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};

function PanelBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center">{children}</div>
  );
}
