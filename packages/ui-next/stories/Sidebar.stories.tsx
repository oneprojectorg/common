import type { Meta, StoryObj } from '@storybook/react-vite';

import { Sidebar, SidebarLayout, SidebarProvider, SidebarTrigger } from '@/components/Sidebar';

const meta: Meta = {
  title: 'shadcn/Sidebar',
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <SidebarProvider defaultOpen>
      <SidebarLayout>
        <Sidebar label="Navigation">
          <nav className="flex flex-col gap-1 p-4">
            <a href="#" className="hover:bg-muted rounded p-2 text-sm">
              Home
            </a>
            <a href="#" className="hover:bg-muted rounded p-2 text-sm">
              Decisions
            </a>
            <a href="#" className="hover:bg-muted rounded p-2 text-sm">
              Profile
            </a>
          </nav>
        </Sidebar>
        <main className="flex-1 p-6">
          <SidebarTrigger aria-label="Toggle menu" />
          <h1 className="mt-4 text-lg font-medium">Main content</h1>
        </main>
      </SidebarLayout>
    </SidebarProvider>
  ),
};
